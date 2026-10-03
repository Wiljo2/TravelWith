import { HOUR_END } from "@/constants/time";
import type { Extra, Task } from "@/types";

interface Deps {
  addEvent: (dayId: string, title: string, start: number, end: number, note?: string, cat?: string) => string;
  addExtra: (extra: Omit<Extra, "id">) => void;
  deleteTask: (id: string) => void;
}

// Confirm a decision: choosing an option promotes the task to a real activity
// (a calendar event if it's scheduled) plus a budget line, then removes the task.
export function chooseOption(tasks: Task[], taskId: string, optionId: string, { addEvent, addExtra, deleteTask }: Deps) {
  const task = tasks.find((t) => t.id === taskId);
  const option = task?.options?.find((o) => o.id === optionId);
  if (!task || !option) return;

  let linkedEventId: string | undefined;
  if (task.dayId && task.start != null) {
    const end = task.end ?? Math.min(task.start + 1, HOUR_END);
    linkedEventId = addEvent(task.dayId, task.title, task.start, end, option.note ?? "", "logist");
  }
  if (option.amount && option.amount > 0) {
    addExtra({
      label: `${task.title}: ${option.label}`,
      amount: option.amount,
      currency: option.currency ?? "USD",
      splitMode: option.splitMode ?? "group",
      linkedEventId,
    });
  }
  deleteTask(taskId);
}
