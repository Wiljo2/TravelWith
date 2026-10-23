import { describe, expect, it } from "vitest";
import { newTaskOptionRow, newTaskRow, taskOptionPatch, taskPatch } from "@/server/domain/taskRows";
import { checkVoteOption, closeVoteArgs, closeVoteDays, optionDates, optionLimit, requireEditableOptions } from "@/server/domain/voteRows";
import type { TripTaskOptionRow, TripTaskRow } from "@/types/database";

const meta = { room_code: "ABCD1234", version: 2, updated_at: "t", updated_by: null };
const task: TripTaskRow = {
  ...meta, id: "k1", position: 0, title: "¿Cuándo viajamos?", done: false, note: null,
  day_id: null, start_hour: null, end_hour: null, cat: "decidir", priority: null, icon: null, decides: "dates",
};
const option: TripTaskOptionRow = {
  ...meta, id: "o1", task_id: "k1", position: 0, label: "Nov 26 – Dic 4, 2026", note: null, amount: null, currency: null,
  split_mode: null, votes: ["u1"], start_date: "2026-11-26", end_date: "2026-12-04",
};

describe("vote tasks", () => {
  it("a task with decides is an open backlog 'decidir' task", () => {
    expect(newTaskRow({ title: "¿A dónde?", decides: "destination", cat: "reservar", dayId: "d1", done: true }, 4)).toMatchObject({
      title: "¿A dónde?", decides: "destination", cat: "decidir", done: false, day_id: null, start_hour: null, end_hour: null, position: 4,
    });
    expect(() => newTaskRow({ title: "A", decides: "budget" }, 0)).toThrow(/decides must be one of/);
    expect(() => newTaskRow({ title: "A", decides: 3 }, 0)).toThrow(/decides must be a string/);
  });

  it("regular tasks don't write decides, and no update sets it", () => {
    expect(newTaskRow({ title: "A" }, 0)).not.toHaveProperty("decides");
    expect(() => taskPatch(task, { id: "k1", decides: null })).toThrow(/nothing to update/);
    expect(taskPatch(task, { id: "k1", title: "B", decides: "destination" })).toEqual({ title: "B" });
  });
});

describe("option dates", () => {
  it("go together and must be a valid range of at most 60 days", () => {
    expect(optionDates({}, false)).toEqual({});
    expect(optionDates({ startDate: "2026-11-26", endDate: "2026-12-04" }, false)).toEqual({ start_date: "2026-11-26", end_date: "2026-12-04" });
    expect(optionDates({ startDate: null, endDate: null }, true)).toEqual({ start_date: null, end_date: null });
    expect(() => optionDates({ startDate: null, endDate: null }, false)).toThrow(/go together/);
    expect(() => optionDates({ startDate: "2026-11-26" }, false)).toThrow(/go together/);
    expect(() => optionDates({ startDate: "2026-11-26", endDate: "2026-11-25" }, false)).toThrow(/on or after/);
    expect(() => optionDates({ startDate: "2026-02-30", endDate: "2026-03-02" }, false)).toThrow(/valid dates/);
    expect(() => optionDates({ startDate: "2026-11-01", endDate: "2026-12-31" }, false)).toThrow(/at most 60 days/);
  });

  it("flow through option create and update", () => {
    expect(newTaskOptionRow({ taskId: "k1", label: "A", startDate: "2026-11-26", endDate: "2026-11-30" }, 0))
      .toMatchObject({ start_date: "2026-11-26", end_date: "2026-11-30" });
    expect(newTaskOptionRow({ taskId: "k1", label: "A" }, 0)).not.toHaveProperty("start_date");
    expect(taskOptionPatch({ id: "o1", startDate: "2026-11-27", endDate: "2026-11-30" })).toEqual({ start_date: "2026-11-27", end_date: "2026-11-30" });
  });
});

describe("checkVoteOption", () => {
  const destination = { ...task, decides: "destination" as const };

  it("dates votes need dates; other tasks can't have them", () => {
    expect(() => checkVoteOption(task, { label: "Pronto" }, true)).toThrow(/need startDate and endDate/);
    expect(() => checkVoteOption(task, { start_date: "2026-11-26", end_date: "2026-11-30" }, true)).not.toThrow();
    expect(() => checkVoteOption(task, { label: "Otro nombre" }, false)).not.toThrow();
    expect(() => checkVoteOption(task, { start_date: null, end_date: null }, false)).toThrow(/need startDate/);
    expect(() => checkVoteOption({ ...task, decides: null }, { start_date: "2026-11-26" }, true)).toThrow(/Only the options of a dates vote/);
    expect(() => checkVoteOption({ ...task, decides: null }, { label: "A" }, true)).not.toThrow();
  });

  it("destinations are short names without dates", () => {
    expect(() => checkVoteOption(destination, { label: "Cartagena" }, true)).not.toThrow();
    expect(() => checkVoteOption(destination, { label: "x".repeat(81) }, true)).toThrow(/at most 80/);
    expect(() => checkVoteOption(destination, { label: "A", start_date: "2026-11-26" }, true)).toThrow(/without dates/);
  });

  it("a closed vote takes no changes; a done regular task still does", () => {
    expect(() => checkVoteOption({ ...task, done: true }, { label: "A" }, false)).toThrow(/closed/);
    expect(() => requireEditableOptions({ ...task, done: true })).toThrow(/closed/);
    expect(() => requireEditableOptions({ ...task, decides: null, done: true })).not.toThrow();
  });

  it("vote tasks have a smaller option limit", () => {
    expect(optionLimit(task)).toBe(5);
    expect(optionLimit({ decides: null })).toBe(20);
  });
});

describe("closing a vote", () => {
  it("validates the arguments", () => {
    expect(closeVoteArgs({ taskId: "k1", optionId: "o1" })).toEqual({ taskId: "k1", optionId: "o1", replaceItinerary: false });
    expect(closeVoteArgs({ taskId: "k1", optionId: "o1", replaceItinerary: true }).replaceItinerary).toBe(true);
    expect(() => closeVoteArgs({ taskId: "k1" })).toThrow(/optionId is required/);
    expect(() => closeVoteArgs({ taskId: "k1", optionId: "o1", replaceItinerary: "yes" })).toThrow(/must be a boolean/);
  });

  it("a dates vote rebuilds one day per date, with a new trip's ids", () => {
    const days = closeVoteDays(task, option)!;
    expect(days).toHaveLength(9);
    expect(days[0]).toEqual({ id: "d0", label: "Jue · Nov 26", sub: "", flexible: false });
    expect(days[8].id).toBe("d8");
  });

  it("a destination vote writes no days", () => {
    expect(closeVoteDays({ ...task, decides: "destination" }, { ...option, start_date: null, end_date: null, label: "Cartagena" })).toBeNull();
    expect(() => closeVoteDays({ ...task, decides: "destination" }, { ...option, label: "x".repeat(81) })).toThrow(/at most 80/);
  });

  it("refuses closed, regular and foreign tasks and options without dates", () => {
    expect(() => closeVoteDays({ ...task, done: true }, option)).toThrow(/not an open vote/);
    expect(() => closeVoteDays({ ...task, decides: null }, option)).toThrow(/not an open vote/);
    expect(() => closeVoteDays(task, { ...option, task_id: "k2" })).toThrow(/not found in task/);
    expect(() => closeVoteDays(task, { ...option, start_date: null, end_date: null })).toThrow(/has no dates/);
  });
});
