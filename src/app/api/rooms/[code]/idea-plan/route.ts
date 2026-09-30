import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { normalizeRoomCode, validateRoomPayload } from "@/lib/validate";
import { loadRoom, TripStoreError } from "@/server/trip-store";
import { IdeaPlanError, planIdeasWithClaude } from "@/server/ideaPlan";
import { LOCAL_MODE_ENABLED, LOCAL_ROOM_CODE } from "@/data/mockRoom";
import type { RoomPayload } from "@/hooks/useRoom";

type Params = Promise<{ code: string }>;

// POST /api/rooms/[code]/idea-plan — "Analizar con Claude": where each idea fits
// the itinerary. Reads the room from the database (the client can't inject a
// different plan); only the dev-only LOCAL demo room sends its payload inline.
// Body: { ideaIds?: string[] } to analyze only those ideas (the new ones), and
// { payload } for the LOCAL room.
export async function POST(req: Request, { params }: { params: Params }) {
  const code = normalizeRoomCode((await params).code);
  if (!code) return NextResponse.json({ error: "Código inválido" }, { status: 400 });
  const body = (await req.json().catch(() => ({}))) as { ideaIds?: unknown; payload?: unknown };
  const ideaIds = Array.isArray(body.ideaIds) ? body.ideaIds.filter((x): x is string => typeof x === "string") : undefined;

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
    const { links, ideaIds: analyzed, usage } = await planIdeasWithClaude(payload, ideaIds);
    return NextResponse.json({ links, ideaIds: analyzed, at: new Date().toISOString(), usage });
  } catch (e) {
    if (e instanceof IdeaPlanError) return NextResponse.json({ error: e.message }, { status: 503 });
    if (e instanceof Anthropic.RateLimitError) return NextResponse.json({ error: "Claude está ocupado, intenta en un minuto." }, { status: 429 });
    if (e instanceof Anthropic.APIError) return NextResponse.json({ error: `Error de Claude (${e.status})` }, { status: 502 });
    return NextResponse.json({ error: "No se pudo analizar" }, { status: 500 });
  }
}
