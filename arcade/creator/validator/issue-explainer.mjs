/**
 * Creator Foundation — validator ISSUE EXPLAINER (pure + cross-env).
 *
 * Creator-throughput helper: turns the validators' terse error strings into one friendly,
 * actionable hint each, so a normal creator can fix a BLOCKED pack without reading validator
 * source. STRICTLY EXPLANATORY — this module never judges anything: the shared validators
 * (validateAssetPack / importArcadePackage) remain the only gate, and an error with no matching
 * hint simply renders without one. The hint table is CLOSED static copy (no interpolation of
 * creator input back into the hint — the raw error line, already shown, carries the specifics).
 *
 * Used by the district-editor and arcade-builder issue panels + unit tests.
 */

/** Closed [pattern, hint] table — first match wins. Patterns target STABLE validator phrasings. */
const HINTS = Object.freeze([
  // shared manifest/pack shape
  [/forbidden (content or )?economy term|forbidden economy\/ownership term/i,
    'Remove money/ownership words (pay, buy, own, bet…) — names and source must stay economy-free.'],
  [/frame_contract_id must be one of/i,
    'Pick one of the documented cabinet frame contracts from the dropdown.'],
  [/pack_id must be a clean kebab slug/i,
    'Use lowercase letters, digits and dashes, 3–48 chars, e.g. "my-first-pack".'],
  [/display_name must be/i,
    'Give it a short display name — at least 1 character, within the byte limit shown.'],
  [/schema_version must be/i,
    'Set schema_version to the exact number required — older or newer drafts are rejected.'],
  [/unknown top key|unknown keys|unknown key:/i,
    'Delete the extra field — packages carry only the documented keys, nothing custom.'],
  [/missing key:|missing file referenced/i,
    'Add the missing field/file named in the error — every required part must be present.'],
  // asset-pack specifics
  [/not approved-local in the registry/i,
    'Only APPROVED package hashes can be placed. Import the approved registry + package files, or remove this tile.'],
  [/duplicate tile position/i,
    'Two tiles share one grid cell — clear one of them.'],
  [/grid\.(cols|rows) must be an integer/i,
    'Keep the grid within the documented bounds — shrink cols/rows to fit.'],
  [/\.gx must be|\.gy must be/i,
    'A tile sits outside the grid — move it inside cols × rows or enlarge the grid.'],
  [/tiles exceeds|tiles must have at least/i,
    'Tile count is out of range — packs need at least one tile and respect the maximum.'],
  [/constraints\.\w+ must be|constraints unknown key/i,
    'Leave constraints exactly as generated — they are fixed safety declarations, not options.'],
  // arcade-game specifics
  [/exceed declared size_budget_bytes/i,
    'The generated files are bigger than your declared budget — raise the budget (within the cap) or simplify.'],
  [/exceed hard cap/i,
    'The package is over the absolute size cap — cabinets must stay tiny; trim the source.'],
  [/entry module must not import/i,
    'game.mjs must be self-contained — inline the code instead of importing.'],
  [/adapter may import only/i,
    "adapter.mjs may import './game.mjs' and nothing else."],
  [/side-effect import not allowed/i,
    'Remove bare imports — only the documented module shape is allowed.'],
  [/forbidden \(/i,
    'The source uses a banned construct (network, storage, eval…) — cabinets draw and score only.'],
  [/source missing or empty/i,
    'The file is empty — every referenced module needs real source.'],
  [/unexpected bundled file/i,
    'Only manifest + entry + adapter ship — remove extra files (assets must stay empty).'],
]);

/** PURE: one friendly hint for a validator error line, or '' when no stable hint exists. */
export function explainIssue(errorLine) {
  if (typeof errorLine !== 'string' || !errorLine) return '';
  for (const [re, hint] of HINTS) if (re.test(errorLine)) return hint;
  return '';
}

/** PURE: annotate a list of error lines → [{ error, hint }] (hint may be ''). */
export function explainIssues(errors) {
  return (Array.isArray(errors) ? errors : []).map((e) => ({ error: String(e), hint: explainIssue(String(e)) }));
}

/** The closed hint copy (fresh array of strings; for cleanliness tests). */
export function hintCopy() {
  return HINTS.map(([, hint]) => hint);
}
