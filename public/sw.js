// TravelWith service worker: keeps the app openable without internet.
// - The page: network first, falling back to the last copy.
// - Build assets (/_next/static/…, hashed, never change): cache first.
// - Map (OpenFreeMap): style and tile index network first; tiles, fonts,
//   icons and place photos (Wikipedia) cache first, in their own cache that app updates don't wipe
//   (src/lib/mapOffline.ts fills it for the trip's region).
// - API calls and Supabase are never cached here: the trip itself has its own
//   offline copy on the device (src/lib/offline.ts).
const CACHE = "tw-app-v1";
const MAP_CACHE = "tw-map-v1";
const MAP_HOST = "tiles.openfreemap.org";
const PHOTO_HOST = "upload.wikimedia.org";   // place photos (CORS, so cheap to keep)
const SHELL = ["/", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png", "/icon.png", "/apple-icon.png"];

const put = (key, res, cache = CACHE) => caches.open(cache).then((c) => c.put(key, res));

const networkFirst = (req, cache) => fetch(req)
  .then((res) => {
    if (res.ok) put(req, res.clone(), cache);
    return res;
  })
  .catch(async () => (await caches.match(req)) ?? Response.error());

const cacheFirst = (req, cache) => caches.match(req).then((hit) => hit ?? fetch(req).then((res) => {
  if (res.ok) put(req, res.clone(), cache);
  return res;
}));

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(SHELL.map((url) => cache.add(url).catch(() => {})));
    // The page's scripts, styles and fonts, so the very first offline open works.
    const html = await (await cache.match("/"))?.text();
    const assets = [...(html ?? "").matchAll(/(?:src|href)="(\/_next\/static\/[^"]+)"/g)].map((m) => m[1]);
    await Promise.all([...new Set(assets)].map((url) => cache.add(url).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== CACHE && key !== MAP_CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.host === PHOTO_HOST) {
    event.respondWith(cacheFirst(req, MAP_CACHE));
    return;
  }
  if (url.host === MAP_HOST) {
    const index = url.pathname.startsWith("/styles/") || !url.pathname.endsWith(".pbf") && !url.pathname.includes("/sprites/");
    event.respondWith(index ? networkFirst(req, MAP_CACHE) : cacheFirst(req, MAP_CACHE));
    return;
  }
  // Idea covers (an app route, so cacheable): seen once, shown offline too.
  if (url.origin === self.location.origin && /^\/api\/rooms\/[^/]+\/thumb$/.test(url.pathname)) {
    event.respondWith(cacheFirst(req, MAP_CACHE));
    return;
  }
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) put("/", res.clone());
          return res;
        })
        .catch(async () => (await caches.match("/")) ?? Response.error()),
    );
    return;
  }

  // /vendor/ holds versioned copies of library files (the map's worker).
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/vendor/") || SHELL.includes(url.pathname)) {
    event.respondWith(cacheFirst(req, CACHE));
  }
});
