const CACHE_VERSION = "v1";
const SHELL_CACHE   = `ps-shell-${CACHE_VERSION}`;
const API_CACHE     = `ps-api-${CACHE_VERSION}`;
const MEDIA_CACHE   = `ps-media-${CACHE_VERSION}`;

// Minimal app shell to pre-cache at install time.
// JS / CSS chunks are cached on first access via networkFirst.
const SHELL_ASSETS = ["/", "/index.html"];

// API paths whose GET responses are served stale-while-revalidate.
const API_PREFIXES = [
  "/api/clients",
  "/api/gallery",
  "/api/staff",
  "/api/payments",
  "/api/dashboard",
];

// ── Install ───────────────────────────────────────────────────────────────────
// Pre-cache the minimal app shell so the UI is available immediately offline.
// Assets are added individually via Promise.allSettled so a single 404 never
// aborts the whole install.  Errors are logged (not swallowed silently).
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(async (cache) => {
      const results = await Promise.allSettled(
        SHELL_ASSETS.map((url) => cache.add(url))
      );
      results.forEach((r, i) => {
        if (r.status === "rejected") {
          console.warn(`[SW] Failed to pre-cache ${SHELL_ASSETS[i]}:`, r.reason);
        }
      });
      await self.skipWaiting();
    })
  );
});

// ── Activate ──────────────────────────────────────────────────────────────────
// Purge caches from previous cache versions then claim all open clients so
// the new SW takes effect immediately without a page reload.
self.addEventListener("activate", (event) => {
  const allowed = new Set([SHELL_CACHE, API_CACHE, MEDIA_CACHE]);
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !allowed.has(k)).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only intercept same-origin requests.
  if (url.origin !== self.location.origin) return;

  // Auth endpoints always bypass the cache — tokens must never be stale.
  if (url.pathname.startsWith("/api/auth")) return;

  // Write operations (POST / PATCH / PUT / DELETE) always go to the network.
  if (url.pathname.startsWith("/api/") && request.method !== "GET") return;

  // ── API GET: stale-while-revalidate ────────────────────────────────────────
  // Returns the cached response immediately (if any) and refreshes the cache
  // in the background.  event.waitUntil() is called on the background fetch so
  // the SW is kept alive until the cache update is fully written.
  if (
    request.method === "GET" &&
    API_PREFIXES.some((p) => url.pathname.startsWith(p))
  ) {
    event.respondWith(staleWhileRevalidate(event, API_CACHE));
    return;
  }

  // ── Uploaded photos: cache-first ───────────────────────────────────────────
  // Photos are immutable after upload — serve from cache, populate on miss.
  if (url.pathname.startsWith("/uploads/")) {
    event.respondWith(cacheFirst(request, MEDIA_CACHE));
    return;
  }

  // ── Everything else (JS, CSS, HTML): network-first ─────────────────────────
  // Prefer a fresh copy from the network; fall back to cache when offline.
  event.respondWith(networkFirst(request, SHELL_CACHE));
});

// ─── Caching strategies ───────────────────────────────────────────────────────

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok || networkResponse.status === 0) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;

    // For SPA navigation misses, return the shell so React Router can handle
    // the route client-side.
    if (request.mode === "navigate") {
      const shell =
        (await cache.match("/index.html")) ||
        (await cache.match("/"));
      if (shell) return shell;
    }

    return new Response("Offline — no cached version available.", {
      status:  503,
      headers: { "Content-Type": "text/plain" },
    });
  }
}

// staleWhileRevalidate takes the FetchEvent (not just the request) so it can
// call event.waitUntil() to keep the SW alive while the background revalidation
// fetch writes to the cache — without this the SW may be terminated early.
async function staleWhileRevalidate(event, cacheName) {
  const { request } = event;
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);

  // Start the network fetch unconditionally so the cache is always refreshed.
  const revalidate = fetch(request)
    .then((networkResponse) => {
      if (networkResponse.ok || networkResponse.status === 0) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch(() => null);

  if (cached) {
    // Keep the SW alive while the background update finishes.
    event.waitUntil(revalidate);
    return cached;
  }

  // No cache hit — must await the network.
  return (await revalidate) ||
    new Response(JSON.stringify({ offline: true, data: [] }), {
      status:  200,
      headers: { "Content-Type": "application/json" },
    });
}

async function cacheFirst(request, cacheName) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok || networkResponse.status === 0) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    return new Response("Offline — resource not cached.", {
      status:  503,
      headers: { "Content-Type": "text/plain" },
    });
  }
}
