import { normalizeText } from "@/utils/ideas";
import type { CalendarEvent, Day, EventPlace } from "@/types";

// Pure helpers for the trip map: which activities still need a location, the
// pins (activities at the same spot share one), distances, and the map tiles
// to keep on the device so the trip's region always loads.

export type LngLat = { lat: number; lng: number };
export type BBox = { west: number; south: number; east: number; north: number };

// Orlando, Miami and the cruise (Nassau, CocoCay): always kept for offline use
// at overview zooms, so the ship's position can be seen anywhere on the route.
export const TRIP_REGION: BBox = { west: -82.2, south: 23.0, east: -76.0, north: 29.2 };

// Only the trip's region goes on the map (not, say, the home airport).
export const inTripRegion = (p: LngLat) =>
  p.lng >= TRIP_REGION.west && p.lng <= TRIP_REGION.east && p.lat >= TRIP_REGION.south && p.lat <= TRIP_REGION.north;
const REGION_ZOOMS = [4, 5, 6, 7, 8, 9];
// Around each pin, more detail the closer in (km of radius per zoom). The
// vector tiles stop at zoom 14; the map draws closer views from those.
const STOP_RADIUS_KM: Record<number, number> = { 10: 12, 11: 7, 12: 4, 13: 2.5, 14: 1.5 };

export const eventKey = (ev: CalendarEvent) =>
  normalizeText(`${ev.title}|${ev.note ?? ""}${ev.mapsUrl ? `|${ev.mapsUrl}` : ""}`).trim();

// Places without a photo search yet (located before photos existed).
export const missingPhotos = (places: Record<string, EventPlace>) =>
  Object.values(places).some((p) => p.kind === "place" && p.photo === undefined);

// Activities never located, or edited since.
export function staleEvents(days: Day[], places: Record<string, EventPlace>): CalendarEvent[] {
  return days.flatMap((d) => d.events).filter((ev) => places[ev.id]?.key !== eventKey(ev));
}

export interface StopVisit { dayIdx: number; dayId: string; eventId: string; title: string; start: number }
export interface MapStop extends LngLat { id: string; name: string; query?: string; photo?: string; photoPage?: string; visits: StopVisit[] }

// One pin per spot: activities closer than ~80 m share it, and so do those
// named the same within 2 km (one mall located twice). In trip order. An
// activity edited since it was located keeps its pin until it's located again.
// Visits follow the itinerary as it is now (moved activities move with it).
export function mapStops(days: Day[], places: Record<string, EventPlace>): MapStop[] {
  const stops: MapStop[] = [];
  days.forEach((day, dayIdx) => {
    for (const ev of [...day.events].sort((a, b) => a.start - b.start)) {
      const p = places[ev.id];
      if (p?.kind !== "place" || p.lat == null || p.lng == null) continue;
      const at = { lat: p.lat, lng: p.lng };
      const name = normalizeText(p.name ?? "");
      let stop = stops.find((s) => {
        const km = distanceKm(s, at);
        return km < 0.08 || (!!name && normalizeText(s.name) === name && km < 2);
      });
      if (!stop) {
        stop = { id: `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`, name: p.name || ev.title, query: p.query, ...at, visits: [] };
        stops.push(stop);
      }
      if (!stop.photo && p.photo) Object.assign(stop, { photo: p.photo, photoPage: p.photoPage });
      stop.visits.push({ dayIdx, dayId: day.id, eventId: ev.id, title: ev.title, start: ev.start });
    }
  });
  return stops;
}

// Each pin's place in the itinerary: 1, 2, 3… by its first visit (day, then
// time). With a day selected, the order within that day.
export function stopOrder(stops: MapStop[], dayIdx: number | null): Map<string, number> {
  const visits = stops
    .flatMap((s) => s.visits.filter((v) => dayIdx == null || v.dayIdx === dayIdx).map((v) => ({ id: s.id, v })))
    .sort((a, b) => a.v.dayIdx - b.v.dayIdx || a.v.start - b.v.start);
  const order = new Map<string, number>();
  for (const { id } of visits) if (!order.has(id)) order.set(id, order.size + 1);
  return order;
}

export function distanceKm(a: LngLat, b: LngLat): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 12_742 * Math.asin(Math.sqrt(h));
}

export function fmtDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000 / 10) * 10} m` : `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

export function boundsOf(points: LngLat[]): BBox | null {
  if (points.length === 0) return null;
  return {
    west: Math.min(...points.map((p) => p.lng)),
    south: Math.min(...points.map((p) => p.lat)),
    east: Math.max(...points.map((p) => p.lng)),
    north: Math.max(...points.map((p) => p.lat)),
  };
}

// ── Offline tiles (slippy-map numbering) ──────────────────────────────────────

export type Tile = { z: number; x: number; y: number };

const tileX = (lng: number, z: number) => Math.floor(((lng + 180) / 360) * 2 ** z);
const tileY = (lat: number, z: number) => {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
};

export function tilesInBBox(b: BBox, z: number): Tile[] {
  const out: Tile[] = [];
  for (let x = tileX(b.west, z); x <= tileX(b.east, z); x++) {
    for (let y = tileY(b.north, z); y <= tileY(b.south, z); y++) out.push({ z, x, y });
  }
  return out;
}

function around(p: LngLat, km: number): BBox {
  const dLat = km / 111;
  const dLng = km / (111 * Math.cos((p.lat * Math.PI) / 180));
  return { west: p.lng - dLng, south: p.lat - dLat, east: p.lng + dLng, north: p.lat + dLat };
}

// Every tile to keep on the device: the whole region at overview zooms, and
// street detail around each pin (and around where the user is, when known).
export function offlineTiles(points: LngLat[]): Tile[] {
  const seen = new Set<string>();
  const out: Tile[] = [];
  const add = (t: Tile) => {
    const k = `${t.z}/${t.x}/${t.y}`;
    if (!seen.has(k)) { seen.add(k); out.push(t); }
  };
  for (const z of REGION_ZOOMS) tilesInBBox(TRIP_REGION, z).forEach(add);
  for (const p of points) {
    for (const [z, km] of Object.entries(STOP_RADIUS_KM)) tilesInBBox(around(p, km), Number(z)).forEach(add);
  }
  return out;
}
