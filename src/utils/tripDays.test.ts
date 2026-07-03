import { describe, it, expect } from "vitest";
import { generateDays, parseISODate, fmtTripDates, MAX_TRIP_DAYS } from "./tripDays";

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

describe("fmtTripDates", () => {
  it("collapses same-month ranges", () => {
    expect(fmtTripDates("2026-11-02", "2026-11-08")).toBe("Nov 2 – 8, 2026");
  });

  it("shows both months when they differ", () => {
    expect(fmtTripDates("2026-11-26", "2026-12-04")).toBe("Nov 26 – Dic 4, 2026");
  });
});
