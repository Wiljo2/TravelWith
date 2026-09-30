import { LIMITS } from "@/constants/limits";
import { DomainError, checkArgs, checkClientId } from "@/server/domain/core";
import type { NewRow } from "@/server/repo/core";
import type { RoomHeaderRow } from "@/server/repo/trip";
import { MAX_TRIP_DAYS, parseISODate } from "@/utils/tripDays";
import { uid } from "@/utils/uid";

const DAY_MS = 24 * 60 * 60 * 1000;

// Header patch for trip.update, validated against the stored dates so a
// change of only one date still yields a valid range. Days are not
// regenerated here: that is itinerary.reset.
export function tripHeaderPatch(current: RoomHeaderRow, args: unknown): Partial<Omit<RoomHeaderRow, "code">> {
  checkArgs(args, {
    name: { type: "string", max: LIMITS.name },
    startDate: { type: "string", max: 10 },
    endDate: { type: "string", max: 10 },
  });
  const a = args as Record<string, unknown>;
  const patch: Partial<Omit<RoomHeaderRow, "code">> = {};

  if (a.name !== undefined) {
    patch.name = (a.name as string).trim();
    if (!patch.name) throw new DomainError("name cannot be empty");
  }
  if (a.destination !== undefined) {
    if (a.destination !== null && typeof a.destination !== "string") throw new DomainError("destination must be a string");
    const destination = typeof a.destination === "string" ? a.destination.trim() : "";
    if (destination.length > LIMITS.name) throw new DomainError(`destination is too long (max ${LIMITS.name} characters)`);
    patch.destination = destination || null;
  }
  if (a.startDate !== undefined) patch.start_date = a.startDate as string;
  if (a.endDate !== undefined) patch.end_date = a.endDate as string;
  if (Object.keys(patch).length === 0) throw new DomainError("nothing to update");

  if (patch.start_date !== undefined || patch.end_date !== undefined) {
    const start = parseISODate(patch.start_date ?? current.start_date ?? "");
    const end = parseISODate(patch.end_date ?? current.end_date ?? "");
    if (!start || !end) throw new DomainError("startDate and endDate must be valid dates (yyyy-mm-dd)");
    if (end < start) throw new DomainError("endDate must be on or after startDate");
    if (Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1 > MAX_TRIP_DAYS) {
      throw new DomainError(`A trip can last at most ${MAX_TRIP_DAYS} days`);
    }
  }
  return patch;
}

export function newTravelerRow(args: unknown, position: number): NewRow<"trip_travelers"> {
  checkArgs(args, { id: { type: "string" }, name: { type: "string", required: true, max: LIMITS.name } });
  const a = args as { id?: string; name: string };
  const name = a.name.trim();
  if (!name) throw new DomainError("name is required");
  return { id: a.id === undefined ? uid() : checkClientId(a.id), position, name };
}
