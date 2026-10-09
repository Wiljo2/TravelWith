import { describe, expect, it } from "vitest";
import {
  chooseOptionArgs, chosenOptionRows, newTaskOptionRow, newTaskRow, taskOptionPatch, taskPatch,
} from "@/server/domain/taskRows";
import type { TripTaskOptionRow, TripTaskRow } from "@/types/database";

const meta = { room_code: "ABCD1234", version: 2, updated_at: "t", updated_by: null };
const task: TripTaskRow = {
  ...meta, id: "k1", position: 0, title: "Reservar hotel", done: false, note: null,
  day_id: "d0", start_hour: 10, end_hour: null, cat: null, priority: null, icon: null,
};
const option: TripTaskOptionRow = {
  ...meta, id: "o1", task_id: "k1", position: 0, label: "Hotel A", note: "link", amount: 120, currency: null, split_mode: null,
};

describe("task rows", () => {
  it("newTaskRow: backlog by default, scheduled with default hours when dayId is given", () => {
    expect(newTaskRow({ title: " Comprar " }, 3)).toMatchObject({ title: "Comprar", done: false, day_id: null, start_hour: null, position: 3 });
    expect(newTaskRow({ title: "A", dayId: "d1" }, 0)).toMatchObject({ day_id: "d1", start_hour: 9, end_hour: 10 });
    expect(() => newTaskRow({ title: "A", cat: "nope" }, 0)).toThrow(/task category/);
    expect(() => newTaskRow({ title: "A", priority: "urgente" }, 0)).toThrow(/priority/);
  });

  it("taskPatch: unschedule clears day and hours; rescheduling merges stored hours", () => {
    expect(taskPatch(task, { id: "k1", unschedule: true })).toEqual({ day_id: null, start_hour: null, end_hour: null });
    expect(taskPatch(task, { id: "k1", dayId: "d2" })).toEqual({ day_id: "d2", start_hour: 10, end_hour: 11 });
    expect(() => taskPatch({ ...task, day_id: null }, { id: "k1", start: 10 })).toThrow(/dayId is required/);
    expect(() => taskPatch(task, { id: "k1", start: 30 })).toThrow(/time range/);
  });

  it("icon: trimmed on create, reset with null or empty, validated", () => {
    expect(newTaskRow({ title: "A", icon: " ✈️ " }, 0).icon).toBe("✈️");
    expect(newTaskRow({ title: "A" }, 0)).not.toHaveProperty("icon");
    expect(taskPatch(task, { id: "k1", icon: "🏨" })).toEqual({ icon: "🏨" });
    expect(taskPatch(task, { id: "k1", icon: null })).toEqual({ icon: null });
    expect(taskPatch(task, { id: "k1", icon: "" })).toEqual({ icon: null });
    expect(() => taskPatch(task, { id: "k1", icon: 3 })).toThrow(/icon must be/);
    expect(() => newTaskRow({ title: "A", icon: "x".repeat(17) }, 0)).toThrow(/icon is too long/);
  });

  it("options validate money fields and allow clearing them", () => {
    expect(newTaskOptionRow({ taskId: "k1", label: "B", amount: 5, currency: "COP" }, 1)).toMatchObject({ amount: 5, currency: "COP", split_mode: null });
    expect(() => newTaskOptionRow({ taskId: "k1", label: "B", amount: -5 }, 0)).toThrow(/non-negative/);
    expect(taskOptionPatch({ id: "o1", amount: null, label: "C" })).toEqual({ amount: null, label: "C" });
  });
});

describe("choosing an option", () => {
  it("a scheduled task becomes an event, a costed option an expense", () => {
    const { event, expense } = chosenOptionRows(task, option, { eventId: "e9", expenseId: "x9" });
    expect(event).toEqual({ id: "e9", day_id: "d0", start_hour: 10, end_hour: 11, title: "Reservar hotel", cat: "logist", note: "link" });
    expect(expense).toEqual({ id: "x9", label: "Reservar hotel: Hotel A", amount: 120, currency: "USD", split_mode: "group" });
  });

  it("a backlog task with a free option creates nothing", () => {
    const { event, expense } = chosenOptionRows({ ...task, day_id: null }, { ...option, amount: 0 }, {});
    expect(event).toBeNull();
    expect(expense).toBeNull();
  });

  it("validates client ids", () => {
    expect(() => chooseOptionArgs({ taskId: "k1", optionId: "o1", eventId: "a b" })).toThrow(/eventId/);
  });
});
