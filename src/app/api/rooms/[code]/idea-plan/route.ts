import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { validateRoomPayload } from "@/lib/validate";
import { loadRoom } from "@/server/trip-store";
import { requireMember } from "@/server/auth";
import { HttpError, errorResponse, roomCodeParam } from "@/server/http";
import { IdeaPlanError, planIdeasWithClaude } from "@/server/ideaPlan";
import { dailyTokenLimit, recordUsage, tokensUsedToday } from "@/server/agent/usage";
import { LOCAL_MODE_ENABLED, LOCAL_ROOM_CODE } from "@/data/localMode";
import type { RoomPayload } from "@/types";

type Params = Promise<{ code: string }>;

// POST /api/rooms/[code]/idea-plan — "Analizar con Claude": each idea's place,
// type and where it fits the itinerary. Members only, and it counts against the
// caller's daily assistant token quota (it is a paid Claude call). Reads the
// room from the database (the client can't inject a different plan); only the
// dev-only LOCAL demo room sends its payload inline.
// Body: { ideaIds?: string[] } to analyze only those ideas (the new ones), and
// { payload } for the LOCAL room.
export async function POST(req: Request, { params }: { params: Params }) {
  let code: string;
  let userId: string | null = null;
  let payload: RoomPayload;
  let ideaIds: string[] | undefined;
  try {
    code = roomCodeParam((await params).code);
    const body = (await req.json().catch(() => ({}))) as { ideaIds?: unknown; payload?: unknown };
    ideaIds = Array.isArray(body.ideaIds) ? body.ideaIds.filter((x): x is string => typeof x === "string") : undefined;

    if (code === LOCAL_ROOM_CODE) {
      const local = LOCAL_MODE_ENABLED ? validateRoomPayload(body.payload) : null;
      if (!local) throw new HttpError(400, "Modo local no disponible");
      payload = local;
    } else {
      ({ user: { id: userId } } = await requireMember(req, code));
      if ((await tokensUsedToday(userId)) >= dailyTokenLimit()) {
        throw new HttpError(429, "Alcanzaste el límite diario del asistente. Vuelve a intentarlo mañana.");
      }
      payload = (await loadRoom(code)).payload;
    }
  } catch (e) {
    return errorResponse(e, "POST /api/rooms/[code]/idea-plan");
  }

  try {
    const { links, classes, ideaIds: analyzed, usage } = await planIdeasWithClaude(payload, ideaIds);
    if (userId) await recordUsage(userId, code, usage);
    return NextResponse.json({ links, classes, ideaIds: analyzed, at: new Date().toISOString(), usage });
  } catch (e) {
    if (e instanceof IdeaPlanError) return NextResponse.json({ error: e.message }, { status: 503 });
    if (e instanceof Anthropic.RateLimitError) return NextResponse.json({ error: "Claude está ocupado, intenta en un minuto." }, { status: 429 });
    return errorResponse(e, "POST /api/rooms/[code]/idea-plan");
  }
}
