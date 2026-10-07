import { offlineTiles, type LngLat } from "@/utils/tripGeo";

// Keeps the trip's map on the device: the region at overview zooms and street
// detail around every pin, plus the style, fonts, icons and place photos. The requests go
// through the service worker (public/sw.js), which stores them; this only
// decides what to fetch and remembers when it was done.

export const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";
const MAP_CACHE = "tw-map-v1";
const STATE_KEY = "tw:mapOffline";
const REFRESH_DAYS = 7;   // the tiles are rebuilt weekly; refresh the copy as often
const GLYPH_RANGES = ["0-255", "256-511", "8192-8447"];

export interface OfflineMapState { pointsKey: string; tiles: string; count: number; at: string }

type Style = {
  sources: Record<string, { url?: string; tiles?: string[] }>;
  glyphs?: string;
  sprite?: string | { url: string }[];
  layers: { layout?: Record<string, unknown> }[];
};

export const pointsKey = (points: LngLat[], photos: string[] = []) =>
  [...points.map((p) => `${p.lat.toFixed(3)},${p.lng.toFixed(3)}`), ...photos].sort().join("|");

// Only a production build with its service worker can store the map.
export function canStoreMap(): boolean {
  return process.env.NODE_ENV === "production" && typeof navigator !== "undefined" && !!navigator.serviceWorker?.controller;
}

export function offlineMapState(): OfflineMapState | null {
  try {
    return JSON.parse(localStorage.getItem(STATE_KEY) ?? "null");
  } catch {
    return null;
  }
}

export function needsRefresh(state: OfflineMapState | null, points: LngLat[], photos: string[]): boolean {
  if (!state || state.pointsKey !== pointsKey(points, photos)) return true;
  return Date.now() - new Date(state.at).getTime() > REFRESH_DAYS * 86_400_000;
}

const json = async <T,>(url: string) => (await fetch(url)).json() as Promise<T>;

export async function storeMapOffline(points: LngLat[], photos: string[], onProgress: (done: number, total: number) => void): Promise<OfflineMapState> {
  const style = await json<Style>(MAP_STYLE);
  const source = Object.values(style.sources).find((s) => s.url || s.tiles);
  const template = source?.tiles?.[0] ?? (source?.url ? (await json<{ tiles: string[] }>(source.url)).tiles[0] : undefined);
  if (!template) throw new Error("No se encontró el mapa base");

  const urls = offlineTiles(points).map((t) => template.replace("{z}", String(t.z)).replace("{x}", String(t.x)).replace("{y}", String(t.y)));
  const fonts = new Set(style.layers.flatMap((l) => {
    const f = l.layout?.["text-font"];
    return Array.isArray(f) && f.every((x) => typeof x === "string") ? [f.join(",")] : [];
  }));
  if (style.glyphs) {
    for (const font of fonts) for (const range of GLYPH_RANGES) urls.push(style.glyphs.replace("{fontstack}", encodeURIComponent(font)).replace("{range}", range));
  }
  for (const s of typeof style.sprite === "string" ? [style.sprite] : (style.sprite ?? []).map((x) => x.url)) {
    urls.push(`${s}.json`, `${s}.png`, `${s}@2x.json`, `${s}@2x.png`);
  }

  urls.push(...photos);

  let done = 0;
  const queue = [...urls];
  await Promise.all(Array.from({ length: 6 }, async () => {
    for (let url = queue.shift(); url; url = queue.shift()) {
      await fetch(url, { mode: "cors" }).catch(() => undefined);
      onProgress(++done, urls.length);
    }
  }));

  // Tiles of older weekly builds are dead weight once the new ones are stored.
  const build = template.slice(0, template.indexOf("{z}"));
  const cache = await caches.open(MAP_CACHE);
  for (const req of await cache.keys()) {
    if (req.url.includes("/planet/") && !req.url.startsWith(build)) await cache.delete(req);
  }

  const state: OfflineMapState = { pointsKey: pointsKey(points, photos), tiles: build, count: urls.length, at: new Date().toISOString() };
  try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch { /* the map is stored anyway */ }
  return state;
}
