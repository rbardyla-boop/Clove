/**
 * Voxel Lab Bench — "Export to second brain" Markdown artifact (Gate E, Slice 7).
 *
 * Pure, dependency-free (no DOM, no THREE, no network) so it is directly node:test-
 * testable in isolation, matching the sibling deterministic modules (mesh-greedy.mjs,
 * lod.mjs, light-volume.mjs, metrics-room.mjs). Never calls Date.now()/new Date()/
 * Math.random() internally — a caller (bench-boot.mjs) passes `metadata.date` explicitly
 * if a timestamp is wanted, so this module's own output is 100% deterministic given the
 * same input, which is exactly what the worked-example fidelity test below depends on.
 *
 * Algorithm and column-ordering are transcribed EXACTLY from
 * docs/VOXEL_LAB_BENCH_PLAN.md Section 4.3's worked example (lines 389-415) — this
 * module exists to reproduce that artifact byte-for-byte from live bench data, not to
 * invent a new report shape. Two formatting choices in that worked example are load-
 * bearing and are preserved here on purpose even though they look inconsistent with each
 * other at first glance:
 *
 *   - Metadata/changes lines are HUMANIZED labels ("- Room: ...", "- Render strategy:
 *     ...") — see the plan's `- Room: 32m x 32m x 16m, chunk resolution 32` and
 *     `- Render strategy: greedy-quads` lines. These are prose, written for a human
 *     reading the exported note in Obsidian, so labelFromKey() turns `renderStrategy`
 *     into "Render strategy".
 *   - The metrics-history TABLE HEADER keeps the RAW camelCase keys
 *     (`| lightGridResolution | frameTimeMs | lightVolumeBytes | drawCalls |`), not
 *     humanized labels — see the plan's exact header line. The table is a data
 *     grid meant to be copy-pasted/re-parsed (e.g. back into a spreadsheet or a script),
 *     so its column names are kept as stable, machine-matching identifiers instead of
 *     being reformatted for prose.
 *
 * Do not "clean up" this asymmetry — it is the plan's own worked example, verified
 * line-by-line against docs/VOXEL_LAB_BENCH_PLAN.md by test/export-markdown.test.mjs's
 * worked-example fidelity case.
 */

/** Placeholder body text for each section when its input field is omitted/empty. */
const PLACEHOLDER = {
  metadata: '_No metadata provided._',
  changes: '_No changes recorded._',
  metricsHistory: '_No measurements recorded._',
  lesson: '_No lesson recorded._',
  reproduction: '_No reproduction steps recorded._',
};

/** Collapse embedded newlines to spaces and trim — for single-line prose contexts
 * (the title heading and "- Label: value" metadata/changes lines) where a raw newline
 * would break the line into two, corrupting the Markdown structure. */
function escapeHeadingText(value) {
  return String(value).replace(/\r?\n/g, ' ').trim();
}

/** Collapse embedded newlines to spaces AND escape `|` as `\|` — for table cell
 * contexts, where an unescaped pipe would silently change the table's column count. */
function escapeTableCell(value) {
  return String(value).replace(/\r?\n/g, ' ').replace(/\|/g, '\\|');
}

/**
 * Humanize a camelCase object key into a prose label: "renderStrategy" -> "Render
 * strategy", "lightGridResolution" -> "Light grid resolution". Only used for the
 * Metadata section (see the module-header note on why the metrics table does NOT use
 * this).
 */
function labelFromKey(key) {
  const words = String(key).replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  return words[0].charAt(0).toUpperCase() + words[0].slice(1) + (words.length > 1 ? ' ' + words.slice(1).join(' ') : '');
}

/** Render an integer with thousands-separator commas (e.g. 4096 -> "4,096"), matching
 * the plan's worked-example table cells exactly. */
function formatInteger(n) {
  const sign = n < 0 ? '-' : '';
  const digits = Math.abs(n).toString();
  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** Format a number for a table cell: integers get thousands separators (4096 ->
 * "4,096"), non-integers are fixed to 3 decimals with trailing zeros/dot trimmed (4.1 ->
 * "4.1", not "4.100") and the integer part still gets thousands separators. */
function formatNumber(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return String(value);
  if (Number.isInteger(value)) return formatInteger(value);
  const fixed = value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
  const [intPart, decPart] = fixed.split('.');
  return formatInteger(Number(intPart)) + (decPart ? '.' + decPart : '');
}

/** Format any table cell value: undefined/null render as an empty string (never the
 * literal text "undefined"), numbers go through formatNumber(), everything else is
 * stringified — all paths are then pipe-escaped via escapeTableCell(). */
function formatCell(value) {
  if (value === undefined || value === null) return '';
  const text = typeof value === 'number' ? formatNumber(value) : String(value);
  return escapeTableCell(text);
}

/** Render the "## Metadata" body: one humanized "- Label: value" line per entry, in
 * Object.entries() order, or the placeholder if metadata is missing/empty. */
function renderMetadataSection(metadata) {
  const entries = metadata && typeof metadata === 'object' ? Object.entries(metadata) : [];
  if (entries.length === 0) return PLACEHOLDER.metadata;
  return entries.map(([key, value]) => `- ${labelFromKey(key)}: ${escapeHeadingText(value)}`).join('\n');
}

/** Render the "## What I changed" body: one "- line" per changes entry, in array
 * order, or the placeholder if changes is missing/empty. */
function renderChangesSection(changes) {
  const list = Array.isArray(changes) ? changes : [];
  if (list.length === 0) return PLACEHOLDER.changes;
  return list.map((line) => `- ${escapeHeadingText(line)}`).join('\n');
}

/** Render the "## What I measured" body: a Markdown table with RAW (non-humanized)
 * column headers taken from Object.keys() of the FIRST row (see module-header note),
 * a divider row, and one body row per metricsHistory entry, or the placeholder if
 * metricsHistory is missing/empty. */
function renderMetricsHistorySection(metricsHistory) {
  const rows = Array.isArray(metricsHistory) ? metricsHistory : [];
  if (rows.length === 0) return PLACEHOLDER.metricsHistory;
  const columns = Object.keys(rows[0]);
  const header = `| ${columns.map((c) => escapeTableCell(c)).join(' | ')} |`;
  const divider = `|${columns.map(() => '---').join('|')}|`;
  const body = rows.map((row) => `| ${columns.map((c) => formatCell(row[c])).join(' | ')} |`);
  return [header, divider, ...body].join('\n');
}

/** Render the "## The lesson" body: the trimmed lesson string, or the placeholder if
 * missing/blank. */
function renderLessonSection(lesson) {
  const text = typeof lesson === 'string' ? lesson.trim() : '';
  return text.length > 0 ? text : PLACEHOLDER.lesson;
}

/** Render the "## Reproduction" body: each line 4-space-indented (a Markdown code
 * block via indentation, matching the plan's `    world.setLightGridResolution(32);`
 * line), accepting EITHER an array of strings OR a single multi-line string (split on
 * newlines) so both produce identical output for equivalent content, or the placeholder
 * if missing/empty. */
function renderReproductionSection(reproduction) {
  const lines = Array.isArray(reproduction)
    ? reproduction
    : (typeof reproduction === 'string' && reproduction.length > 0 ? reproduction.split(/\r?\n/) : []);
  if (lines.length === 0) return PLACEHOLDER.reproduction;
  return lines.map((line) => `    ${line}`).join('\n');
}

/**
 * exportExperiment(input = {}) -> string (Markdown)
 *
 * Builds the "Export to second brain" Markdown artifact from a plain data object — see
 * docs/VOXEL_LAB_BENCH_PLAN.md Section 4.3 for the canonical worked example this
 * function's output is verified against byte-for-byte. `input` fields (all optional):
 *   - title (string)
 *   - metadata (object): rendered as "- Label: value" lines
 *   - changes (string[]): rendered as "- line" lines
 *   - metricsHistory (object[]): rendered as a Markdown table, RAW column headers from
 *     the first row's keys
 *   - lesson (string)
 *   - reproduction (string[] | string): rendered as a 4-space-indented block
 *
 * Deterministic and side-effect-free: the SAME input always produces the SAME output
 * string (no wall-clock/random data touched internally).
 */
export function exportExperiment(input = {}) {
  const title = escapeHeadingText(input.title || 'Voxel Lab Experiment');
  return [
    `# ${title}`,
    '',
    '## Metadata',
    renderMetadataSection(input.metadata),
    '',
    '## What I changed',
    renderChangesSection(input.changes),
    '',
    '## What I measured',
    renderMetricsHistorySection(input.metricsHistory),
    '',
    '## The lesson',
    renderLessonSection(input.lesson),
    '',
    '## Reproduction',
    renderReproductionSection(input.reproduction),
    '',
  ].join('\n');
}
