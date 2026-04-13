const CACHE_NAME = 'operators-deck-v38';

// Only cache true static assets — never HTML files.
// Cloudflare redirects HTML requests (trailing slash, HTTPS, etc.)
// and a redirected response passed to respondWith() crashes with:
// "a redirected response was used for a request whose redirect mode is not 'follow'"
const STATIC_ASSETS = [
  '/particle-bg.js',
  '/manifest.json',
  '/od-core.js',
  '/intel-engine.js',
  '/op-brain.js',
  '/clove-16.png',
  '/clove-32.png',
  '/clove-180.png',
  '/clove-192.png',
  '/clove-512.png',
  '/favicon.ico',
  '/og-image.jpg',
  '/anchor/entropy.js',
  '/anchor/ics.js',
  '/anchor/db.js',
  '/anchor/tension-meter.js',
  '/anchor/anchor-step.js',
  '/anchor/anchor-ratio.js'
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

// ═══════════════════════════════════════════════════════════════════════════════
// NIGHT SHIFT — PERIODIC BACKGROUND SYNC (Phase 2)
// ═══════════════════════════════════════════════════════════════════════════════
// SW cannot access localStorage. Clinical data lives there.
// Strategy: message open clients to run analysis. If none open, set IndexedDB
// "stale" flag so next app open triggers immediate foreground catch-up.
// ═══════════════════════════════════════════════════════════════════════════════

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'night-shift-intelligence') {
    event.waitUntil(handleNightShift());
  }
});

async function handleNightShift() {
  try {
    // Attempt to acquire lock — prevents overlapping runs
    if (navigator.locks) {
      return await navigator.locks.request('clove_intel_lock', { ifAvailable: true }, async (lock) => {
        if (!lock) return; // Another run in progress — abort
        await executeNightShiftSync();
      });
    }
    // Fallback if Locks API unavailable
    await executeNightShiftSync();
  } catch (e) {
    // Silent failure — foreground catch-up handles it
  }
}

async function executeNightShiftSync() {
  // 1. Battery check (optional — API may be unavailable in SW context)
  try {
    if (typeof navigator.getBattery === 'function') {
      const battery = await navigator.getBattery();
      if (!battery.charging && battery.level < 0.3) return; // Preserve power
    }
  } catch (e) { /* Battery API unavailable in SW — proceed anyway */ }

  // 2. Storage headroom check
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const est = await navigator.storage.estimate();
      if (est.quota && est.usage && (est.usage / est.quota) > 0.9) return; // Near full
    }
  } catch (e) { /* Estimate unavailable — proceed */ }

  // 3. Message any open client tabs to run analysis
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  let messaged = false;

  for (const client of clients) {
    client.postMessage({ type: 'NIGHT_SHIFT_RUN' });
    messaged = true;
  }

  // 4. If no clients open, set IndexedDB stale flag for next foreground catch-up
  if (!messaged) {
    try {
      const db = await openIntelDB();
      const tx = db.transaction('ops', 'readwrite');
      tx.objectStore('ops').put({ key: 'stale', value: true, timestamp: Date.now() });
      await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = reject; });
      db.close();
    } catch (e) { /* IndexedDB unavailable — foreground handles it */ }
  }
}

// Minimal IndexedDB helper for stale flag
function openIntelDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('clove_intel', 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('ops')) {
        db.createObjectStore('ops', { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Listen for registration requests from client pages
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'NIGHT_SHIFT_REGISTER') {
    registerNightShiftSync();
  }
  if (event.data && event.data.type === 'NIGHT_SHIFT_UNREGISTER') {
    unregisterNightShiftSync();
  }
});

async function registerNightShiftSync() {
  try {
    const status = await navigator.permissions.query({ name: 'periodic-background-sync' });
    if (status.state === 'granted' || status.state === 'prompt') {
      await self.registration.periodicSync.register('night-shift-intelligence', {
        minInterval: 12 * 60 * 60 * 1000 // 12 hours
      });
    }
  } catch (e) {
    // PeriodicSync not supported — foreground catch-up is the fallback
  }
}

async function unregisterNightShiftSync() {
  try {
    await self.registration.periodicSync.unregister('night-shift-intelligence');
  } catch (e) { /* Not registered or not supported */ }
}
