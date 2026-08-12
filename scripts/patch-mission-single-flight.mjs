import { readFile, writeFile } from 'node:fs/promises';

const path = new URL('../mission-001-app.js', import.meta.url);
let text = await readFile(path, 'utf8');

function replaceOnce(from, to, label) {
  if (text.includes(to)) return;
  if (!text.includes(from)) throw new Error(`patch_anchor_missing:${label}`);
  text = text.replace(from, to);
}

replaceOnce(
`  let state = null;
`,
`  let state = null;
  let writeInFlight = false;
`,
'single_flight_flag');

replaceOnce(
`  async function save(next) {
    if (!window.ClovePrivateStore) throw new Error('private_store_missing');
    if (!validPersistedState(next)) throw new Error('mission_state_invalid');
    if (!validStateTransition(state, next)) throw new Error('mission_transition_invalid');
    await window.ClovePrivateStore.set(KEY, next);
    state = next;
    return state;
  }
`,
`  async function save(next) {
    if (!window.ClovePrivateStore) throw new Error('private_store_missing');
    if (!validPersistedState(next)) throw new Error('mission_state_invalid');
    if (!validStateTransition(state, next)) throw new Error('mission_transition_invalid');
    if (writeInFlight) throw new Error('mission_write_in_progress');
    writeInFlight = true;
    try {
      await window.ClovePrivateStore.set(KEY, next);
      state = next;
      return state;
    } finally {
      writeInFlight = false;
    }
  }
`,
'single_flight_save');

replaceOnce(
`    return code === 'mission_state_invalid' || code === 'mission_transition_invalid';
`,
`    return code === 'mission_state_invalid' || code === 'mission_transition_invalid' || code === 'mission_write_in_progress';
`,
'single_flight_classification');

await writeFile(path, text, 'utf8');
console.log('patched Mission single-flight write guard');
