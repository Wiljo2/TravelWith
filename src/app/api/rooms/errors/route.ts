import { NextResponse } from "next/server";
import { ERROR_LIMITS, recordError } from "@/server/errors";
import { HttpError, errorResponse } from "@/server/http";

const MAX_BODY = 8 * 1024;

// POST /api/rooms/errors — the browser reports an error the app didn't handle.
// No sign-in (errors happen before it too), so only same-origin requests with a
// small body of string fields are accepted.
export async function POST(req: Request) {
  try {
    if (!sameOrigin(req)) throw new HttpError(403, "Origen no permitido");
    if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY) throw new HttpError(413, "Reporte demasiado grande");
    const text = await req.text();
    if (text.length > MAX_BODY) throw new HttpError(413, "Reporte demasiado grande");
    const body = parseReport(text);
    if (!body) throw new HttpError(400, "Reporte inválido");
    await recordError({ source: "client", ...body, userAgent: req.headers.get("user-agent") });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return errorResponse(e, "POST /api/rooms/errors");
  }
}

function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? new URL(req.url).host;
  try {
    return !!origin && new URL(origin).host === host;
  } catch {
    return false;
  }
}

type Report = { message: string; context: string | null; stack: string | null; path: string | null };

function parseReport(text: string): Report | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const { message, context, stack, path } = raw as Record<string, unknown>;
  const optional = (v: unknown) => v === undefined || v === null || typeof v === "string";
  if (typeof message !== "string" || !message.trim() || ![context, stack, path].every(optional)) return null;
  const str = (v: unknown) => (typeof v === "string" ? v : null);
  return { message: message.slice(0, ERROR_LIMITS.message), context: str(context), stack: str(stack), path: str(path) };
}
