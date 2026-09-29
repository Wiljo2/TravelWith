import type { RoomPayload } from "@/hooks/useRoom";
import type { TripInfo } from "@/types";
import { parseISODate } from "@/utils/tripDays";

const CODE_RE = /^[A-Z0-9]{4,10}$/;
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

export function validateRoomPayload(body: unknown): RoomPayload | null {
  if (typeof body !== "object" || body === null) return null;
  const p = body as Record<string, unknown>;

  if (!Array.isArray(p.days) || !Array.isArray(p.extras)) return null;
  if (typeof p.exchangeRate !== "number" || !Number.isFinite(p.exchangeRate) || p.exchangeRate <= 0) return null;

  for (const key of ["mockPeople", "tripSpans", "tasks", "ideas", "ideaPlaces", "ideaLinks"] as const) {
    if (p[key] !== undefined && !Array.isArray(p[key])) return null;
  }

  if (p.trip !== undefined && !validateTripInput(p.trip)) return null;

  return p as unknown as RoomPayload;
}
