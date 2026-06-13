# Creator Foundation CF-4A - Arcade Builder V2 Rule-Graph Authoring Plan

**Status:** PLAN ONLY. No implementation, no deploy, no Worker/DO change, no route or migration change.

**Authorization:** `AUTHORIZED: PLAN CF-4 ARCADE BUILDER V2 -- FINE-GRAINED RULE-GRAPH AUTHORING -- NO LIVE WORLD LOAD`

**Goal:** evolve the current static lab builder from preset selection into fine-grained constrained authorship. Creators should assemble a game from approved mechanics modules and bounded rule knobs. They should not write arbitrary JavaScript.

**Non-goal:** public UGC, live-world package loading, ticket/prize/ledger integration, marketplace/ownership semantics, or any production authority change.

## 1. Current Builder Audit

### What The Live Lab Builder Can Do Now

The lab surface currently proves a useful operator-first path:

- choose a named starter preset from a closed library;
- tune closed tokens for variant, accent, speed, difficulty, motion, juice, input mode, frame contract, and size budget;
- generate a valid local arcade package with `manifest.json`, `game.mjs`, and `adapter.mjs`;
- run the generated package through the CF-4 importer gate;
- export individual files or a builder bundle;
- open the static lab in a browser and mount generated starter cabinets as client-local, no-ticket previews.

This is enough to prove the end-to-end surface: authoring UI, deterministic generation, importer validation, sandbox run, and local/static cabinet mounting.

### Where It Is Too Coarse

The current builder is still a starter cabinet generator, not a real community game creator:

- creators pick among prewritten procedural shapes rather than composing mechanics;
- "variant" is too large a unit of authorship;
- input mode exists, but objective, scoring, spawn, layout, failure, and accessibility rules are not independently editable;
- layout is mostly frame selection, not lane/zone/spawn/UI composition;
- visual control is mostly accent/motion/juice, not target shape, background pattern, warning style, success/fail burst, or high-contrast profile;
- generated code remains the output format, while the user-facing model is not yet a structured rule graph;
- test output proves packages can run, but not that the builder can express multiple real genres from shared rule modules.

The next leap is therefore from preset selection to constrained mechanics composition.

### Ownership Map

Current generation and editor ownership:

- `arcade/creator/arcade-builder/index.html` - local builder UI shell.
- `arcade/creator/arcade-builder/arcade-builder.mjs` - DOM wiring, closed control state, generation invocation, importer report, export shell.
- `arcade/creator/arcade-builder/cabinet-templates.mjs` - pure generation core: closed token tables, variants, starter library, generated package source.
- `arcade/creator/arcade-builder/write-starter-statics.mjs` - author-time starter static generation for checked-in starter cabinets.

Package validation and import ownership:

- `arcade/creator/schemas/arcade-game-package-schema.mjs` - CF-1 arcade manifest schema, frame contracts, size budget, empty capability allowlist.
- `arcade/creator/validator/validate-arcade-package.mjs` - manifest validation.
- `arcade/creator/arcade-importer/import-arcade-package.mjs` - folder/source import gate, code-aware static scan, import restriction, size enforcement, local trust label.
- `arcade/creator/validator/validation-report.mjs` - shared forbidden vocabulary and validation report primitives.
- `arcade/creator/validator/issue-explainer.mjs` - friendly issue explanations, not authority.

Sandbox ownership:

- `arcade/creator/arcade-sandbox/index.html` - local sandbox host page.
- `arcade/creator/arcade-sandbox/sandbox-runner.mjs` - null-origin `sandbox="allow-scripts"` iframe, strict CSP, narrow postMessage channel, untrusted local result proposal.
- `arcade/creator/samples/arcade-sample/*` - tiny known-good package.

Starter cabinet mounting ownership:

- `arcade/cabinets/starters/curated-floor.mjs` - checked-in operator-curated starter manifest; client-local only; no tickets.
- `arcade/cabinets/starters/starter-host.mjs` - shared host wrapper for generated starter modules; local score display only; no messages, no client authority calls.
- `arcade/cabinets/starters/<starter>/game.mjs` and `adapter.mjs` - checked-in generated starter modules.
- `arcade/cabinet-adapter-runtime.js`, `arcade/cabinet-import-loader.mjs`, `arcade/cabinet-frame.js`, and `arcade/cabinet-frame-contract.mjs` - runtime/frame contracts that mount imported/static cabinets.

Production/static boundary ownership:

- `scripts/build-curated-client-upload.mjs` excludes `arcade/creator/**` from the production static upload.
- `arcade/creator/approval/approved-loader.mjs` keeps `LIVE_WORLD_LOADER_ENABLED = false`.
- CF-4A does not change either boundary.

## 2. Rule-Graph Schema Proposal

The new authoring model should define an `arcade_rule_graph` package body. The builder may still generate deterministic `game.mjs` and `adapter.mjs` for the existing CF-4 sandbox, but the creator-facing artifact should be a structured graph of closed modules.

### Top-Level Shape

```json
{
  "schema_version": 1,
  "package_kind": "arcade_game",
  "game_kind": "arcade_rule_graph",
  "template": "reaction_lane",
  "package_id": "signal-lane-demo",
  "display_name": "Signal Lane Demo",
  "frame_contract_id": "cabinet-360x640",
  "rules": {},
  "layout": {},
  "visuals": {},
  "accessibility": {},
  "capabilities": {
    "network": false,
    "storage": false,
    "external_assets": false,
    "live_world_authorized": false
  }
}
```

The graph should use fixed keys, closed enums, bounded integers, bounded durations, and known presets. Unknown keys reject.

### Mechanic Template

Closed template enum for CF-4A:

- `reaction_lane`
- `signal_ring`
- `memory_trace`

Future-compatible but out of CF-4A scope:

- `dodge_avoid`
- `collect_pattern`
- `match_line_clear`
- `timing_bar`
- `hold_release`
- `path_trace`
- `orbit_timing`

### Objective Rule

Closed objective modules:

- `clear_targets`
- `survive_timer`
- `repeat_sequence`
- `hit_timing_window`
- `maintain_phase_lock`

Bounded fields:

- `target_count`: integer, e.g. 3-60
- `required_streak`: integer, e.g. 1-20
- `success_threshold`: enum or bounded integer
- `mistake_tolerance`: integer, e.g. 0-10

### Input Grammar

Closed input modules:

- `tap`
- `tap_or_swipe`
- `hold`
- `hold_and_release`
- `drag`
- `keyboard`
- `mobile_fallback`

Gamepad remains later. Every template must have a mobile-first fallback and keyboard path where feasible.

### Spawn And Layout Rule

Closed layout modules:

- `lanes`
- `rings`
- `sequence_grid`
- `target_zones`
- `safe_zones`
- `spawn_regions`
- `ui_slots`

Bounded knobs:

- `lane_count`: 1-5
- `ring_count`: 1-4
- `target_zone_count`: 1-12
- `safe_zone_count`: 0-6
- `max_simultaneous_objects`: 1-12
- `spawn_pattern`: `center_out`, `left_right`, `random_bag`, `clockwise`, `sequence_reveal`
- `frame`: `cabinet-360x640`, `cabinet-640x360`, `cabinet-480x480`
- `preview_mode`: `phone`, `desktop`, `cabinet`

### Scoring Rule

Closed scoring modules:

- `bounded_combo`
- `flat_hits`
- `timing_quality`
- `sequence_accuracy`
- `survival_ticks`

Bounds:

- score cap required;
- combo cap required;
- combo decay enum;
- miss penalty enum;
- no payout/reward/ticket/prize semantics;
- result remains `untrusted_local_proposal` in sandbox.

### Timer And Fail Rule

Closed timer/fail modules:

- `round_timer`
- `target_count_timer`
- `miss_limit`
- `streak_break`
- `sequence_fail`

Bounds:

- `round_length_s`: 15-90
- `warning_at_s`: 3-15
- `miss_limit`: 0-10
- `difficulty_ramp`: `none`, `gentle`, `standard`, `sharp`
- `spawn_cadence_ms`: bounded by template
- `hit_window_ms`: bounded by template

### Visual, Audio, And Motion Profile

Closed presentation modules:

- `palette`
- `background_pattern`
- `target_shape`
- `trail_style`
- `pulse_style`
- `warning_style`
- `success_burst`
- `fail_burst`
- `particle_effects`
- `screen_shake`
- `audio_lite`

Required constraints:

- particle effects are bounded by pool size and lifetime;
- screen shake is bounded by amplitude/duration and disabled under reduced motion;
- audio is closed-token oscillator/audio-lite only, gesture-gated, no files, no network, no loops;
- high-contrast profile is required for every template;
- reduced-motion variant is required for every template.

Suggested closed tokens:

- `particle_effects`: `off`, `soft`, `arcade`
- `screen_shake`: `off`, `soft`, `arcade`
- `contrast`: `standard`, `high`
- `motion`: `reduced`, `standard`, `vivid`
- `palette`: closed project palettes only

### Accessibility Profile

Required fields:

- `reduced_motion`: `supported`
- `contrast`: `standard` or `high`
- `mobile_controls`: closed layout enum
- `keyboard_controls`: closed grammar enum
- `text_free_playability`: boolean, true only if icon/shape state is sufficient
- `color_independent_signals`: boolean, must be true for high-contrast profile

### Capability Declaration

The package must explicitly declare all restricted capabilities false:

```json
{
  "network": false,
  "storage": false,
  "external_assets": false,
  "dom_escape": false,
  "arbitrary_code": false,
  "live_world_authorized": false,
  "ticket_hooks": false,
  "prize_hooks": false,
  "ledger_hooks": false
}
```

These are documentation/validation fields for the rule graph. They do not grant capability. The validator remains deny-by-default.

## 3. CF-4A Implementation Slices

Implementation is not authorized here. These are the proposed future slices for the later gate:

`AUTHORIZED: IMPLEMENT CF-4A ARCADE BUILDER V2 RULE-GRAPH FOUNDATION -- NO LIVE WORLD LOAD`

### Slice A - Rule-Graph Data Model

- Add pure schema module for `arcade_rule_graph`.
- Define template enums, rule enums, bounds, and required accessibility/capability declarations.
- Add positive fixtures and abuse fixtures.
- No UI yet.

Acceptance:

- valid minimal graphs for Reaction Lane, Signal Ring, and Memory Trace pass;
- unknown keys, arbitrary strings, external URLs, capability escalation, and economy terms fail.

### Slice B - Reaction Lane Template

Good for Flash Three-style quick games.

Controls:

- lane count;
- spawn cadence;
- target count;
- hit window;
- combo cap;
- combo decay;
- miss cap;
- high-contrast target state;
- particle effect level;
- bounded screen shake level.

Output:

- deterministic package JSON;
- deterministic generated game/adapter for existing CF-4 sandbox;
- local preview only.

### Slice C - Signal Ring Template

Good for Spire Pulse-style timing games.

Controls:

- ring count;
- pulse speed;
- phase lock window;
- input window;
- difficulty ramp;
- ring trail style;
- warning style;
- reduced-motion ring fallback;
- high-contrast profile.

Output:

- timing game built from the shared rule interpreter/generator;
- bounded visuals and audio-lite only.

### Slice D - Memory Trace Template

Good for Simon/rhythm/path games.

Controls:

- sequence length;
- reveal time;
- mistake tolerance;
- pattern style;
- input grammar;
- assist mode;
- success/fail burst;
- reduced-motion reveal mode;
- high-contrast state markers.

Output:

- sequence-memory game with no random unbounded growth;
- deterministic seeded pattern generation where needed.

### Slice E - Local Preview

- Builder preview shows the selected rule graph before export.
- Phone, desktop, and cabinet frame preview modes.
- Preview can use the same deterministic generator as export.
- Preview must not bypass the importer/sandbox trust boundary.

### Slice F - Deterministic Adapter Generation

- Generate `manifest.json`, `game.mjs`, and `adapter.mjs` from the rule graph.
- Keep output small and deterministic.
- Generated modules must still satisfy CF-4 importer restrictions.
- No dynamic imports, network, storage, or host calls.

### Slice G - Validator Expansion

- Validate graph structure before generation.
- Validate generated package through existing importer after generation.
- Add rule-graph-specific abuse corpus:
  - excessive object counts;
  - invalid timing windows;
  - unbounded score/combo;
  - missing reduced-motion/high-contrast profile;
  - forbidden economy/token/prize vocabulary;
  - capability escalation;
  - external asset references;
  - unknown keys.

### Slice H - Sandbox Smoke

- Run generated packages in `arcade-sandbox`.
- Verify result proposals remain `untrusted_local_proposal` and `server_authorized:false`.
- Verify no network/storage/DOM escape.
- Verify particle/screen-shake settings are bounded and reduced-motion disables motion-heavy effects.

### Slice I - Mobile Smoke

- Run each template in mobile viewport.
- Verify tap/swipe/hold/drag fallback per template.
- Verify no text overflow in compact controls.
- Verify high-contrast mode is visible and not color-only.

## 4. Safety Model

Hard constraints:

- no arbitrary JS editor;
- no public upload;
- no live-world loader;
- `LIVE_WORLD_LOADER_ENABLED` remains false;
- no ticket/prize/ledger/economy hooks;
- no external assets or URLs;
- no production authority change;
- no Worker/DO change;
- no route or migration change;
- no marketplace, ownership, rent, paid hosting, accounts, payout, token, NFT, transfer, or convertible balance;
- generated result remains an untrusted local proposal.

The builder may generate JavaScript as an implementation artifact for the existing CF-4 sandbox, but creators author data and closed rules only. Generated code is deterministic, validator checked, and sandboxed. The user never edits source text.

Trust remains local-first:

```text
rule graph -> validate graph -> deterministic generation -> importArcadePackage
           -> local sandbox -> untrusted local proposal -> export/report
```

No output from CF-4A may enter the live city. CF-7 remains the separate live-loader gate.

## 5. Acceptance Gates

Before CF-4A can be considered implemented, all of the following must pass:

- package validates;
- graph validates before generation;
- generated adapter runs only in local sandbox;
- `server_authorized:false` and `trust:'untrusted_local_proposal'` remain true for sandbox results;
- bot smoke passes for Reaction Lane, Signal Ring, and Memory Trace;
- mobile smoke passes for all three templates;
- abuse corpus rejected;
- package size and generated file size are bounded;
- forbidden fields rejected;
- capability list remains deny-by-default;
- mobile safety verified;
- motion safety verified, including reduced-motion disabling screen shake and heavy particles;
- high-contrast profile verified;
- score/combo bounds verified;
- no network/storage/DOM escape;
- no ticket/prize/economy/ledger hooks;
- no open assets or URLs;
- no public upload;
- no live-world loader;
- `LIVE_WORLD_LOADER_ENABLED` remains false;
- curated production upload exclusion for `arcade/creator/**` remains intact;
- Worker dry-run is byte-identical if no Worker source changed, or unnecessary if `workers/**` diff is empty.

## Bottom Line

The static lab proves the surface. CF-4A should make the builder a constrained rule-graph authoring tool:
real mechanics composition, still bounded, local, validated, sandboxed, and non-authoritative.

