import { useCallback, useEffect, useRef, useState } from "react";
import type { Task, TaskOption } from "@/types";
import { sendable } from "@/lib/opQueue";
import { applyToTasks, type Row, type TripTable } from "@/utils/tripRows";
import type { IsKnown, SendOp } from "@/hooks/useTripOps";

function defined(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

function optionArgs(o: TaskOption): Record<string, unknown> {
  return defined({ id: o.id, label: o.label, note: o.note, amount: o.amount, currency: o.currency, splitMode: o.splitMode });
}

// Options are edited as a whole list; the server stores one row each. New
// options are created once they have a label (the server requires one).
function syncOptions(taskId: string, prev: TaskOption[], next: TaskOption[], send: SendOp, isKnown: IsKnown) {
  for (const o of prev) {
    if (!next.some((n) => n.id === o.id) && isKnown("trip_task_options", o.id)) send("taskOption.delete", { id: o.id });
  }
  for (const o of next) {
    if (!isKnown("trip_task_options", o.id)) {
      if (o.label.trim()) send("taskOption.create", { ...optionArgs(o), taskId });
      continue;
    }
    const old = prev.find((p) => p.id === o.id);
    const changed: Record<string, unknown> = { id: o.id };
    for (const k of ["label", "note", "amount", "currency", "splitMode"] as const) {
      if (old?.[k] !== o[k]) changed[k] = o[k] ?? (k === "note" ? "" : null);
    }
    const args = sendable(changed);
    if (args) send("taskOption.update", args);
  }
}

export function useTasks(send: SendOp, isKnown: IsKnown) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const latest = useRef(tasks);
  useEffect(() => {
    latest.current = tasks;
  }, [tasks]);

  function addTask(partial: Partial<Task> & { title: string }) {
    const task: Task = { id: crypto.randomUUID(), done: false, ...partial };
    setTasks((prev) => [...prev, task]);
    if (task.title.trim()) {
      const { options: _options, version: _version, ...fields } = task;
      send("task.create", defined(fields));
    }
  }

  function toggleTask(id: string) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
    send("task.toggle", { id });
  }

  function updateTask(id: string, patch: Partial<Task>) {
    const before = latest.current.find((t) => t.id === id);
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    const { options, ...fields } = patch;
    if (options) syncOptions(id, before?.options ?? [], options, send, isKnown);

    // `dayId: undefined` in a patch means "back to the backlog".
    const unschedule = "dayId" in fields && fields.dayId === undefined;
    const args: Record<string, unknown> = { id };
    for (const [k, v] of Object.entries(fields)) {
      if (k === "id" || k === "version") continue;
      if (unschedule && (k === "dayId" || k === "start" || k === "end")) continue;
      if (k === "note") args.note = v ?? "";
      else if (v !== undefined) args[k] = v;
    }
    if ("icon" in fields) args.icon = fields.icon ?? null;
    if (unschedule) args.unschedule = true;
    const sent = sendable(args);
    if (sent) send("task.update", sent);
  }

  function deleteTask(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    send("task.delete", { id });
  }

  // The server creates the event and expense and deletes the task in one
  // transaction; the new rows come back in the response.
  function chooseOption(taskId: string, optionId: string) {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    send("task.chooseOption", { taskId, optionId });
  }

  // Scheduled tasks follow their day when two days are swapped.
  function swapTaskDays(aId: string, bId: string) {
    setTasks((prev) => prev.map((t) => (t.dayId === aId ? { ...t, dayId: bId } : t.dayId === bId ? { ...t, dayId: aId } : t)));
  }

  const loadTasks = useCallback((incoming: Task[] | undefined) => {
    if (Array.isArray(incoming)) setTasks(incoming);
  }, []);

  const applyRow = useCallback((table: TripTable, id: string, row: Row | null) => {
    setTasks((prev) => applyToTasks(prev, table, id, row));
  }, []);

  return { tasks, addTask, toggleTask, updateTask, deleteTask, chooseOption, swapTaskDays, loadTasks, applyRow };
}
