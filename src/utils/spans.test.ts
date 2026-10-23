import { describe, it, expect } from "vitest";
import { spanRanges } from "./spans";
import type { CalendarEvent, Day, DaySpan, TripSpan } from "@/types";

const ev = (id: string): CalendarEvent => ({ id, start: 9, end: 10, title: id, cat: "actividad", note: "" });
const day = (i: number, events: CalendarEvent[] = [], spans: DaySpan[] = []): Day => ({ id: `d${i}`, label: "", sub: "", flexible: false, events, spans });
const daySpan = (id: string, label: string, bg = "blue-bg", border = "blue"): DaySpan => ({ id, label, bg, border });
const tripSpan = (id: string, startEventId: string, endEventId: string): TripSpan => ({ id, label: id, startEventId, endEventId, bg: "green-bg", border: "green" });

describe("spanRanges", () => {
  it("resolves a trip span to the days of its start and end activities", () => {
    const days = [day(0, [ev("board")]), day(1), day(2, [ev("land")])];
    expect(spanRanges(days, [tripSpan("Crucero", "board", "land")])).toEqual([
      { id: "trip-Crucero", label: "Crucero", bg: "green-bg", color: "green", startIdx: 0, endIdx: 2 },
    ]);
  });

  it("skips trip spans whose activities are gone or reversed", () => {
    const days = [day(0, [ev("a")]), day(1, [ev("b")])];
    expect(spanRanges(days, [tripSpan("gone", "a", "missing"), tripSpan("reversed", "b", "a")])).toEqual([]);
  });

  it("joins the same day span on consecutive days into one range", () => {
    const days = [day(0, [], [daySpan("s0", "Playa")]), day(1, [], [daySpan("s1", "Playa")]), day(2), day(3, [], [daySpan("s3", "Playa")])];
    expect(spanRanges(days, []).map((r) => [r.id, r.startIdx, r.endIdx])).toEqual([["day-s0", 0, 1], ["day-s3", 3, 3]]);
  });

  it("keeps day spans apart when their label or color differs", () => {
    const days = [day(0, [], [daySpan("s0", "Playa")]), day(1, [], [daySpan("s1", "Playa", "red-bg", "red"), daySpan("s2", "Museo")])];
    expect(spanRanges(days, []).map((r) => r.id)).toEqual(["day-s0", "day-s1", "day-s2"]);
  });

  it("falls back to the background when the border is transparent", () => {
    const days = [day(0, [], [daySpan("s0", "Playa", "sand", "transparent")])];
    expect(spanRanges(days, [])[0].color).toBe("sand");
  });
});
