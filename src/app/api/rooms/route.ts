import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { validateTripInput } from "@/lib/validate";
import { generateDays } from "@/utils/tripDays";
import { DEFAULT_RATE } from "@/utils/currency";
import { requireUser } from "@/server/auth";
import { HttpError, errorResponse } from "@/server/http";
import { deleteRoom, joinRoom } from "@/server/members";
import { generateRoomCode } from "@/server/room-code";
import type { RoomPayload } from "@/types";

const MAX_ATTEMPTS = 3;

// POST /api/rooms — create a trip. The initial payload is built server-side so
// a fresh room never inherits the demo itinerary from the client's local state,
// and the creator becomes owner here: roles are never chosen by the client.
export async function POST(req: Request) {
  try {
    const user = await requireUser(req);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new HttpError(400, "Body inválido");
    }

    const trip = validateTripInput(body);
    if (!trip) throw new HttpError(400, "Datos del viaje inválidos: se requiere nombre y fechas (inicio ≤ fin)");

    const days = generateDays(trip.startDate, trip.endDate);
    if (!days) throw new HttpError(400, "Rango de fechas inválido");

    const payload: RoomPayload = {
      trip,
      days,
      extras: [],
      exchangeRate: DEFAULT_RATE,
      mockPeople: [],
      tripSpans: [],
      tasks: [],
    };

    const code = await insertRoom(trip.name, payload);
    try {
      await joinRoom(code, user, "owner");
    } catch (e) {
      await deleteRoom(code).catch(() => {});
      throw e;
    }

    return NextResponse.json({ code, trip }, { status: 201 });
  } catch (e) {
    return errorResponse(e, "POST /api/rooms");
  }
}

async function insertRoom(name: string, payload: RoomPayload): Promise<string> {
  const supabase = createServerClient();
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const code = generateRoomCode();
    const { error } = await supabase.from("rooms").insert({ code, name, payload });
    if (!error) return code;
    // 23505 = unique_violation → code collision, try a new one
    if (error.code !== "23505") throw error;
  }
  throw new Error("Could not generate a unique room code");
}
