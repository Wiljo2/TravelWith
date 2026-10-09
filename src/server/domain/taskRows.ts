import { LIMITS } from "@/constants/limits";
import { HOUR_END } from "@/constants/time";
import { DomainError, checkArgs, checkClientId } from "@/server/domain/core";
import { iconArg, optionalIcon } from "@/server/domain/featureRows";
import { parseAmount, parseCurrency, parseSplitMode } from "@/server/domain/expenseRows";
import { validatePriority, validateSchedule, validateTaskCat } from "@/server/domain/tasks";
import type { NewRow, RowPatch } from "@/server/repo/core";
import type { TripTaskOptionRow, TripTaskRow } from "@/types/database";
import { uid } from "@/utils/uid";

// Pure validation for task and task option ops on rows. The op checks that
// referenced days exist and enforces per-trip / per-task limits.

type Args = Record<string, unknown>;

const TASK_FIELDS = {
  id: { type: "string" },
  title: { type: "string", max: LIMITS.title },
  note: { type: "string", max: LIMITS.note },
  cat: { type: "string", max: LIMITS.id },
  priority: { type: "string", max: LIMITS.id },
  dayId: { type: "string", max: LIMITS.id },
  start: { type: "number" },
  end: { type: "number" },
  done: { type: "boolean" },
  unschedule: { type: "boolean" },
} as const;

function schedule(start: number | undefined, end: number | undefined): { start_hour: number; end_hour: number } {
  const s = start ?? 9;
  const e = end ?? Math.min(s + 1, HOUR_END);
  validateSchedule(s, e);
  return { start_hour: s, end_hour: e };
}

export function newTaskRow(args: unknown, position: number): NewRow<"trip_tasks"> {
  checkArgs(args, { ...TASK_FIELDS, title: { ...TASK_FIELDS.title, required: true } });
  const a = args as Args;
  const title = (a.title as string).trim();
  if (!title) throw new DomainError("title is required");
  if (a.cat !== undefined) validateTaskCat(a.cat as string);
  if (a.priority !== undefined) validatePriority(a.priority as string);
  const note = typeof a.note === "string" && a.note.trim() ? a.note.trim() : null;
  return {
    id: a.id === undefined ? uid() : checkClientId(a.id),
    position,
    title,
    done: (a.done as boolean | undefined) ?? false,
    note,
    cat: (a.cat as string | undefined) ?? null,
    priority: (a.priority as TripTaskRow["priority"] | undefined) ?? null,
    ...optionalIcon(iconArg(a.icon)),
    ...(a.dayId !== undefined
      ? { day_id: a.dayId as string, ...schedule(a.start as number | undefined, a.end as number | undefined) }
      : { day_id: null, start_hour: null, end_hour: null }),
  };
}

// Scheduling merges with the stored day/hours; `unschedule` moves the task
// back to the backlog.
export function taskPatch(current: TripTaskRow, args: unknown): RowPatch<"trip_tasks"> {
  checkArgs(args, { ...TASK_FIELDS, id: { type: "string", required: true } });
  const a = args as Args;
  const patch: RowPatch<"trip_tasks"> = {};
  if (a.title !== undefined) {
    patch.title = (a.title as string).trim();
    if (!patch.title) throw new DomainError("title cannot be empty");
  }
  if (a.note !== undefined) patch.note = a.note as string;
  if (a.done !== undefined) patch.done = a.done as boolean;
  if (a.cat !== undefined) {
    validateTaskCat(a.cat as string);
    patch.cat = a.cat as string;
  }
  if (a.priority !== undefined) {
    validatePriority(a.priority as string);
    patch.priority = a.priority as TripTaskRow["priority"];
  }
  const icon = iconArg(a.icon);
  if (icon !== undefined) patch.icon = icon;
  if (a.unschedule) {
    Object.assign(patch, { day_id: null, start_hour: null, end_hour: null });
  } else if (a.dayId !== undefined || a.start !== undefined || a.end !== undefined) {
    const dayId = (a.dayId as string | undefined) ?? current.day_id;
    if (!dayId) throw new DomainError("dayId is required to schedule a task (or pass unschedule: true)");
    const stored = current.day_id ? current : null;
    Object.assign(patch, {
      day_id: dayId,
      ...schedule(
        (a.start as number | undefined) ?? (stored?.start_hour == null ? undefined : Number(stored.start_hour)),
        (a.end as number | undefined) ?? (stored?.end_hour == null ? undefined : Number(stored.end_hour)),
      ),
    });
  }
  if (Object.keys(patch).length === 0) throw new DomainError("nothing to update");
  return patch;
}

const OPTION_FIELDS = {
  id: { type: "string" },
  taskId: { type: "string", max: LIMITS.id },
  label: { type: "string", max: LIMITS.label },
  note: { type: "string", max: LIMITS.note },
} as const;

export function newTaskOptionRow(args: unknown, position: number): NewRow<"trip_task_options"> {
  checkArgs(args, { ...OPTION_FIELDS, taskId: { ...OPTION_FIELDS.taskId, required: true }, label: { ...OPTION_FIELDS.label, required: true } });
  const a = args as Args;
  const label = (a.label as string).trim();
  if (!label) throw new DomainError("label is required");
  return {
    id: a.id === undefined ? uid() : checkClientId(a.id),
    task_id: a.taskId as string,
    position,
    label,
    note: (a.note as string | undefined) ?? null,
    amount: a.amount == null ? null : parseAmount(a.amount),
    currency: a.currency == null ? null : parseCurrency(a.currency),
    split_mode: a.splitMode == null ? null : parseSplitMode(a.splitMode),
  };
}

export function taskOptionPatch(args: unknown): RowPatch<"trip_task_options"> {
  checkArgs(args, { ...OPTION_FIELDS, id: { type: "string", required: true } });
  const a = args as Args;
  const patch: RowPatch<"trip_task_options"> = {};
  if (a.label !== undefined) {
    patch.label = (a.label as string).trim();
    if (!patch.label) throw new DomainError("label cannot be empty");
  }
  if (a.note !== undefined) patch.note = a.note as string;
  if (a.amount !== undefined) patch.amount = a.amount === null ? null : parseAmount(a.amount);
  if (a.currency !== undefined) patch.currency = a.currency === null ? null : parseCurrency(a.currency);
  if (a.splitMode !== undefined) patch.split_mode = a.splitMode === null ? null : parseSplitMode(a.splitMode);
  if (Object.keys(patch).length === 0) throw new DomainError("nothing to update");
  return patch;
}

export interface ChooseOptionArgs {
  taskId: string;
  optionId: string;
  eventId?: string;
  expenseId?: string;
}

export function chooseOptionArgs(args: unknown): ChooseOptionArgs {
  checkArgs(args, {
    taskId: { type: "string", required: true, max: LIMITS.id },
    optionId: { type: "string", required: true, max: LIMITS.id },
    eventId: { type: "string" },
    expenseId: { type: "string" },
  });
  const a = args as ChooseOptionArgs;
  return {
    taskId: a.taskId,
    optionId: a.optionId,
    ...(a.eventId !== undefined ? { eventId: checkClientId(a.eventId, "eventId") } : {}),
    ...(a.expenseId !== undefined ? { expenseId: checkClientId(a.expenseId, "expenseId") } : {}),
  };
}

// Confirming a task: a scheduled task becomes a calendar event (category
// "logist", the option's note), and an option with a cost becomes an expense
// linked to that event. Same rules as the client had.
export function chosenOptionRows(task: TripTaskRow, option: TripTaskOptionRow, ids: { eventId?: string; expenseId?: string }) {
  const start = task.start_hour == null ? null : Number(task.start_hour);
  const event = task.day_id && start != null
    ? {
        id: ids.eventId ?? uid(),
        day_id: task.day_id,
        start_hour: start,
        end_hour: task.end_hour == null ? Math.min(start + 1, HOUR_END) : Number(task.end_hour),
        title: task.title,
        cat: "logist",
        note: option.note ?? "",
      }
    : null;
  const amount = option.amount == null ? 0 : Number(option.amount);
  const expense = amount > 0
    ? {
        id: ids.expenseId ?? uid(),
        label: `${task.title}: ${option.label}`.slice(0, LIMITS.label),
        amount,
        currency: option.currency ?? "USD",
        split_mode: option.split_mode ?? "group",
      }
    : null;
  return { event, expense };
}
