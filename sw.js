const CACHE_NAME = 'operators-deck-v55';

// Only handle an explicit offline-safe asset allowlist. HTML and mutable Mission
// runtime files are never intercepted. For allowlisted assets, prefer the network
// so an online user receives the current deployment; cached copies are fallback.
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
  '/anchor/anchor-ratio.js',
  '/semantic/benefit-embeddings.json',
  '/fr-policies.json',
  '/fr-master-policy.json',
  '/semantic/transformers.min.js',
  '/voice-engine.js',
  '/stt-worker.js'
];
const STATIC_ASSET_PATHS = new Set(STATIC_ASSETS);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const url of STATIC_ASSETS) {
        try {
          const res = await fetch(url, { redirect: 'follow' });
          if (res && res.ok) await cache.put(url, res);
        } catch (e) {
          // Asset missing or offline — skip silently.
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

  // RULE 1: never intercept navigation requests (HTML page loads).
  if (request.mode === 'navigate') return;

  // RULE 2: pass external URLs straight through.
  if (!url.startsWith(self.location.origin)) return;

  // RULE 3: only intercept the explicit offline-safe asset allowlist.
  const pathname = new URL(url).pathname;
  if (!STATIC_ASSET_PATHS.has(pathname)) return;

  // RULE 4: network first. Update the offline cache on a good response; use the
  // cached copy only when the network is unavailable.
  event.respondWith(
    fetch(request, { redirect: 'follow' }).then((res) => {
      if (res && res.ok && res.type === 'basic') {
        const resClone = res.clone();
        event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(request, resClone)));
      }
      return res;
    }).catch(async () => {
      const cached = await caches.match(request);
      return cached || new Response('', { status: 408 });
    })
  );
});

// NIGHT SHIFT — PERIODIC BACKGROUND SYNC (legacy Operator's Deck support)
// SW cannot access localStorage. Clinical data lives there.
// Strategy: message open clients to run analysis. If none open, set IndexedDB
// "stale" flag so next app open triggers immediate foreground catch-up.

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'night-shift-intelligence') {
    event.waitUntil(handleNightShift());
  }
});

async function handleNightShift() {
  try {
    if (navigator.locks) {
      return await navigator.locks.request('clove_intel_lock', { ifAvailable: true }, async (lock) => {
        if (!lock) return;
        await executeNightShiftSync();
      });
    }
    await executeNightShiftSync();
  } catch (e) {
    // Silent failure — foreground catch-up handles it.
  }
}

async function executeNightShiftSync() {
  try {
    if (typeof navigator.getBattery === 'function') {
      const battery = await navigator.getBattery();
      if (!battery.charging && battery.level < 0.3) return;
    }
  } catch (e) { /* Battery API unavailable in SW — proceed anyway. */ }

  try {
    if (navigator.storage && navigator.storage.estimate) {
      const est = await navigator.storage.estimate();
      if (est.quota && est.usage && (est.usage / est.quota) > 0.9) return;
    }
  } catch (e) { /* Estimate unavailable — proceed. */ }

  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  let messaged = false;

  for (const client of clients) {
    client.postMessage({ type: 'NIGHT_SHIFT_RUN' });
    messaged = true;
  }

  if (!messaged) {
    try {
      const db = await openIntelDB();
      const tx = db.transaction('ops', 'readwrite');
      tx.objectStore('ops').put({ key: 'stale', value: true, timestamp: Date.now() });
      await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = reject; });
      db.close();
    } catch (e) { /* IndexedDB unavailable — foreground handles it. */ }
  }
}

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
        minInterval: 12 * 60 * 60 * 1000
      });
    }
  } catch (e) {
    // PeriodicSync not supported — foreground catch-up is the fallback.
  }
}

async function unregisterNightShiftSync() {
  try {
    await self.registration.periodicSync.unregister('night-shift-intelligence');
  } catch (e) { /* Not registered or not supported. */ }
}
