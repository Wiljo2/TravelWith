import { DomainError } from "@/server/domain/core";
import { closeVoteArgs, closeVoteDays, requireOpenTask, voteArgs } from "@/server/domain/voteRows";
import { RowNotFoundError } from "@/server/repo/errors";
import { eventsRepo } from "@/server/repo/events";
import { setOptionVote, taskOptionsRepo } from "@/server/repo/taskOptions";
import { closeTaskVote, tasksRepo } from "@/server/repo/tasks";
import type { OpDefinition, RowChange } from "@/server/ops/types";

export const VOTE_OPS: Record<string, OpDefinition> = {
  // Approval voting: one toggle per option and member. Unguarded (the SQL
  // function adds or removes only the caller's id), but it still bumps the
  // option version, so the response row carries every vote committed so far.
  "taskOption.vote": {
    async run(ctx, { args }) {
      const { id, on } = voteArgs(args);
      const option = await taskOptionsRepo.get(ctx.code, id);
      if (!option) throw new RowNotFoundError("trip_task_options", id);
      const task = await tasksRepo.get(ctx.code, option.task_id);
      if (!task) throw new RowNotFoundError("trip_tasks", option.task_id);
      requireOpenTask(task);
      const row = await setOptionVote(ctx.code, id, on, ctx.userId);
      return { changed: [{ table: "trip_task_options", row }], deleted: [] };
    },
  },

  // The owner settles a date or destination vote with one option: the trip
  // gets its dates (and the days are rebuilt) or its destination, and the vote
  // is done, in one transaction. Rebuilding deletes every activity, so with
  // activities it needs `replaceItinerary` (the UI confirms first); the SQL
  // re-checks, so one added meanwhile is never wiped silently.
  "task.closeVote": {
    minRole: "owner",
    async run(ctx, { args, expectedVersion }) {
      const { taskId, optionId, replaceItinerary } = closeVoteArgs(args);
      const task = await tasksRepo.get(ctx.code, taskId);
      if (!task) throw new RowNotFoundError("trip_tasks", taskId);
      const option = await taskOptionsRepo.get(ctx.code, optionId);
      if (!option) throw new DomainError(`Option "${optionId}" not found in task "${taskId}"`);
      const days = closeVoteDays(task, option);
      if (days && !replaceItinerary) {
        const events = await eventsRepo.list(ctx.code);
        if (events.length > 0) {
          throw new DomainError(
            `The itinerary has ${events.length} activities; closing a dates vote deletes them (pass replaceItinerary: true)`,
          );
        }
      }
      const result = await closeTaskVote(ctx.code, taskId, optionId, expectedVersion, days, replaceItinerary, ctx.userId);
      return {
        changed: [
          { table: "trip_tasks", row: result.task },
          ...(result.days ?? []).map((row): RowChange => ({ table: "trip_days", row })),
        ],
        deleted: [],
        trip: result.trip,
      };
    },
  },
};
