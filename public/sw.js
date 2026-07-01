const SHELL_CACHE = "fnp-shell-v2.45";
const IMG_CACHE   = "fnp-images-v1";
const SHELL_URLS  = ["/", "/manifest.json", "/icons/icon-512.png", "/icons/icon-192.png"];

// Install: pre-cache app shell
self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(SHELL_CACHE)
      .then(c => c.addAll(SHELL_URLS).catch(()=>{}))
      .then(() => self.skipWaiting())
  );
});

// Activate: delete ALL old caches (purges any stale bundle cached by older SW versions)
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== SHELL_CACHE && k !== IMG_CACHE).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);

  // Only handle our own origin; let everything cross-origin go straight to network
  if (url.origin !== self.location.origin) return;
  // Never touch API calls (parse/AI) or Next.js data/RSC requests — these MUST be live,
  // and caching RSC payloads is what breaks the app after a new deploy.
  if (url.pathname.startsWith("/api/")) return;
  if (url.pathname.startsWith("/_next/data/")) return;
  if (url.searchParams.has("_rsc")) return;
  if (e.request.headers.get("RSC") === "1" || e.request.headers.get("Next-Router-Prefetch")) return;

  // Images & icons: cache-first (big, stable once uploaded — gives offline image loading)
  if (url.pathname.match(/\.(png|jpg|jpeg|webp|gif|ico|svg)$/)) {
    e.respondWith(
      caches.open(IMG_CACHE).then(cache =>
        cache.match(e.request).then(hit => {
          if (hit) return hit;
          return fetch(e.request).then(res => {
            if (res.ok) cache.put(e.request, res.clone());
            return res;
          }).catch(() => new Response("", { status: 503 }));
        })
      )
    );
    return;
  }

  // App shell + static JS/CSS: network-first (always fresh when online), cache fallback offline
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(SHELL_CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then(hit => hit || new Response("Offline", { status: 503 })))
  );
});
