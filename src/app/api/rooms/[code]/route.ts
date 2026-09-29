import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { validateRoomPayload } from "@/lib/validate";
import { persistRoom } from "@/server/trip-store";
import { requireMember } from "@/server/auth";
import { HttpError, errorResponse, roomCodeParam } from "@/server/http";

type Params = Promise<{ code: string }>;

export async function GET(req: Request, { params }: { params: Params }) {
  try {
    const code = roomCodeParam((await params).code);
    await requireMember(req, code);

    const { data, error } = await createServerClient()
      .from("rooms")
      .select("code, payload, members, updated_at")
      .eq("code", code)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new HttpError(404, "Sala no encontrada");
    return NextResponse.json(data);
  } catch (e) {
    return errorResponse(e, "GET /api/rooms/[code]");
  }
}

// DELETE /api/rooms/[code] — hard-delete the trip for EVERYONE. Owner only.
// The normal flow is leaving via DELETE /members (last one out deletes the room).
export async function DELETE(req: Request, { params }: { params: Params }) {
  try {
    const code = roomCodeParam((await params).code);
    await requireMember(req, code, "owner");
    const supabase = createServerClient();

    const { error: membershipsError } = await supabase.from("user_rooms").delete().eq("room_code", code);
    if (membershipsError) throw membershipsError;

    const { error } = await supabase.from("rooms").delete().eq("code", code);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e, "DELETE /api/rooms/[code]");
  }
}

// PATCH /api/rooms/[code] — save the full payload.
// Optional optimistic concurrency: when the client sends `expectedUpdatedAt`
// and it doesn't match the stored row, respond 409 with the current server
// state instead of overwriting a newer save from another member.
export async function PATCH(req: Request, { params }: { params: Params }) {
  try {
    const code = roomCodeParam((await params).code);
    await requireMember(req, code);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new HttpError(400, "Payload inválido");
    }

    const { expectedUpdatedAt, ...rest } = (body ?? {}) as Record<string, unknown>;
    const payload = validateRoomPayload(rest);
    if (!payload) throw new HttpError(400, "Payload inválido");

    if (typeof expectedUpdatedAt === "string") {
      const { data: current, error } = await createServerClient()
        .from("rooms")
        .select("payload, updated_at")
        .eq("code", code)
        .maybeSingle();

      if (error) throw error;
      if (!current) throw new HttpError(404, "Sala no encontrada");

      if (current.updated_at !== expectedUpdatedAt) {
        return NextResponse.json(
          { error: "Conflicto de versión", payload: current.payload, updated_at: current.updated_at },
          { status: 409 },
        );
      }
    }

    const updatedAt = await persistRoom(code, payload);
    return NextResponse.json({ ok: true, updated_at: updatedAt });
  } catch (e) {
    return errorResponse(e, "PATCH /api/rooms/[code]");
  }
}
