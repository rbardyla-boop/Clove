/**
 * Sample Import Game — minimal client-local game. TEST ONLY / DISABLED.
 *
 * A deliberately tiny game that conforms to the cabinet game interface
 * ({ open, close, isOpen, getFrame }) an imported game must expose. It is the
 * `entry_file` referenced by this fixture's manifest. It is NOT registered in the
 * production adapter registry and NOT rendered on the floor — it exists only so
 * the import path has a complete, realistic example (manifest → adapter → entry).
 *
 * It sends NO network/economy messages: authority_mode is client_local_only.
 */
export function createSampleImportGame() {
  let root = null;
  let open = false;

  function build() {
    root = document.createElement('div');
    root.className = 'sig-panel';
    root.innerHTML = `
        <div class="sig-head"><div class="sig-title">SAMPLE IMPORT (test)</div></div>
        <div class="sig-stage"><p>Disabled sample import fixture.</p></div>`;
  }

  return {
    // A production import would mount `root` into a cabinet frame via the runtime.
    getRoot() { if (!root) build(); return root; },
    getFrame() { return null; }, // wired by the adapter runtime in a real import
    open() { if (!root) build(); open = true; },
    close() { open = false; },
    isOpen() { return open; },
  };
}
