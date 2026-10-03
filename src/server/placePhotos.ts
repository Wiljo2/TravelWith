import { normalizeText } from "@/utils/ideas";
import { distanceKm } from "@/utils/tripGeo";
import type { EventPlace } from "@/types";

// A photo for each place on the trip map, from Wikipedia (free, no key, and its
// images may be kept on the device for offline use). An article only counts
// when it is really about this place: found by name AND located near the pin,
// or located right next to it AND sharing a distinctive word with its name.
// No match means no photo ("" = searched, none found) rather than a wrong one.

const API = "https://en.wikipedia.org/w/api.php";
const NAME_MATCH_KM = 3;
const NEARBY_M = 1000;
const HEADERS = { "User-Agent": "TravelWith/1.0 (group trip planner; https://github.com/2203juan)" };

type Page = { title: string; index?: number; fullurl?: string; thumbnail?: { source: string }; coordinates?: { lat: number; lon: number }[] };
export type Photo = { photo: string; photoPage?: string };

async function pages(params: Record<string, string>): Promise<Page[]> {
  const qs = new URLSearchParams({
    action: "query", format: "json", formatversion: "2", prop: "pageimages|coordinates|info",
    inprop: "url", piprop: "thumbnail", pithumbsize: "480", ...params,
  });
  try {
    const res = await fetch(`${API}?${qs}`, { headers: HEADERS, signal: AbortSignal.timeout(6000) });
    if (!res.ok) return [];
    const data = (await res.json()) as { query?: { pages?: Page[] } };
    return (data.query?.pages ?? []).sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  } catch {
    return [];
  }
}

const GENERIC = new Set(normalizeText("the and del los las hotel suites inn resort orlando miami florida nassau bahamas cruise port terminal international airport park beach street avenue road boulevard drive island center centre city mall market club").split(" "));
const words = (s: string) => new Set(normalizeText(s).split(/[^a-z0-9ñ]+/).filter((w) => w.length >= 4 && !GENERIC.has(w)));

const near = (p: Page, at: { lat: number; lng: number }, km: number) => {
  const c = p.coordinates?.[0];
  return !!c && distanceKm({ lat: c.lat, lng: c.lon }, at) <= km;
};

export async function findPhoto(place: { name?: string; lat?: number; lng?: number }): Promise<Photo | null> {
  if (!place.name || place.lat == null || place.lng == null) return null;
  const at = { lat: place.lat, lng: place.lng };
  const pick = (p?: Page) => (p?.thumbnail ? { photo: p.thumbnail.source, photoPage: p.fullurl } : null);

  const byName = await pages({ generator: "search", gsrsearch: place.name, gsrlimit: "3" });
  const named = byName.find((p) => p.thumbnail && near(p, at, NAME_MATCH_KM));
  if (named) return pick(named);

  const own = words(place.name);
  const around = await pages({ generator: "geosearch", ggscoord: `${at.lat}|${at.lng}`, ggsradius: String(NEARBY_M), ggslimit: "10" });
  return pick(around.find((p) => p.thumbnail && [...words(p.title)].some((w) => own.has(w))) ?? undefined);
}

// Adds a photo to every place that has none yet, one search per distinct place.
export async function withPhotos(places: Record<string, EventPlace>): Promise<Record<string, EventPlace>> {
  const spot = (p: EventPlace) => `${p.name}|${p.lat?.toFixed(3)},${p.lng?.toFixed(3)}`;
  const pending = new Map<string, EventPlace>();
  for (const p of Object.values(places)) if (p.kind === "place" && p.photo === undefined && p.name) pending.set(spot(p), p);
  const found = new Map<string, Photo | null>();
  const list = [...pending];
  for (let i = 0; i < list.length; i += 4) {
    await Promise.all(list.slice(i, i + 4).map(async ([k, p]) => found.set(k, await findPhoto(p))));
  }
  return Object.fromEntries(Object.entries(places).map(([id, p]) => {
    if (!found.has(spot(p)) || p.photo !== undefined) return [id, p];
    const photo = found.get(spot(p));
    return [id, { ...p, photo: photo?.photo ?? "", ...(photo?.photoPage ? { photoPage: photo.photoPage } : {}) }];
  }));
}
