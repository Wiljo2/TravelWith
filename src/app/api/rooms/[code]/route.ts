import { NextResponse } from "next/server";
import { requireMember } from "@/server/auth";
import { deleteRoom } from "@/server/members";
import { getTrip } from "@/server/repo/trip";
import { assertWritable } from "@/server/maintenance";
import { HttpError, errorResponse, roomCodeParam } from "@/server/http";

type Params = Promise<{ code: string }>;

export async function GET(req: Request, { params }: { params: Params }) {
  try {
    const code = roomCodeParam((await params).code);
    await requireMember(req, code);

    const trip = await getTrip(code);
    if (!trip) throw new HttpError(404, "Sala no encontrada");
    return NextResponse.json(trip);
  } catch (e) {
    return errorResponse(e, "GET /api/rooms/[code]");
  }
}

// DELETE /api/rooms/[code] — hard-delete the trip for EVERYONE. Owner only.
// The normal flow is leaving via DELETE /members (last one out deletes the room).
export async function DELETE(req: Request, { params }: { params: Params }) {
  try {
    const code = roomCodeParam((await params).code);
    assertWritable();
    await requireMember(req, code, "owner");
    await deleteRoom(code);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e, "DELETE /api/rooms/[code]");
  }
}
