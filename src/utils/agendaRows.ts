import type { CalendarEvent, Day, Task } from "@/types";

export type AgendaRow =
  | { kind: "event"; ev: CalendarEvent; start: number }
  | { kind: "task"; task: Task; start: number };

// A day's activities and the tasks scheduled on it, by start time (activities first on a tie).
export function agendaRows(day: Day, tasks: Task[]): AgendaRow[] {
  return [
    ...day.events.map((ev) => ({ kind: "event" as const, ev, start: ev.start })),
    ...tasks
      .filter((t) => t.dayId === day.id && t.start != null)
      .map((task) => ({ kind: "task" as const, task, start: task.start! })),
  ].sort((a, b) => a.start - b.start);
}
