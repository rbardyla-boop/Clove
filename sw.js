const CACHE_NAME = 'operators-deck-v14';

// Only cache true static assets — never HTML files.
// Cloudflare redirects HTML requests (trailing slash, HTTPS, etc.)
// and a redirected response passed to respondWith() crashes with:
// "a redirected response was used for a request whose redirect mode is not 'follow'"
const STATIC_ASSETS = [
  '/manifest.json',
  '/od-core.js',
  '/clove-16.png',
  '/clove-32.png',
  '/clove-180.png',
  '/clove-192.png',
  '/clove-512.png',
  '/favicon.ico',
  '/og-image.jpg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const url of STATIC_ASSETS) {
        try {
          const res = await fetch(url, { redirect: 'follow' });
          if (res && res.ok) await cache.put(url, res);
        } catch (e) {
          // Asset missing or offline — skip silently
        }
      }
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = request.url;

  // ── RULE 1: NEVER intercept navigate requests (HTML page loads).
  // Cloudflare redirects every .html URL and respondWith(redirected) crashes.
  // Let the browser handle all navigation natively.
  if (request.mode === 'navigate') return;

  // ── RULE 2: Pass external URLs straight through.
  if (!url.startsWith(self.location.origin)) return;

  // ── RULE 3: Cache-first for static assets (images, manifest).
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request, { redirect: 'follow' }).then((res) => {
        if (res && res.ok && res.type === 'basic') {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, resClone));
        }
        return res;
      }).catch(() => new Response('', { status: 408 }));
    })
  );
});
