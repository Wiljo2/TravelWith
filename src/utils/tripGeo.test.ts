import { describe, it, expect } from "vitest";
import { initialDays } from "@/test/fixtures/initialDays";
import { distanceKm, eventKey, inBBox, mapStops, offlineTiles, staleEvents, stopOrder, tilesInBBox, tripRegion, type MapStop } from "./tripGeo";
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

  const pin = (name: string, lat: number, lng: number, visits = 1): MapStop => ({
    id: name, name, lat, lng,
    visits: Array.from({ length: visits }, (_, i) => ({ dayIdx: i, dayId: `d${i}`, eventId: `${name}${i}`, title: name, start: 9 })),
  });
  const cali = pin("Cali", 3.54, -76.38, 2);
  const florida = [pin("Orlando", 28.378, -81.5, 4), pin("Miami", 25.77, -80.19, 2), pin("Nassau", 25.08, -77.34), pin("CocoCay", 25.82, -77.94)];

  it("finds the trip's region and leaves the home airport out, even with two visits", () => {
    const region = tripRegion([cali, ...florida])!;
    for (const p of florida) expect(inBBox(region, p)).toBe(true);
    expect(inBBox(region, cali)).toBe(false);
  });

  it("works for any destination", () => {
    const japan = [pin("Tokio", 35.68, 139.69, 3), pin("Kioto", 35.01, 135.77, 2), pin("Osaka", 34.69, 135.5)];
    const region = tripRegion([pin("Bogotá", 4.7, -74.07), ...japan])!;
    for (const p of japan) expect(inBBox(region, p)).toBe(true);
    expect(region.west).toBeGreaterThan(130);
  });

  it("gives a one-place trip room around it, and none without pins", () => {
    const region = tripRegion([pin("Cartagena", 10.42, -75.55)])!;
    expect(region.east - region.west).toBeCloseTo(0.3);
    expect(region.north - region.south).toBeCloseTo(0.3);
    expect(tripRegion([])).toBeNull();
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

  it("keeps a continent-wide trip's overview to a bounded number of tiles", () => {
    const europe = [pin("Lisboa", 38.72, -9.14), pin("Madrid", 40.42, -3.7), pin("París", 48.86, 2.35), pin("Berlín", 52.52, 13.4), pin("Roma", 41.9, 12.5), pin("Atenas", 37.98, 23.73)];
    const overview = offlineTiles(europe).filter((t) => t.z <= 9);
    expect(overview.length).toBeLessThanOrEqual(3000);
    expect(overview.some((t) => t.z === 4)).toBe(true);
  });

  it("handles the demo trip", () => {
    expect(staleEvents(initialDays, {})).toHaveLength(initialDays.flatMap((d) => d.events).length);
  });
});
