import type { RoomPayload, CalendarEvent } from "@/types";
import { CATEGORIES, DEFAULT_EVENT_CAT } from "@/constants/categories";
import { HOUR_START, HOUR_END } from "@/constants/time";
import { uid } from "@/utils/uid";
import { LIMITS } from "@/constants/limits";
import { DomainError, checkArgs, requireDay, requireEvent } from "./core";

const EVENT_FIELDS = {
  title: { type: "string", max: LIMITS.title },
  start: { type: "number" },
  end: { type: "number" },
  cat: { type: "string", max: LIMITS.id },
  note: { type: "string", max: LIMITS.note },
  dayId: { type: "string", max: LIMITS.id },
} as const;

export function validateHours(start: number, end: number) {
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    throw new DomainError("start and end must be decimal hours (e.g. 19.5 = 7:30pm)");
  }
  if (start < HOUR_START || end > HOUR_END || end <= start) {
    throw new DomainError(
      `Invalid time range: hours must satisfy ${HOUR_START} <= start < end <= ${HOUR_END} (decimal hours; ${HOUR_END} = 2am next day)`,
    );
  }
}

export function validateCat(cat: string) {
  if (!CATEGORIES[cat]) {
    throw new DomainError(`Unknown category "${cat}". Valid: ${Object.keys(CATEGORIES).join(", ")}`);
  }
}

export interface AddEventArgs {
  dayId: string;
  title: string;
  start: number;
  end: number;
  cat?: string;
  note?: string;
}

export function addEvent(payload: RoomPayload, args: AddEventArgs): { payload: RoomPayload; event: CalendarEvent } {
  checkArgs(args, {
    ...EVENT_FIELDS,
    dayId: { ...EVENT_FIELDS.dayId, required: true },
    title: { ...EVENT_FIELDS.title, required: true },
    start: { type: "number", required: true },
    end: { type: "number", required: true },
  });
  const target = requireDay(payload, args.dayId);
  if (target.events.length >= LIMITS.eventsPerDay) {
    throw new DomainError(`Day ${args.dayId} already has ${LIMITS.eventsPerDay} events`);
  }
  if (!args.title.trim()) throw new DomainError("title is required");
  validateHours(args.start, args.end);
  const cat = args.cat ?? DEFAULT_EVENT_CAT;
  validateCat(cat);

  const event: CalendarEvent = {
    id: uid(),
    title: args.title.trim(),
    start: args.start,
    end: args.end,
    cat,
    note: args.note?.trim() ?? "",
  };

  const days = payload.days.map((d) =>
    d.id === args.dayId ? { ...d, events: [...d.events, event] } : d,
  );
  return { payload: { ...payload, days }, event };
}

export interface UpdateEventArgs {
  title?: string;
  start?: number;
  end?: number;
  cat?: string;
  note?: string;
  dayId?: string; // move the event to another day
}

export function updateEvent(
  payload: RoomPayload,
  eventId: string,
  patch: UpdateEventArgs,
): { payload: RoomPayload; event: CalendarEvent } {
  checkArgs(patch, EVENT_FIELDS);
  const { day, event } = requireEvent(payload, eventId);

  const next: CalendarEvent = {
    ...event,
    ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
    ...(patch.start !== undefined ? { start: patch.start } : {}),
    ...(patch.end !== undefined ? { end: patch.end } : {}),
    ...(patch.cat !== undefined ? { cat: patch.cat } : {}),
    ...(patch.note !== undefined ? { note: patch.note } : {}),
  };
  if (!next.title) throw new DomainError("title cannot be empty");
  validateHours(next.start, next.end);
  validateCat(next.cat);

  const targetDayId = patch.dayId ?? day.id;
  if (targetDayId !== day.id) requireDay(payload, targetDayId);

  const days = payload.days.map((d) => {
    let events = d.events;
    if (d.id === day.id) events = events.filter((e) => e.id !== eventId);
    if (d.id === targetDayId) events = [...events, next];
    return events === d.events ? d : { ...d, events };
  });

  return { payload: { ...payload, days }, event: next };
}

export function deleteEvent(payload: RoomPayload, eventId: string): { payload: RoomPayload; event: CalendarEvent } {
  const { event } = requireEvent(payload, eventId);
  const days = payload.days.map((d) =>
    d.events.some((e) => e.id === eventId)
      ? { ...d, events: d.events.filter((e) => e.id !== eventId) }
      : d,
  );
  // Unlink any expense pointing at the removed event so no dangling ids remain.
  const extras = payload.extras.map((x) =>
    x.linkedEventId === eventId ? { ...x, linkedEventId: undefined } : x,
  );
  return { payload: { ...payload, days, extras }, event };
}
