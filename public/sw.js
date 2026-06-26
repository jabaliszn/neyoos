/**
 * NEYO service worker (Feature G.2).
 * - Precaches a minimal offline shell.
 * - Navigations: network-first, fall back to cached shell when offline.
 * - Static assets (_next/static, icons): cache-first.
 * - Never caches API calls (they go through the offline queue when offline).
 */
const CACHE = "neyo-v1";
const OFFLINE_URL = "/offline";
const PRECACHE = [OFFLINE_URL, "/icon-192.png", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle same-origin GETs; let everything else (POST/API) hit network.
  if (req.method !== "GET" || url.origin !== self.location.origin) return;

  // API calls: always network (offline writes are handled by the app's queue).
  if (url.pathname.startsWith("/api/")) return;

  // Static assets: cache-first.
  if (url.pathname.startsWith("/_next/static") || /\.(png|jpg|jpeg|svg|webp|ico|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      }))
    );
    return;
  }

  // Navigations / pages: network-first, fall back to cache, then offline shell.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match(OFFLINE_URL)))
    );
  }
});

// I.86 native-style notifications: supports Web Push payloads and notification clicks.
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: "NEYO notification", body: event.data?.text() || "Open NEYO for details" }; }
  const title = data.title || "NEYO notification";
  const options = {
    body: data.body || "Open NEYO for details",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: { href: data.href || "/dashboard", id: data.id || null },
    tag: data.id || `neyo-${Date.now()}`,
    renotify: true,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href = event.notification.data?.href || "/dashboard";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.focus();
          if ("navigate" in client) return client.navigate(href);
          return;
        }
      }
      return self.clients.openWindow(href);
    })
  );
});
