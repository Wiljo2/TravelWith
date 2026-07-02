import type { RoomPayload } from "@/hooks/useRoom";

const CODE_RE = /^[A-Z0-9]{4,10}$/;

export function normalizeRoomCode(raw: string): string | null {
  const code = raw.trim().toUpperCase();
  return CODE_RE.test(code) ? code : null;
}

export function validateRoomPayload(body: unknown): RoomPayload | null {
  if (typeof body !== "object" || body === null) return null;
  const p = body as Record<string, unknown>;

  if (!Array.isArray(p.days) || !Array.isArray(p.extras)) return null;
  if (typeof p.exchangeRate !== "number" || !Number.isFinite(p.exchangeRate) || p.exchangeRate <= 0) return null;

  for (const key of ["mockPeople", "tripSpans", "tasks"] as const) {
    if (p[key] !== undefined && !Array.isArray(p[key])) return null;
  }

  return p as unknown as RoomPayload;
}
