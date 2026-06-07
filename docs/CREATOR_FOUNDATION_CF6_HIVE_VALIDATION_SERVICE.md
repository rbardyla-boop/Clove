# Creator Foundation CF-6 — Hive Validation Service Prototype

**Status:** implemented, **local/dev-only, CLI-first, zero live trust, no production, no deploy.**
**Not:** approval · live-world authorization · content clearance · public upload · loader enablement · economy · ownership · accounts.
**Parents:** `docs/NEON_CIRCUIT_CREATOR_PIPELINE_ROADMAP.md` (CF-6), `docs/CREATOR_FOUNDATION_CF2_APPROVED_LOADER.md` (the boundary it generalizes), `docs/NEON_CIRCUIT_GAMEPLAY_CHARTER.md` §15 (Hive validation role).

## What CF-6 proves

CF-2 made a single operator's static approved-registry real. CF-6 turns *validation* into something
**service-shaped** — accept a package, run the canonical validators, emit a hash-bound verdict, keep a
submission queue, answer read-only lookups — **while granting zero live trust.** It is the seed of future
distributed validation, **not** distributed authority: decentralizing review must never decentralize
trust by default (charter §15).

## Four hard outputs

1. **Validation service prototype** (`arcade/creator/hive-validation/hive-service.mjs`, pure core +
   `hive-cli.mjs` local harness). Accepts a package, recomputes the canonical hash, runs the **same**
   validators the CLI uses, writes a deterministic report. In-memory submission queue + read-only
   `lookup(hash)`.
2. **Hash-bound Hive receipt.** "This exact package hash got this exact validator verdict." It carries
   `package_hash`, `validator_version`, `verdict: valid|invalid`, and a `receipt_hash` over its body
   (tamper-evident). It is **not** approval, **not** live authorization, **not** content clearance.
3. **Quarantine boundary.** The service has **no live-world capability**: it cannot flip
   `LIVE_WORLD_LOADER_ENABLED`, cannot update an approved live registry, cannot register a cabinet,
   cannot touch Worker/DO authority, cannot publish to production. Structurally enforced — the module
   imports only the pure validators + the hash util, and exposes **no** approve / enable-live / register
   method.
4. **Equivalence with the CLI.** The same package produces the **same verdict** through the CLI
   (`validate-package.mjs`) and the CF-6 service — by construction (identical validator dispatch), and
   locked by tests.

## Hard invariants (non-negotiable)

```
status               = 'local_validation_only'   (never operator_approved_local, never live)
live_world_authorized = false                     (always — the service has no live capability)
content_cleared       = false                     (automated validation is NOT content review — CF-8 human job)
```

These are forced regardless of what a package claims: a package carrying `live_world_authorized: true`
is recorded `false` (and rejected as an unknown key by the strict validators).

## Quarantine — what the service can and cannot do

```
CAN:  validate a package · recompute its canonical hash · emit a hash-bound verdict ·
      enqueue a public-safe submission entry · answer a read-only lookup by hash
CANNOT (no such method exists, by design):
      approve · enable live loading · flip LIVE_WORLD_LOADER_ENABLED · update an approved registry ·
      register a cabinet · touch Worker/DO · publish/deploy · clear content · grant any authority
```

The module imports **only** `validator/{package-hash, validate-block-package, validate-block-layered-package,
validate-arcade-package}.mjs`. It imports **no** `approved-loader`, **no** `approved-package-registry`
mutator, **no** Worker/DO. A read-side `isReceiptIntact()` additionally refuses any receipt whose
invariants were tampered (e.g. a forged `live_world_authorized:true`).

## CLI-first (no network surface)

```
node arcade/creator/hive-validation/hive-cli.mjs <pkg.json> [<pkg2.json> ...] [--lookup <hash>]
```

CLI-first by design: **no HTTP server, no network, no live-world write.** A localhost-only HTTP wrapper
(bound to 127.0.0.1, explicit command) is documented as a future option but intentionally **not built** —
a verdict authorizes nothing, so the service needs no exposed surface, and not binding a port keeps the
attack surface at zero. (Near-term "decentralized" framing stays **proof-of-service / reputation /
capacity budgets**, never rent / paid hosting / marketplace — those remain hard non-goals.)

## Validation

```
node --test tests/creator/hive-validation.test.mjs    # 11 unit (equivalence + quarantine + hash-bound + adversarial)
node arcade/creator/hive-validation/hive-cli.mjs arcade/creator/samples/*.json arcade/creator/samples/arcade-sample/manifest.json
node --test tests/creator/*.test.mjs                   # 126 creator unit (115 + 11), green
node --test tests/arcade/*.test.mjs                    # 608 arcade unit (unchanged), green
node --test tests/creator/curated-upload.test.mjs      # CF-6 excluded from curated upload (verified --list)
node tests/arcade/check-production-config.mjs           # PASS; node scripts/check-city-build-size.mjs — within budget
cd workers/arcade && wrangler deploy --dry-run          # byte-identical (200.81 KiB) — no Worker change
```

Adversarial suite (all → `invalid`, none authorized): script injection, external URL, forbidden economy
copy, unknown field, unknown kind, a `live_world_authorized:true` attempt, plus tampered-receipt detection.

## Next Creator Foundation phase

```
CF-7 (= "CF-E")  operator-approved LIVE loader — the FIRST time a package may render in the live world,
      and only behind a human-cleared, separately-authorized review. It flips LIVE_WORLD_LOADER_ENABLED,
      which CF-2/CF-3 still forbid. A CF-6 "valid" verdict is a PRECONDITION, never a sufficient cause.
CF-8  moderation + human-review queue — content review of free-text fields; runs alongside CF-7. A CF-6
      verdict is structural only; content clearance is CF-8's human responsibility.
```

The live world stays closed. CF-6 proves validation can be service-shaped without becoming an authority.
Detail + lineage: `docs/NEON_CIRCUIT_CREATOR_PIPELINE_ROADMAP.md`.
