import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { validateTripInput } from "@/lib/validate";
import { generateDays } from "@/utils/tripDays";
import { DEFAULT_RATE } from "@/utils/currency";
import type { RoomPayload } from "@/types";

function genCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

const MAX_ATTEMPTS = 3;

// POST /api/rooms — create a trip. The initial payload is built server-side so
// a fresh room never inherits the demo itinerary from the client's local state.
export async function POST(req: Request) {
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const trip = validateTripInput(body);
  if (!trip) {
    return NextResponse.json(
      { error: "Datos del viaje inválidos: se requiere nombre y fechas (inicio ≤ fin)" },
      { status: 400 },
    );
  }

  const days = generateDays(trip.startDate, trip.endDate);
  if (!days) {
    return NextResponse.json({ error: "Rango de fechas inválido" }, { status: 400 });
  }

  const payload: RoomPayload = {
    trip,
    days,
    extras: [],
    exchangeRate: DEFAULT_RATE,
    mockPeople: [],
    tripSpans: [],
    tasks: [],
  };

  const supabase = createServerClient();

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const code = genCode();
    const { error } = await supabase
      .from("rooms")
      .insert({ code, name: trip.name, payload });

    if (!error) {
      return NextResponse.json({ code, trip }, { status: 201 });
    }
    // 23505 = unique_violation → code collision, try a new one
    if (error.code !== "23505") {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "No se pudo generar un código único" }, { status: 500 });
}
