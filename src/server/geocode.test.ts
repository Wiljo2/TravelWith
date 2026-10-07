import { describe, it, expect } from "vitest";
import { initialDays } from "@/test/fixtures/initialDays";
import { eventKey } from "@/utils/tripGeo";
import { buildGeoPrompt, placesFromLinks } from "./geocode";
import type { EventPlace } from "@/types";

const payload = (eventPlaces: Record<string, EventPlace> = {}) =>
  ({ days: initialDays, extras: [], exchangeRate: 1, trip: { name: "x", destination: "Orlando · Miami", startDate: "2026-11-26", endDate: "2026-12-04" }, eventPlaces }) as never;

describe("buildGeoPrompt", () => {
  const all = initialDays.flatMap((d) => d.events);

  it("labels only the activities still to locate, mapped back to their ids", () => {
    const first = all[0];
    const p = buildGeoPrompt(payload({ [first.id]: { key: eventKey(first), kind: "none" } }));
    expect(p.count).toBe(all.length - 1);
    expect([...p.labels.values()].some((l) => l.id === first.id)).toBe(false);
    expect(p.labels.get("e1")?.id).toBe(all[1].id);
  });

  it("skips activities already found from their Google Maps link, naming them for context", () => {
    const ev = all[0];
    const p = buildGeoPrompt(payload(), { [ev.id]: { key: eventKey(ev), kind: "place", name: "Aeropuerto X", lat: 1, lng: 1, source: "link" } });
    expect(p.count).toBe(all.length - 1);
    expect(p.user).toContain("[ubicado en: Aeropuerto X]");
  });

  it("gives each day its phase in the trip", () => {
    expect(buildGeoPrompt(payload()).user).toContain("crucero día 1 de 5 · embarque");
  });
});

describe("placesFromLinks", () => {
  const ev = { id: "x", title: "Cena", note: "ver https://www.google.com/maps/@25.1,-77.1,15z", start: 19, end: 20, cat: "comida" };

  it("pins the exact spot of the activity's link, before a link in its note", async () => {
    const own = "https://www.google.com/maps/place/Bayside+Marketplace/@25.77,-80.18,17z/data=!3d25.778231!4d-80.187108";
    const places = await placesFromLinks([{ ...ev, mapsUrl: own }]);
    expect(places.x).toMatchObject({ kind: "place", name: "Bayside Marketplace", lat: 25.778231, lng: -80.187108, source: "link" });
  });

  it("falls back to a link pasted in the note", async () => {
    expect((await placesFromLinks([ev])).x).toMatchObject({ lat: 25.1, lng: -77.1 });
  });
});
