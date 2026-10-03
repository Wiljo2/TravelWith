import { describe, it, expect } from "vitest";
import { initialDays } from "@/data/initialDays";
import { eventKey } from "@/utils/tripGeo";
import { buildGeoPrompt } from "./geocode";
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
