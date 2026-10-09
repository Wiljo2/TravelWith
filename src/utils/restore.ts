import type { CalendarEvent, Task } from "@/types";

export function eventCreateArgs(dayId: string, ev: CalendarEvent): Record<string, unknown> {
  const { id, title, start, end, note, cat, mapsUrl, documentId, icon } = ev;
  return { id, dayId, title, start, end, note, cat, ...(mapsUrl ? { mapsUrl } : {}), ...(documentId ? { documentId } : {}), ...(icon ? { icon } : {}) };
}

export function taskCreateArgs(task: Task): Record<string, unknown> {
  const { options: _options, version: _version, ...fields } = task;
  return Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
}
