import type { TaskPriority } from "@/types";
import { TASK_CATEGORIES, PRIORITIES } from "@/constants/taskCategories";
import { HOUR_START, HOUR_END } from "@/constants/time";
import { DomainError } from "./core";

export function validateTaskCat(cat: string) {
  if (!TASK_CATEGORIES[cat]) {
    throw new DomainError(`Unknown task category "${cat}". Valid: ${Object.keys(TASK_CATEGORIES).join(", ")}`);
  }
}

export function validatePriority(priority: string): asserts priority is TaskPriority {
  if (!(priority in PRIORITIES)) {
    throw new DomainError(`Unknown priority "${priority}". Valid: ${Object.keys(PRIORITIES).join(", ")}`);
  }
}

export function validateSchedule(start: number, end: number) {
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    throw new DomainError("start and end must be decimal hours (e.g. 19.5 = 7:30pm)");
  }
  if (start < HOUR_START || end > HOUR_END || end <= start) {
    throw new DomainError(
      `Invalid time range: hours must satisfy ${HOUR_START} <= start < end <= ${HOUR_END} (decimal hours)`,
    );
  }
}
