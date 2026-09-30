import { z } from "zod";
import { LIMITS } from "@/constants/limits";

// Full shape of a persisted RoomPayload. Objects are loose (unknown keys are
// kept) so fields added later survive older validators, and optional fields
// accept null because legacy payloads may carry it. Colors only allow hex,
// rgb(a) and `transparent`: they are rendered into inline CSS, where a `url(...)`
// would make every member's browser fetch an attacker-chosen address.

const id = z.string().min(1).max(LIMITS.id);
const optId = id.nullish();
const text = (max: number) => z.string().max(max);
const hour = z.number().min(0).max(48);
const money = z.number();
export const COLOR_RE = /^(#[0-9a-fA-F]{3,8}|transparent|rgba?\([\d\s.,%]+\))$/;
const color = z.string().regex(COLOR_RE);
const currency = z.enum(["USD", "COP"]).nullish();
const splitMode = z.enum(["group", "perPerson"]).nullish();

const calendarEvent = z.looseObject({
  id,
  start: hour,
  end: hour,
  title: text(LIMITS.title),
  cat: text(LIMITS.id),
  note: text(LIMITS.note).nullish(),
});

const daySpan = z.looseObject({
  id,
  label: text(LIMITS.label).nullish(),
  startEventId: optId,
  endEventId: optId,
  startHour: hour.nullish(),
  endHour: hour.nullish(),
  bg: color,
  border: color,
  zIndex: z.number().nullish(),
});

const day = z.looseObject({
  id,
  label: text(LIMITS.label),
  sub: text(LIMITS.label).nullish(),
  flexible: z.boolean().nullish(),
  spans: z.array(daySpan).max(LIMITS.spansPerDay).nullish(),
  events: z.array(calendarEvent).max(LIMITS.eventsPerDay),
});

const extra = z.looseObject({
  id,
  label: text(LIMITS.label),
  amount: money,
  currency,
  splitMode,
  linkedEventId: optId,
  startDayId: optId,
  endDayId: optId,
});

const taskOption = z.looseObject({
  id,
  label: text(LIMITS.label),
  note: text(LIMITS.note).nullish(),
  amount: money.nullish(),
  currency,
  splitMode,
});

const task = z.looseObject({
  id,
  title: text(LIMITS.title),
  done: z.boolean(),
  note: text(LIMITS.note).nullish(),
  dayId: optId,
  start: hour.nullish(),
  end: hour.nullish(),
  cat: text(LIMITS.id).nullish(),
  priority: z.enum(["alta", "media", "baja"]).nullish(),
  options: z.array(taskOption).max(LIMITS.optionsPerTask).nullish(),
});

const tripSpan = z.looseObject({
  id,
  label: text(LIMITS.label).nullish(),
  startEventId: id,
  endEventId: id,
  bg: color,
  border: color,
  zIndex: z.number().nullish(),
});

const mockPerson = z.looseObject({
  id,
  name: text(LIMITS.name),
});

export const roomPayloadSchema = z.looseObject({
  days: z.array(day).max(LIMITS.days),
  extras: z.array(extra).max(LIMITS.extras),
  exchangeRate: z.number().positive(),
  trip: z.looseObject({}).nullish(),
  mockPeople: z.array(mockPerson).max(LIMITS.travelers).nullish(),
  tripSpans: z.array(tripSpan).max(LIMITS.tripSpans).nullish(),
  tasks: z.array(task).max(LIMITS.tasks).nullish(),
});

// Human-readable list of schema violations ("days.0.events.2.title: ..."), empty when valid.
export function payloadIssues(payload: unknown): string[] {
  const result = roomPayloadSchema.safeParse(payload);
  if (result.success) return [];
  return result.error.issues.slice(0, 20).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
}
