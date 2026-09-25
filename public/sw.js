/*
 * Aitta service worker: keeps the shopping list usable offline in the store.
 *  - /_next/static and icons: cache-first (immutable, hashed)
 *  - page navigations: network-first, falling back to the cached copy
 *    (so a list you opened at home still loads with no signal)
 *  - API calls: network only (the checklist keeps its own offline copy and
 *    queues check-offs in localStorage until the connection is back)
 */
const VERSION = "aitta-v1";
const STATIC = `${VERSION}-static`;
const PAGES = `${VERSION}-pages`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC)
      .then((c) => c.addAll(["/manifest.webmanifest", "/icon-192.png", "/icon-512.png"]))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function isStatic(url) {
  return url.pathname.startsWith("/_next/static/") || /^\/(icon|apple-icon)[^/]*\.(png|svg)$/.test(url.pathname) || url.pathname === "/manifest.webmanifest";
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (isStatic(url)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(STATIC).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && !res.redirected) {
            const copy = res.clone();
            caches.open(PAGES).then((c) => c.put(url.pathname, copy));
          }
          return res;
        })
        .catch(() =>
          caches.match(url.pathname, { cacheName: PAGES }).then(
            (hit) =>
              hit ||
              new Response(
                "<!doctype html><meta name=viewport content='width=device-width'><body style='font-family:system-ui;padding:24px'><h1>Offline</h1><p>This page wasn't opened while online. Open your shopping list once with a connection and it will work offline afterwards.</p>",
                { headers: { "content-type": "text/html; charset=utf-8" } },
              ),
          ),
        ),
    );
  }
});
