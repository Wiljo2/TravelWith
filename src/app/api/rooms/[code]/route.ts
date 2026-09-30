import { NextResponse } from "next/server";
import { validateRoomPayload } from "@/lib/validate";
import { payloadIssues } from "@/lib/schemas";
import { LIMITS } from "@/constants/limits";
import { TripConflictError, persistRoom } from "@/server/trip-store";
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

// "report" logs schema violations without rejecting (rollout mode, until live
// payloads are known to be clean); anything else enforces the full schema.
// Structural checks and the size cap are always enforced.
const SCHEMA_MODE = process.env.PAYLOAD_VALIDATION === "report" ? "report" : "enforce";

// PATCH /api/rooms/[code] — save the full payload built on `expectedUpdatedAt`.
// The write is a compare-and-swap: if another member saved in between, nothing
// is written and the response is 409 with the current state to adopt.
export async function PATCH(req: Request, { params }: { params: Params }) {
  try {
    const code = roomCodeParam((await params).code);
    assertWritable();
    await requireMember(req, code);

    const raw = await req.text();
    if (Buffer.byteLength(raw) > LIMITS.bodyBytes) throw new HttpError(413, "El viaje es demasiado grande para guardarlo");

    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      throw new HttpError(400, "Payload inválido");
    }

    const { expectedUpdatedAt, ...rest } = (body ?? {}) as Record<string, unknown>;
    if (typeof expectedUpdatedAt !== "string" || !expectedUpdatedAt) {
      throw new HttpError(400, "Falta la versión del viaje (expectedUpdatedAt)");
    }

    const payload = validateRoomPayload(rest);
    if (!payload) throw new HttpError(400, "Payload inválido");

    const issues = payloadIssues(payload);
    if (issues.length > 0) {
      if (SCHEMA_MODE === "enforce") throw new HttpError(400, `Payload inválido: ${issues[0]}`);
      console.warn(`[api] PATCH /api/rooms/${code} schema issues (report mode)`, issues);
    }

    const updatedAt = await persistRoom(code, payload, expectedUpdatedAt);
    return NextResponse.json({ ok: true, updated_at: updatedAt });
  } catch (e) {
    if (e instanceof TripConflictError) {
      return NextResponse.json(
        { error: e.message, payload: e.current.payload, updated_at: e.current.updatedAt },
        { status: 409 },
      );
    }
    return errorResponse(e, "PATCH /api/rooms/[code]");
  }
}
