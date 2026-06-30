const SHELL_CACHE = "fnp-shell-v2.17";
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

// Activate: delete old caches
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

  // Never intercept Supabase, Anthropic, or non-same-origin API calls
  if (!url.origin.includes(self.location.origin) && !url.pathname.startsWith("/api/")) return;
  if (url.hostname.includes("supabase.co") || url.hostname.includes("anthropic.com")) return;

  // Images: cache-first (they're big and stable once uploaded)
  if (url.pathname.startsWith("/api/img") || url.pathname.match(/\.(png|jpg|jpeg|webp|gif|ico)$/)) {
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

  // API parse / other API: network-only (never cache AI responses)
  if (url.pathname.startsWith("/api/")) return;

  // App shell + Next.js assets: network-first, fall back to cache
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
