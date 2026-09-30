import type { RoomPayload, Task, TaskPriority } from "@/types";
import { TASK_CATEGORIES, PRIORITIES } from "@/constants/taskCategories";
import { HOUR_START, HOUR_END } from "@/constants/time";
import { uid } from "@/utils/uid";
import { LIMITS } from "@/constants/limits";
import { DomainError, checkArgs, requireDay } from "./core";

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

const TASK_FIELDS = {
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

function requireTask(payload: RoomPayload, taskId: string): Task {
  const task = (payload.tasks ?? []).find((t) => t.id === taskId);
  if (!task) throw new DomainError(`Task "${taskId}" not found. Use get_trip_overview to list current task ids.`);
  return task;
}

export interface AddTaskArgs {
  title: string;
  note?: string;
  cat?: string;
  priority?: string;
  dayId?: string;   // schedule on the calendar; omit for backlog
  start?: number;
  end?: number;
}

export function addTask(payload: RoomPayload, args: AddTaskArgs): { payload: RoomPayload; task: Task } {
  checkArgs(args, { ...TASK_FIELDS, title: { ...TASK_FIELDS.title, required: true } });
  if (!args.title.trim()) throw new DomainError("title is required");
  if ((payload.tasks ?? []).length >= LIMITS.tasks) throw new DomainError(`The trip already has ${LIMITS.tasks} tasks`);
  if (args.cat) validateTaskCat(args.cat);
  if (args.priority) validatePriority(args.priority);

  const task: Task = {
    id: uid(),
    title: args.title.trim(),
    done: false,
    ...(args.note?.trim() ? { note: args.note.trim() } : {}),
    ...(args.cat ? { cat: args.cat } : {}),
    ...(args.priority ? { priority: args.priority as TaskPriority } : {}),
  };

  if (args.dayId) {
    requireDay(payload, args.dayId);
    const start = args.start ?? 9;
    const end = args.end ?? Math.min(start + 1, HOUR_END);
    validateSchedule(start, end);
    task.dayId = args.dayId;
    task.start = start;
    task.end = end;
  }

  return { payload: { ...payload, tasks: [...(payload.tasks ?? []), task] }, task };
}

export interface UpdateTaskArgs {
  title?: string;
  note?: string;
  done?: boolean;
  cat?: string;
  priority?: string;
  dayId?: string;
  start?: number;
  end?: number;
  unschedule?: boolean; // remove from the calendar, keep in backlog
}

export function updateTask(
  payload: RoomPayload,
  taskId: string,
  patch: UpdateTaskArgs,
): { payload: RoomPayload; task: Task } {
  checkArgs(patch, TASK_FIELDS);
  const current = requireTask(payload, taskId);
  if (patch.cat) validateTaskCat(patch.cat);
  if (patch.priority) validatePriority(patch.priority);

  const next: Task = {
    ...current,
    ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
    ...(patch.note !== undefined ? { note: patch.note } : {}),
    ...(patch.done !== undefined ? { done: patch.done } : {}),
    ...(patch.cat !== undefined ? { cat: patch.cat } : {}),
    ...(patch.priority !== undefined ? { priority: patch.priority as TaskPriority } : {}),
  };
  if (!next.title) throw new DomainError("title cannot be empty");

  if (patch.unschedule) {
    next.dayId = undefined;
    next.start = undefined;
    next.end = undefined;
  } else if (patch.dayId !== undefined || patch.start !== undefined || patch.end !== undefined) {
    const dayId = patch.dayId ?? current.dayId;
    if (!dayId) throw new DomainError("dayId is required to schedule a task (or pass unschedule: true)");
    requireDay(payload, dayId);
    const start = patch.start ?? current.start ?? 9;
    const end = patch.end ?? current.end ?? Math.min(start + 1, HOUR_END);
    validateSchedule(start, end);
    next.dayId = dayId;
    next.start = start;
    next.end = end;
  }

  const tasks = (payload.tasks ?? []).map((t) => (t.id === taskId ? next : t));
  return { payload: { ...payload, tasks }, task: next };
}

export function deleteTask(payload: RoomPayload, taskId: string): { payload: RoomPayload; task: Task } {
  const task = requireTask(payload, taskId);
  const tasks = (payload.tasks ?? []).filter((t) => t.id !== taskId);
  return { payload: { ...payload, tasks }, task };
}
