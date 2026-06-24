# Neon Circuit — Release Plan (canonical roadmap)

> This is the canonical roadmap. It replaces the stale "tiny-sprint build pack" thinking
> (which kept re-proposing already-shipped work) with the current reality. When a proposed
> sprint conflicts with this document, this document wins.

## 1. Status summary

- **Neon Circuit is live as a B=9 public arcade city** at `clovelearn.io/arcade/city/`.
- The next **shippable** milestone is **Public Arcade v1** — a short release-hardening track (no
  economy expansion, no live UGC, no new infrastructure).
- **Full Platform v1** is **gated by counsel/operator decisions**, not by missing code. It cannot
  honestly be called "done" until the economy legal/safety review (PR #87 packet) is answered.
- **Attention Routing** is allowed **only as internal, report-only telemetry** — never a
  coin/token, never connected to arcade tickets, never minors-facing reward.

Two distinct finish lines, only one of which is a coding gate:

```
PUBLIC ARCADE v1   = a coding / release-hardening gate   → reachable in a short track (~85% done)
FULL PLATFORM v1   = a decision / legal gate             → blocked on the counsel answer
ATTENTION ROUTING  = an internal-telemetry track          → report-only, never a coin
```

## 2. Track 1 — Public Arcade v1 (active release track)

A short release-hardening track. None of it touches economy expansion, CF-7, accounts, chat,
marketplace, or user-generated content. Owner in brackets — the split matters: the sandbox cannot
reach Cloudflare or hold two devices, so upload/toggle/physical-proof are operator actions.

```
A2  Pulse Tap feel/juice pass            [Claude]   BUILT — branch feat/pulse-tap-feel-juice, PR #88 (open)
A3  Signal Sprint readability/input pass  [Claude]   lane-slide tween, collect/noise audio+haptic,
                                                      pulse/noise contrast, distance in HUD, countdown
A4  Neon Grid feedback/pattern clarity    [Claude]   per-cell Simon tones, brighter reveal, your-turn cue
CF  Disable Cloudflare Web Analytics/RUM   [Operator] dashboard toggle — clears the blocked-beacon console
    auto-injection                                    error AND honors the "no telemetry" positioning.
                                                      Do NOT widen the CSP to allow the beacon.
A5  Production static upload + smoke        [Operator uploads · Claude preps/verifies the curated package]
7F  Phone + desktop physical proof          [Operator] runbook already merged; the one test only the
                                                      operator can run (two real devices)
A6  Public "what is live" page / release    [Claude]   honest public description of Arcade v1
    note
```

A2 introduced a tiny shared `arcade/cabinet-juice.mjs` (client-only audio/haptic helper, no economy
coupling), so A3 and A4 are smaller — they inherit it.

### Exit criteria for "Neon Circuit Arcade v1 — public"

```
[ ] B=9 city live
[ ] Three polished cabinets live (Pulse Tap, Signal Sprint, Neon Grid)
[ ] No Cloudflare telemetry beacon injection
[ ] 7F phone + desktop proof passed
[ ] Production smoke clean
[ ] Economy behavior unchanged
[ ] CF-7 live loader remains disabled
```

## 3. Track 2 — Full Platform v1 (parked, decision-gated)

**Blocked by external counsel / operator decisions. This is not a coding gate** — the audit found
the scaffolding (CF-1..CF-8, sandbox, moderation queue) largely exists; the blocker is policy/legal.

The single unlock is: **counsel answers the PR #87 §3/§7 questions**, and the operator records each
YES / NO / MODIFY outcome as an ADR in `docs/PROJECT_CHARTER.md`.

Frozen until that decision lands (none of these may be built ahead of it):

```
CF-7 live loader enablement
Public creator publishing (UGC into the live world)
Creator packages touching rewards / economy
Economy expansion (new persistence, identity, prize, or reward surface)
Marketplace
Ownership
Transfer / cash-out
Economy copy-risk changes
Per-player reset / delete implementation
Charter reconciliation ("session-scoped" -> verified persistent reality)
```

Rationale (facts, not a legal conclusion): the persistent, non-cash ticket/prize economy is live,
public, playerId-keyed, and minors-reachable, and has not had a documented legal review. That does
not make it impermissible — it means it must not be expanded blindly. See
`docs/PHASE9A5_ECONOMY_LEGAL_SAFETY_AUDIT.md` and `docs/PHASE9A5_COUNSEL_REVIEW_PACKET.md`.

## 4. Track 3 — Attention Routing Index (internal telemetry only)

The decentralized-compute-routing idea is endorsed **as internal telemetry**, with a hard product
decision recorded here.

### Decision (recorded)

```
No coin.
No token.
No tradable / redeemable / earnable asset.
No cash-out.
No connection to arcade tickets.
No user-visible balance.
No minors-facing reward.
```

A tradable asset would convert an internal routing signal into a financial product — pulling in
money-services-business, securities, stored-value, and minors considerations on a surface that is
already public and counsel-gated. That path is the **last** path, not the prototype path.

### Allowed v0 (report-only)

```
Internal report-only telemetry
Surface-level demand scoring (per game / block / cabinet — not per-user profiles)
Compute routing signal (where inference / cache / shards should go)
Pseudonymous / aggregated
Short retention
No payout
No exchange
No public claim
```

Shape (report-only first): signed `AttentionEvent`s aggregate to a per-surface `ComputeRouteScore`
(attention weight + latency pressure + queue depth + trust + safety + cost) that drives compute
allocation. A `NodeWorkOrder` carries `payout_policy: none` in v0. Privacy note: because the arcade
is minors-reachable, keep attention **surface-aggregated and pseudonymous** — do not build per-user
(least of all per-minor) attention profiles. Any later node payment goes via invoices or closed
internal compute-credits; tokenized settlement only after separate legal / KYC / AML / tax / minors
design.

This track is **independent** of Tracks 1 and 2 (report-only routing telemetry is not an economy
surface), so it can be built in parallel whenever the operator chooses.

## 5. Dependency diagram

```
NOW ──► Track 1 (A3 → A4 → CF toggle → A5 → 7F → A6) ──► PUBLIC ARCADE v1   ◄── near-term shippable
   │
   ├──► Track 3 v0 (report-only attention routing) ── parallel · optional · no economy coupling
   │
   └──► Track 2  ⏸ BLOCKED on counsel answer ──► (CF-7 / UGC / economy decisions) ──► FULL PLATFORM v1
```

## 6. Rejected / stale work (do not propose these)

```
Re-build 7A / 7B / 7C / 7D / 7E — already shipped on main.
Re-build CF-1..CF-6 / CF-8 — already shipped on main.
Build a coin / token — rejected (Track 3 decision).
Enable CF-7 before counsel — rejected (frozen).
Add a new ticketed game before counsel — rejected (economy expansion).
Live creator publishing before counsel — rejected (frozen).
Connect attention telemetry to arcade tickets / rewards — rejected.
```

## 7. Next allowed actions

```
Push / PR A2 (done — PR #88).
Add this release plan (this doc).
Run A3 after the A2 base is settled (ideally after A2 merges, since A3 reuses cabinet-juice.mjs).
Run A4 after A3.
Operator: disable Cloudflare Web Analytics injection (dashboard).
Operator: static upload after the polish sprints, then production smoke.
Operator: run the 7F phone + desktop proof.
```

---
*Canonical roadmap. Public Arcade v1 is a coding track; Full Platform v1 is a decision/legal gate;
Attention Routing is internal report-only telemetry, never a coin. Keep the platform and coin tracks
parked until the counsel/operator decisions land.*
