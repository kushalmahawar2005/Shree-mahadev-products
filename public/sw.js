/* Swadeshi Mahadev service worker: installable app + calm offline fallback.
 * Never caches anything personal or price-sensitive (cart, checkout, account, admin, API, server actions):
 * pages always come fresh from the network; only versioned build files and the offline page are cached. */
const VERSION = "smp-v3";
const STATIC = `${VERSION}-static`;
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC).then((c) => c.addAll([OFFLINE_URL, "/icons/icon-192.png"])).then(() => self.skipWaiting()),
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

const PRIVATE = /^\/(admin|api|checkout|account|cart|login|order|review|track-order)(\/|$)/;

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // server actions, forms, payments: untouched
  const url = new URL(req.url);

  // Page loads: always network. Offline → friendly page instead of the browser's dinosaur.
  if (req.mode === "navigate") {
    if (url.origin === self.location.origin && PRIVATE.test(url.pathname)) return;
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  // Hashed build files never change: cache first.
  if (url.origin === self.location.origin && url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            // Clone now, before the page reads the body; cloning later fails with "body already used".
            if (res.ok) {
              const copy = res.clone();
              event.waitUntil(caches.open(STATIC).then((c) => c.put(req, copy)));
            }
            return res;
          }),
      ),
    );
    return;
  }

  // Everything else (incl. Cloudinary product photos) goes straight to the network: the CDN and the
  // browser's own HTTP cache already make repeat views fast, and intercepting cross-origin images
  // broke some of them.
});
