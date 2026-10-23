import { describe, it, expect } from "vitest";
import { tripWeeks, spansSeveralWeeks, weekBars } from "./tripWeeks";
import type { SpanRange } from "./spans";

const range = (id: string, startIdx: number, endIdx: number): SpanRange => ({ id, bg: "#eee", color: "#999", startIdx, endIdx });

describe("tripWeeks", () => {
  it("lists the Mon–Sun weeks a trip touches, marking each date in or out", () => {
    const weeks = tripWeeks("2026-11-26", "2026-12-04");
    expect(weeks).toHaveLength(2);
    expect(weeks[0].map((d) => d.iso)).toEqual([
      "2026-11-23", "2026-11-24", "2026-11-25", "2026-11-26", "2026-11-27", "2026-11-28", "2026-11-29",
    ]);
    expect(weeks[0].map((d) => d.inTrip)).toEqual([false, false, false, true, true, true, true]);
    expect(weeks[1].map((d) => d.iso)).toEqual([
      "2026-11-30", "2026-12-01", "2026-12-02", "2026-12-03", "2026-12-04", "2026-12-05", "2026-12-06",
    ]);
    expect(weeks[1].map((d) => d.inTrip)).toEqual([true, true, true, true, true, false, false]);
  });

  it("numbers each date from the trip's first day", () => {
    const weeks = tripWeeks("2026-11-26", "2026-12-04");
    expect(weeks[0].map((d) => d.dayIdx)).toEqual([-3, -2, -1, 0, 1, 2, 3]);
    expect(weeks[1][4]).toMatchObject({ iso: "2026-12-04", day: 4, month: 11, dayIdx: 8, inTrip: true });
  });

  it("crosses months and years", () => {
    const weeks = tripWeeks("2026-12-30", "2027-01-02");
    expect(weeks).toHaveLength(1);
    expect(weeks[0].filter((d) => d.inTrip).map((d) => d.iso)).toEqual(["2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02"]);
    expect(weeks[0][4]).toMatchObject({ iso: "2027-01-01", day: 1, month: 0 });
  });

  it("returns no weeks for invalid, reversed or too long ranges", () => {
    expect(tripWeeks("bad", "2026-12-04")).toEqual([]);
    expect(tripWeeks("2026-12-04", "2026-11-26")).toEqual([]);
    expect(tripWeeks("2026-01-01", "2026-12-31")).toEqual([]);
  });
});

describe("spansSeveralWeeks", () => {
  it("is false when the trip fits in one Mon–Sun week", () => {
    expect(spansSeveralWeeks("2026-11-23", "2026-11-29")).toBe(false);   // Mon – Sun
    expect(spansSeveralWeeks("2026-11-28", "2026-11-29")).toBe(false);   // Sat – Sun
    expect(spansSeveralWeeks("2026-11-26", "2026-11-26")).toBe(false);
  });

  it("is true when the trip crosses a Sunday into Monday", () => {
    expect(spansSeveralWeeks("2026-11-29", "2026-11-30")).toBe(true);    // Sun – Mon
    expect(spansSeveralWeeks("2026-11-26", "2026-12-04")).toBe(true);
  });

  it("is false without valid dates", () => {
    expect(spansSeveralWeeks("", "")).toBe(false);
    expect(spansSeveralWeeks("2026-12-04", "2026-11-26")).toBe(false);
  });
});

describe("weekBars", () => {
  const weeks = tripWeeks("2026-11-26", "2026-12-04");   // first week starts at dayIdx -3

  it("cuts a range at the week boundary and marks where it continues", () => {
    const [first, second] = weekBars(weeks, [range("cruise", 2, 5)]);
    expect(first).toEqual([expect.objectContaining({ id: "cruise", startCol: 5, endCol: 6, lane: 0, continuesBefore: false, continuesAfter: true })]);
    expect(second).toEqual([expect.objectContaining({ id: "cruise", startCol: 0, endCol: 1, lane: 0, continuesBefore: true, continuesAfter: false })]);
  });

  it("stacks overlapping ranges in separate lanes and reuses a free lane", () => {
    const [first] = weekBars(weeks, [range("a", 0, 1), range("b", 1, 2), range("c", 2, 3)]);
    expect(first.map((b) => [b.id, b.lane])).toEqual([["a", 0], ["b", 1], ["c", 0]]);
  });

  it("puts the longer range first when two start the same day", () => {
    const [first] = weekBars(weeks, [range("short", 0, 0), range("long", 0, 3)]);
    expect(first.map((b) => [b.id, b.lane])).toEqual([["long", 0], ["short", 1]]);
  });

  it("leaves weeks a range doesn't touch empty", () => {
    expect(weekBars(weeks, [range("late", 6, 8)])[0]).toEqual([]);
  });
});
