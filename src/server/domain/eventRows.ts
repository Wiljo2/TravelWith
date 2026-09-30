import { DEFAULT_EVENT_CAT } from "@/constants/categories";
import { LIMITS } from "@/constants/limits";
import { DomainError, checkArgs, checkClientId } from "@/server/domain/core";
import { validateCat, validateHours } from "@/server/domain/events";
import type { NewRow, RowPatch } from "@/server/repo/core";
import type { TripEventRow } from "@/types/database";
import { uid } from "@/utils/uid";

// Pure validation for event ops on rows: each function checks untyped args and
// returns the row or patch to write. Existence checks (day, event) and limits
// that need the database are done by the op before calling these.

const TEXT_FIELDS = {
  title: { type: "string", max: LIMITS.title },
  cat: { type: "string", max: LIMITS.id },
  note: { type: "string", max: LIMITS.note },
} as const;

export interface EventCreateArgs {
  id?: string;
  dayId: string;
  title: string;
  start: number;
  end: number;
  cat?: string;
  note?: string;
}

export function newEventRow(args: unknown, position: number): NewRow<"trip_events"> {
  checkArgs(args, {
    ...TEXT_FIELDS,
    id: { type: "string" },
    dayId: { type: "string", required: true, max: LIMITS.id },
    title: { ...TEXT_FIELDS.title, required: true },
    start: { type: "number", required: true },
    end: { type: "number", required: true },
  });
  const a = args as EventCreateArgs;
  const title = a.title.trim();
  if (!title) throw new DomainError("title is required");
  validateHours(a.start, a.end);
  const cat = a.cat ?? DEFAULT_EVENT_CAT;
  validateCat(cat);

  return {
    id: a.id === undefined ? uid() : checkClientId(a.id),
    day_id: a.dayId,
    position,
    start_hour: a.start,
    end_hour: a.end,
    title,
    cat,
    note: a.note?.trim() ?? "",
  };
}

export interface EventUpdateArgs {
  id: string;
  title?: string;
  start?: number;
  end?: number;
  cat?: string;
  note?: string;
}

// Validates the merged result, so a patch with only `end` is checked against
// the stored `start`.
export function eventUpdatePatch(current: TripEventRow, args: unknown): RowPatch<"trip_events"> {
  checkArgs(args, {
    ...TEXT_FIELDS,
    id: { type: "string", required: true },
    start: { type: "number" },
    end: { type: "number" },
  });
  const a = args as EventUpdateArgs;
  const patch: RowPatch<"trip_events"> = {};
  if (a.title !== undefined) {
    patch.title = a.title.trim();
    if (!patch.title) throw new DomainError("title cannot be empty");
  }
  if (a.start !== undefined) patch.start_hour = a.start;
  if (a.end !== undefined) patch.end_hour = a.end;
  if (a.cat !== undefined) {
    validateCat(a.cat);
    patch.cat = a.cat;
  }
  if (a.note !== undefined) patch.note = a.note;
  if (Object.keys(patch).length === 0) throw new DomainError("nothing to update");
  validateHours(patch.start_hour ?? Number(current.start_hour), patch.end_hour ?? Number(current.end_hour));
  return patch;
}

export interface EventMoveArgs {
  id: string;
  dayId: string;
  start?: number;
  end?: number;
}

// Drag and drop: another day and/or other hours. `position` is set by the op
// when the day changes (end of the target day).
export function eventMovePatch(current: TripEventRow, args: unknown, position?: number): RowPatch<"trip_events"> {
  checkArgs(args, {
    id: { type: "string", required: true },
    dayId: { type: "string", required: true, max: LIMITS.id },
    start: { type: "number" },
    end: { type: "number" },
  });
  const a = args as EventMoveArgs;
  const start = a.start ?? Number(current.start_hour);
  const end = a.end ?? Number(current.end_hour);
  validateHours(start, end);
  return {
    day_id: a.dayId,
    start_hour: start,
    end_hour: end,
    ...(position !== undefined ? { position } : {}),
  };
}
