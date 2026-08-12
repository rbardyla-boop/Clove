import { readFile, writeFile } from 'node:fs/promises';

const path = new URL('../mission-001.html', import.meta.url);
let html = await readFile(path, 'utf8');

const alreadyIntegrated = html.includes('<script src="mission-private-store.js"></script>') && html.includes('<script src="mission-001-app.js"></script>');
if (alreadyIntegrated) {
  console.log('Mission 001 encrypted-store integration already present.');
  process.exit(0);
}

const scriptStart = html.indexOf('<script>\n(() => {');
const scriptEnd = html.lastIndexOf('</script>');
if (scriptStart < 0 || scriptEnd <= scriptStart) {
  throw new Error('mission_inline_controller_not_found');
}

const oldFooter = "F1 experimental product path. No account. Mission text and debrief content stay in this browser's local storage. Aggregate measurement contains only coarse event names, device class, referrer group and mission class; it does not send your mission text, debrief, location, contacts, or photos.";
const newFooter = "F1.1 pilot candidate. No account. Mission text and debrief content are encrypted locally in this browser before storage. Aggregate measurement contains only coarse event names, device class, referrer group and mission class; it does not send your mission text, debrief, location, contacts, or photos.";
if (!html.includes(oldFooter)) throw new Error('mission_footer_contract_not_found');
html = html.replace(oldFooter, newFooter);
html = html.replace('F1 TEST BUILD<br>18–24 / ADULTS ONLY', 'F1.1 PILOT CANDIDATE<br>18–24 / ADULTS ONLY');

const replacement = '<script src="mission-private-store.js"></script>\n<script src="mission-001-app.js"></script>';
html = html.slice(0, scriptStart) + replacement + html.slice(scriptEnd + '</script>'.length);

if (html.includes('function save(next){state=next;try{localStorage.setItem(KEY')) {
  throw new Error('plaintext_controller_survived_integration');
}
if (!html.includes(newFooter) || !html.includes(replacement)) {
  throw new Error('mission_integration_postcondition_failed');
}

await writeFile(path, html, 'utf8');
console.log('Mission 001 now uses encrypted private store + external controller.');
