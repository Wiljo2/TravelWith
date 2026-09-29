import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { requireMember, requireUser } from "@/server/auth";
import { HttpError, errorResponse, roomCodeParam } from "@/server/http";
import type { RoomMember } from "@/types";

type Params = Promise<{ code: string }>;

// GET /api/rooms/[code]/members — list members of a room (members only)
export async function GET(req: Request, { params }: { params: Params }) {
  try {
    const code = roomCodeParam((await params).code);
    await requireMember(req, code);

    const { data, error } = await createServerClient()
      .from("rooms")
      .select("members")
      .eq("code", code)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new HttpError(404, "Sala no encontrada");
    return NextResponse.json(data.members ?? []);
  } catch (e) {
    return errorResponse(e, "GET /api/rooms/[code]/members");
  }
}

// DELETE /api/rooms/[code]/members — leave the trip (remove it from MY view).
// Collaborative model: leaving never destroys the trip for the others; it also
// removes the user from the display members list so they stop counting in the
// per-person budget. When the LAST member leaves, the room itself is deleted.
export async function DELETE(req: Request, { params }: { params: Params }) {
  try {
    const code = roomCodeParam((await params).code);
    const user = await requireUser(req);
    const supabase = createServerClient();

    const { error } = await supabase
      .from("user_rooms")
      .delete()
      .eq("user_id", user.id)
      .eq("room_code", code);
    if (error) throw error;

    const { data: room } = await supabase
      .from("rooms")
      .select("members")
      .eq("code", code)
      .maybeSingle();

    if (room) {
      const members: RoomMember[] = (room.members ?? []).filter((m: RoomMember) => m.userId !== user.id);
      await supabase.from("rooms").update({ members }).eq("code", code);
    }

    const { count } = await supabase
      .from("user_rooms")
      .select("*", { count: "exact", head: true })
      .eq("room_code", code);

    if ((count ?? 0) === 0) {
      await supabase.from("rooms").delete().eq("code", code);
      return NextResponse.json({ ok: true, roomDeleted: true });
    }

    return NextResponse.json({ ok: true, roomDeleted: false });
  } catch (e) {
    return errorResponse(e, "DELETE /api/rooms/[code]/members");
  }
}

// POST /api/rooms/[code]/members — join the room: add to the display roster
// (rooms.members) and upsert the user↔room relation (user_rooms), bumping
// last_active_at so the client can auto-resume the user's most recent trip.
// Idempotent: re-entering an existing membership only bumps last_active_at —
// it never downgrades an existing role.
export async function POST(req: Request, { params }: { params: Params }) {
  try {
    const code = roomCodeParam((await params).code);
    const user = await requireUser(req);

    let role: "owner" | "member" = "member";
    try {
      const body = await req.json();
      if (body?.role === "owner") role = "owner";
    } catch {
      // No body sent — default role "member" (the common case: joining by code).
    }

    const supabase = createServerClient();

    const { data: room, error: fetchError } = await supabase
      .from("rooms")
      .select("members")
      .eq("code", code)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!room) throw new HttpError(404, "Sala no encontrada");

    const members: RoomMember[] = room.members ?? [];
    if (!members.some((m) => m.userId === user.id)) {
      const newMember: RoomMember = {
        userId: user.id,
        name: String(user.user_metadata?.full_name ?? user.email ?? "Usuario"),
        avatar: user.user_metadata?.avatar_url as string | undefined,
        joinedAt: new Date().toISOString(),
      };
      const { error: updateError } = await supabase
        .from("rooms")
        .update({ members: [...members, newMember] })
        .eq("code", code);
      if (updateError) throw updateError;
    }

    const nowIso = new Date().toISOString();
    const { data: existingUserRoom } = await supabase
      .from("user_rooms")
      .select("role")
      .eq("user_id", user.id)
      .eq("room_code", code)
      .maybeSingle();

    if (existingUserRoom) {
      const { error: touchError } = await supabase
        .from("user_rooms")
        .update({ last_active_at: nowIso })
        .eq("user_id", user.id)
        .eq("room_code", code);
      if (touchError) throw touchError;
    } else {
      const { error: insertError } = await supabase
        .from("user_rooms")
        .insert({ user_id: user.id, room_code: code, role, last_active_at: nowIso });
      if (insertError) throw insertError;
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e, "POST /api/rooms/[code]/members");
  }
}
