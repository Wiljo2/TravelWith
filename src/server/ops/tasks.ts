import { LIMITS } from "@/constants/limits";
import { VOTE_KINDS } from "@/constants/votes";
import { DomainError, argId } from "@/server/domain/core";
import {
  chooseOptionArgs, chosenOptionRows, newTaskOptionRow, newTaskRow, taskOptionPatch, taskPatch,
} from "@/server/domain/taskRows";
import { checkVoteOption, optionLimit, requireEditableOptions } from "@/server/domain/voteRows";
import { HttpError } from "@/server/http";
import { RowNotFoundError } from "@/server/repo/errors";
import { eventsRepo } from "@/server/repo/events";
import { taskOptionsRepo } from "@/server/repo/taskOptions";
import { chooseTaskOption, tasksRepo } from "@/server/repo/tasks";
import { requireDayRow } from "@/server/ops/shared";
import type { OpContext, OpDefinition, RowChange } from "@/server/ops/types";
import type { TripTaskRow } from "@/types/database";

function nextPosition(rows: { position: number }[]): number {
  return rows.length ? Math.max(...rows.map((r) => r.position)) + 1 : 0;
}

async function requireTaskRow(code: string, id: string) {
  const row = await tasksRepo.get(code, id);
  if (!row) throw new RowNotFoundError("trip_tasks", id);
  return row;
}

async function requireOptionRow(code: string, id: string) {
  const row = await taskOptionsRepo.get(code, id);
  if (!row) throw new RowNotFoundError("trip_task_options", id);
  return row;
}

// Only the owner settles a date or destination vote (task.closeVote): marking
// one done or deleting it is theirs too.
function requireVoteOwner(ctx: OpContext, task: Pick<TripTaskRow, "decides"> | null) {
  if (task?.decides && ctx.role !== "owner") {
    throw new HttpError(403, "Solo el creador del viaje puede cerrar o borrar esta votación");
  }
}

export const TASK_OPS: Record<string, OpDefinition> = {
  "task.create": {
    async run(ctx, { args }) {
      const existing = await tasksRepo.list(ctx.code);
      if (existing.length >= LIMITS.tasks) throw new DomainError(`The trip already has ${LIMITS.tasks} tasks`);
      const newRow = newTaskRow(args, nextPosition(existing));
      if (newRow.decides && existing.some((t) => t.decides === newRow.decides && !t.done)) {
        throw new DomainError(`The trip already has an open vote "${VOTE_KINDS[newRow.decides].title}"`);
      }
      if (newRow.day_id) await requireDayRow(ctx.code, newRow.day_id);
      const row = await tasksRepo.insert(ctx.code, newRow, ctx.userId);
      return { changed: [{ table: "trip_tasks", row }], deleted: [] };
    },
  },

  "task.update": {
    async run(ctx, { args, expectedVersion }) {
      const id = argId(args);
      const current = await requireTaskRow(ctx.code, id);
      const patch = taskPatch(current, args);
      if (patch.done !== undefined) requireVoteOwner(ctx, current);
      if (patch.day_id) await requireDayRow(ctx.code, patch.day_id);
      const row = await tasksRepo.update(ctx.code, id, patch, expectedVersion, ctx.userId);
      return { changed: [{ table: "trip_tasks", row }], deleted: [] };
    },
  },

  // Flips `done` relative to the version the client saw, so two members
  // toggling at once conflict instead of cancelling each other out.
  "task.toggle": {
    async run(ctx, { args, expectedVersion }) {
      const id = argId(args);
      const current = await requireTaskRow(ctx.code, id);
      requireVoteOwner(ctx, current);
      const row = await tasksRepo.update(ctx.code, id, { done: !current.done }, expectedVersion ?? current.version, ctx.userId);
      return { changed: [{ table: "trip_tasks", row }], deleted: [] };
    },
  },

  "task.delete": {
    async run(ctx, { args, expectedVersion }) {
      const id = argId(args);
      requireVoteOwner(ctx, await tasksRepo.get(ctx.code, id));
      await tasksRepo.remove(ctx.code, id, expectedVersion, ctx.userId);
      return { changed: [], deleted: [{ table: "trip_tasks", id }] };
    },
  },

  // Event and expense ids may come from the client so its optimistic rows match.
  "task.chooseOption": {
    async run(ctx, { args, expectedVersion }) {
      const { taskId, optionId, eventId, expenseId } = chooseOptionArgs(args);
      const task = await requireTaskRow(ctx.code, taskId);
      if (task.decides) throw new DomainError(`Task "${taskId}" is a group vote; the trip owner closes it with task.closeVote`);
      const option = await taskOptionsRepo.get(ctx.code, optionId);
      if (!option || option.task_id !== taskId) throw new DomainError(`Option "${optionId}" not found in task "${taskId}"`);
      const { event, expense } = chosenOptionRows(task, option, { eventId, expenseId });
      if (event) {
        const dayEvents = await eventsRepo.list(ctx.code, { column: "day_id", value: event.day_id });
        if (dayEvents.length >= LIMITS.eventsPerDay) throw new DomainError(`Day ${event.day_id} already has ${LIMITS.eventsPerDay} events`);
      }
      const result = await chooseTaskOption(ctx.code, taskId, expectedVersion, event, expense, ctx.userId);
      const changed: RowChange[] = [];
      if (result.event) changed.push({ table: "trip_events", row: result.event });
      if (result.expense) changed.push({ table: "trip_expenses", row: result.expense });
      return { changed, deleted: [{ table: "trip_tasks", id: taskId }] };
    },
  },

  "taskOption.create": {
    async run(ctx, { args }) {
      const taskId = (args as { taskId?: unknown }).taskId;
      if (typeof taskId !== "string") throw new DomainError("taskId is required");
      const task = await requireTaskRow(ctx.code, taskId);
      const existing = await taskOptionsRepo.list(ctx.code, { column: "task_id", value: taskId });
      const limit = optionLimit(task);
      if (existing.length >= limit) throw new DomainError(`Task ${taskId} already has ${limit} options`);
      const newRow = newTaskOptionRow(args, nextPosition(existing));
      checkVoteOption(task, newRow, true);
      const row = await taskOptionsRepo.insert(ctx.code, newRow, ctx.userId);
      return { changed: [{ table: "trip_task_options", row }], deleted: [] };
    },
  },

  "taskOption.update": {
    async run(ctx, { args, expectedVersion }) {
      const id = argId(args);
      const patch = taskOptionPatch(args);
      const option = await requireOptionRow(ctx.code, id);
      checkVoteOption(await requireTaskRow(ctx.code, option.task_id), patch, false);
      const row = await taskOptionsRepo.update(ctx.code, id, patch, expectedVersion, ctx.userId);
      return { changed: [{ table: "trip_task_options", row }], deleted: [] };
    },
  },

  "taskOption.delete": {
    async run(ctx, { args, expectedVersion }) {
      const id = argId(args);
      const option = await taskOptionsRepo.get(ctx.code, id);
      const task = option && (await tasksRepo.get(ctx.code, option.task_id));
      if (task) requireEditableOptions(task);
      await taskOptionsRepo.remove(ctx.code, id, expectedVersion, ctx.userId);
      return { changed: [], deleted: [{ table: "trip_task_options", id }] };
    },
  },
};
