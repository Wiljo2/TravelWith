import { CATEGORIES } from "@/constants/categories";
import { HOUR_START, HOUR_END } from "@/constants/time";
import { DomainError } from "./core";

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
