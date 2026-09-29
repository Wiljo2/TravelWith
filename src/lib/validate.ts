import type { RoomPayload, TripInfo } from "@/types";
import { parseISODate } from "@/utils/tripDays";

// Accepts legacy 6-char codes and the 10-char codes from generateRoomCode.
const CODE_RE = /^[A-Z0-9]{4,12}$/;
const MAX_NAME_LENGTH = 80;

export function normalizeRoomCode(raw: string): string | null {
  const code = raw.trim().toUpperCase();
  return CODE_RE.test(code) ? code : null;
}

export function validateTripInput(body: unknown): TripInfo | null {
  if (typeof body !== "object" || body === null) return null;
  const t = body as Record<string, unknown>;

  if (typeof t.name !== "string" || !t.name.trim() || t.name.trim().length > MAX_NAME_LENGTH) return null;
  if (typeof t.startDate !== "string" || typeof t.endDate !== "string") return null;

  const start = parseISODate(t.startDate);
  const end = parseISODate(t.endDate);
  if (!start || !end || end < start) return null;

  const destination = typeof t.destination === "string" && t.destination.trim()
    ? t.destination.trim().slice(0, MAX_NAME_LENGTH)
    : undefined;

  return { name: t.name.trim(), destination, startDate: t.startDate, endDate: t.endDate };
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

// Structural checks that are always enforced: anything that would make every
// member's client throw on load (e.g. `days: [null]`) is rejected here. The
// full schema with limits (`payloadIssues` in lib/schemas.ts) runs on top.
export function validateRoomPayload(body: unknown): RoomPayload | null {
  if (!isObject(body)) return null;
  const p = body;

  if (!Array.isArray(p.days) || !Array.isArray(p.extras)) return null;
  if (typeof p.exchangeRate !== "number" || !Number.isFinite(p.exchangeRate) || p.exchangeRate <= 0) return null;

  for (const key of ["mockPeople", "tripSpans", "tasks"] as const) {
    if (p[key] !== undefined && !Array.isArray(p[key])) return null;
  }
  for (const key of ["extras", "mockPeople", "tripSpans", "tasks"] as const) {
    if (Array.isArray(p[key]) && !(p[key] as unknown[]).every(isObject)) return null;
  }
  for (const d of p.days) {
    if (!isObject(d) || !Array.isArray(d.events) || !d.events.every(isObject)) return null;
    if (d.spans !== undefined && d.spans !== null && (!Array.isArray(d.spans) || !d.spans.every(isObject))) return null;
  }

  if (p.trip !== undefined && !validateTripInput(p.trip)) return null;

  return p as unknown as RoomPayload;
}
