import { NextResponse } from "next/server";
import { normalizeRoomCode } from "@/lib/validate";
import { TripStoreError } from "@/server/trip-store";

const GENERIC_ERROR = "Ocurrió un error en el servidor. Intenta de nuevo.";

// An error whose message is safe to show to the caller.
export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function roomCodeParam(raw: string): string {
  const code = normalizeRoomCode(raw);
  if (!code) throw new HttpError(400, "Código inválido");
  return code;
}

// Client errors keep their message; anything else (database, network, bugs) is
// logged server-side and answered with a generic 500 so internals never leak.
export function errorResponse(e: unknown, context: string): NextResponse {
  if ((e instanceof HttpError || e instanceof TripStoreError) && e.status < 500) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  console.error(`[api] ${context}`, e);
  return NextResponse.json({ error: GENERIC_ERROR }, { status: 500 });
}
