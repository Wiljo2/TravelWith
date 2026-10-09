import type { CalendarEvent, Day, DaySpan, EventPlace, Extra, Idea, MockPerson, Task, TaskOption, TripDocument, TripSpan } from "@/types";

// Pure helpers that apply one database row (as returned by the ops endpoint or
// broadcast on the trip channel) to the client's trip state. `row = null`
// removes the item. A row whose version is not newer than the item already
// held is ignored, so echoes of our own writes and stale messages are no-ops.

export type TripTable =
  | "trip_days"
  | "trip_events"
  | "trip_day_spans"
  | "trip_spans"
  | "trip_expenses"
  | "trip_tasks"
  | "trip_task_options"
  | "trip_travelers"
  | "trip_documents"
  | "trip_ideas"
  | "trip_event_places";

export type Row = Record<string, unknown> & { id: string; version: number };

const num = (v: unknown): number => Number(v);
const optNum = (v: unknown): number | undefined => (v == null ? undefined : Number(v));
const optStr = (v: unknown): string | undefined => (v == null ? undefined : String(v));

function isStale(current: { version?: number } | undefined, row: Row): boolean {
  return current?.version !== undefined && current.version >= row.version;
}

export function rowToEvent(r: Row): CalendarEvent {
  return {
    id: r.id, start: num(r.start_hour), end: num(r.end_hour), title: String(r.title), cat: String(r.cat), note: String(r.note ?? ""),
    mapsUrl: optStr(r.maps_url), documentId: optStr(r.document_id), icon: optStr(r.icon), version: r.version,
  };
}

export function rowToDaySpan(r: Row): DaySpan {
  return {
    id: r.id, label: optStr(r.label), startEventId: optStr(r.start_event_id), endEventId: optStr(r.end_event_id),
    startHour: optNum(r.start_hour), endHour: optNum(r.end_hour), bg: String(r.bg), border: String(r.border),
    zIndex: optNum(r.z_index), version: r.version,
  };
}

export function rowToTripSpan(r: Row): TripSpan {
  return {
    id: r.id, label: optStr(r.label), startEventId: String(r.start_event_id), endEventId: String(r.end_event_id),
    bg: String(r.bg), border: String(r.border), zIndex: optNum(r.z_index), version: r.version,
  };
}

export function rowToExtra(r: Row): Extra {
  return {
    id: r.id, label: String(r.label), amount: num(r.amount),
    currency: (optStr(r.currency) as Extra["currency"]) ?? "USD",
    splitMode: (optStr(r.split_mode) as Extra["splitMode"]) ?? "group",
    linkedEventId: optStr(r.linked_event_id), startDayId: optStr(r.start_day_id), endDayId: optStr(r.end_day_id),
    documentId: optStr(r.document_id), version: r.version,
  };
}

export function rowToTaskOption(r: Row): TaskOption {
  return {
    id: r.id, label: String(r.label), note: optStr(r.note), amount: optNum(r.amount),
    currency: optStr(r.currency) as TaskOption["currency"], splitMode: optStr(r.split_mode) as TaskOption["splitMode"],
    version: r.version,
  };
}

export function rowToTask(r: Row, options: TaskOption[] = []): Task {
  return {
    id: r.id, title: String(r.title), done: Boolean(r.done), note: optStr(r.note), dayId: optStr(r.day_id),
    start: r.day_id == null ? undefined : optNum(r.start_hour), end: r.day_id == null ? undefined : optNum(r.end_hour),
    cat: optStr(r.cat), priority: optStr(r.priority) as Task["priority"], icon: optStr(r.icon), options, version: r.version,
  };
}

export function rowToDocument(r: Row): TripDocument {
  return { id: r.id, driveFileId: String(r.drive_file_id), title: String(r.title), kind: optStr(r.kind) as TripDocument["kind"], version: r.version };
}

export function rowToIdea(r: Row): Idea {
  return { ...(r.data as Omit<Idea, "id">), id: r.id, version: r.version };
}

export function rowToEventPlace(r: Row): EventPlace {
  return { ...(r.data as EventPlace), version: r.version };
}

export function rowToTraveler(r: Row): MockPerson {
  return { id: r.id, name: String(r.name), version: r.version };
}

// Upsert or remove one item of a flat list, keeping its place on update.
export function applyToList<T extends { id: string; version?: number }>(
  list: T[],
  id: string,
  row: Row | null,
  toItem: (r: Row) => T,
): T[] {
  const index = list.findIndex((x) => x.id === id);
  if (!row) return index === -1 ? list : list.filter((x) => x.id !== id);
  if (index === -1) return [...list, toItem(row)];
  if (isStale(list[index], row)) return list;
  const next = [...list];
  next[index] = toItem(row);
  return next;
}

// Days, events and day spans live nested in Day[]; an event or span row may
// move it to another day.
export function applyToDays(days: Day[], table: TripTable, id: string, row: Row | null): Day[] {
  if (table === "trip_days") {
    if (!row) return days.filter((d) => d.id !== id);
    return days.map((d) =>
      d.id === id && !isStale(d, row)
        ? { ...d, label: String(row.label), sub: String(row.sub ?? ""), flexible: Boolean(row.flexible), version: row.version }
        : d,
    );
  }
  if (table !== "trip_events" && table !== "trip_day_spans") return days;

  const key = table === "trip_events" ? "events" : "spans";
  const current = days.flatMap((d) => (d[key] ?? []) as (CalendarEvent | DaySpan)[]).find((x) => x.id === id);
  if (row && isStale(current, row)) return days;
  const targetDay = row ? String(row.day_id) : null;
  const item = row ? (table === "trip_events" ? rowToEvent(row) : rowToDaySpan(row)) : null;

  return days.map((d) => {
    const list = (d[key] ?? []) as (CalendarEvent | DaySpan)[];
    const had = list.some((x) => x.id === id);
    if (d.id === targetDay && item) {
      const next = had ? list.map((x) => (x.id === id ? item : x)) : [...list, item];
      return { ...d, [key]: next };
    }
    return had ? { ...d, [key]: list.filter((x) => x.id !== id) } : d;
  });
}

// Tasks hold their options; an option row is applied inside its task.
export function applyToTasks(tasks: Task[], table: TripTable, id: string, row: Row | null): Task[] {
  if (table === "trip_tasks") {
    return applyToList(tasks, id, row, (r) => rowToTask(r, tasks.find((t) => t.id === id)?.options ?? []));
  }
  if (table !== "trip_task_options") return tasks;
  const owner = row ? String(row.task_id) : tasks.find((t) => t.options?.some((o) => o.id === id))?.id;
  return tasks.map((t) => (t.id === owner ? { ...t, options: applyToList(t.options ?? [], id, row, rowToTaskOption) } : t));
}

export const OP_TABLES: Record<string, TripTable> = {
  event: "trip_events",
  day: "trip_days",
  daySpan: "trip_day_spans",
  tripSpan: "trip_spans",
  expense: "trip_expenses",
  task: "trip_tasks",
  taskOption: "trip_task_options",
  traveler: "trip_travelers",
  document: "trip_documents",
  idea: "trip_ideas",
  eventPlace: "trip_event_places",
};
