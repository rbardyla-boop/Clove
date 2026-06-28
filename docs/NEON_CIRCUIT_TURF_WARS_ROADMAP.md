# Neon Circuit — Turf Wars Roadmap (Decentralized Hive-Network)

> **Status: DRAFT / DESIGN-ONLY. Not authorized to build. Not committed.**
> Vision: *"Make it like Clash of Clans, make it old-school GTA — no central servers."*
> This roadmap **deliberately supersedes** the current Gameplay Charter (which bans raiding/loot/ownership/
> economy). It is **charter-illegal by construction until a counsel-ruled superseding ADR clears** (Phase 0).

## 1. The vision

A persistent, decentralized, top-down **GTA-80 city** where every player **hosts their own block** as a
self-hosted node, builds and dresses it up (Clash-of-Clans base-building energy), and competes for
**territory** through an **async attack / defend / upgrade** loop with crews — **peer-to-peer, no central
authority** computing or validating world state.

The genre fit is native, not bolted on: **CoC attacks are already async against a frozen base snapshot**, so a
signed-snapshot P2P substrate is arguably the *purest* expression of the form.

### Signature scenes (the feel)
- **The Tag War** — roll up to a contested corner; two crews' neon tags fight for the wall, each tag's
  glow/size = that crew's current district attention. You claim turf by **out-drawing, never defacing.**
- **The Crowd-Pull (the "attack")** — your crew's signal-runners stream toward a defender's published layout;
  their marquees "pull" the crowd, the meter swings live, and it saves as a **shareable replay anyone can
  re-watch *and* any peer can cryptographically re-verify.** CoC attack-replay energy, zero felony.
- **The Block-Raising** — base-building as street dressing: place signage, prop-density, light rigs and watch
  your corner go from a dim lot to a packed, glowing, unmistakably-*yours* block.
- **The Night Map** — the P2P city lights up by control: your crew's corners glow your color, contested corners
  flicker, sleeping/unhosted blocks sit dim until someone caches their snapshot. GTA1 minimap × CoC clan map.
- **The Offline Defense Reveal** — log back in, replay the crowd-pulls that ran against your snapshot while you
  slept, clear the cosmetic scorch, re-dress in response. Async defend loop; **nothing real is lost.**

## 2. The architecture (no central servers)

**Authority = replay determinism over signed, content-addressed data.** There is no authority node.

- **Identity** = a per-device **ed25519 keypair** (player id = pubkey hash). The keypair *is* the identity —
  no accounts, no PII. (Web Crypto `subtle` is already used for SHA-256 in `package-hash.mjs`; signing is a
  one-API extension, **no new dependency.**)
- **State** = each block is an append-only, hash-chained log of **signed CRDT ops** `{prev_hash, seq, op, sig}`
  with a **closed, enum-only** op vocabulary (`build_structure`, `upgrade_structure`, `collect_resource`,
  `publish_base_snapshot`, `record_attack_result`, `join_crew`).
- **A base snapshot** = the canonical-JSON fold of that log at a seq, **content-addressed by sha256** and
  host-signed. Change one byte → different hash → signature no longer matches. Tamper-evident by construction.
- **The world map** = the *union of every signed snapshot a node has cached* — a peer-to-peer patchwork, not a
  server-owned map.
- **The current Cloudflare Worker+DO mesh is NOT discarded** — it is **demoted** from authority to *one
  optional, swappable relay / cache / DHT-bootstrap* that holds only signed public snapshots it cannot forge
  (it has no signing key). Swap it for a libp2p mesh or a friend's pin and correctness is unchanged, because
  correctness lives in the signatures and the deterministic fold — never in the relay.

### Anti-cheat (the keystone)
An attack outcome is a **pure deterministic function of `(signed base graph, signed attack plan, shared seed)`**
via the existing seeded `free-sandbox-interpreter.mjs`. So **optimistic execution + fraud-proof challenge**
works with no referee: the raider posts a signed result; any peer who re-runs the identical inputs and gets a
different outcome publishes a **one-op fraud-proof** citing the divergent step, and the cheater's result is
dropped by every honest fold. Forged/over-minted resources simply **fail to fold** (the ledger's CONSERVE /
NO-NEGATIVE / capped-MINT / capped-XFER invariants reject them identically on every peer).

### Availability (attack an offline host)
Peers and volunteer caches hold the host's **signed snapshot**; since you attack a *snapshot*, the host need
not be online, and signature + content-hash make a cached copy as trustworthy as the original. Discovery via a
content-addressed DHT (`snapshot_hash → holders`). The outcome op syncs to the host's log when it next folds.

## 3. The economy (minors-safe by construction)

- Two soft, **non-cash** counters (e.g. *flux*, *cores*) produced by structures over wall-clock time, spent on
  upgrades + timers (the return-visit driver), all clamped by the shipped bounded-mint/cap ledger invariants.
- Territory + crew rank are **bounded, decaying display gauges** (Host-Rank shape) — signal *current activity*,
  never hoardable/sellable wealth.
- **Hard-banned by the validator:** real money, payments, cash-out, transferable/sellable balances,
  player-to-player asset transfer beyond a capped conserved in-fold territory signal, permanent person-bound
  titles.
- **"Losing" is reversible/cosmetic only** — a raided base shows a host-clearable scorch overlay; the signed
  snapshot is **never mutated or deleted** by an attacker. A loss costs nothing real and is fully recoverable.
- **Cut from CoC (and why):** real-money/IAP/gem economies, gambling/loot-box mechanics, permanent destruction,
  any transferable/cashable balance — each is a regulated-economy or addictive-design risk aimed at minors.

## 4. The hard truth: safety without a central choke point

**This is the dominant risk and it does NOT fully solve in pure P2P.** Signatures prove *origin*, not
*policy-compliance* — a perfectly-signed base can still be unsafe for a child — and decentralization removes
the central server that today allowlist-filters every minors-facing interaction.

**The honest design:** safety does **not** decentralize to a trustless free-for-all. We *move and shrink* the
choke point into a hybrid — *"no single-company server, but a small accountable **non-central** trust root."*
Four stacked layers:

1. **Closed-vocabulary by construction** — a base is data-only, every value an enum token (palette/structure/
   sign symbols); no free text, URLs, images, or code. *Almost no UGC attack surface to moderate.* (Biggest lever.)
2. **No P2P chat / DMs / free text at all** — crew comms are canned/templated tokens only, so the primary
   grooming vector simply doesn't exist. (The charter already bans chat.)
3. **Dark-by-default client render-gate** — a client refuses to *draw* any snapshot lacking a valid, hash-bound
   human-approval receipt for that exact content hash (deny-by-default, fail-closed), checked against a gossiped
   signed revocation list with a freshness/max-age expiry.
4. **Signed moderation as a non-central M-of-N quorum** — the CF-8 review queue + Consent Anchor generalize from
   one operator to a *k-of-n* of vetted reviewer keys issuing a signed, revocable, hash-bound "cleared for
   minors-facing visibility" token; revocation propagates as a signed op; default visibility is **opt-in /
   default-deny** (a fresh minor's node renders only operator-seeded + crew-vouched blocks).

**Residual risks we are NOT hiding:** the client render-gate is bypassable by a patched client (so publishing
must *also* only gossip approved snapshots); revocation/takedown can't guarantee a hard delete of bytes already
on a device; the reviewer quorum is a concentrated (though non-central) trust root. **These are exactly what
Phase 0 counsel must rule on.**

## 5. Phased plan

> **Phases 1–4 are LAB-ONLY** (denylisted from prod upload, like `agent-ledger.mjs` today — zero live/minors
> exposure). They are safe to build **in parallel** with the Phase 0 counsel review. Only the **live pilot
> (Phase 5)** truly waits on the legal ruling. This is how we get real momentum without legal risk.

| Phase | Name | Goal | Gate | Risk |
|------|------|------|------|------|
| **0** | **Legal + Safety-Model gate** (blocking, NO code) | Counsel ruling on minors + decentralized UGC + competitive economy + staked loss + no central choke point; a charter-superseding ADR. | `AUTHORIZED: COUNSEL RULING + CHARTER-SUPERSEDING ADR SIGNED` | HIGH |
| 1 | Signed-CRDT substrate (lab) | ed25519 signed-op logs + content-addressed snapshots + bounded non-cash economy, proven by the seeded harness. | `AUTHORIZED: SIGNED-CRDT SUBSTRATE PROVEN IN LAB` | LOW |
| 2 | Deterministic attack + anti-cheat (lab) | Interpreter → verifiable attack simulator; optimistic-exec + fraud-proof under hostile conditions, no referee. | `AUTHORIZED: VERIFIABLE-REPLAY ANTI-CHEAT PROVEN` | MED |
| 3 | Non-central availability fabric (lab→staged) | Offline host's base seeable/attackable via swappable helpers without recreating central authority. | `AUTHORIZED: NO-CENTRAL-AUTHORITY AVAILABILITY EXERCISED` | MED |
| 4 | Non-central safety gate + red-team (lab) | M-of-N signed clearance token + render-gate + gossiped revocation; adversarial red-team; honest residual-risk report. | `AUTHORIZED: SAFETY MODEL RED-TEAMED + COUNSEL RE-SIGN` | HIGH |
| 5 | Gated live pilot (single block, age-gated closed cohort) | Flip `LIVE_WORLD_LOADER_ENABLED` for ONE block behind the clearance gate; instrument retention + abuse. Display-only control overlay first, attack loop last. | `AUTHORIZED: GATED PILOT SIGN-OFF (OPERATOR + COUNSEL)` | HIGH |

### Phase 0 — the exact checklist counsel must clear
Q1 Is a no-central-server, minors-facing UGC + competitive network defensible at all, and under what mandatory
controls? · Q2 Does a signed-reviewer-quorum + dark-by-default render-gate satisfy COPPA / UK AADC / DSA-style
duty-of-care given no central server? · Q3 Who is the legally responsible controller for takedown/CSAM when
content lives on minors' own devices? · Q4 Is gossiped signed-revocation + freshness-expiry an adequate
takedown, or does the law require a hard guaranteed delete we cannot provide in P2P? · Q5 CSAM/illegal-content
liability for content-addressed data cached on peers we don't control. · Q6 Is a decaying non-cash territory
ladder a regulated economy / addictive pattern for minors? · Q7 Is keypair-only identity compatible with
required age-assurance? · Q8 Does *any* attack/raid/loss framing survive, or must even reversible/cosmetic loss
go? · Q9 Liability for a patched client that bypasses the render-gate. · Q10 Cross-border: snapshots replicated
to peers in unknown jurisdictions.
**Deliverable:** a counsel memo + a charter-superseding ADR that authorizes a bounded version (naming mandatory
controls) **or kills it**, plus the conservative fallback (mandatory swappable clearance gate, default-deny
minors visibility, canned-only comms, reversible-only loss).

## 6. What this reuses (mostly wiring proven parts, not net-new invention)

- `hiveworld-agents/agent-ledger.mjs` + `attention-ledger.mjs` — convergent CRDT fold + AE/AA invariants →
  the signed op-log + resource/loot/territory ledger.
- `hiveworld-agents/attention-evidence.mjs` (C1–C10) + `attention-stress.mjs` (S1–S8) — seeded adversarial
  harness → the anti-cheat proof rig.
- `arcade-builder/free-sandbox-interpreter.mjs` — deterministic data-only interpreter → the **verifiable attack
  simulator** (runs *data*, not creator code).
- `validator/package-hash.mjs` — canonical-JSON sha256 via Web Crypto `subtle` → content-addressed snapshots;
  same API extends to ed25519 identity/signing with **no new dep**.
- `arcade-sandbox/sandbox-runner.mjs` (null-origin) — runs the interpreter on untrusted base data, zero new
  trust surface.
- `approval/approved-loader.mjs` + `LIVE_WORLD_LOADER_ENABLED` double-lock — deny-by-default hash-match boundary
  → the per-client render-gate; the disabled live loader is the production migration gate.
- `hive-validation/hive-service.mjs` — separates VALIDATION / APPROVAL / CONTENT-CLEARANCE / LIVE-AUTHORIZATION
  ("decentralizing review must never decentralize trust by default") — the keystone safety principle.
- `moderation/review-queue.mjs` (CF-8) + Consent Anchor plan — generalize one operator → signed M-of-N quorum +
  revocable clearance token.
- `city/city-host-rank.mjs` — shipped bounded *decaying* recognition gauge → the template for decaying,
  non-hoardable territory/rank.
- `workers/arcade` Worker+DO mesh — **demoted** to one optional swappable signed-snapshot relay (no signing key).

## 7. Open decisions (need the operator)

- **Sybil resistance** — keypairs are free to mint; ladder-gaming / fake crews need a uniqueness story
  (vetted-key web-of-trust, rate-limited onboarding, or proof-of-work) that itself risks re-centralizing trust.
- **M vs N** for the reviewer quorum; key-rotation / threshold scheme; behavior on signer-key compromise.
- **Fraud-proof liveness** — optimistic execution assumes ≥1 honest peer re-verifies in the challenge window;
  if the victim is offline and nobody re-runs it, a fraudulent outcome could settle (needs verifier incentive
  or relay-side spot-check).
- **Revocation freshness window** — max-age before a client fails closed (takedown latency vs offline play).
- **Crew comms** — zero-text canned tokens only, or a tightly-bounded reviewed template set?
- **Transport** — libp2p vs a minimal custom gossip over the existing relay; is the Worker+DO relay the default
  bootstrap at launch?
- **Pilot audience** — adults-only/closed-cohort indefinitely until the safety residue is bounded, or a defined
  path to a minors-facing release at all?

## 8. Honest bottom line

The build is mostly **wiring already-shipped machinery** — the CRDT folds, the deterministic interpreter, the
adversarial harness, the approval/render-gate, the closed-vocab creator pipeline all exist. The *engineering*
is tractable and can start in the lab now. The **gating risk is not engineering — it is minors-safety law in a
no-central-server topology**, and the honest expected outcome is that counsel either bounds it heavily or kills
the competitive layer. The roadmap is sequenced so that ruling **wastes no build**: lab phases prove the
substrate in parallel; nothing minors-facing goes live until Phase 0 + Phase 4 clear.
