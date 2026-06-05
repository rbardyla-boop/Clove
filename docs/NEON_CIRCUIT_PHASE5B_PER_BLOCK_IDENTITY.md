# Neon Circuit — Phase 5B: Per-Block Identity

Phase 5A made the city a district of three blocks (discovery + bounded routing). Phase 5B
makes those blocks feel **distinct**: each has its own visual identity — a default accent
style and its own landmark labels — so travelling the district visibly changes the world.

It is **display-only**. It changes no geometry, no collision, no authority, no economy. No
new Durable Object, no migration, no cross-DO coordination.

## Goal

Give each block (`downtown-01`, `harbor-02`, `skyline-03`) a recognizable identity, reusing
the existing Phase 4F block-style render path and the Phase 5A district travel flow — so the
multi-block district is tangible, not just a routing abstraction.

## What changed from Phase 5A

- `arcade/city/city-stewardship.mjs` — `defaultBlockStyle(cityId)` now returns a **per-block
  default style** drawn from the same closed allowlist (downtown = magenta/neon-noir,
  harbor = cyan/tidal, skyline = amber/sunset). No/unknown cityId → the downtown default
  (every existing no-arg caller is unchanged). A steward **reset** restores the *block's own*
  default (the reset path threads `cityId`).
- `arcade/city/city-block.mjs` — `publicLayout(cityId)` overlays **per-block landmark labels**
  (e.g. harbor's `HARBOR CONTROL` / `DOCKSIDE NOODLES` / `FERRY TERMINAL`) onto the shared
  geometry; the arcade building keeps its label everywhere (it is the portal home).
  `welcomePayload` sends `publicLayout(cityId)`.
- `workers/arcade/src/city-room.ts` + `workers/arcade/city-dev-shim.mjs` — a cold block seeds
  its **own** default style (`defaultBlockStyle(boundCityId)`). The CityRoom binds `boundCityId`
  from the route **before** `ensureInitialized()` so a cold harbor/skyline DO seeds the right
  identity (not downtown's).
- `arcade/city/city-render-canvas2d.js` + `city-render-three.js` — a `setLayout(layout)` so the
  renderer refreshes per-block labels when the player travels. The 2D renderer redraws labels;
  the 3D renderer's geometry is identical across blocks (and draws no labels), so it just keeps
  the ref current. `city-scene.js` calls `renderer.setLayout` on welcome.

## Authority model (unchanged)

Per-block identity is **paint, not authority**. Geometry, collision, spawn points, and portals
are **byte-identical** across blocks (asserted in `city-identity.test.mjs`), so the Phase 4A–4B
movement authority and reconciliation are entirely unchanged. The per-block style remains
server-owned (it flows through the Phase 4F stewardship state, which a steward can still edit
within the manifest); the per-block labels are public-safe display data in the welcome layout.

## Public-safety model

Per-block styles are constrained to the existing closed stewardship allowlist
(`cyan/magenta/amber/white` × `classic/circuit/signal` × `low/medium/high`), so an identity can
never carry anything outside the manifest. Labels are fixed strings (no free text, no user
input). No money/ownership/economy data is introduced.

## Size-budget result

`node scripts/check-city-build-size.mjs` → **0.732 MB / 0.196 MB gzipped** (within budget).
Worker bundle `179.49 KiB / 38.76 KiB gz` (no new dependency, no new asset).

## Validation commands

```bash
node --test tests/arcade/*.test.mjs                 # 504/504 (+4 identity)
node tests/arcade/check-production-config.mjs        # PASS
node scripts/check-city-build-size.mjs               # PASS
bash tests/arcade/run-city-district.sh               # district + per-block identity on travel
# + all Phase 4 city specs + two-client + frame-contract
( cd workers/arcade && wrangler deploy --dry-run --outdir dist )
```

## Known limitations

- Identity is style accent + landmark labels only; block **geometry** is still shared (distinct
  per-block worlds remain a larger, authority-touching change — deferred).
- The 3D renderer draws no text labels, so per-block labels are a 2D-renderer feature (the 3D
  scene still shows the per-block accent style).
- Live cross-block population/health in discovery remains deferred (it needs a cross-DO
  coordinator that can only be validated end-to-end on staging, not against the dev-shim).

## Explicit non-goals

No real money / crypto / blockchain / token / NFT / staking / yield / resale / cash-out /
gambling / wagering / marketplace / paid hosting / land or block ownership / rent / income /
payout / accounts / cross-block economy / HiveWorld bridge / `game/*`. No new Durable Object,
no migration, no authority/collision change. No deploy. No credentials.

## Next phases

- Live district presence (population/health) in discovery — paired with a staging deploy so the
  cross-DO coordinator is validated end-to-end (not just against the dev-shim).
- Distinct per-block geometry (a larger, authority-core change) if/when justified.
