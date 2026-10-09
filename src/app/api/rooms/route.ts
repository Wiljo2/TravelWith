import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { validateTripInput } from "@/lib/validate";
import { generateDays } from "@/utils/tripDays";
import { DEFAULT_RATE } from "@/utils/currency";
import { requireUser } from "@/server/auth";
import { assertWritable } from "@/server/maintenance";
import { HttpError, errorResponse } from "@/server/http";
import { deleteRoom, joinRoom } from "@/server/members";
import { generateRoomCode } from "@/server/room-code";
import { resetItinerary } from "@/server/repo/days";
import type { TripInfo } from "@/types";

const MAX_ATTEMPTS = 3;

// POST /api/rooms — create a trip: the header in the rooms columns, the empty
// days in trip_days (rooms.payload stays empty, it is only the pre-cut-over
// backup). Built server-side so a fresh room never inherits the client's local
// state, and the creator becomes owner here: roles are never chosen by the client.
export async function POST(req: Request) {
  try {
    assertWritable();
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

    const code = await insertRoom(trip);
    try {
      await joinRoom(code, user, "owner");
      await resetItinerary(code, days.map(({ id, label, sub, flexible }) => ({ id, label, sub, flexible })), user.id);
    } catch (e) {
      await deleteRoom(code).catch(() => {});
      throw e;
    }

    return NextResponse.json({ code, trip }, { status: 201 });
  } catch (e) {
    return errorResponse(e, "POST /api/rooms");
  }
}

async function insertRoom(trip: TripInfo): Promise<string> {
  const supabase = createServerClient();
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const code = generateRoomCode();
    const { error } = await supabase.from("rooms").insert({
      code,
      name: trip.name,
      destination: trip.destination ?? null,
      start_date: trip.startDate,
      end_date: trip.endDate,
      exchange_rate: DEFAULT_RATE,
    });
    if (!error) return code;
    // 23505 = unique_violation → code collision, try a new one
    if (error.code !== "23505") throw error;
  }
  throw new Error("Could not generate a unique room code");
}
