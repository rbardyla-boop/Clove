// ─── OPERATOR'S DECK — PRELOAD ───────────────────────────────────────────────
// Minimal preload. contextIsolation is ON, nodeIntegration is OFF.
// The app runs as vanilla browser JS — no Node APIs exposed to renderer.
// Voice input: exposes SpeechRecognition availability check.
// ─────────────────────────────────────────────────────────────────────────────

const { contextBridge } = require('electron');

// Expose app info + voice readiness to the renderer
contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  version: require('./package.json').version,

  // ── Voice input readiness
  // Web Speech API (Chrome's cloud-routed STT) is BANNED per CLOVELEARN_RULES.md Rule 1.
  // Local STT via Whisper WASM will be integrated in a future build.
  // This flag will be set to true once local STT model is bundled.
  voiceAvailable: false,

  // ── Platform info (useful for keyboard shortcut hints)
  platform: process.platform, // 'darwin', 'win32', 'linux'
});

// ── Suppress service worker registration errors in Electron
// The PWA's sw.js tries to register on load — harmless but noisy in console.
window.addEventListener('DOMContentLoaded', () => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register = function() {
      return Promise.resolve({ installing: null, waiting: null, active: null });
    };
  }
});
