// TravelWith service worker: keeps the app openable without internet.
// - The page: network first, falling back to the last copy.
// - Build assets (/_next/static/…, hashed, never change): cache first.
// - API calls and Supabase are never cached here: the trip itself has its own
//   offline copy on the device (src/lib/offline.ts).
const CACHE = "tw-app-v1";
const SHELL = ["/", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png", "/icon.png", "/apple-icon.png"];

const put = (key, res) => caches.open(CACHE).then((c) => c.put(key, res));

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
    for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
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

  if (url.pathname.startsWith("/_next/static/") || SHELL.includes(url.pathname)) {
    event.respondWith(
      caches.match(req).then((hit) => hit ?? fetch(req).then((res) => {
        if (res.ok) put(req, res.clone());
        return res;
      })),
    );
  }
});
