# Neon Circuit — Creator Pipeline Roadmap (CF-1 … CF-8)

**Status:** charter / roadmap. **Plan-only — describes the long-term creator path; implements nothing new.**
**Parent:** `docs/NEON_CIRCUIT_GAMEPLAY_CHARTER.md` (Sections 14–16). **Boundary source:** CF-2/CF-3 docs.

## North star

> **Deep, expressive, alive-feeling Neon Circuit customization — without open-UGC risk.**
> (Depth comparable to what genre players know from heavily-customizable city games, but under a far
> narrower theme and a closed pipeline.)

Many distinct blocks and (eventually) cabinets that feel alive, delivered **without** the openness of
arbitrary-asset/arbitrary-script customization games. Every step keeps the same rails:

```
closed token sets            procedural layers (original visuals, no imported art)
package validation           hash receipts (tamper-evident, hash-bound approval)
Hive validation              deny-by-default
no arbitrary uploads         no arbitrary scripts in packages
no external asset URLs        no live-world entry without explicit, human-cleared approval
```

The invariant, unchanged from CF-1 and made structural in CF-2, that every phase below preserves:

```
Nothing player-authored enters the live world directly.
Everything is: local first → packaged → hash-addressed → validated → explicitly approved
              by a receipt → loaded only from an approved registry.
The live world stays closed until a phase deliberately, and reviewably, opens it.
```

## Phase-number reconciliation (read this first)

The shipped CF-2/CF-3 docs sketch a coarser forward path: **"CF-4 = tiled map viewer OR arcade
importer"** and **"CF-E = LIVE approved-hash loader."** This roadmap adopts the finer-grained
**CF-4…CF-8** below and maps the old names onto it so nothing is lost:

| Old note (CF-2/CF-3 docs) | This roadmap |
|---|---|
| CF-4 "arcade game package importer + local sandbox runner" | **CF-4** |
| CF-4 "tiled iso map viewer / multi-block compositions / asset pack" | **CF-5** |
| (new) | **CF-6** Hive validation **service** prototype |
| **CF-E** "LIVE approved-hash loader (human-cleared)" | **CF-7** |
| (new) | **CF-8** moderation + human-review queue |

`CF-E` and `CF-7` are the **same gate**. Wherever code/docs say `LIVE_WORLD_LOADER_ENABLED` or "CF-E",
read "CF-7" in this roadmap.

---

## CF-1 — Local editor + schemas + validator  ·  ✅ done (on `main`, ADR-021)

- **Goal.** A safety foundation for player content *before* any of it could become a latency/security/
  moderation/file-bloat problem: author locally → immutable data-only package → validate locally →
  canonical hash + `local_validation_only` receipt. Stops at local validation.
- **Allowed.** Data-only block/arcade packages built from a rich-but-closed token vocab
  (`creator-tokens.mjs`); offline procedural isometric preview; arcade SDK template with a strict size
  budget (≤64 KiB).
- **Blocked.** JS/URLs/external assets in packages; unknown keys (rejected, never silent-dropped); any
  submit/upload/live-load; economy/ownership/account fields.
- **Validation gates.** 26 creator unit tests + 10-check editor browser smoke; block + arcade validator
  CLIs; arcade size gate; full arcade regression + Worker dry-run byte-identical.
- **Security risks (addressed).** Code/markup smuggling, oversized files, prototype pollution → deny-by-
  default validators, deep safety scan, bounded numbers, size gate.
- **Proves it works.** Validators reject the abuse corpus and accept positive controls; the editor
  produces a deterministic hash; nothing leaves the device.

## CF-2 — Approved hash loader boundary  ·  ✅ done (on `main`, ADR-022)

- **Goal.** Make the **trust boundary itself** real and provably closed — *whether* a validated package
  may be trusted by a loader at all — and keep the creator tooling out of the production upload.
- **Allowed.** A static, local, hash-keyed **approved-package registry** + a hash-sealed **approval
  receipt**; an editor **"Approved local preview (operator)"** card running the loader in `local_preview`.
- **Blocked.** Any live-world load (`live_world` mode rejected unconditionally;
  `LIVE_WORLD_LOADER_ENABLED = false`, double-locked because `live_world_authorized: true` is itself a
  validation error); shipping `arcade/creator/**` in the curated upload.
- **Validation gates.** 64 creator unit tests at the CF-1+CF-2 subtotal (CF-1 26 + CF-2 38; the suite
  later reaches 101 with CF-3's 37) + 18-check editor smoke; curated-upload excludes creator / includes
  city; arcade regression + production-config + city-size; Worker dry-run byte-identical.
- **Security risks (addressed).** A modified/unapproved/wrong-receipt package reaching a renderer;
  tooling leaking to production → hash recomputation + registry membership + tamper-evident receipt +
  curated-upload hard-fail.
- **Proves it works.** The boundary is proven by **refusing every live-world load**; the curated builder
  copies nothing if a forbidden path would ship.

## CF-3 — Layered block customization (decals / symbols / facade slots)  ·  ✅ done (branch `2f53645`, ADR-023)

- **Goal.** The first real **depth** step toward the north star, added *only because* the trust boundary
  (CF-2) exists first. A richer, layered block model.
- **Allowed.** A NEW `block_layered` package kind: a fixed-key `layers` object across 6 dimensions
  (facade / windows / roof / lighting_zones required; sign / symbols optional), ~65 new **closed** tokens
  (decals, sign placements, window grids, roof accents, lighting zones, palette variants). `scale` is a
  **string enum** (no numeric arbitrary-value surface). Bounds: ≤12 KiB, ≤6 symbols, 1–4 unique lighting
  zones.
- **Blocked.** Free-form colors/numbers/text/images/URLs; the flat `block_style` (CF-1) contract is
  **byte-frozen**; any live-world load (`block_layered` flows through the same CF-2 loader; `live_world`
  still always rejected).
- **Validation gates.** 101 creator unit tests (CF-1 26 + CF-2 38 + CF-3 37) + a **26-row adversarial
  abuse checklist** + 20-check layered editor smoke + the CF-1/CF-2 18-check smoke; `block_style` hash
  unchanged.
- **Security risks (addressed).** Numeric-scale injection, symbol/zone DoS, constraint downgrade, spoofed/
  missing/extra fields, prototype pollution → 18 ordered deny-by-default rules reusing CF-1 primitives.
- **Proves it works.** The abuse corpus each maps to its expected rejection; a maximal legal package is
  ~1–3 KiB; the layered renderer composes closed tokens to original procedural visuals.

---

## CF-4 — Arcade package importer + local sandbox runner  ·  planned

- **Goal.** Bring **custom cabinet games** into the same local-first pipeline as blocks — author/import →
  validate → run **only** in a local sandbox. The highest-risk artifact (behavior, not just data), so the
  tightest gate.
- **Allowed content.** An arcade package that declares capabilities **deny-by-default** (empty
  allowlist), empty assets by default, strict size budget; runs behind the existing **cabinet frame
  contract** (Phase 1I) and **cabinet adapter SDK** (Phase 1J) in a local sandbox runner only.
- **Blocked content.** Arbitrary JS executed in the live world; network/storage/DOM-escape capabilities;
  external asset URLs; any live cabinet replacement; any economy/ticket/prize-value hook.
- **Validation gates.** A package-capability validator (deny-by-default) + adversarial abuse corpus
  (capability escalation, sandbox escape attempts, oversized assets); the sandbox runner must enforce the
  frame contract; arcade regression unchanged; Worker dry-run byte-identical.
- **Security risks.** Sandbox escape, capability creep, resource exhaustion, supply-chain via an imported
  package. **Mitigation:** strict CSP + iframe/worker isolation, capability allowlist, size/time bounds,
  no eval of package-supplied strings outside the sandbox; the package is data describing a constrained
  game, validated before it runs.
- **What proves it works.** A sample custom cabinet runs in the local sandbox under the frame contract;
  the abuse corpus is rejected; nothing the package does can touch the city/arcade authority or escape
  the sandbox; the importer ships nothing to production (`arcade/creator/**` exclusion holds).

## CF-5 — Tile / map viewer + city asset-pack workflow  ·  planned

- **Goal.** Compose multiple approved blocks into a **tiled isometric map** locally, and define a
  repeatable **city asset-pack** workflow — the authoring side of growing the map (Phase 8+), still
  local-only. **This is not scale-before-kernel:** CF-5 is local-composition-only and intentionally
  precedes CF-6/CF-7 because it adds **zero live-world reach** — every referenced package is approved
  by hash and never live-loaded until CF-7.
- **Allowed content.** A local tiled-iso map viewer over multi-block compositions; an asset-pack manifest
  referencing **already-approved, hash-addressed** packages from a local source; documented (not built)
  future object storage (e.g. R2) for packs.
- **Blocked content.** Live map mutation; loading unapproved packages; arbitrary external asset sources;
  baking economy/ownership into a pack; any production deploy.
- **Validation gates.** A pack-manifest validator (every referenced package must be approved-local by
  hash); a viewer browser smoke; composition bounds (tile count, pack size); curated-upload exclusion.
- **Security risks.** A pack referencing an unvetted package; path/URL traversal in pack references;
  oversized compositions. **Mitigation:** packs reference packages **by approved hash only**; closed local
  source; bounds + deny-by-default on the manifest.
- **What proves it works.** A multi-block composition renders locally from approved packages only;
  a pack referencing an unapproved hash is rejected; the viewer never reaches the network or the live
  world.

## CF-6 — Hive validation **service** prototype  ·  planned (plan-gated)

- **Goal.** Generalize the CF-2 single-operator static registry into a **reviewable validation service**
  — the "Hive" — that can accept a package, run the canonical validators, and record a hash-bound verdict,
  **without** granting any live-world trust. Prototype only.
- **Allowed content.** A service that runs the **same pure validators** (deterministic, no new trust
  surface) and produces hash-bound receipts/verdicts; a queue of submissions; read-only verdict lookup.
- **Blocked content.** Any path from a verdict to a live load (that is CF-7, separately gated); writing
  trust by default; accepting non-data packages; bypassing the validators; storing PII.
- **Validation gates.** The service must reuse the existing validators verbatim (a test asserts identical
  verdicts to the CLI); deny-by-default on submission; **quarantine** — the validating component holds no
  live-world capability; the live loader stays off (`LIVE_WORLD_LOADER_ENABLED = false`).
- **Security risks.** SSRF / injection via submitted packages, DoS by submission volume, trust-escalation
  (a verdict mistaken for live authorization), prompt-injection if any AI assists review. **Mitigation:**
  treat submissions as fully untrusted input; the reader/validator is privilege-free; rate limit; a
  verdict is never a load authorization; a separate human/actor step (CF-7/CF-8) is required before live.
- **What proves it works.** The service reproduces CLI verdicts exactly; an adversarial submission corpus
  is rejected; no verdict can, by any code path, enable a live load; load authority still requires CF-7.
- **Content-appropriateness is out of scope for automation.** The validator/Hive service is a
  structural + safety-vocab filter; it makes **no** judgement about the appropriateness of free-text
  human labels (`display_name`/`package_id`/`operator_note`). A CF-6 "valid" verdict is **never**
  content-cleared — that is solely a CF-8 human responsibility.

## CF-7 — Operator-approved **live** loader  ·  gated (this is "CF-E")

- **Goal.** The first time any player-authored package may render in the **live world** — and only behind
  a deliberate, human-cleared, separately-authorized review path. Flips `LIVE_WORLD_LOADER_ENABLED` for an
  explicitly approved hash.
- **Allowed content.** Loading a specific package whose hash is **human-approved for live**, with
  `live_world_authorized: true` semantics that **today's CF-2/CF-3 validators forbid** (they must be
  introduced here, deliberately, with their own gates) — and only for that exact hash.
- **Blocked content.** Bulk/auto live-approval; open UGC going live; any live load lacking an
  approved-for-live receipt; flipping the constant without the human-cleared path; touching arcade
  economy/ownership.
- **Validation gates.** A human review sign-off recorded per hash; the live loader rejects anything not
  approved-for-live; a full security review of the live path; staging verification before production; the
  double-lock is replaced by an explicit, auditable authority, not removed.
- **Security risks.** This is the moment the live world opens — the highest-risk phase in the program.
  Risks: a malicious approved package, approval-process bypass, replay of an old approval onto a modified
  package, moderation gaps. **Mitigation:** hash-bound live approval (modified → re-review), human in the
  loop, deny-by-default everywhere else, staging-first, and CF-8 moderation operating alongside.
- **What proves it works.** Only a specific human-approved hash renders live; every other package is
  refused; a modified package loses its approval; the path is auditable and reversible (revoke → no live
  load).

## CF-8 — Moderation + human-review queue  ·  gated

- **Goal.** The human process that *must* exist **before CF-7 authorizes its first live hash**: a queue
  where authored packages are reviewed by a human before they can be live-approved, with rejection and
  revocation. (CF-7 and CF-8 ship as one gate; the deny-by-default queue precedes the first live
  approval — the numbering is not permission to open a live loader before moderation exists.)
- **Free-text review is the core obligation.** The reviewer **must** screen every package free-text
  field — `display_name`, `package_id`, and the receipt's `operator_note` — for profanity, slurs,
  harassment, impersonation, and PII. The CF-1/CF-3 deny-regex is a **syntactic filter only**
  (markup/script/URL + economy vocab); it does **not** screen these classes, so a package named with a
  slur or a real person's name passes automated validation today. "No free-text field is live-approved
  without human content review" is a hard CF-7→CF-8 acceptance gate.
- **Allowed content.** A review queue, reviewer decisions (approve-for-live / reject / needs-changes),
  revocation of a previously live-approved hash, an audit trail; abuse reporting.
- **Blocked content.** Auto-approval to live; reviewer tools that expose PII; a queue that defaults to
  trust; bypassing review for "trusted" authors without an explicit policy ADR.
- **Validation gates.** Every live approval traces to a human decision; revocation immediately removes
  live-load eligibility; the queue is deny-by-default (unreviewed = not live); reviewer surfaces are
  privilege-scoped.
- **Security risks.** Reviewer account compromise, social-engineering an approval, moderation evasion via
  near-duplicate packages, harmful content reaching players. **Mitigation:** hash-bound decisions, audit
  trail + revocation, abuse reporting, content-safety review criteria aligned with the product's
  clinical-grade safety posture (charter Section 17).
- **What proves it works.** No package is live without a recorded human approval; revocation works
  end-to-end; the abuse/reporting path resolves to a reviewable action.

---

## Cross-phase invariants (every phase must satisfy)

```
deny-by-default                  unknown/unapproved = rejected, never silent-accepted
data-only packages               no scripts/URLs/external assets except via a gated, sandboxed phase
closed token vocab               VISUAL/STYLE depth = MORE closed tokens, never free-form style fields
bounded human-label text only    the sole free text is display_name/package_id/operator_note — length-
                                 bounded, deny-regex-screened (markup/economy only), CF-8-human-reviewed
hash-bound everything            approval is for an exact canonical hash; edit ⇒ re-review
no live load without CF-7         LIVE_WORLD_LOADER_ENABLED stays false until CF-7 opens it, reviewably
quarantine                       readers/validators hold no live-world capability; a separate actor opens
isolation from production        arcade/creator/** excluded from the curated client upload until CF-7
no economy/ownership/marketplace  never introduced by a creator phase
```

## Acceptance gates to move between phases

- **CF-3 → CF-4:** charter + kernel + this roadmap landed; CF-3 reviewed/merged; an arcade-package
  capability model designed (deny-by-default) before any sandbox code.
- **CF-4 → CF-5:** the sandbox runner enforces the frame contract and survives the escape corpus.
- **CF-5 → CF-6:** map/pack manifests reference approved hashes only and the viewer is proven local-only.
- **CF-6 → CF-7:** the Hive service reproduces CLI verdicts exactly and grants **zero** live trust; a
  full security review of the *would-be* live path is scheduled.
- **CF-7 → CF-8 (one gate):** the deny-by-default human-review queue is operational **before the first
  live approval** (not merely "before volume"); live approval is hash-bound, auditable, revocable,
  staging-verified before production; and no free-text field is live-approved without human content
  review.

*This roadmap is plan-only. It adds no creator code, no Worker/DO change, no deploy, and no production
change.*
