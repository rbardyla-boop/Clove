(function (g) {
  'use strict';

  const DB_NAME = 'clove_private_store_v1';
  const STORE_NAME = 'keys';
  const KEY_ID = 'mission_aes_main';
  const ENVELOPE_PREFIX = 'cloveenc:v1:';
  let keyPromise = null;

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('private_store_db_open_failed'));
    });
  }

  function getStoredKey(db) {
    return new Promise((resolve, reject) => {
      const req = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(KEY_ID);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error || new Error('private_store_key_read_failed'));
    });
  }

  function putStoredKey(db, key) {
    return new Promise((resolve, reject) => {
      const req = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(key, KEY_ID);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error || new Error('private_store_key_write_failed'));
    });
  }

  async function init() {
    if (keyPromise) return keyPromise;
    keyPromise = (async () => {
      if (!g.crypto?.subtle || !g.indexedDB) throw new Error('private_store_unsupported');
      const db = await openDb();
      try {
        const existing = await getStoredKey(db);
        if (existing) return existing;
        const created = await g.crypto.subtle.generateKey(
          { name: 'AES-GCM', length: 256 },
          false,
          ['encrypt', 'decrypt']
        );
        await putStoredKey(db, created);
        return created;
      } finally {
        db.close();
      }
    })();
    try {
      return await keyPromise;
    } catch (error) {
      keyPromise = null;
      throw error;
    }
  }

  function bytesToBase64(bytes) {
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  }

  function base64ToBytes(value) {
    const binary = atob(value);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
    return out;
  }

  function safeReviver(key, value) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') return undefined;
    return value;
  }

  async function encrypt(value) {
    const key = await init();
    const iv = g.crypto.getRandomValues(new Uint8Array(12));
    const plain = new TextEncoder().encode(JSON.stringify(value));
    const cipher = new Uint8Array(await g.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain));
    const combined = new Uint8Array(iv.length + cipher.length);
    combined.set(iv, 0);
    combined.set(cipher, iv.length);
    return ENVELOPE_PREFIX + bytesToBase64(combined);
  }

  async function decrypt(envelope) {
    if (typeof envelope !== 'string' || !envelope.startsWith(ENVELOPE_PREFIX)) {
      throw new Error('private_store_invalid_envelope');
    }
    const combined = base64ToBytes(envelope.slice(ENVELOPE_PREFIX.length));
    if (combined.length <= 12) throw new Error('private_store_invalid_ciphertext');
    const iv = combined.slice(0, 12);
    const cipher = combined.slice(12);
    const key = await init();
    const plain = await g.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
    return JSON.parse(new TextDecoder().decode(plain), safeReviver);
  }

  async function set(name, value) {
    const encrypted = await encrypt(value);
    // Fail closed: plaintext is never a fallback.
    localStorage.setItem(name, encrypted);
    return value;
  }

  async function get(name, fallback = null) {
    const raw = localStorage.getItem(name);
    if (raw === null) return fallback;

    if (raw.startsWith(ENVELOPE_PREFIX)) {
      // Never delete unreadable ciphertext here. The caller decides how to recover.
      return decrypt(raw);
    }

    // Legacy F1 plaintext migration. Preserve the original until encryption succeeds.
    let parsed;
    try {
      parsed = JSON.parse(raw, safeReviver);
    } catch {
      throw new Error('private_store_legacy_value_invalid');
    }
    const encrypted = await encrypt(parsed);
    localStorage.setItem(name, encrypted);
    return parsed;
  }

  function del(name) {
    localStorage.removeItem(name);
  }

  function isEncryptedRaw(name) {
    const raw = localStorage.getItem(name);
    return typeof raw === 'string' && raw.startsWith(ENVELOPE_PREFIX);
  }

  g.ClovePrivateStore = Object.freeze({
    init,
    get,
    set,
    del,
    isEncryptedRaw,
    envelopePrefix: ENVELOPE_PREFIX,
  });
})(typeof window !== 'undefined' ? window : globalThis);
