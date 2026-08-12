import { readFile, writeFile } from 'node:fs/promises';

const path = new URL('../mission-001-app.js', import.meta.url);
let text = await readFile(path, 'utf8');
let changed = false;

function replaceOnce(from, to, label) {
  if (text.includes(to)) return;
  if (!text.includes(from)) throw new Error(`patch_anchor_missing:${label}`);
  text = text.replace(from, to);
  changed = true;
}

replaceOnce(
  "  async function load() {\n",
  `  function stateStage(s) {\n    if (!s) return 'empty';\n    if (s.status === 'debrief') return \`debrief:\${s.outcome}\`;\n    return s.status;\n  }\n\n  function validStateTransition(previous, next) {\n    const from = stateStage(previous);\n    const to = stateStage(next);\n    if (from === 'empty') return to === 'planning';\n    if (from === 'planning') return to === 'planning' || to === 'committed';\n    if (from === 'committed') return to === 'committed' || to === 'left';\n    if (from === 'left') return to === 'left' || to.startsWith('debrief:');\n    if (from.startsWith('debrief:')) return to === 'complete';\n    return false;\n  }\n\n  async function load() {\n`,
  'transition_guard_function'
);

replaceOnce(
  "    if (!validPersistedState(next)) throw new Error('mission_state_invalid');\n    await window.ClovePrivateStore.set(KEY, next);",
  "    if (!validPersistedState(next)) throw new Error('mission_state_invalid');\n    if (!validStateTransition(state, next)) throw new Error('mission_transition_invalid');\n    await window.ClovePrivateStore.set(KEY, next);",
  'transition_guard_save'
);

replaceOnce(
  "  function hidden(id, value) { $(id).hidden = value; }\n  function showOnly(id) { sections.forEach(s => hidden(s, s !== id)); window.scrollTo({top:0, behavior:'smooth'}); }",
  "  function scrollBehavior() {\n    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'; }\n    catch { return 'auto'; }\n  }\n  function hidden(id, value) { $(id).hidden = value; }\n  function showOnly(id) { sections.forEach(s => hidden(s, s !== id)); window.scrollTo({top:0, behavior:scrollBehavior()}); }",
  'reduced_motion_show_only'
);

replaceOnce(
  "    $('commit').scrollIntoView({behavior:'smooth', block:'start'});",
  "    $('commit').scrollIntoView({behavior:scrollBehavior(), block:'start'});",
  'reduced_motion_commit_scroll'
);

if (changed) {
  await writeFile(path, text, 'utf8');
  console.log('patched mission-001-app.js');
} else {
  console.log('mission-001-app.js already patched');
}
