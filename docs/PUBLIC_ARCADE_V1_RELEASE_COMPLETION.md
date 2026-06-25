# Public Arcade v1 + Local Maker v0 Release Completion

**Status date:** 2026-06-25
**Main commit at completion:** `50cc288` (Merge PR #97 — local share import-export polish)
**Production host:** `clovelearn.io` served by the Cloudflare **Workers static-assets Worker `wild-hat-6257`** (not Cloudflare Pages; not the Durable Object Worker `neon-arcade-mesh-production`). Static client uploads are done via the Cloudflare dashboard "Upload static files"; **no Worker/DO code was redeployed** for any client upload in this release.

This is a **launch record**, not a feature change. It records what is live, what was proven, and what remains blocked.

**Provenance tags used below**
- `[machine-smoke]` — verified by a headless browser smoke driving live `clovelearn.io` (2026-06-25), or by repo unit/config checks.
- `[operator-attested]` — verified by the operator on real devices (recorded here as attested, not independently re-run in this note).
- `[code/config]` — verified by reading shipped source or build configuration.

---

## 1. Release status

| Capability | State |
|---|---|
| Public Arcade v1 | **LIVE + PROVEN** |
| Local Maker v0 | **LIVE + PROVEN** |
| Playable maker input | **LIVE + PROVEN** |
| Local share / import-export | **LIVE + PROVEN** |
| Safe retention loop | **COMPLETE** |

The production-proven retention loop:

```
open maker
→ pick template
→ tweak settings
→ test in sandbox
→ play with intended input
→ copy NCLOCAL1 share code
→ second browser/user pastes code
→ play locally
```

Release boundary (all enforced):

```
No server upload.   No account.          No live publishing.   No ticket reward.
No economy.         No CF-7.             No marketplace.        No coin/token.
No production city insertion.
```

---

## 2. What is live

All reachable on `https://clovelearn.io`:

- Homepage entry → arcade/city
- `/whats-live.html` (clean-URL `/whats-live`)
- `/arcade/city/` — the Neon Circuit city (**B=9**, 9 blocks)
- Pulse Tap · Signal Sprint · Neon Grid (the three polished cabinets)
- `/arcade/creator/local-maker/` — the Local Maker hub
- Arcade Builder (`/arcade/creator/arcade-builder/`)
- Arcade Sandbox (`/arcade/creator/arcade-sandbox/`)
- Local `NCLOCAL1` share / import flow (builder copy → sandbox paste)

---

## 3. Public Arcade v1 — proof

- `[machine-smoke]` B=9 city live: all 9 block ids present in the served `arcade/city/city-block.mjs` — `downtown-01, harbor-02, skyline-03, foundry-04, nexus-05, garden-06, aurora-07, relay-08, lumen-09`.
- `[machine-smoke]` Homepage → `/whats-live` (307 → 200) → city reachable.
- `[machine-smoke]` Three polished cabinets reachable (HTTP 200): `arcade/pulse-tap-game.js`, `arcade/signal-sprint-game.js`, `arcade/cabinets/neon-grid/neon-grid-game.mjs`.
- `[operator-attested]` Phone + desktop two-device verification of the live city (travel, routing, district events, block stewardship) — operator devices. The two-device multiplayer proof procedure is documented in [`NEON_CIRCUIT_PHASE7F_MULTIPLAYER_PROOF_RUNBOOK.md`](NEON_CIRCUIT_PHASE7F_MULTIPLAYER_PROOF_RUNBOOK.md).
- `[code/config]` Ticket receipts belong **only** to official production cabinets; no creator/maker package can mint a ticket (see §7).
- `[code/config]` Static upload path proven through `wild-hat-6257`; the Durable Object Worker was **not** redeployed for static client uploads.

---

## 4. Local Maker v0 — proof

- `[machine-smoke]` Local Maker hub loads in production and links **only** Builder + Sandbox (no publish / upload / account / marketplace links).
- `[code/config]` Blocked creator surfaces remain absent and unlinked from the public maker: approval, moderation, live-loader, block/layered/district/map editors, hive-validation, arcade-sdk, creator-corner, and `arcade-studio` are all excluded from the curated upload (the public creator allowlist is exactly **16 files**).
- `[machine-smoke]` Builder produces valid local packages from the fixed closed-token templates; the importer gates every build.
- `[machine-smoke]` One-click **TEST IN SANDBOX** works; the sandbox auto-loads the same-origin handoff and re-gates it on arrival.
- `[machine-smoke]` Playable input: Tap / Hold / Swipe / Drag are forwarded to the game via a transparent overlay over the cabinet (the prior production smoke scored Tap=7, Hold=4, Swipe=1, Drag=4, fallback Tap button=7).
- `[machine-smoke]` Result remains an **untrusted local proposal** (`server_authorized:false`); no ticket/economy field.
- `[machine-smoke]` Debug hook (`window.__cf4_sandbox`) is **absent** on the production URL.

---

## 5. Local share / import — proof

- `[machine-smoke]` Builder produces a `NCLOCAL1:<base64>` share code (shown only when the build is VALID), plus a copyable summary; **Copy share code** and **Copy summary** place the correct text on the clipboard.
- `[code/config]` The share code carries **only** the local `{manifest, files}` package data — it is a local package share code, not a URL, link, token, or proof of ownership.
- `[machine-smoke]` A **second browser/session** can paste the code into the Sandbox; the imported game runs locally.
- `[code/config]` The Sandbox **decodes and shape-validates before running**: malformed/oversized/params-only input is rejected with a readable error and **no game runs before validation**. `builder_params` is never treated as executable state.
- `[machine-smoke]` The local **package fingerprint matches** across builder and sandbox (identical canonical SHA-256), so two people can confirm they are testing the same local build.
- `[machine-smoke]` Garbage paste → readable error, no iframe mounted.

---

## 6. Trust boundary

```
Builder creates data only — it never runs the generated game.
Sandbox distrusts imported data.
Sandbox re-validates through importArcadePackage.
Game runs in a null-origin iframe (sandbox="allow-scripts"; child CSP default-src 'none').
Result is local / untrusted.
server_authorized = false.

No creator package enters the production city.
No creator package earns tickets.
No creator package touches ledger, balance, prizes, receipts, or redemption.
```

The same gate applies to **every** load path — one-click handoff, bundled sample, restart, paste, and file import all route through `run()` → `importArcadePackage` before anything executes.

---

## 7. What remains blocked

These are **not** enabled by this release:

- CF-7 live loader
- Live creator publishing
- Creator-made ticketed games
- Marketplace
- Ownership
- Transfer / cash-out
- Coin / token
- Server-backed share links
- Accounts
- Cloud storage
- Public approval / moderation / live-loader surfaces
- `arcade-studio` public exposure
- Creator packages entering the live city

---

## 8. Full Platform v1 status

Full Platform v1 remains **parked behind counsel/operator decisions**. This release does **not** resolve the economy/legal gate. The completed local-maker loop is a **safe retention bridge**, not live UGC publishing. The single unlock for Full Platform v1 is counsel answering the open economy questions, after which the operator records the corresponding ADRs.

---

## 9. Attention Routing status

Attention Routing remains **internal, report-only telemetry only**:

```
No coin.    No token.    No payout.    No user-visible balance.
No arcade-ticket coupling.    No public reward claim.
```

This was an explicit operator decision and is independent of Tracks 1 (Public Arcade) and 2 (Full Platform).

---

## 10. Production smoke summary

Headless browser smoke against live `clovelearn.io` (2026-06-25), run twice deterministic:

- Homepage → whats-live → city works.
- B=9 city verified (9/9 blocks live).
- Pulse Tap / Signal Sprint / Neon Grid reachable.
- Local-maker hub verified (only Builder + Sandbox; boundary copy local-only / no-upload / no-tickets).
- Builder share code + fingerprint + Copy share code + Copy summary verified.
- Second-browser paste/import verified (runs, fingerprint matches, untrusted-local).
- Playable input verified (overlay forwards gestures to the imported game).
- Bad import rejected safely (readable error, no game runs).
- No server / WebSocket / economy call in the maker flow; no app console errors; debug hook absent on the production URL.

Repo checks at completion commit `50cc288`: unit suite green, production-config check PASS, city build-size check PASS.

---

## 11. Trust-boundary one-line summary

> A creator can make, play, copy, share (as local text/file), and replay a local arcade game in another browser — **with no server, account, ticket, economy, live-publish, or production-city path.**

---

## 12. Remaining non-feature cleanup (parked, not release blockers)

- Repo test-script / `package.json` hygiene (e.g. `npm run test:unit` is the canonical `*.test.mjs` suite; the `*.spec.mjs` browser smokes require their `run-*.sh` harnesses — running them bare reports env-gap failures that are not regressions).
- Temporary release worktree cleanup under `/tmp/neon-release-worktrees/`.
- Optional public-facing release note for visitors.
- Optional CR1D production-proof screenshot archive.

---

## Cross-references

- [`RELEASE_PLAN.md`](RELEASE_PLAN.md) — the two-finish-line plan (Public Arcade v1 vs Full Platform v1).
- [`NEON_CIRCUIT_PHASE7F_MULTIPLAYER_PROOF_RUNBOOK.md`](NEON_CIRCUIT_PHASE7F_MULTIPLAYER_PROOF_RUNBOOK.md) — two-device multiplayer proof procedure.
- [`CREATOR_FOUNDATION_CF4_ARCADE_IMPORTER.md`](CREATOR_FOUNDATION_CF4_ARCADE_IMPORTER.md) — the importer gate every load path passes through.
- [`PROJECT_CHARTER.md`](PROJECT_CHARTER.md) — architectural decision record.

**Checkpoint:** Public Arcade v1 shipped · Local Maker v0 shipped · safe retention loop complete · Full Platform v1 still parked behind counsel/operator decisions.
