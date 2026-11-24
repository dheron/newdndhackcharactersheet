// Offline support for the web version. Pages are fetched from the network when it is there (so
// updates arrive) and from the cache when it is not; built assets have hashed names, so they are
// served from the cache once fetched. Character data is not here: it lives in the browser's storage.
const CACHE = "character-sheet-v3";

// On install, cache the page and the scripts and styles it loads (their names change with each build).
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const html = await (await fetch("./", { cache: "no-cache" })).text();
      const assets = [...html.matchAll(/(?:src|href)="(\.\/assets\/[^"]+)"/g)].map((m) => m[1]);
      await cache.addAll(["./", "./manifest.webmanifest", "./icons/icon-192.png", ...assets]);
    })(),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  const isAsset = new URL(request.url).pathname.includes("/assets/");
  if (isAsset) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
            return response;
          }),
      ),
    );
    return;
  }
  // Pages: always ask the server for the newest copy (skipping the browser's own cache), so a
  // new version shows on the next load; fall back to the saved copy when offline.
  event.respondWith(
    fetch(request, { cache: "no-cache" })
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy));
        return response;
      })
      .catch(() => caches.match(request).then((hit) => hit || caches.match("./"))),
  );
});
