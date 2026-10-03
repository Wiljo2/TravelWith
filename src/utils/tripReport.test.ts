import { describe, it, expect } from "vitest";
import { initialDays } from "@/data/initialDays";
import { buildTripReport, pdfText } from "./tripReport";

const trip = { name: "Orlando · Miami · Wonder of the Seas", startDate: "2026-11-26", endDate: "2026-12-04" };
const input = { trip, days: initialDays, travelers: ["Ana Pérez", "Juan"], now: new Date(2026, 9, 3) };

describe("pdfText", () => {
  it("keeps Spanish letters, drops links and emoji, spells arrows out", () => {
    expect(pdfText("Vuelo Cali → Orlando ✅ https://latam.com/x — señor")).toBe("Vuelo Cali -> Orlando - señor");
  });
});

describe("buildTripReport", () => {
  it("migration: travelers, real dates and the logistics, without prices", () => {
    const r = buildTripReport("migration", input);
    expect(r.travelers).toEqual(["Ana Pérez", "Juan"]);
    expect(r.dates).toContain("26 de noviembre al 4 de diciembre de 2026");
    const [logistics, byDay] = r.sections;
    expect(logistics.rows.some((row) => row.text.startsWith("Check-in puerto"))).toBe(true);
    expect(logistics.rows.every((row) => !/\$|USD/.test(`${row.text} ${row.detail ?? ""}`))).toBe(true);
    expect(logistics.rows.some((row) => /Desayuno en hotel/.test(row.text))).toBe(false);
    expect(byDay.rows).toHaveLength(initialDays.length);
    expect(r.fileName).toBe("itinerario-migracion-orlando-miami-wonder-of-the-seas.pdf");
  });

  it("full: one section per day with every activity", () => {
    const r = buildTripReport("full", input);
    expect(r.sections).toHaveLength(initialDays.length);
    expect(r.sections[0].title).toContain("26 de noviembre de 2026");
    expect(r.sections[0].rows).toHaveLength(initialDays[0].events.length);
  });

  it("falls back to the day labels when the trip has no dates", () => {
    const r = buildTripReport("migration", { ...input, trip: null });
    expect(r.sections[1].rows[0].when).toBe(initialDays[0].label);
  });
});
