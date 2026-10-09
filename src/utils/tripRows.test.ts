import { describe, expect, it } from "vitest";
import { applyToDays, applyToList, applyToTasks, rowToExtra, rowToTask, type Row } from "@/utils/tripRows";
import type { Day, Extra, Task } from "@/types";

const days: Day[] = [
  { id: "d0", label: "Jue", sub: "", flexible: false, version: 1, events: [{ id: "e1", start: 9, end: 10, title: "A", cat: "tour", note: "", version: 2 }] },
  { id: "d1", label: "Vie", sub: "", flexible: false, version: 1, events: [] },
];
const eventRow = (over: Record<string, unknown>): Row =>
  ({ id: "e1", day_id: "d0", start_hour: "9.00", end_hour: "10.50", title: "A", cat: "tour", note: null, version: 3, ...over }) as Row;

describe("applyToDays", () => {
  it("updates an event in place, converting numeric strings and null notes", () => {
    const next = applyToDays(days, "trip_events", "e1", eventRow({ title: "B" }));
    expect(next[0].events[0]).toEqual({ id: "e1", start: 9, end: 10.5, title: "B", cat: "tour", note: "", version: 3 });
  });

  it("moves an event to the day in the row", () => {
    const next = applyToDays(days, "trip_events", "e1", eventRow({ day_id: "d1" }));
    expect(next[0].events).toHaveLength(0);
    expect(next[1].events.map((e) => e.id)).toEqual(["e1"]);
  });

  it("ignores rows that are not newer than what it holds", () => {
    expect(applyToDays(days, "trip_events", "e1", eventRow({ title: "old", version: 2 }))).toBe(days);
  });

  it("removes with a null row and inserts unknown events", () => {
    expect(applyToDays(days, "trip_events", "e1", null)[0].events).toHaveLength(0);
    const added = applyToDays(days, "trip_events", "e9", eventRow({ id: "e9", day_id: "d1", version: 1 }));
    expect(added[1].events[0].id).toBe("e9");
  });

  it("updates day fields and day spans", () => {
    const next = applyToDays(days, "trip_days", "d1", { id: "d1", label: "Sáb", sub: null, flexible: true, version: 2 } as Row);
    expect(next[1]).toMatchObject({ label: "Sáb", sub: "", flexible: true, version: 2 });
    const withSpan = applyToDays(days, "trip_day_spans", "s1", { id: "s1", day_id: "d0", bg: "#fff", border: "#000", start_hour: null, version: 1 } as Row);
    expect(withSpan[0].spans?.[0]).toMatchObject({ id: "s1", bg: "#fff", startHour: undefined });
  });
});

describe("lists and tasks", () => {
  it("applyToList upserts in place and removes", () => {
    const extras: Extra[] = [{ id: "x1", label: "Hotel", amount: 1, version: 1 }];
    const row = { id: "x1", label: "Hotel", amount: "300.00", currency: "COP", split_mode: null, linked_event_id: null, version: 2 } as Row;
    expect(applyToList(extras, "x1", row, rowToExtra)[0]).toMatchObject({ amount: 300, currency: "COP", splitMode: "group", linkedEventId: undefined });
    expect(applyToList(extras, "x1", null, rowToExtra)).toEqual([]);
  });

  it("task rows keep their options; option rows land in their task", () => {
    const tasks: Task[] = [{ id: "k1", title: "T", done: false, options: [{ id: "o1", label: "A", version: 1 }], version: 1 }];
    const updated = applyToTasks(tasks, "trip_tasks", "k1", { id: "k1", title: "T2", done: true, day_id: null, start_hour: 9, version: 2 } as Row);
    expect(updated[0]).toMatchObject({ title: "T2", done: true, start: undefined, options: [{ id: "o1" }] });
    const withOption = applyToTasks(tasks, "trip_task_options", "o2", { id: "o2", task_id: "k1", label: "B", amount: "10", version: 1 } as Row);
    expect(withOption[0].options?.map((o) => o.id)).toEqual(["o1", "o2"]);
    expect(applyToTasks(tasks, "trip_task_options", "o1", null)[0].options).toEqual([]);
  });

  it("rowToTask drops hours of backlog tasks", () => {
    expect(rowToTask({ id: "k", title: "x", done: false, day_id: null, start_hour: 9, end_hour: 10, version: 1 } as Row)).toMatchObject({ dayId: undefined, start: undefined, end: undefined });
  });
});
