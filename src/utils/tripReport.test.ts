import { describe, it, expect } from "vitest";
import { initialDays } from "@/test/fixtures/initialDays";
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

  it("migration: lists linked documents, the activities they back and their Drive links", () => {
    const days = initialDays.map((d, i) => i !== 2 ? d : {
      ...d, events: [...d.events, { id: "park", start: 8, end: 20, title: "Universal", cat: "actividad", note: "Llevar ID", documentId: "doc-park" }],
    });
    const documents = [
      { id: "doc-park", driveFileId: "abcdefghij1234", title: "Entradas Universal", kind: "ticket" as const },
      { id: "doc-car", driveFileId: "abcdefghij5678", title: "Alquiler carro" },
    ];
    const r = buildTripReport("migration", { ...input, days, documents });
    const [logistics, support, byDay] = r.sections;
    expect(logistics.rows.find((row) => row.text === "Universal")?.detail).toBe("Llevar ID · Soporte: Entradas Universal");
    expect(support.title).toBe("Documentos de soporte");
    expect(support.rows).toEqual([
      { when: "Entrada", text: "Entradas Universal", detail: expect.stringContaining("Universal"), link: "https://drive.google.com/file/d/abcdefghij1234/view" },
      { when: "Otro", text: "Alquiler carro", detail: undefined, link: "https://drive.google.com/file/d/abcdefghij5678/view" },
    ]);
    expect(JSON.stringify([logistics, byDay])).not.toContain("abcdefghij");
    expect(byDay.rows).toHaveLength(initialDays.length);
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
