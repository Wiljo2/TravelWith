import { requireOpenTask, voteArgs } from "@/server/domain/voteRows";
import { RowNotFoundError } from "@/server/repo/errors";
import { setOptionVote, taskOptionsRepo } from "@/server/repo/taskOptions";
import { tasksRepo } from "@/server/repo/tasks";
import type { OpDefinition } from "@/server/ops/types";

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
};
