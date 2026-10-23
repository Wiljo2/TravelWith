import { LIMITS } from "@/constants/limits";
import { DomainError } from "@/server/domain/core";
import { newTaskRow } from "@/server/domain/taskRows";
import { newTravelerRow } from "@/server/domain/tripRows";
import type { NewRow } from "@/server/repo/core";

export interface TripSeedRows {
  travelers: NewRow<"trip_travelers">[];
  tasks: NewRow<"trip_tasks">[];
}

// Optional rows POST /api/rooms creates with a new trip (the creation wizard's
// placeholder travelers and starter tasks). Absent fields seed nothing.
export function tripSeedRows(body: Record<string, unknown>): TripSeedRows {
  return {
    travelers: seedList(body.travelers, "travelers", LIMITS.travelers).map((name, i) => newTravelerRow({ name }, i)),
    tasks: seedList(body.tasks, "tasks", LIMITS.starterTasks).map((task, i) => newTaskRow(starterTaskArgs(task), i)),
  };
}

function seedList(value: unknown, field: string, max: number): unknown[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new DomainError(`${field} must be an array`);
  if (value.length > max) throw new DomainError(`${field} can have at most ${max} items`);
  return value;
}

// Starter tasks go to the backlog: only the title, category and priority are read.
function starterTaskArgs(task: unknown) {
  if (typeof task !== "object" || task === null || Array.isArray(task)) throw new DomainError("each task must be an object");
  const { title, cat, priority } = task as Record<string, unknown>;
  return { title, cat, priority };
}
