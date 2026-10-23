import { LIMITS } from "@/constants/limits";
import { DomainError, checkArgs } from "@/server/domain/core";
import type { TripTaskRow } from "@/types/database";

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
