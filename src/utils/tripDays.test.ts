import { describe, it, expect } from "vitest";
import { generateDays, parseISODate, fmtTripDates, tripPhase, hasActivities, hasDates, moveStartHour, MAX_TRIP_DAYS } from "./tripDays";

describe("hasDates", () => {
  it("is true only with both dates", () => {
    expect(hasDates({ name: "Cartagena", startDate: "2026-12-04", endDate: "2026-12-06" })).toBe(true);
    expect(hasDates({ name: "Cartagena" })).toBe(false);
    expect(hasDates({ name: "Cartagena", startDate: "2026-12-04" })).toBe(false);
    expect(hasDates({ name: "Cartagena", startDate: "", endDate: "" })).toBe(false);
  });

  it("is false while there is no trip", () => {
    expect(hasDates(null)).toBe(false);
    expect(hasDates(undefined)).toBe(false);
  });
});

describe("hasActivities", () => {
  it("is false for an empty or activity-free itinerary", () => {
    expect(hasActivities([])).toBe(false);
    expect(hasActivities(generateDays("2026-11-26", "2026-11-28")!)).toBe(false);
  });

  it("finds an activity in any day", () => {
    const ev = { id: "e1", start: 9, end: 10, title: "Museo del Oro", cat: "cultura", note: "" };
    expect(hasActivities([{ events: [] }, { events: [ev] }])).toBe(true);
  });
});

describe("parseISODate", () => {
  it("parses valid ISO dates as local dates", () => {
    const d = parseISODate("2026-11-26")!;
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(10);
    expect(d.getDate()).toBe(26);
  });

  it("rejects malformed input", () => {
    expect(parseISODate("26/11/2026")).toBeNull();
    expect(parseISODate("2026-13-99")).toBeNull();
    expect(parseISODate("")).toBeNull();
  });
});

describe("generateDays", () => {
  it("generates one day per date, inclusive", () => {
    const days = generateDays("2026-11-26", "2026-12-04")!;
    expect(days).toHaveLength(9);
    expect(days[0].id).toBe("d0");
    expect(days[0].label).toBe("Jue · Nov 26");
    expect(days[8].id).toBe("d8");
    expect(days[8].label).toBe("Vie · Dic 4");
  });

  it("generates a single day when start equals end", () => {
    expect(generateDays("2026-01-01", "2026-01-01")).toHaveLength(1);
  });

  it("starts with empty events and no spans", () => {
    const days = generateDays("2026-11-26", "2026-11-27")!;
    for (const d of days) {
      expect(d.events).toEqual([]);
      expect(d.flexible).toBe(false);
    }
  });

  it("rejects reversed ranges and invalid dates", () => {
    expect(generateDays("2026-12-04", "2026-11-26")).toBeNull();
    expect(generateDays("bad", "2026-11-26")).toBeNull();
  });

  it("caps the range at MAX_TRIP_DAYS", () => {
    expect(generateDays("2026-01-01", "2026-12-31")).toBeNull();
    const max = generateDays("2026-01-01", "2026-03-01");
    expect(max === null || max.length <= MAX_TRIP_DAYS).toBe(true);
  });
});

describe("tripPhase", () => {
  const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min);

  it("counts days left before the trip", () => {
    expect(tripPhase("2026-11-26", 9, at(2026, 11, 20))).toEqual({ phase: "before", daysLeft: 6 });
    expect(tripPhase("2026-11-26", 9, at(2026, 11, 25))).toEqual({ phase: "before", daysLeft: 1 });
  });

  it("returns the day index and decimal hour during the trip", () => {
    expect(tripPhase("2026-11-26", 9, at(2026, 11, 26, 6))).toEqual({ phase: "during", dayIdx: 0, hour: 6 });
    expect(tripPhase("2026-11-26", 9, at(2026, 11, 28, 14, 30))).toEqual({ phase: "during", dayIdx: 2, hour: 14.5 });
  });

  it("keeps small hours on the previous itinerary day", () => {
    expect(tripPhase("2026-11-26", 9, at(2026, 11, 29, 1, 30))).toEqual({ phase: "during", dayIdx: 2, hour: 25.5 });
    expect(tripPhase("2026-11-26", 9, at(2026, 11, 26, 1))).toEqual({ phase: "before", daysLeft: 1 });
    expect(tripPhase("2026-11-26", 9, at(2026, 12, 5, 1))).toEqual({ phase: "during", dayIdx: 8, hour: 25 });
  });

  it("is over once the last itinerary day ends", () => {
    expect(tripPhase("2026-11-26", 9, at(2026, 12, 5, 9))).toEqual({ phase: "after" });
  });

  it("returns null for invalid dates", () => {
    expect(tripPhase("bad", 9)).toBeNull();
  });
});

describe("fmtTripDates", () => {
  it("collapses same-month ranges", () => {
    expect(fmtTripDates("2026-11-02", "2026-11-08")).toBe("Nov 2 – 8, 2026");
  });

  it("shows both months when they differ", () => {
    expect(fmtTripDates("2026-11-26", "2026-12-04")).toBe("Nov 26 – Dic 4, 2026");
  });
});

describe("moveStartHour", () => {
  const ev = (id: string, start: number, end: number) => ({ id, start, end });
  const day = (...events: ReturnType<typeof ev>[]) => ({ events });

  it("keeps the hours on a free day", () => {
    expect(moveStartHour(ev("a", 10.5, 12), day())).toBe(10.5);
    expect(moveStartHour(ev("a", 10, 12), day(ev("b", 8, 10), ev("c", 12, 13)))).toBe(10);
  });

  it("moves to the next whole hour that fits when the hours are taken", () => {
    expect(moveStartHour(ev("a", 10, 11), day(ev("b", 10.5, 12)))).toBe(12);
    expect(moveStartHour(ev("a", 9.5, 10.5), day(ev("b", 9, 10)))).toBe(10);
    expect(moveStartHour(ev("a", 9, 11), day(ev("b", 10, 12), ev("c", 13, 14)))).toBe(14);
  });

  it("ignores the activity itself", () => {
    expect(moveStartHour(ev("a", 10, 11), day(ev("a", 10, 11)))).toBe(10);
  });

  it("gives punctual activities a quarter hour", () => {
    expect(moveStartHour(ev("a", 15, 15), day(ev("b", 15, 15)))).toBe(16);
    expect(moveStartHour(ev("a", 15, 15), day(ev("b", 14, 15)))).toBe(15);
    expect(moveStartHour(ev("a", 14.75, 15.25), day(ev("b", 15, 15)))).toBe(16);
  });

  it("keeps the hours as a conflict when nothing fits before the day ends", () => {
    expect(moveStartHour(ev("a", 22, 25), day(ev("b", 21, 26)))).toBe(22);
    expect(moveStartHour(ev("a", 23, 25), day(ev("b", 23, 24)))).toBe(24);
  });
});
