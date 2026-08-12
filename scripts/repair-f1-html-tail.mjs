import { readFile, writeFile } from 'node:fs/promises';

const path = new URL('../mission-001.html', import.meta.url);
const html = await readFile(path, 'utf8');
const marker = '  <footer class="footer">';
const footerAt = html.indexOf(marker);
if (footerAt < 0) throw new Error('mission_footer_start_missing');

const prefix = html.slice(0, footerAt);
const tail = `  <footer class="footer">F1.1 pilot candidate. No account. Mission text and debrief content are encrypted locally in this browser before storage. Aggregate measurement contains only coarse event names, device class, referrer group and mission class; it does not send your mission text, debrief, location, contacts, or photos.</footer>
</main>
<script src="mission-private-store.js"></script>
<script src="mission-001-app.js"></script>
</body>
</html>
`;

const repaired = prefix + tail;

const invariants = [
  ['footer close', /<footer class="footer">[\s\S]*?<\/footer>/],
  ['main close', /<\/footer>\s*<\/main>/],
  ['private store script', /<script src="mission-private-store\.js"><\/script>/],
  ['mission app script', /<script src="mission-001-app\.js"><\/script>/],
  ['body close', /<\/body>\s*<\/html>\s*$/],
];
for (const [name, pattern] of invariants) {
  if (!pattern.test(repaired)) throw new Error(`mission_tail_invariant_failed:${name}`);
}
if (/<\/f<script|\}\)\(\);\s*<\/script>/.test(repaired)) throw new Error('mission_corrupt_tail_survived');

await writeFile(path, repaired, 'utf8');
console.log('Mission 001 HTML tail repaired and structurally bounded.');
