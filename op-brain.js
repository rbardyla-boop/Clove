/**
 * OP-BRAIN.JS — CloveLearn Embedding Memory Layer v1.0
 * ────────────────────────────────────────────────────
 * Sprint 4C: Local RAG via all-MiniLM-L6-v2 (23MB).
 * Converts WGO protocol logs into 384-dim vectors.
 * Stores in IndexedDB. Enables semantic similarity search.
 * Falls back gracefully — intel-engine.js Layer 1 is never blocked.
 *
 * Dependencies: transformers.js (from cdn.jsdelivr.net, cached locally)
 * Own IndexedDB: clove_intel (shared with sw.js stale flag)
 *   v1: ops store only (sw.js creates this)
 *   v2: adds memories store (this file upgrades to v2)
 * Own localStorage: none (piggybacks on od_intel_config for settings)
 *
 * Exposes: window.OpBrain
 */

(function (g) {
  'use strict';

  // ── CONSTANTS ────────────────────────────────────────────────────────────
  var MODEL_ID     = 'Xenova/all-MiniLM-L6-v2';
  var CDN_URL      = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3';
  var DB_NAME      = 'clove_intel';
  var DB_VERSION   = 2;   // v1 (sw.js) = ops only; v2 adds memories
  var STORE_MEM    = 'memories';
  var STORE_OPS    = 'ops';
  var MAX_MEMORIES = 500;
  var VECTOR_DIM   = 384;

  // ── STATE ────────────────────────────────────────────────────────────────
  var _pipeline   = null;
  var _db         = null;
  var _modelReady = false;
  var _loading    = false;

  // ── IndexedDB ────────────────────────────────────────────────────────────
  function openDB() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = function (e) {
        var db      = e.target.result;
        var oldVer  = e.oldVersion;

        // Create ops store if this is a fresh install (no prior version)
        if (oldVer < 1) {
          if (!db.objectStoreNames.contains(STORE_OPS)) {
            db.createObjectStore(STORE_OPS, { keyPath: 'key' });
          }
        }
        // Add memories store on upgrade from v1 or fresh install
        if (!db.objectStoreNames.contains(STORE_MEM)) {
          var memStore = db.createObjectStore(STORE_MEM, { autoIncrement: true, keyPath: 'id' });
          memStore.createIndex('timestamp', 'timestamp', { unique: false });
          memStore.createIndex('source',    'source',    { unique: false });
          memStore.createIndex('orig_ts',   'orig_ts',   { unique: true  }); // original entry ts for dedup
        }
      };

      req.onsuccess = function () {
        resolve(req.result);
      };
      req.onerror = function () {
        reject(req.error);
      };
    });
  }

  function getDB() {
    if (_db) return Promise.resolve(_db);
    return openDB().then(function (db) {
      _db = db;
      return db;
    });
  }

  // ── MODEL MANAGEMENT ─────────────────────────────────────────────────────
  function loadModel(onProgress) {
    if (_modelReady && _pipeline) return Promise.resolve(true);
    if (_loading) return Promise.resolve(false);
    _loading = true;

    return checkStorageHeadroom()
      .then(function (headroom) {
        if (!headroom.ok) {
          _loading = false;
          return false;
        }
        return import(CDN_URL).then(function (mod) {
          var createPipeline = mod.pipeline;
          return createPipeline('feature-extraction', MODEL_ID, {
            progress_callback: onProgress || function () {},
            dtype:  'fp32',
            device: 'wasm'
          });
        }).then(function (pipe) {
          _pipeline   = pipe;
          _modelReady = true;
          _loading    = false;

          // Record model version in IndexedDB ops store
          return getDB().then(function (db) {
            try {
              var tx    = db.transaction(STORE_OPS, 'readwrite');
              var store = tx.objectStore(STORE_OPS);
              store.put({ key: 'model_version', value: '1.0.0', timestamp: Date.now() });
            } catch (e) { /* non-fatal */ }
            return true;
          });
        });
      })
      .catch(function () {
        _loading    = false;
        _modelReady = false;
        _pipeline   = null;
        return false;
      });
  }

  function unloadModel() {
    _pipeline   = null;
    _modelReady = false;
    // Cached model files stay in Cache Storage — this only frees RAM
  }

  function isModelReady() { return _modelReady && _pipeline !== null; }
  function isLoading()    { return _loading; }

  // ── EMBEDDING ────────────────────────────────────────────────────────────
  function embed(text) {
    if (!isModelReady()) return Promise.resolve(null);
    return _pipeline(text, { pooling: 'mean', normalize: true })
      .then(function (output) {
        return output.data; // Float32Array(384)
      })
      .catch(function () { return null; });
  }

  // ── COSINE SIMILARITY ─────────────────────────────────────────────────────
  function cosineSimilarity(a, b) {
    var dot = 0, magA = 0, magB = 0;
    for (var i = 0; i < a.length; i++) {
      dot  += a[i] * b[i];
      magA += a[i] * a[i];
      magB += b[i] * b[i];
    }
    var denom = Math.sqrt(magA) * Math.sqrt(magB);
    return denom === 0 ? 0 : dot / denom;
  }

  // ── INGESTION ────────────────────────────────────────────────────────────
  function ingest(entry) {
    if (!isModelReady())                                    return Promise.resolve(false);
    if (!entry || !entry.input || entry.input.length < 10) return Promise.resolve(false);

    var origTs = entry.timestamp || 0;

    return getDB().then(function (db) {
      // Dedup check via orig_ts index
      return new Promise(function (resolve, reject) {
        var tx  = db.transaction(STORE_MEM, 'readonly');
        var idx = tx.objectStore(STORE_MEM).index('orig_ts');
        var req = idx.get(origTs);
        req.onsuccess = function () { resolve(req.result ? 'exists' : 'new'); };
        req.onerror   = function () { resolve('new'); }; // on error, attempt ingest
      });
    }).then(function (status) {
      if (status === 'exists') return false;

      return embed(entry.input).then(function (vec) {
        if (!vec) return false;

        return getDB().then(function (db) {
          return new Promise(function (resolve, reject) {
            var record = {
              vector:      Array.from(vec),             // Float32Array → Array for IDB
              text:        entry.input.substring(0, 300),
              distortions: entry.distortions || [],
              intensity:   entry.intensity   || 0,
              state:       entry.state       || '',
              label:       entry.label       || '',
              orig_ts:     origTs,
              timestamp:   Date.now(),
              source:      'protocol_log',
              embedded_at: Date.now()
            };
            var tx  = db.transaction(STORE_MEM, 'readwrite');
            var req = tx.objectStore(STORE_MEM).add(record);
            tx.oncomplete = function () { resolve(true);  };
            tx.onerror    = function () { resolve(false); };
          });
        });
      });
    }).catch(function () { return false; });
  }

  // ── SYNC NEW LOGS ─────────────────────────────────────────────────────────
  function syncNewLogs() {
    var logs = [];
    try { logs = JSON.parse(localStorage.getItem('od_protocol_logs') || '[]'); } catch (e) {}

    var processed = 0, skipped = 0, failed = 0;

    // Sequential async processing to avoid flooding the embedding pipeline
    var chain = Promise.resolve();
    logs.forEach(function (entry) {
      chain = chain.then(function () {
        if (!entry.input || entry.input.length < 10) { skipped++; return; }
        return ingest(entry).then(function (ok) {
          if (ok === false && entry.timestamp) {
            // Could be duplicate (already embedded) or failed
            skipped++;
          } else if (ok === true) {
            processed++;
          } else {
            failed++;
          }
        });
      });
    });

    return chain.then(function () {
      // Enforce MAX_MEMORIES cap — delete oldest entries if over limit
      return getDB().then(function (db) {
        return new Promise(function (resolve) {
          var tx    = db.transaction(STORE_MEM, 'readonly');
          var req   = tx.objectStore(STORE_MEM).count();
          req.onsuccess = function () { resolve(req.result); };
          req.onerror   = function () { resolve(0); };
        });
      }).then(function (count) {
        if (count <= MAX_MEMORIES) return;
        var overflow = count - MAX_MEMORIES;
        return getDB().then(function (db) {
          return new Promise(function (resolve) {
            var tx     = db.transaction(STORE_MEM, 'readwrite');
            var store  = tx.objectStore(STORE_MEM);
            var cursor = store.index('timestamp').openCursor(null, 'next');
            var deleted = 0;
            cursor.onsuccess = function (e) {
              var c = e.target.result;
              if (!c || deleted >= overflow) { resolve(); return; }
              c.delete();
              deleted++;
              c.continue();
            };
            cursor.onerror = function () { resolve(); };
          });
        });
      });
    }).then(function () {
      return { processed: processed, skipped: skipped, failed: failed };
    }).catch(function () {
      return { processed: processed, skipped: skipped, failed: failed };
    });
  }

  // ── RECALL ───────────────────────────────────────────────────────────────
  function recall(queryText, topK) {
    topK = topK || 3;
    if (!isModelReady()) return Promise.resolve([]);

    return embed(queryText).then(function (queryVec) {
      if (!queryVec) return [];

      return getDB().then(function (db) {
        return new Promise(function (resolve, reject) {
          var results = [];
          var tx      = db.transaction(STORE_MEM, 'readonly');
          var cursor  = tx.objectStore(STORE_MEM).openCursor();
          cursor.onsuccess = function (e) {
            var c = e.target.result;
            if (!c) { resolve(results); return; }
            var mem = c.value;
            if (mem.vector && mem.vector.length === VECTOR_DIM) {
              var sim = cosineSimilarity(Array.from(queryVec), mem.vector);
              results.push({
                text:        mem.text        || '',
                distortions: mem.distortions || [],
                intensity:   mem.intensity   || 0,
                state:       mem.state       || '',
                label:       mem.label       || '',
                similarity:  sim,
                timestamp:   mem.orig_ts     || mem.timestamp || 0
              });
            }
            c.continue();
          };
          cursor.onerror = function () { resolve(results); };
        });
      }).then(function (results) {
        results.sort(function (a, b) { return b.similarity - a.similarity; });
        return results.slice(0, topK);
      });
    }).catch(function () { return []; });
  }

  // ── PATTERN DETECTION ────────────────────────────────────────────────────
  function detectPatterns() {
    return getDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var clusters = {};
        var tx       = db.transaction(STORE_MEM, 'readonly');
        var cursor   = tx.objectStore(STORE_MEM).openCursor();
        cursor.onsuccess = function (e) {
          var c = e.target.result;
          if (!c) { resolve(clusters); return; }
          var mem = c.value;
          var key = (mem.distortions && mem.distortions.length) ? mem.distortions[0] : (mem.state || 'UNKNOWN');
          if (!clusters[key]) clusters[key] = { count: 0, totalIntensity: 0, lastSeen: 0 };
          clusters[key].count++;
          clusters[key].totalIntensity += mem.intensity || 0;
          if ((mem.orig_ts || 0) > clusters[key].lastSeen) clusters[key].lastSeen = mem.orig_ts || 0;
          c.continue();
        };
        cursor.onerror = function () { resolve(clusters); };
      });
    }).then(function (clusters) {
      return Object.entries(clusters)
        .map(function (e) {
          return {
            cluster:      e[0],
            count:        e[1].count,
            avgIntensity: e[1].count > 0 ? Math.round((e[1].totalIntensity / e[1].count) * 10) / 10 : 0,
            lastSeen:     e[1].lastSeen
          };
        })
        .sort(function (a, b) { return b.count - a.count; });
    }).catch(function () { return []; });
  }

  // ── MEMORY STATS ─────────────────────────────────────────────────────────
  function getMemoryCount() {
    return getDB().then(function (db) {
      return new Promise(function (resolve) {
        var tx  = db.transaction(STORE_MEM, 'readonly');
        var req = tx.objectStore(STORE_MEM).count();
        req.onsuccess = function () { resolve(req.result); };
        req.onerror   = function () { resolve(0); };
      });
    }).catch(function () { return 0; });
  }

  function getMemoryStats() {
    return getDB().then(function (db) {
      return new Promise(function (resolve) {
        var stats  = { count: 0, oldestTs: 0, newestTs: 0, totalIntensity: 0, distMap: {} };
        var tx     = db.transaction(STORE_MEM, 'readonly');
        var cursor = tx.objectStore(STORE_MEM).openCursor();
        cursor.onsuccess = function (e) {
          var c = e.target.result;
          if (!c) { resolve(stats); return; }
          var mem = c.value;
          stats.count++;
          stats.totalIntensity += mem.intensity || 0;
          var ts = mem.orig_ts || mem.timestamp || 0;
          if (!stats.oldestTs || ts < stats.oldestTs) stats.oldestTs = ts;
          if (ts > stats.newestTs) stats.newestTs = ts;
          (mem.distortions || []).forEach(function (d) {
            stats.distMap[d] = (stats.distMap[d] || 0) + 1;
          });
          c.continue();
        };
        cursor.onerror = function () { resolve(stats); };
      });
    }).then(function (stats) {
      var topDist = Object.entries(stats.distMap)
        .sort(function (a, b) { return b[1] - a[1]; })
        .slice(0, 5)
        .map(function (e) { return e[0]; });
      return {
        count:          stats.count,
        oldestTs:       stats.oldestTs || null,
        newestTs:       stats.newestTs || null,
        avgIntensity:   stats.count > 0 ? Math.round((stats.totalIntensity / stats.count) * 10) / 10 : 0,
        topDistortions: topDist
      };
    }).catch(function () {
      return { count: 0, oldestTs: null, newestTs: null, avgIntensity: 0, topDistortions: [] };
    });
  }

  // ── PURGE ─────────────────────────────────────────────────────────────────
  function purgeMemory() {
    return getDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx  = db.transaction(STORE_MEM, 'readwrite');
        var req = tx.objectStore(STORE_MEM).clear();
        tx.oncomplete = function () { resolve(true);  };
        tx.onerror    = function () { resolve(false); };
      });
    }).catch(function () { return false; });
  }

  function purgeModel() {
    return Promise.resolve().then(function () {
      unloadModel();
      // Remove cached transformers.js model files from Cache Storage
      return caches.keys().then(function (keys) {
        return Promise.all(
          keys
            .filter(function (k) { return k.toLowerCase().includes('transformers'); })
            .map(function (k) { return caches.delete(k); })
        );
      }).catch(function () {});
    }).then(function () {
      // Remove model_version from ops store
      return getDB().then(function (db) {
        try {
          var tx = db.transaction(STORE_OPS, 'readwrite');
          tx.objectStore(STORE_OPS).delete('model_version');
        } catch (e) { /* non-fatal */ }
        return true;
      });
    }).catch(function () { return false; });
  }

  // ── STORAGE CHECK ────────────────────────────────────────────────────────
  function checkStorageHeadroom() {
    if (!navigator.storage || !navigator.storage.estimate) {
      return Promise.resolve({ ok: true, usedMB: 0, quotaMB: 0, pct: 0 });
    }
    return navigator.storage.estimate().then(function (est) {
      var used    = est.usage  || 0;
      var quota   = est.quota  || 0;
      var freeMB  = (quota - used) / 1048576;
      var pct     = quota > 0 ? Math.round((used / quota) * 100) : 0;
      return {
        ok:      pct < 90 && freeMB >= 100,
        usedMB:  Math.round(used  / 1048576),
        quotaMB: Math.round(quota / 1048576),
        pct:     pct
      };
    }).catch(function () {
      return { ok: true, usedMB: 0, quotaMB: 0, pct: 0 };
    });
  }

  // ── PUBLIC API ───────────────────────────────────────────────────────────
  g.OpBrain = {
    version:              '1.0.0',
    loadModel:            loadModel,
    unloadModel:          unloadModel,
    isModelReady:         isModelReady,
    isLoading:            isLoading,
    embed:                embed,
    ingest:               ingest,
    syncNewLogs:          syncNewLogs,
    recall:               recall,
    detectPatterns:       detectPatterns,
    getMemoryCount:       getMemoryCount,
    getMemoryStats:       getMemoryStats,
    purgeMemory:          purgeMemory,
    purgeModel:           purgeModel,
    checkStorageHeadroom: checkStorageHeadroom
  };

})(window);
