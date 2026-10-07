import { describe, it, expect } from "vitest";
import { calendarStartHour } from "./gridStart";
import type { Day } from "@/types";

const day = (...starts: number[]): Day => ({
  id: "d", label: "", sub: "", flexible: false,
  events: starts.map((start, i) => ({ id: `e${i}`, start, end: start + 1, title: "x", cat: "logist", note: "" })),
});

describe("calendarStartHour", () => {
  it("opens at 6am when nothing starts earlier", () => {
    expect(calendarStartHour([day(9, 14)], [])).toBe(6);
    expect(calendarStartHour([], [])).toBe(6);
  });

  it("starts at the hour of the earliest event or task", () => {
    expect(calendarStartHour([day(9), day(5.25)], [])).toBe(5);
    expect(calendarStartHour([day(9)], [{ id: "t", title: "x", done: false, dayId: "d", start: 2.5 }])).toBe(2);
  });

  it("ignores late-night hours past midnight", () => {
    expect(calendarStartHour([day(24, 25)], [])).toBe(6);
  });
});
