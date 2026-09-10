const CACHE = "vibescout-v2"; // bumped once to blow away the broken v1 cache on everyone's phones

// Only precache paths that exist in EVERY build. /src/main.js and
// /src/style.css only exist in dev — Vite hashes them into /assets/*.js
// in production, so precaching those literal paths 404s during install,
// which fails the whole install step. That silent failure is why old
// versions of the app were getting stuck on people's phones.
const APP_SHELL = ["/", "/index.html", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  // The HTML shell: always try the network first so a fresh deploy is
  // visible immediately for anyone online. Only fall back to whatever's
  // cached (or the cached index.html) if the network request fails.
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match("/index.html")))
    );
    return;
  }

  // Everything else (hashed JS/CSS/images/etc.): same network-first
  // approach, caching each response as it comes in so the app still
  // works if the connection drops later.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
