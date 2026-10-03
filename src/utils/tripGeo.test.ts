import { describe, it, expect } from "vitest";
import { initialDays } from "@/test/fixtures/initialDays";
import { distanceKm, eventKey, inTripRegion, mapStops, offlineTiles, staleEvents, stopOrder, tilesInBBox } from "./tripGeo";
import type { Day, EventPlace } from "@/types";

const day = (id: string, events: [string, string, number][]): Day => ({
  id, label: id, sub: "", flexible: false,
  events: events.map(([eid, title, start]) => ({ id: eid, title, start, end: start + 1, cat: "miami", note: "" })),
});

describe("trip map", () => {
  const days = [day("d0", [["a", "Hotel", 8], ["b", "Desayuno en hotel", 9], ["c", "Disney Springs", 18]]), day("d1", [["d", "Hotel", 8]])];
  const at = (ev: Day["events"][number], lat: number, lng: number, kind: EventPlace["kind"] = "place"): EventPlace => ({ key: eventKey(ev), kind, name: ev.title, lat, lng });
  const [a, b, c] = days[0].events;
  const places: Record<string, EventPlace> = {
    a: at(a, 28.378, -81.5016),
    b: at(b, 28.3781, -81.5017),          // same hotel, a few meters away
    c: at(c, 28.3712, -81.5184),
  };

  it("lists activities never located or edited since", () => {
    expect(staleEvents(days, places).map((e) => e.id)).toEqual(["d"]);
    const edited = { ...places, c: { ...places.c, key: "otra cosa" } };
    expect(staleEvents(days, edited).map((e) => e.id)).toEqual(["c", "d"]);
  });

  it("shares one pin between activities at the same spot, in trip order", () => {
    const stops = mapStops(days, places);
    expect(stops).toHaveLength(2);
    expect(stops[0].visits.map((v) => v.eventId)).toEqual(["a", "b"]);
  });

  it("numbers pins in itinerary order, overall or within a day", () => {
    const two = [
      day("d0", [["a", "Hotel", 8], ["c", "Disney Springs", 18]]),
      day("d1", [["e", "Disney Springs", 9], ["d", "Hotel", 20]]),
    ];
    const ps = { ...places, d: at(two[1].events[1], 28.378, -81.5016), e: at(two[1].events[0], 28.3712, -81.5184) };
    const stops = mapStops(two, ps);
    const hotel = stops.find((s) => s.name === "Hotel")!.id;
    const springs = stops.find((s) => s.name === "Disney Springs")!.id;
    expect(stopOrder(stops, null)).toEqual(new Map([[hotel, 1], [springs, 2]]));
    expect(stopOrder(stops, 1)).toEqual(new Map([[springs, 1], [hotel, 2]]));
  });

  it("follows the itinerary: a moved activity changes the order, an edited one keeps its pin", () => {
    const moved = [day("d0", [["a", "Hotel", 20], ["b", "Desayuno en hotel", 21], ["c", "Disney Springs", 8]]), days[1]];
    const stops = mapStops(moved, places);
    expect(stopOrder(stops, 0).get(stops.find((s) => s.name === "Disney Springs")!.id)).toBe(1);
    const edited = { ...places, c: { ...places.c, key: "texto anterior" } };
    expect(mapStops(days, edited).some((s) => s.name === "Disney Springs")).toBe(true);
  });

  it("keeps only the trip's region", () => {
    expect(inTripRegion({ lat: 28.378, lng: -81.5 })).toBe(true);    // Orlando
    expect(inTripRegion({ lat: 25.08, lng: -77.34 })).toBe(true);    // Nassau
    expect(inTripRegion({ lat: 3.54, lng: -76.38 })).toBe(false);    // Cali
  });

  it("locates an activity again when its Google Maps link is added, and only then", () => {
    const withLink = days.map((d) => ({ ...d, events: d.events.map((e) => (e.id === "c" ? { ...e, mapsUrl: "https://maps.app.goo.gl/x" } : e)) }));
    expect(staleEvents(withLink, places).map((e) => e.id)).toEqual(["c", "d"]);
  });

  it("measures distances", () => {
    expect(distanceKm({ lat: 25.7782, lng: -80.1871 }, { lat: 25.0812, lng: -77.3375 })).toBeCloseTo(294, -1);
  });

  it("covers a box with slippy-map tiles", () => {
    expect(tilesInBBox({ west: -180, south: -85, east: 179.9, north: 85 }, 1)).toHaveLength(4);
  });

  it("keeps the region and each pin's surroundings, without repeats", () => {
    const tiles = offlineTiles(mapStops(days, places));
    const keys = tiles.map((t) => `${t.z}/${t.x}/${t.y}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(tiles.some((t) => t.z === 14)).toBe(true);
    expect(tiles.length).toBeLessThan(400);
  });

  it("handles the demo trip", () => {
    expect(staleEvents(initialDays, {})).toHaveLength(initialDays.flatMap((d) => d.events).length);
  });
});
