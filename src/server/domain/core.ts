import type { RoomPayload, CalendarEvent, Day } from "@/types";

// Validation failure with a message the agent (or an API consumer) can act on.
export class DomainError extends Error {}

interface FieldSpec {
  type: "string" | "number" | "boolean";
  required?: boolean;
  max?: number;
}

// Tool inputs arrive as untyped JSON (schemas are not `strict`), so each
// domain entry point checks types first: a wrong type becomes a DomainError
// the model can correct instead of a TypeError that aborts the run.
export function checkArgs(args: unknown, spec: Record<string, FieldSpec>): void {
  if (typeof args !== "object" || args === null) throw new DomainError("arguments must be an object");
  const a = args as Record<string, unknown>;
  for (const [key, s] of Object.entries(spec)) {
    const v = a[key];
    if (v === undefined) {
      if (s.required) throw new DomainError(`${key} is required`);
      continue;
    }
    const ok = s.type === "number" ? typeof v === "number" && Number.isFinite(v) : typeof v === s.type;
    if (!ok) throw new DomainError(`${key} must be a ${s.type}`);
    if (s.max !== undefined && typeof v === "string" && v.length > s.max) {
      throw new DomainError(`${key} is too long (max ${s.max} characters)`);
    }
  }
}

export function requireDay(payload: RoomPayload, dayId: string): Day {
  const day = payload.days.find((d) => d.id === dayId);
  if (!day) {
    const ids = payload.days.map((d) => `${d.id} (${d.label})`).join(", ");
    throw new DomainError(`Day "${dayId}" not found. Valid days: ${ids}`);
  }
  return day;
}

export function findEvent(payload: RoomPayload, eventId: string): { day: Day; event: CalendarEvent } | null {
  for (const day of payload.days) {
    const event = day.events.find((e) => e.id === eventId);
    if (event) return { day, event };
  }
  return null;
}

export function requireEvent(payload: RoomPayload, eventId: string): { day: Day; event: CalendarEvent } {
  const found = findEvent(payload, eventId);
  if (!found) throw new DomainError(`Event "${eventId}" not found. Use get_day_detail to list current event ids.`);
  return found;
}
