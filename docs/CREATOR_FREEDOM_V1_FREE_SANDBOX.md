# Creator Freedom v1 — Free Sandbox Mechanics

Free Sandbox is the deep, **local-only** authoring layer of the Local Maker. It lets a creator build
*materially different* arcade games — survival dodgers, collect-and-escape runs, wave clears, timed
routes, combo chases — by composing a **declarative, capability-limited graph** of mechanics. No
arbitrary JavaScript, no network, no storage, no live world, no economy. It extends CF-4A's closed
rule-graph idea from one fixed template (Reaction Lane) to a general, bounded game vocabulary.

> Local-only. Runs in the hardened sandbox. Not the live city. No tickets. No account. No upload.

## The one architectural idea: graph-as-data + a fixed interpreter

The creator authors **data** (a closed-vocabulary JSON graph). The generator turns that graph into a
**standard `arcade_game` package**:

```
game.mjs  =  const GRAPH = { …validated runtime graph… };
             export function createGame() { return (<FIXED reviewed interpreter>)(GRAPH); }
adapter.mjs =  the existing SDK reference adapter (unchanged)
```

So the package's *only* code is one **fixed, reviewed deterministic interpreter**
(`arcade/creator/arcade-builder/free-sandbox-interpreter.mjs`). Only the closed-vocab DATA varies.
That output is an ordinary `arcade_game` package, which means:

- **The importer gate is unchanged.** `importArcadePackage` re-validates the manifest and runs its
  26-pattern code-aware source scan over the generated `game.mjs`/`adapter.mjs` exactly as for any
  other package. A tampered graph or an injected `fetch(`/`eval(`/`localStorage`/`<script>`/`import(` is
  rejected — the gate, not the editor, is the authority.
- **The sandbox is unchanged.** The package runs in the existing **null-origin** iframe
  (`sandbox="allow-scripts"`, never `allow-same-origin`; child CSP `default-src 'none'` → no network,
  no eval). The result is an `untrusted_local_proposal`; the host/server stays the authority.

No new package kind, no new runtime, no parallel sandbox — the new trust surface is **zero**.

## What a creator can build (the declarative blocks)

Authored in `arcade/creator/schemas/free-sandbox-schema.mjs` (the validator is fail-closed):

| Block | Choices (closed vocabulary) |
|------|------|
| **Arena** | edges (wrap / clamp / lethal), scroll, background, up to 8 zones (goal / hazard / safe / spawn) |
| **Player** | control (free move / lane switch / dodge / follow pointer / tap), speed tier, lives (1–9), size, shape |
| **Objective** | survive_timer · reach_goal · collect_targets · clear_waves · timed_route · score_threshold · combo_chain · avoid_hits |
| **Scoring** | per pickup / per enemy cleared / per second alive / combo cap |
| **Entities** (≤8 types) | kind (enemy / obstacle / pickup / projectile / hazard / goal_marker / score_orb), shape, palette colour, size, movement, speed, max_count, collision (none / block / damage / collect / score / goal), lifetime, score value |
| **Movement / AI** | stationary · patrol_x · patrol_y · chase · flee · wander · orbit · zigzag · sine · fall · rise · burst (all deterministic from the seed) |
| **Waves** (≤12) | at_s, entity, count, interval, from-side, repeat |
| **Rules** (≤16) | **WHEN** timer_elapsed / score_reached / player_enters_zone / collision_with / pickup_collected / wave_cleared / lives_changed / combo_reached → **THEN** add_score / sub_life / add_life / spawn / despawn_kind / set_player_speed / trigger_fx / start_wave / end_win / end_lose / show_message / apply_modifier |
| **Modifiers** | difficulty ramp (none / gentle / standard / hard), replay variation |
| **Theme** | palette, particles, shake, contrast (all reduced-motion aware) |

Five worked examples ship as graph fixtures in `free-sandbox-templates.mjs` (`EXAMPLE_GRAPHS`):
**Survival Dodge, Collect and Escape, Wave Clear, Timed Route, Combo Score** — five distinct
objectives, five distinct mechanic sets. Each validates, gates, and runs deterministically (≈26 KB
packaged, well under the 64 KiB cap).

## What a creator still cannot do (bounded freedom)

Every one of these is enforced by the validator AND, as defense in depth, by the importer scan on the
generated source:

- No arbitrary JS, no `eval` / `Function` / dynamic `import`, no code strings.
- No network (`fetch` / `WebSocket` / external URL), no storage in package code, no DOM escape.
- No live-world load, no creator tickets / rewards / prizes / economy / ownership / marketplace.
- No accounts, no server upload, no cloud storage, no publishing.
- No Worker/DO authority — results are untrusted local proposals only.

The freedom is wide *inside* the schema and hard-bounded *at* it: unknown enums, over-cap counts
(entity types, live instances, rules, waves, spawn rate), URLs, control characters, economy/ownership
vocabulary, and any capability flag set true all **fail closed** with a readable error.

## Replayability & retention (local-only)

`arcade/creator/arcade-sandbox/free-sandbox-retention.mjs` keeps a **host-only** play history keyed by
the local package **fingerprint** (sha256 of `{manifest, files}`):

- best score, play count, last score, a **personal grade** (graded relative to *your own* prior best —
  S for a new best, down to D — never a fixed "economy" scale),
- a recent-packages list (LRU, capped),
- deterministic **seed replay**: the package seed is fixed, so "Restart" re-runs an identical session.

It lives in `localStorage` on the **trusted sandbox page only** — never inside the iframe (the
null-origin sandbox can't reach it, and the importer bans storage in package source). It is a single
device memory: no server, no account, no leaderboard, no reward.

## Why this is not live publishing, and not an economy

The output never touches the live city or CF-7. It is played only in the local hardened sandbox; its
"result" is explicitly an `untrusted_local_proposal` with `server_authorized: false`. There is no
ticket, prize, balance, transfer, or cash-out anywhere in the schema, the interpreter, the editor, or
the retention store — the vocabulary that would imply one is on the validator's deny-list. Creator
Freedom v1 deliberately expands *creative* range while keeping the legal/economy/live-publishing
surfaces closed (see ADR-048 and ADR-047).

## How to use it

Open the Arcade Maker (`arcade/creator/arcade-builder/`), choose **Free Sandbox** in the Mode select,
then start blank / from a mechanic / by remixing an example. Edit the blocks; the panel validates live
and shows the fingerprint. Press **Test in sandbox** to play it (one-click handoff into the hardened
sandbox), or copy a local `NCLOCAL1:` share code for another browser to import and play locally.

## Files

- `arcade/creator/schemas/free-sandbox-schema.mjs` — closed schema + fail-closed validator + caps.
- `arcade/creator/arcade-builder/free-sandbox-interpreter.mjs` — the fixed deterministic engine + source emitter.
- `arcade/creator/arcade-builder/free-sandbox-templates.mjs` — generator (`buildFreeSandboxPackage`) + 5 examples.
- `arcade/creator/arcade-builder/free-sandbox-editor.mjs` — the data-only editor controller.
- `arcade/creator/arcade-sandbox/free-sandbox-retention.mjs` — host-only play retention by fingerprint.
- Tests: `tests/creator/free-sandbox-{schema,interpreter,examples,editor,retention,hardening}.test.mjs`
  + the `free-sandbox-editor` browser smoke. No importer/sandbox change; the editor aggregate is re-pinned.
