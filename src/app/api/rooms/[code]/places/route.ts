import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { normalizeRoomCode, validateRoomPayload } from "@/lib/validate";
import { loadRoom, TripStoreError } from "@/server/trip-store";
import { GeocodeError, locateEvents } from "@/server/geocode";
import { LOCAL_MODE_ENABLED, LOCAL_ROOM_CODE } from "@/data/mockRoom";
import type { RoomPayload } from "@/hooks/useRoom";

type Params = Promise<{ code: string }>;

// One or two model calls plus geocoder and photo lookups: up to ~60 s for a
// whole trip the first time; later runs only touch new activities.
export const maxDuration = 120;

// POST /api/rooms/[code]/places — "Ubicar lugares" for the trip map: where each
// activity not located yet happens. Reads the saved room (the client can't
// inject a different plan); only the dev-only LOCAL demo room sends its payload.
// Returns { places } by event id; the client stores them in the room.
export async function POST(req: Request, { params }: { params: Params }) {
  const code = normalizeRoomCode((await params).code);
  if (!code) return NextResponse.json({ error: "Código inválido" }, { status: 400 });
  const body = (await req.json().catch(() => ({}))) as { payload?: unknown };

  let payload: RoomPayload | null;
  try {
    if (code === LOCAL_ROOM_CODE) {
      payload = LOCAL_MODE_ENABLED ? validateRoomPayload(body.payload) : null;
      if (!payload) return NextResponse.json({ error: "Modo local no disponible" }, { status: 400 });
    } else {
      payload = (await loadRoom(code)).payload;
    }
  } catch (e) {
    const status = e instanceof TripStoreError ? e.status : 400;
    return NextResponse.json({ error: e instanceof Error ? e.message : "Sala no encontrada" }, { status });
  }

  try {
    const { places, usage } = await locateEvents(payload);
    return NextResponse.json({ places, usage });
  } catch (e) {
    if (e instanceof GeocodeError) return NextResponse.json({ error: e.message }, { status: 503 });
    if (e instanceof Anthropic.RateLimitError) return NextResponse.json({ error: "Claude está ocupado, intenta en un minuto." }, { status: 429 });
    if (e instanceof Anthropic.APIError) return NextResponse.json({ error: `Error de Claude (${e.status})` }, { status: 502 });
    return NextResponse.json({ error: "No se pudieron ubicar los lugares" }, { status: 500 });
  }
}
