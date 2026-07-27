const CACHE_NAME = "map-tile-cache-v1";
const CACHE_PREFIX = "map-tile-cache-";
const MAX_TILE_CACHE_ITEMS = 1000;

function isMapTileRequest(request) {
  if (request.method !== "GET") return false;

  const url = new URL(request.url);
  const hostname = url.hostname;

  return (
    hostname === "server.arcgisonline.com" ||
    hostname === "basemaps.cartocdn.com" ||
    hostname.endsWith(".basemaps.cartocdn.com")
  );
}

async function trimCache(cache) {
  const keys = await cache.keys();
  const overflow = keys.length - MAX_TILE_CACHE_ITEMS;

  if (overflow <= 0) return;

  await Promise.all(keys.slice(0, overflow).map((request) => cache.delete(request)));
}

async function fetchAndCacheTile(request) {
  const cache = await caches.open(CACHE_NAME);
  const response = await fetch(request);

  if (response.ok || response.type === "opaque") {
    cache
      .put(request, response.clone())
      .then(() => trimCache(cache))
      .catch(() => undefined);
  }

  return response;
}

async function getTileResponse(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  if (cached) return cached;

  return fetchAndCacheTile(request);
}

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
            .map((name) => caches.delete(name)),
        ),
      ),
    ]),
  );
});

self.addEventListener("fetch", (event) => {
  if (!isMapTileRequest(event.request)) return;

  event.respondWith(getTileResponse(event.request));
});
