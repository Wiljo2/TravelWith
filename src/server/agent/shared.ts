import { DEFAULT_EVENT_CAT, EVENT_CATEGORY_KEYS } from "@/constants/categories";
import { DomainError } from "@/server/domain/core";
import { HttpError } from "@/server/http";
import type { OpResult } from "@/server/ops/types";
import { RowConflictError, RowNotFoundError } from "@/server/repo/errors";
import { getTrip, type RoomHeaderRow } from "@/server/repo/trip";

export type Input = Record<string, unknown>;

export const HOURS_DESC = "Decimal hour between 0 and 26 (e.g. 5.5 = 5:30am, 19.5 = 7:30pm, 25 = 1:00am next day)";
export const EVENT_CATS = EVENT_CATEGORY_KEYS.join(" | ");

export const NEW_EVENT_FIELDS = {
  dayId: { type: "string", description: "Target day id (from get_trip_overview)" },
  title: { type: "string" },
  start: { type: "number", description: HOURS_DESC },
  end: { type: "number", description: `${HOURS_DESC}; must be greater than start` },
  cat: { type: "string", description: `Category: ${EVENT_CATS}. Default ${DEFAULT_EVENT_CAT}.` },
  note: { type: "string", description: "Optional note shown on the event" },
};
export const NEW_EVENT_REQUIRED = ["dayId", "title", "start", "end"];

export function schema(properties: Record<string, unknown>, required: string[] = []) {
  return { type: "object" as const, properties, required, additionalProperties: false };
}

export function pick(input: Input, keys: string[]): Input {
  return Object.fromEntries(keys.filter((k) => input[k] !== undefined).map((k) => [k, input[k]]));
}

export async function readTrip(code: string) {
  const trip = await getTrip(code);
  if (!trip) throw new DomainError("The trip no longer exists.");
  return trip;
}

function publicRow(row: object): Input {
  const { room_code: _code, updated_at: _at, updated_by: _by, ...rest } = row as Input;
  return rest;
}

function publicTrip(trip: RoomHeaderRow) {
  const { name, destination, start_date, end_date, exchange_rate } = trip;
  return { name, destination, start_date, end_date, exchange_rate };
}

export function summarize(results: OpResult[]) {
  const trip = results.findLast((r) => r.trip)?.trip;
  return {
    ok: true,
    changed: results.flatMap((r) => r.changed.map(({ table, row }) => ({ table, ...publicRow(row) }))),
    deleted: results.flatMap((r) => r.deleted),
    ...(trip ? { trip: publicTrip(trip) } : {}),
  };
}

// Failures the model can act on, as the text of an is_error tool result; null
// for anything unexpected, which the caller rethrows.
export function toolErrorMessage(e: unknown): string | null {
  if (e instanceof DomainError) return e.message;
  if (e instanceof RowConflictError) return "That item was changed by someone else at the same time. Re-read it and try again.";
  if (e instanceof RowNotFoundError) return "That item no longer exists (someone may have deleted it). Re-read the trip.";
  if (e instanceof HttpError && e.status < 500) return e.message;
  return null;
}
