import { NextResponse } from "next/server";
import { createServerClient, getUserFromToken } from "@/lib/supabase-server";
import { normalizeRoomCode } from "@/lib/validate";
import type { RoomMember } from "@/types";

type Params = Promise<{ code: string }>;

// GET /api/rooms/[code]/members — list members of a room
export async function GET(_req: Request, { params }: { params: Params }) {
  const code = normalizeRoomCode((await params).code);
  if (!code) return NextResponse.json({ error: "Código inválido" }, { status: 400 });
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("rooms")
    .select("members")
    .eq("code", code)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Sala no encontrada" }, { status: 404 });

  return NextResponse.json(data.members ?? []);
}

// DELETE /api/rooms/[code]/members — leave the trip (remove it from MY view).
// Collaborative model: leaving never destroys the trip for the others; it also
// removes the user from the display members list so they stop counting in the
// per-person budget. When the LAST member leaves, the room itself is deleted.
export async function DELETE(req: Request, { params }: { params: Params }) {
  const code = normalizeRoomCode((await params).code);
  if (!code) return NextResponse.json({ error: "Código inválido" }, { status: 400 });

  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const user = await getUserFromToken(token);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const supabase = createServerClient();

  const { error } = await supabase
    .from("user_rooms")
    .delete()
    .eq("user_id", user.id)
    .eq("room_code", code);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

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
}

// POST /api/rooms/[code]/members — join the room: add to the display roster
// (rooms.members) and upsert the user↔room relation (user_rooms), bumping
// last_active_at so the client can auto-resume the user's most recent trip.
// Idempotent: re-entering an existing membership only bumps last_active_at —
// it never downgrades an existing role.
export async function POST(req: Request, { params }: { params: Params }) {
  const code = normalizeRoomCode((await params).code);
  if (!code) return NextResponse.json({ error: "Código inválido" }, { status: 400 });

  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const user = await getUserFromToken(token);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

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

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!room) return NextResponse.json({ error: "Sala no encontrada" }, { status: 404 });

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
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
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
    if (touchError) return NextResponse.json({ error: touchError.message }, { status: 500 });
  } else {
    const { error: insertError } = await supabase
      .from("user_rooms")
      .insert({ user_id: user.id, room_code: code, role, last_active_at: nowIso });
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
