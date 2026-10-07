import { describe, expect, it } from "vitest";
import { dayUpdatePatch, resetDays, swapArgs } from "@/server/domain/dayRows";
import { daySpanPatch, newDaySpanRow, newTripSpanRow, tripSpanPatch } from "@/server/domain/spanRows";
import type { TripDayRow, TripDaySpanRow } from "@/types/database";

const meta = { room_code: "ABCD1234", version: 1, updated_at: "t", updated_by: null };

describe("day rows", () => {
  it("dayUpdatePatch keeps only given fields and rejects empty labels", () => {
    expect(dayUpdatePatch({ id: "d0", sub: "Playa", flexible: true })).toEqual({ sub: "Playa", flexible: true });
    expect(() => dayUpdatePatch({ id: "d0", label: " " })).toThrow(/label cannot be empty/);
    expect(() => dayUpdatePatch({ id: "d0" })).toThrow(/nothing to update/);
    expect(() => dayUpdatePatch({ id: "d0", flexible: "yes" })).toThrow(/boolean/);
  });

  it("resetDays regenerates from the dates, or empties the current days", () => {
    const fromDates = resetDays({ startDate: "2026-10-01", endDate: "2026-10-03" }, []);
    expect(fromDates.map((d) => d.id)).toEqual(["d0", "d1", "d2"]);
    expect(fromDates[0]).toMatchObject({ sub: "", flexible: false });
    const current: TripDayRow[] = [{ ...meta, id: "x", position: 0, label: "Uno", sub: null, flexible: null }];
    expect(resetDays(null, current)).toEqual([{ id: "x", label: "Uno", sub: "", flexible: false }]);
  });

  it("swapArgs needs two different days", () => {
    expect(swapArgs({ a: "d0", b: "d1" })).toEqual({ a: "d0", b: "d1" });
    expect(() => swapArgs({ a: "d0", b: "d0" })).toThrow(/itself/);
  });
});

describe("span rows", () => {
  const span: TripDaySpanRow = {
    ...meta, id: "s1", day_id: "d0", position: 0, label: null, start_event_id: null, end_event_id: null,
    start_hour: 9, end_hour: 11, bg: "#fff", border: "#000", z_index: null,
  };

  it("newDaySpanRow validates colors, hours and ids", () => {
    const row = newDaySpanRow({ id: "s2", dayId: "d0", bg: "rgba(0,0,0,0.1)", border: "transparent", startHour: 9, endHour: 12, zIndex: 2 }, 3);
    expect(row).toMatchObject({ id: "s2", day_id: "d0", position: 3, start_hour: 9, end_hour: 12, z_index: 2, label: null });
    expect(() => newDaySpanRow({ dayId: "d0", bg: "url(x)", border: "#000" }, 0)).toThrow(/bg must be/);
    expect(() => newDaySpanRow({ dayId: "d0", bg: "#fff", border: "#000", startHour: 12, endHour: 9 }, 0)).toThrow(/after/);
    expect(() => newDaySpanRow({ dayId: "d0", bg: "#fff", border: "#000", startHour: -1 }, 0)).toThrow(/decimal hour/);
  });

  it("daySpanPatch clears fields with null and checks merged hours", () => {
    expect(daySpanPatch(span, { id: "s1", startEventId: null, label: "Playa" })).toEqual({ start_event_id: null, label: "Playa" });
    expect(() => daySpanPatch(span, { id: "s1", endHour: 8 })).toThrow(/after/);
    expect(daySpanPatch(span, { id: "s1", startHour: null, endHour: 8 })).toEqual({ start_hour: null, end_hour: 8 });
    expect(() => daySpanPatch(span, { id: "s1" })).toThrow(/nothing to update/);
  });

  it("trip spans need both events", () => {
    expect(newTripSpanRow({ startEventId: "e1", endEventId: "e2", bg: "#abc", border: "#def" }, 0)).toMatchObject({ start_event_id: "e1", end_event_id: "e2" });
    expect(() => newTripSpanRow({ startEventId: "e1", bg: "#abc", border: "#def" }, 0)).toThrow(/endEventId/);
    expect(tripSpanPatch({ id: "t1", label: null, zIndex: 3 })).toEqual({ label: null, z_index: 3 });
    expect(() => tripSpanPatch({ id: "t1", startEventId: null })).toThrow(/startEventId/);
  });
});
