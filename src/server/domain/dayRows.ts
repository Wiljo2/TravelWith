import { LIMITS } from "@/constants/limits";
import { DomainError, checkArgs } from "@/server/domain/core";
import type { RowPatch } from "@/server/repo/core";
import type { ResetDay } from "@/server/repo/days";
import type { TripDayRow } from "@/types/database";
import { generateDays } from "@/utils/tripDays";

export interface DayUpdateArgs {
  id: string;
  label?: string;
  sub?: string;
  flexible?: boolean;
}

export function dayUpdatePatch(args: unknown): RowPatch<"trip_days"> {
  checkArgs(args, {
    id: { type: "string", required: true },
    label: { type: "string", max: LIMITS.label },
    sub: { type: "string", max: LIMITS.label },
    flexible: { type: "boolean" },
  });
  const a = args as DayUpdateArgs;
  const patch: RowPatch<"trip_days"> = {};
  if (a.label !== undefined) {
    patch.label = a.label.trim();
    if (!patch.label) throw new DomainError("label cannot be empty");
  }
  if (a.sub !== undefined) patch.sub = a.sub;
  if (a.flexible !== undefined) patch.flexible = a.flexible;
  if (Object.keys(patch).length === 0) throw new DomainError("nothing to update");
  return patch;
}

// Days after an itinerary reset: regenerated from the trip dates (same ids as
// a new trip), or the current days emptied when the trip has no valid dates.
export function resetDays(dates: { startDate: string; endDate: string } | null, current: TripDayRow[]): ResetDay[] {
  const generated = dates ? generateDays(dates.startDate, dates.endDate) : null;
  if (generated) return generated.map((d) => ({ id: d.id, label: d.label, sub: d.sub, flexible: d.flexible }));
  return current.map((d) => ({ id: d.id, label: d.label, sub: d.sub ?? "", flexible: d.flexible ?? false }));
}

export function swapArgs(args: unknown): { a: string; b: string } {
  checkArgs(args, {
    a: { type: "string", required: true, max: LIMITS.id },
    b: { type: "string", required: true, max: LIMITS.id },
  });
  const { a, b } = args as { a: string; b: string };
  if (a === b) throw new DomainError("cannot swap a day with itself");
  return { a, b };
}
