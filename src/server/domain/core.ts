import type { RoomPayload } from "@/hooks/useRoom";
import type { CalendarEvent, Day } from "@/types";

// Validation failure with a message the agent (or an API consumer) can act on.
export class DomainError extends Error {}

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
