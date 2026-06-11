# Cabinet Starter Library

The starter library is a set of **16 small, original, importer-clean arcade cabinets** built
into the local Arcade Builder. Each one is a *named, tuned, fully-described* preset over the
builder's closed generation tables — a real destination a creator can pick, tune, export, and
test, instead of a blank form. Source of truth:
`arcade/creator/arcade-builder/cabinet-templates.mjs` (pure, DOM-free, unit-proven).

## What a starter cabinet IS (and is not)

A starter is **parameters + metadata**, never code you write:

- a **variant** — one of 14 tiny procedural games (tap-in-the-hot-window family, each with a
  distinct read: pulse, drift, cycle, orbit, tide, crossover, rail, grid walk, phase
  alignment, gauge, bloom, climb, signal window, palindrome echo);
- six **closed tokens** — accent (5 colors), speed (3), difficulty (3 hot-window scales),
  motion (3 amplitude scales), **juice** (off/standard/vivid visual feel — clamps to off
  under reduced motion), and **input mode** (tap_window / hold_band / release_timing /
  swipe_lane / drag_track — see docs/CABINET_JUICE_AND_INPUT_MODES.md);
- **display metadata** — name, one-line pitch, a 3-second rule explanation, the mode's
  instruction line, round-length target, result summary, mobile note, reduced-motion note.
  A plain `tap` always works in every mode (keyboard/sandbox degenerate press+release).

A starter is **not**: arbitrary JS, an asset bundle, a network/storage user, a prize/ticket
rule, an economy hook, or anything ownable. Token values resolve through frozen tables —
hostile strings in any field never reach generated source (unit-proven), and the CF-4
importer re-scans every output regardless.

## How to choose one

Open the builder (`arcade/creator/arcade-builder/`), use the **starter cabinet** picker —
grouped by category — and read the metadata card (pitch, tags, round target, mobile and
reduced-motion notes). Categories:

- **Reflex** — pure timing reads, shortest rounds.
- **Pattern** — discrete steps and sequences; no continuous motion.
- **Position** — something travels; meet it somewhere specific.
- **Puzzle** — two systems to read at once; longer, calmer rounds.
- **Atmosphere** — city-themed takes (one per Neon Circuit block, landmark-flavored).

## The library

| Starter | Category | Variant | Round | Size | Importer | Pitch |
|---|---|---|---|---|---|---|
| Neon Pulse (`neon-pulse`) | Reflex | pulse-ring | ~30s | 1848 B | VALID | Tap the ring at the top of its pulse. |
| Flash Three (`flash-three`) | Reflex | tri-light | ~20s | 1953 B | VALID | Three lights cycle. Only the middle one counts. |
| Narrow Band (`narrow-band`) | Reflex | drift-band | ~30s | 1992 B | VALID | Catch the drifter inside a thin band. |
| Echo Four (`echo-four`) | Pattern | memory-echo | ~40s | 2248 B | VALID | Watch the run, then tap on the echo. |
| Grid Walker (`grid-walker`) | Pattern | echo-grid | ~30s | 2132 B | VALID | A walker crosses the grid. Catch it at the center. |
| Orbit Snag (`orbit-snag`) | Position | orbit-catch | ~30s | 2284 B | VALID | Snag the satellite on the top arc. |
| Rail Sprint (`rail-sprint`) | Position | rail-runner | ~25s | 2191 B | VALID | A runner ping-pongs the rail. Tag it mid-track. |
| Tide Keeper (`tide-keeper`) | Position | tide-gate | ~35s | 2090 B | VALID | Hold the line where the tide meets the gate. |
| Phase Lock (`phase-lock`) | Puzzle | phase-lock | ~45s | 2592 B | VALID | Two rings, two satellites — lock them into one line. |
| Heat Balance (`heat-balance`) | Puzzle | heat-sync | ~30s | 2317 B | VALID | Keep the needle in the safe arc. |
| Spire Pulse (`spire-pulse`) | Atmosphere | pulse-ring | ~30s | 1854 B | VALID | Downtown after dark — answer the Signal Spire. |
| Crosswalk Window (`crosswalk-window`) | Atmosphere | crosswalk-pulse | ~25s | 2171 B | VALID | Catch the walk signal before it flips. |
| Crane Gate (`crane-gate`) | Atmosphere | tide-gate | ~35s | 2090 B | VALID | Harborside — time the tide under the crane. |
| Beacon Climb (`beacon-climb`) | Atmosphere | signal-climb | ~30s | 2007 B | VALID | Ride the signal up the Beacon Crown. |
| Ember Sync (`ember-sync`) | Atmosphere | heat-sync | ~30s | 2322 B | VALID | Foundry heat runs hot — hold the safe arc. |
| Arbor Bloom (`arbor-bloom`) | Atmosphere | light-bloom | ~40s | 2025 B | VALID | Garden lights bloom and fade. Meet them at full bloom. |

All 16/16 are importer-VALID (the table above is generated from the live library + real
importer; `tests/creator/cabinet-templates.test.mjs` pins this in CI-by-hand). Every package
is ~2 KB against an 8 KB default budget and a 64 KB hard cap.

## How to tune one

Picking a starter sets the closed controls; every change re-runs the full importer gate live:

- **difficulty** scales the hot window (`chill` 1.5× / `standard` / `sharp` 0.65×);
- **motion** scales travel/swell amplitude (`calm` 0.7× — the reduced-motion choice);
- **accent / speed / frame / budget** as before;
- rename it (id + display name) to make it yours — economy words are BLOCKED by the shared
  validator, with a friendly hint under the error.

Export = manifest + game.mjs + adapter.mjs, or one `.builder.json` **bundle**. Importing a
bundle restores **parameters only** — bundled source/manifest are deliberately ignored and
everything regenerates through the closed tables (a hostile bundle cannot smuggle code; the
builder smoke proves it).

## How validation works (and what is forbidden)

Two independent layers, neither of which this library weakens:

1. **CF-4 importer** (`importArcadePackage`) — manifest shape, kebab id, byte budgets, frame
   contract, code-aware source scan (no fetch/XHR/WebSocket/EventSource/sendBeacon, no
   workers, no dynamic import, no eval/new Function, no localStorage/sessionStorage/
   indexedDB/cookies), economy-vocabulary regex over names AND source, entry must be
   import-free, adapter may import only `./game.mjs`, zero capabilities, no extra files.
2. **Sandbox** (`arcade/creator/arcade-sandbox/`) — the ONLY place creator code runs:
   null-origin iframe (`sandbox="allow-scripts"`, no same-origin), postMessage frame
   contract, results surface as `untrusted_local_proposal` — the server's award path never
   sees, trusts, or executes any of this.

Forbidden everywhere (copy, ids, source): money/ownership/gambling vocabulary, prize/ticket
rules, payout/account/wallet fields, person attribution, external URLs, dynamic code. The
hardening suite (`tests/creator/starter-hardening.test.mjs`) runs the whole library plus
adversarial injections against these rules.

## How to test in the sandbox

Export a starter (or your tuned copy), open `arcade/creator/arcade-sandbox/`, load the three
files, run. Tap-feed it and request a result — you should see a numeric
`proposed_score` proposal marked untrusted. The sandbox smoke runs five representative
starters (one per category) end-to-end headlessly: `tests/creator/run-arcade-sandbox.sh`.

## How to add a new starter safely

1. If the loop is genuinely new, add a **variant** body in `cabinet-templates.mjs` (BODIES):
   same head/tail contract, `hot()` + `render(ctx)` only, use `WIN`/`MOT` for difficulty/
   motion, no new globals, no strings that look like economy vocabulary (even "token").
2. Add the **starter** entry with the full metadata contract (the unit test enforces every
   field, closed tokens, round 15–90s, clean copy).
3. Run `node --test tests/creator/cabinet-templates.test.mjs tests/creator/starter-hardening.test.mjs`
   — both must pass with zero edits to the gates.
4. Run the builder + sandbox smokes. If your starter needed a validator/sandbox change to
   pass, STOP — that's a boundary change requiring its own review, not a starter.

## City seam (where players meet these)

Each city block's arcade entrance is branded with its landmark house name
("Signal Spire Arcade" — `arcade/city/city-arcade-identity.mjs`, display-only overlay; the
server-authored portal target is untouched). The phone loop — walk → see → enter → play →
return (back-gesture or the 44px return button) → arrival cue — is smoke-proven in
`tests/arcade/run-city-loop-mobile.sh`.
