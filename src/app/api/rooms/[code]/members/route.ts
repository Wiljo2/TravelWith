import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { requireMember, requireUser } from "@/server/auth";
import { HttpError, errorResponse, roomCodeParam } from "@/server/http";
import { joinRoom, leaveRoom } from "@/server/members";

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
// Only members can leave: anyone else gets 404 and nothing is touched.
export async function DELETE(req: Request, { params }: { params: Params }) {
  try {
    const code = roomCodeParam((await params).code);
    const user = await requireUser(req);
    const result = await leaveRoom(code, user.id);
    if (!result.left) throw new HttpError(404, "No eres miembro de este viaje");
    return NextResponse.json({ ok: true, roomDeleted: !!result.roomDeleted });
  } catch (e) {
    return errorResponse(e, "DELETE /api/rooms/[code]/members");
  }
}

// POST /api/rooms/[code]/members — join the room as a member: adds the
// user↔room relation and the roster entry, bumping last_active_at so the
// client can auto-resume the user's most recent trip. Idempotent; an existing
// role is never changed, and the role is never taken from the request.
export async function POST(req: Request, { params }: { params: Params }) {
  try {
    const code = roomCodeParam((await params).code);
    const user = await requireUser(req);
    const result = await joinRoom(code, user, "member");
    if (!result.joined) throw new HttpError(404, "Sala no encontrada");
    return NextResponse.json({ ok: true, role: result.role });
  } catch (e) {
    return errorResponse(e, "POST /api/rooms/[code]/members");
  }
}
