# Creator Foundation CF-7 — Operator-Approved Live Loader (SHIPPED DISABLED)

**Status:** implemented, **SHIPPED DISABLED** (`LIVE_WORLD_LOADER_ENABLED = false`), **staging-only, no
production, no public upload, no auto-approval, no economy.**
**Not:** a live deploy · a config toggle that enables live · a Worker/DO change · an account/marketplace.
**Parents:** `docs/CREATOR_FOUNDATION_CF7_CF8_LIVE_LOADER_PLAN.md` (the hardened plan + 9-finding threat
model this implements), `docs/CREATOR_FOUNDATION_CF8_REVIEW_QUEUE.md` (the human gate it consumes).

## What CF-7 adds

CF-7 builds the **dangerous gate as a closed, testable machine before ever opening it.** It is the trust
boundary that decides whether an approved creator package could ever enter the live world. It is shipped
**disabled** and proven to **reject by default** — so Phase 8 (city scale) can be designed around a real,
exercised boundary instead of a plan.

> **CF-7 IS SHIPPED DISABLED.** `LIVE_WORLD_LOADER_ENABLED` is `false` and is checked **before any binding
> work**. A fully-valid, fully-approved chain (CF-2 local receipt + CF-6 verdict + CF-8 human review +
> CF-7 live receipt + live registry, all real and hash-bound) **still cannot load** — it is rejected with
> `live_world_loader_not_enabled`. Enabling live load is a deliberate, separately-authorized, human-
> cleared, staging-verified production change. It is **not** a toggle reachable through this code.

## The single shared gate

CF-7 imports the **same** `LIVE_WORLD_LOADER_ENABLED` constant the CF-2 loader defines — one gate, one
source of truth, both false. The CF-2 local-preview path stays **byte-frozen**; CF-7 is a separate,
parallel live track. Two locks remain independent: even if the flag were flipped, every CF-7 binding,
the registry, the epoch, and the kill-switch must still pass.

## The closed machine (deny-by-default, fail-closed first)

`loadLivePackage(...)` runs these in order; the fail-closed controls run first, and any failure returns a
structured rejection (nothing is ever thrown into the live world):

| # | Gate | Reject reason | Threat-model |
|---|------|---------------|--------------|
| 0 | kill-switch is the exact off-sentinel (`false`) | `kill_switch_engaged` | F5 |
| 1 | **loader enabled** (`=== true`; shipped false) | `live_world_loader_not_enabled` | — |
| 2 | package survives a JSON round-trip (no `undefined`/NaN, no `Date`/`Map`/non-plain objects) | `package_not_json_clean` | F2 |
| 3 | live receipt valid; **wrong kind fails fast** | `wrong_receipt_kind` / `invalid_live_receipt` | F7 |
| 4 | package body re-validates at **load time** | `package_invalid` | — |
| 5 | recomputed canonical hash === receipt's `package_hash` | `package_hash_mismatch` | — |
| 6 | **binding resolution** — CF-2 local receipt + CF-6 verdict + CF-8 record each present, intact, for this hash, hash-matching the live receipt; `free_text_digest` + `review_id` match | `*_binding_mismatch` / `free_text_digest_mismatch` / `not_a_live_candidate` / … | F1, F3 |
| 7 | live registry valid + this hash eligible (not revoked, not expired) + points at this `live_approval_id` | `invalid_live_registry` / `not_live_approved` / `live_approval_id_mismatch` | F6 |
| 8 | a **persisted** `highestSeenEpoch` is supplied AND registry `revocation_epoch` >= it | `epoch_source_unavailable` / `registry_epoch_rollback` | F4 |
| 9 | `staging_verified` true (defense-in-depth; step 3 already requires it) | `not_staging_verified` | F9 |

Success returns a **defensive copy** of the package, `live_world_authorized: true`, and the epoch — and is
reachable **only** when the machine is explicitly driven (a test parameter), never as shipped.

> **Enablement precondition (F4).** `highestSeenEpoch` has **no default** — defaulting it to `0` would make
> the rollback control fail-OPEN. Any future enablement MUST wire a **persisted** highest-seen epoch source;
> the loader refuses (`epoch_source_unavailable`) without one. Step 9 is intentionally unreachable
> defense-in-depth (a `false` `staging_verified` already fails at step 3).

## Binding resolution at load time (F1) — never trust a stored conclusion

The live receipt records the **hashes** of the prior artifacts. The loader does not believe them; it is
GIVEN the actual artifacts and **re-resolves** each one now:

```
local_receipt_hash         ← recompute receiptHash(localReceipt); require operator_approved_local + same package_hash
hive_verdict_receipt_hash  ← recompute the CF-6 receipt hash; require kind=hive, intact, verdict=valid, same package_hash
free_text_digest           ← the CF-8 record's digest of the screened display_name/package_id/operator_note (plan F3)
human_review.review_id     ← the CF-8 record's review_id; the record must be a live candidate, not revoked
```

A swapped artifact, a different package, or a post-review free-text edit all break a binding and fail.

## Live artifacts (separate from CF-2)

- **`creator_live_approval_receipt`** (`live-approval-receipt.mjs`): the only artifact that carries
  `live_world_authorized: true` at the receipt layer. `buildLiveApprovalReceipt` **derives** that boolean
  from a real CF-8 `approved_for_live_candidate` with cleared free text — there is no input to force it.
- **`creator_approved_live_packages`** (`live-registry.mjs`): the live allowlist. Hash-sealed
  (`registry_hash`), **monotonic** `revocation_epoch`, per-entry `revoked` + `expires_at`.
  `resolveLiveApprovedPackage` returns an entry only if `operator_approved_live` + `live_world_authorized`
  + not revoked + not expired.

## Files

```
arcade/creator/approval/live-approval-receipt.mjs   creator_live_approval_receipt: build + strict validate (F7 kind-first)
arcade/creator/approval/live-registry.mjs           creator_approved_live_packages: build + validate + resolve (epoch/TTL/revoke)
arcade/creator/approval/live-loader.mjs             the closed machine (SHIPPED DISABLED) + kill-switch + JSON guard
arcade/creator/approval/live-loader-cli.mjs         operator boundary check: a perfect chain is rejected as shipped
```

No Worker/DO change. All under `arcade/creator/**` → excluded from the curated client upload.

## Validation

```
node --test tests/creator/live-loader.test.mjs   # 18 adversarial: shipped-disabled rejects a perfect chain;
                                                  #   tamper / digest / epoch / binding / kind / kill-switch /
                                                  #   expiry / revoke / not-registered / JSON-elision all fail
node arcade/creator/approval/live-loader-cli.mjs   # operator boundary check (exit 0 = boundary holds)
node --test tests/creator/*.test.mjs                # creator unit, green
node --test tests/arcade/*.test.mjs                 # 608 arcade unit (unchanged), green
node --test tests/creator/curated-upload.test.mjs   # CF-7 excluded from curated upload
node tests/arcade/check-production-config.mjs        # PASS; node scripts/check-city-build-size.mjs — within budget
cd workers/arcade && wrangler deploy --dry-run      # byte-identical (200.81 KiB) — no Worker change
```

### Acceptance criteria (all proven by the suite)

A valid CF-8 candidate + live receipt + live registry **still cannot load while the flag is false** ·
tampered body fails · mismatched `free_text_digest` fails · stale/revoked/expired fails · wrong receipt
kind fails · registry rollback below the monotonic epoch fails · missing binding resolution fails · a
CF-6-verdict-only package fails · an unreviewed package fails · a reviewed-but-not-live-registered
package fails.

## What CF-7 is NOT

It does not enable live load, deploy, upload, create accounts, or introduce economy/ownership/rent/
marketplace/payout/token/transfer. It does not start Phase 8 or touch HiveWorld. The live world stays
closed; CF-7 is the closed, tested machine that guards the door.
