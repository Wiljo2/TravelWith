import { LIMITS } from "@/constants/limits";
import { VOTE_KINDS } from "@/constants/votes";
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
  const tasks = seedList(body.tasks, "tasks", LIMITS.starterTasks).map((task, i) => newTaskRow(starterTaskArgs(task), i));
  for (const kind of Object.keys(VOTE_KINDS)) {
    if (tasks.filter((t) => t.decides === kind).length > 1) throw new DomainError(`tasks can open only one "${kind}" vote`);
  }
  return {
    travelers: seedList(body.travelers, "travelers", LIMITS.travelers).map((name, i) => newTravelerRow({ name }, i)),
    tasks,
  };
}

function seedList(value: unknown, field: string, max: number): unknown[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new DomainError(`${field} must be an array`);
  if (value.length > max) throw new DomainError(`${field} can have at most ${max} items`);
  return value;
}

// Starter tasks go to the backlog: only the title, category, priority and vote
// kind are read. One with `decides` is a dates or destination vote, built like
// task.create builds it (always open and "Por decidir").
function starterTaskArgs(task: unknown) {
  if (typeof task !== "object" || task === null || Array.isArray(task)) throw new DomainError("each task must be an object");
  const { title, cat, priority, decides } = task as Record<string, unknown>;
  return { title, cat, priority, decides };
}
