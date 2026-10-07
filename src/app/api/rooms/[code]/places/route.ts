import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { validateRoomPayload } from "@/lib/validate";
import { getTrip } from "@/server/repo/trip";
import { requireMember } from "@/server/auth";
import { HttpError, errorResponse, roomCodeParam } from "@/server/http";
import { GeocodeError, locateEvents } from "@/server/geocode";
import { dailyTokenLimit, recordUsage, tokensUsedToday } from "@/server/agent/usage";
import { LOCAL_MODE_ENABLED, LOCAL_ROOM_CODE } from "@/data/localMode";
import type { RoomPayload } from "@/types";

type Params = Promise<{ code: string }>;

// One or two model calls plus geocoder and photo lookups: up to ~60 s for a
// whole trip the first time; later runs only touch new activities.
export const maxDuration = 120;

// POST /api/rooms/[code]/places — "Ubicar lugares" for the trip map: where each
// activity not located yet happens. Members only, and it counts against the
// caller's daily assistant token quota (it calls Claude). Reads the saved room
// (the client can't inject a different plan); only the dev-only LOCAL demo room
// sends its payload. Returns { places } by event id; the client stores them.
export async function POST(req: Request, { params }: { params: Params }) {
  let code: string;
  let userId: string | null = null;
  let payload: RoomPayload;
  try {
    code = roomCodeParam((await params).code);
    const body = (await req.json().catch(() => ({}))) as { payload?: unknown };

    if (code === LOCAL_ROOM_CODE) {
      const local = LOCAL_MODE_ENABLED ? validateRoomPayload(body.payload) : null;
      if (!local) throw new HttpError(400, "Modo local no disponible");
      payload = local;
    } else {
      ({ user: { id: userId } } = await requireMember(req, code));
      if ((await tokensUsedToday(userId)) >= dailyTokenLimit()) {
        throw new HttpError(429, "Alcanzaste el límite diario del asistente. Vuelve a intentarlo mañana.");
      }
      const trip = await getTrip(code);
      if (!trip) throw new HttpError(404, "Sala no encontrada");
      payload = trip.payload;
    }
  } catch (e) {
    return errorResponse(e, "POST /api/rooms/[code]/places");
  }

  try {
    const { places, usage } = await locateEvents(payload);
    if (userId) await recordUsage(userId, code, usage);
    return NextResponse.json({ places, usage });
  } catch (e) {
    if (e instanceof GeocodeError) return NextResponse.json({ error: e.message }, { status: 503 });
    if (e instanceof Anthropic.RateLimitError) return NextResponse.json({ error: "Claude está ocupado, intenta en un minuto." }, { status: 429 });
    return errorResponse(e, "POST /api/rooms/[code]/places");
  }
}
