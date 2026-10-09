import { HOUR_END, HOUR_START } from "@/constants/time";
import { LIMITS } from "@/constants/limits";
import { COLOR_RE } from "@/lib/schemas";
import { DomainError, checkArgs, checkClientId } from "@/server/domain/core";
import type { NewRow, RowPatch } from "@/server/repo/core";
import type { TripDaySpanRow } from "@/types/database";
import { uid } from "@/utils/uid";

// Pure validation for day spans (colored ranges inside a day) and trip spans
// (ranges between two events, across days). Event existence is checked by the
// op. Optional fields accept null in updates to clear them.

type Args = Record<string, unknown>;

function color(value: unknown, field: string): string {
  if (typeof value !== "string" || !COLOR_RE.test(value)) {
    throw new DomainError(`${field} must be a hex, rgb(a) or "transparent" color`);
  }
  return value;
}

function hour(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < HOUR_START || value > HOUR_END) {
    throw new DomainError(`${field} must be a decimal hour between ${HOUR_START} and ${HOUR_END}`);
  }
  return value;
}

function zIndex(value: unknown): number {
  if (!Number.isInteger(value)) throw new DomainError("zIndex must be an integer");
  return value as number;
}

function label(value: unknown): string {
  if (typeof value !== "string" || value.length > LIMITS.label) {
    throw new DomainError(`label must be a string of at most ${LIMITS.label} characters`);
  }
  return value;
}

function eventRef(value: unknown, field: string): string {
  if (typeof value !== "string" || !value || value.length > LIMITS.id) throw new DomainError(`${field} must be an event id`);
  return value;
}

// Clearable fields: undefined = unchanged, null = cleared, otherwise validated.
function optional<T>(a: Args, key: string, parse: (v: unknown) => T): T | null | undefined {
  if (!(key in a) || a[key] === undefined) return undefined;
  return a[key] === null ? null : parse(a[key]);
}

function checkHourOrder(start: number | null | undefined, end: number | null | undefined) {
  if (start != null && end != null && end <= start) throw new DomainError("endHour must be after startHour");
}

export function newDaySpanRow(args: unknown, position: number): NewRow<"trip_day_spans"> {
  checkArgs(args, { id: { type: "string" }, dayId: { type: "string", required: true, max: LIMITS.id } });
  const a = args as Args;
  const startHour = optional(a, "startHour", (v) => hour(v, "startHour"));
  const endHour = optional(a, "endHour", (v) => hour(v, "endHour"));
  checkHourOrder(startHour, endHour);
  return {
    id: a.id === undefined ? uid() : checkClientId(a.id),
    day_id: a.dayId as string,
    position,
    label: optional(a, "label", label) ?? null,
    start_event_id: optional(a, "startEventId", (v) => eventRef(v, "startEventId")) ?? null,
    end_event_id: optional(a, "endEventId", (v) => eventRef(v, "endEventId")) ?? null,
    start_hour: startHour ?? null,
    end_hour: endHour ?? null,
    bg: color(a.bg, "bg"),
    border: color(a.border, "border"),
    z_index: optional(a, "zIndex", zIndex) ?? null,
  };
}

export function daySpanPatch(current: TripDaySpanRow, args: unknown): RowPatch<"trip_day_spans"> {
  checkArgs(args, { id: { type: "string", required: true } });
  const a = args as Args;
  const patch: RowPatch<"trip_day_spans"> = {};
  const set = <K extends keyof RowPatch<"trip_day_spans">>(k: K, v: RowPatch<"trip_day_spans">[K] | undefined) => {
    if (v !== undefined) patch[k] = v;
  };
  set("label", optional(a, "label", label));
  set("start_event_id", optional(a, "startEventId", (v) => eventRef(v, "startEventId")));
  set("end_event_id", optional(a, "endEventId", (v) => eventRef(v, "endEventId")));
  set("start_hour", optional(a, "startHour", (v) => hour(v, "startHour")));
  set("end_hour", optional(a, "endHour", (v) => hour(v, "endHour")));
  if (a.bg !== undefined) patch.bg = color(a.bg, "bg");
  if (a.border !== undefined) patch.border = color(a.border, "border");
  set("z_index", optional(a, "zIndex", zIndex));
  if (Object.keys(patch).length === 0) throw new DomainError("nothing to update");
  const start = patch.start_hour !== undefined ? patch.start_hour : current.start_hour;
  const end = patch.end_hour !== undefined ? patch.end_hour : current.end_hour;
  checkHourOrder(start == null ? null : Number(start), end == null ? null : Number(end));
  return patch;
}

export function newTripSpanRow(args: unknown, position: number): NewRow<"trip_spans"> {
  checkArgs(args, { id: { type: "string" } });
  const a = args as Args;
  return {
    id: a.id === undefined ? uid() : checkClientId(a.id),
    position,
    label: optional(a, "label", label) ?? null,
    start_event_id: eventRef(a.startEventId, "startEventId"),
    end_event_id: eventRef(a.endEventId, "endEventId"),
    bg: color(a.bg, "bg"),
    border: color(a.border, "border"),
    z_index: optional(a, "zIndex", zIndex) ?? null,
  };
}

export function tripSpanPatch(args: unknown): RowPatch<"trip_spans"> {
  checkArgs(args, { id: { type: "string", required: true } });
  const a = args as Args;
  const patch: RowPatch<"trip_spans"> = {};
  const lbl = optional(a, "label", label);
  if (lbl !== undefined) patch.label = lbl;
  if (a.startEventId !== undefined) patch.start_event_id = eventRef(a.startEventId, "startEventId");
  if (a.endEventId !== undefined) patch.end_event_id = eventRef(a.endEventId, "endEventId");
  if (a.bg !== undefined) patch.bg = color(a.bg, "bg");
  if (a.border !== undefined) patch.border = color(a.border, "border");
  const z = optional(a, "zIndex", zIndex);
  if (z !== undefined) patch.z_index = z;
  if (Object.keys(patch).length === 0) throw new DomainError("nothing to update");
  return patch;
}
