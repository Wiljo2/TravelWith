import { LIMITS } from "@/constants/limits";
import { VOTE_KINDS } from "@/constants/votes";
import { DomainError, checkArgs } from "@/server/domain/core";
import { resetDays } from "@/server/domain/dayRows";
import { checkDateRange } from "@/server/domain/tripRows";
import type { ResetDay } from "@/server/repo/days";
import type { TripTaskOptionRow, TripTaskRow } from "@/types/database";
import type { TaskDecides } from "@/types";

// Pure checks for vote ops. The voter is never an argument: it is always the
// member making the request.

export interface VoteArgs {
  id: string;
  on: boolean;
}

export function voteArgs(args: unknown): VoteArgs {
  checkArgs(args, {
    id: { type: "string", required: true, max: LIMITS.id },
    on: { type: "boolean", required: true },
  });
  const a = args as VoteArgs;
  return { id: a.id, on: a.on };
}

export function requireOpenTask(task: Pick<TripTaskRow, "id" | "done">): void {
  if (task.done) throw new DomainError(`Task "${task.id}" is already done; its options no longer take votes`);
}

export function parseDecides(value: unknown): TaskDecides {
  if (typeof value !== "string" || !Object.hasOwn(VOTE_KINDS, value)) {
    throw new DomainError(`decides must be one of: ${Object.keys(VOTE_KINDS).join(", ")}`);
  }
  return value as TaskDecides;
}

type OptionDates = Partial<Pick<TripTaskOptionRow, "start_date" | "end_date">>;

// startDate/endDate of an option: both or neither; null for both clears them (updates only).
export function optionDates(args: Record<string, unknown>, allowClear: boolean): OptionDates {
  const { startDate, endDate } = args;
  if (startDate === undefined && endDate === undefined) return {};
  if (allowClear && startDate === null && endDate === null) return { start_date: null, end_date: null };
  if (typeof startDate !== "string" || typeof endDate !== "string") {
    throw new DomainError("startDate and endDate go together, as yyyy-mm-dd");
  }
  checkDateRange(startDate, endDate);
  return { start_date: startDate, end_date: endDate };
}

type VoteTask = Pick<TripTaskRow, "id" | "decides" | "done">;
type OptionWrite = { label?: string } & OptionDates;

// What an option may hold given its task: only the options of a dates vote
// have dates (and need them), a destination is a short name (it becomes the
// trip destination), and a closed vote takes no more changes.
export function checkVoteOption(task: VoteTask, option: OptionWrite, creating: boolean): void {
  const hasDates = typeof option.start_date === "string";
  if (!task.decides) {
    if (hasDates) throw new DomainError("Only the options of a dates vote have dates");
    return;
  }
  requireEditableOptions(task);
  if (task.decides === "dates") {
    if (creating ? !hasDates : option.start_date === null) {
      throw new DomainError("The options of a dates vote need startDate and endDate (yyyy-mm-dd)");
    }
    return;
  }
  if (hasDates) throw new DomainError("The options of a destination vote are names, without dates");
  if (option.label !== undefined && option.label.length > LIMITS.name) {
    throw new DomainError(`A destination is at most ${LIMITS.name} characters`);
  }
}

export function optionLimit(task: Pick<TripTaskRow, "decides">): number {
  return task.decides ? LIMITS.voteOptions : LIMITS.optionsPerTask;
}

// A closed vote keeps its options as they were when the owner chose.
export function requireEditableOptions(task: VoteTask): void {
  if (task.decides && task.done) throw new DomainError(`The vote "${task.id}" is closed; its options can no longer change`);
}

export interface CloseVoteArgs {
  taskId: string;
  optionId: string;
  replaceItinerary: boolean;
}

export function closeVoteArgs(args: unknown): CloseVoteArgs {
  checkArgs(args, {
    taskId: { type: "string", required: true, max: LIMITS.id },
    optionId: { type: "string", required: true, max: LIMITS.id },
    replaceItinerary: { type: "boolean" },
  });
  const a = args as Partial<CloseVoteArgs>;
  return { taskId: a.taskId!, optionId: a.optionId!, replaceItinerary: a.replaceItinerary ?? false };
}

// What closing a vote with this option writes: the days of a dates vote
// (one per date, same ids as a new trip), or nothing extra for a destination.
export function closeVoteDays(task: VoteTask, option: TripTaskOptionRow): ResetDay[] | null {
  if (!task.decides || task.done) throw new DomainError(`Task "${task.id}" is not an open vote`);
  if (option.task_id !== task.id) throw new DomainError(`Option "${option.id}" not found in task "${task.id}"`);
  if (task.decides === "destination") {
    if (option.label.trim().length > LIMITS.name) throw new DomainError(`A destination is at most ${LIMITS.name} characters`);
    return null;
  }
  if (!option.start_date || !option.end_date) throw new DomainError(`Option "${option.id}" has no dates`);
  const days = resetDays({ startDate: option.start_date, endDate: option.end_date }, []);
  if (days.length === 0) throw new DomainError(`Option "${option.id}" has no valid date range`);
  return days;
}
