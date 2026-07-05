/**
 * Voxel Lab Bench — "Export to second brain" Markdown + JSON artifacts (Gate E,
 * Slice 7; JSON sibling closed out per Operator Decision #7, docs/VOXEL_LAB_BENCH_PLAN.md).
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
 *
 * exportExperimentJson lives in this SAME file, deliberately, rather than a second
 * module — Operator Decision #7 frames JSON as "a JSON sibling" of the one Slice-7
 * export feature, not a separate feature with its own home. Markdown and JSON
 * deliberately diverge on number/string handling for a reason, not by oversight:
 * Markdown is for HUMAN reading (Obsidian), so it runs values through formatNumber()/
 * escapeHeadingText()/escapeTableCell() for readability and Markdown structural safety
 * (commas in big numbers, no stray `|` breaking a table). JSON is for MACHINE
 * consumption ("replay, tests, receipts, and future import/export validation" per
 * Operator Decision #7) — it preserves RAW values (numbers stay numbers, not
 * comma-formatted strings) so a future consumer can actually parse and use them, and
 * JSON.stringify already handles all escaping safely, so no escapeHeadingText/
 * escapeTableCell pass is needed or wanted for JSON. Both formats share ONE
 * normalization step (normalizeExperimentInput below) so the same ambiguous input
 * (e.g. reproduction as a single multi-line string vs an array) is interpreted
 * IDENTICALLY by both formats — only the render-time formatting/escaping/placeholder
 * choices are allowed to differ per format.
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

/**
 * normalizeExperimentInput(input) -> { title, metadata, changes, metricsHistory,
 *   lesson, reproduction }
 *
 * The ONE shared normalization step for BOTH exportExperiment (Markdown) and
 * exportExperimentJson, so an ambiguous input field (e.g. reproduction as a single
 * multi-line string vs an array of lines) is interpreted IDENTICALLY by both formats —
 * this is what makes "required fields/sections map consistently between Markdown and
 * JSON" (Operator Decision #7) true by construction instead of by two independently
 * maintained copies of the same defaulting logic quietly drifting apart. Everything
 * format-specific (Markdown's escapeHeadingText/escapeTableCell/formatNumber passes and
 * placeholder prose strings; JSON's raw-value/null-vs-placeholder choices) is layered
 * on top of this shared shape by each caller, never folded into it.
 *
 * Title contract (intentional, not incidental): `title` must be a non-blank string to
 * be used as-is; a non-string value (e.g. a number) or a whitespace-only string both
 * fall back to the same default as an omitted title, rather than being silently
 * coerced (`String(5)`) or rendered as a degenerate empty "# " heading. This is a
 * conscious, tested type-safety choice — see the two "title contract" tests in
 * test/export-markdown.test.mjs.
 */
function normalizeExperimentInput(input) {
  const rawTitle = typeof input.title === 'string' ? input.title.trim() : '';
  const title = rawTitle.length > 0 ? rawTitle : 'Voxel Lab Experiment';
  const metadata = input.metadata && typeof input.metadata === 'object' ? input.metadata : {};
  const changes = Array.isArray(input.changes) ? input.changes : [];
  const metricsHistory = Array.isArray(input.metricsHistory) ? input.metricsHistory : [];
  const trimmedLesson = typeof input.lesson === 'string' ? input.lesson.trim() : '';
  const lesson = trimmedLesson.length > 0 ? trimmedLesson : null;
  const reproduction = Array.isArray(input.reproduction)
    ? input.reproduction
    : (typeof input.reproduction === 'string' && input.reproduction.length > 0 ? input.reproduction.split(/\r?\n/) : []);
  return { title, metadata, changes, metricsHistory, lesson, reproduction };
}

/** Render the "## Metadata" body: one humanized "- Label: value" line per entry, in
 * Object.entries() order, or the placeholder if metadata is empty. Consumes the
 * already-normalized metadata object. */
function renderMetadataSection(metadata) {
  const entries = Object.entries(metadata);
  if (entries.length === 0) return PLACEHOLDER.metadata;
  return entries.map(([key, value]) => `- ${labelFromKey(key)}: ${escapeHeadingText(value)}`).join('\n');
}

/** Render the "## What I changed" body: one "- line" per changes entry, in array
 * order, or the placeholder if changes is empty. Consumes the already-normalized
 * changes array. */
function renderChangesSection(changes) {
  if (changes.length === 0) return PLACEHOLDER.changes;
  return changes.map((line) => `- ${escapeHeadingText(line)}`).join('\n');
}

/** Render the "## What I measured" body: a Markdown table with RAW (non-humanized)
 * column headers taken from Object.keys() of the FIRST row (see module-header note),
 * a divider row, and one body row per metricsHistory entry, or the placeholder if
 * metricsHistory is empty. Consumes the already-normalized metricsHistory array. */
function renderMetricsHistorySection(metricsHistory) {
  if (metricsHistory.length === 0) return PLACEHOLDER.metricsHistory;
  const columns = Object.keys(metricsHistory[0]);
  const header = `| ${columns.map((c) => escapeTableCell(c)).join(' | ')} |`;
  const divider = `|${columns.map(() => '---').join('|')}|`;
  const body = metricsHistory.map((row) => `| ${columns.map((c) => formatCell(row[c])).join(' | ')} |`);
  return [header, divider, ...body].join('\n');
}

/** Render the "## The lesson" body: the (already-trimmed) lesson string, or the
 * placeholder if normalization resolved it to null. */
function renderLessonSection(lesson) {
  return lesson !== null ? lesson : PLACEHOLDER.lesson;
}

/** Render the "## Reproduction" body: each line 4-space-indented (a Markdown code
 * block via indentation, matching the plan's `    world.setLightGridResolution(32);`
 * line), or the placeholder if empty. Consumes the already-normalized reproduction
 * array (normalization is where array-vs-string equivalence is resolved). */
function renderReproductionSection(reproduction) {
  if (reproduction.length === 0) return PLACEHOLDER.reproduction;
  return reproduction.map((line) => `    ${line}`).join('\n');
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
  const normalized = normalizeExperimentInput(input);
  const title = escapeHeadingText(normalized.title);
  return [
    `# ${title}`,
    '',
    '## Metadata',
    renderMetadataSection(normalized.metadata),
    '',
    '## What I changed',
    renderChangesSection(normalized.changes),
    '',
    '## What I measured',
    renderMetricsHistorySection(normalized.metricsHistory),
    '',
    '## The lesson',
    renderLessonSection(normalized.lesson),
    '',
    '## Reproduction',
    renderReproductionSection(normalized.reproduction),
    '',
  ].join('\n');
}

/**
 * exportExperimentJson(input = {}) -> string (JSON)
 *
 * The JSON sibling of exportExperiment, per Operator Decision #7 — same input shape,
 * same normalizeExperimentInput() call, but built for MACHINE consumption ("replay,
 * tests, receipts, and future import/export validation") rather than human reading:
 *
 *   - Numbers stay numbers. metricsHistory row values are NOT passed through
 *     formatNumber()/escapeTableCell() — a future consumer needs to actually parse and
 *     use them (e.g. `4096`, not the Markdown-table string `"4,096"`).
 *   - metadata stays whatever object shape was normalized ({} when none was provided)
 *     — NOT a placeholder string. {} is the deterministic "no metadata" representation
 *     for a machine consumer.
 *   - changes/metricsHistory/reproduction stay arrays ([] when none were provided) —
 *     never a placeholder string.
 *   - lesson stays the trimmed string, or the literal `null` when none was provided.
 *     This is deliberately DIFFERENT from Markdown's placeholder prose string: a
 *     machine consumer must be able to distinguish "no lesson" (null) from "lesson is
 *     literally the text '_No lesson recorded._'" (a string), which a shared
 *     placeholder string could never disambiguate. This is intentional, not a gap.
 *
 * Key order in the returned object is always exactly: title, metadata, changes,
 * metricsHistory, lesson, reproduction — guaranteed because this function always
 * builds the SAME object literal shape and JS object literals preserve insertion order.
 *
 * Deterministic and side-effect-free, same as exportExperiment: the SAME input always
 * produces the SAME output string.
 */
export function exportExperimentJson(input = {}) {
  const normalized = normalizeExperimentInput(input);
  return JSON.stringify(normalized, null, 2);
}
