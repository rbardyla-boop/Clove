# Turf Wars — Public-Safe Technical Showcase Plan (DOCS-ONLY PLAN)

**Status: PLAN — DOCS-ONLY. No code, no deploy, no publish. This document plans a *non-interactive technical
showcase* envelope; it does not build, publish, or deploy anything.** It claims **no** legal approval, **no**
minors clearance, **no** production readiness, and does **not** supersede the gameplay charter. It does
**not** change the live/minors-facing posture: that path stays **BLOCKED** behind the Phase 0 counsel ruling
+ charter-superseding ADR (see `docs/TURF_WARS_PHASE0_LIVE_MINORS_UNBLOCK_PACKET.md`). `LIVE_WORLD_LOADER_ENABLED`
stays literally `false`, the curated-upload turf-wars count stays `0`, and Turf Wars stays lab-only /
prod-denylisted.

> **The key distinction this plan rests on.** The *live game* path (public access, real players, minors,
> UGC ingestion, live P2P, rendering of user content, moderation/takedown) is safety- and counsel-gated. A
> **non-interactive technical showcase** — source code, architecture diagrams, deterministic replay proofs,
> and a canned synthetic demo with **no real users, no UGC, no network, no accounts, no data collection** —
> is a portfolio/research artifact about *how the code works*, not a game anyone can play. This plan defines
> the envelope that keeps the showcase on the safe side of that line. **Actually building or publishing any
> surface below is a separate future gate (Section 10); this plan publishes nothing.**

> **Cross-references (this plan does not replace or soften any of them):** the roadmap
> `docs/NEON_CIRCUIT_TURF_WARS_ROADMAP.md`; the Phase 2/3/4 plans; the Phase 0 checklist
> `docs/TURF_WARS_PHASE0_LEGAL_SAFETY_CHECKLIST.md`; and the live/minors unblock packet
> `docs/TURF_WARS_PHASE0_LIVE_MINORS_UNBLOCK_PACKET.md`.

---

## 1. Executive framing

The live / minors-facing **product** path remains **blocked** (counsel + charter-superseding ADR). The
technical **showcase** path is **separate and narrower**, and is safe precisely because it removes everything
that triggers the gate:

- **A public explanation of the code is allowed** as a portfolio / research artifact — it describes *how the
  system works*, it is not a game.
- **No live game launch.** Nothing is playable against other people.
- **No minors-facing release.** No copy targets or invites minors; no "play now."
- **No public multiplayer / no live P2P.** No network runtime, no peer discovery, no real settlement.
- **No UGC.** No upload, no creator ingestion, no user-submitted blocks.
- **No live world loading.** `LIVE_WORLD_LOADER_ENABLED` stays `false`.
- **No claim of legal clearance.** The showcase asserts the opposite: "experimental lab prototype; safety /
  legal review required before any live use."

What makes this safe to show publicly is that it is **read-only and synthetic**: deterministic proofs and
canned traces that already exist in the lab, presented as an explanation — with **no data collected from any
viewer** and **no path from the showcase into a live runtime**.

---

## 2. Allowed showcase surfaces

Each is a *candidate* surface; building/publishing any one is its own future gate (Section 10).

- **GitHub README section** — a prose + diagram explanation of Turf Wars in the existing repo.
- **Clovelearn static "technical lab" page** — a static, non-interactive page outside the production game path.
- **Architecture diagrams** — system layers (substrate → settlement → availability fabric → safety plan).
- **Deterministic replay transcript** — a text/JSON transcript of a canned attack lifecycle (regenerated
  byte-identically from a fixed seed).
- **Pre-recorded video / GIF** — a screen capture of the lab harness running canned data.
- **Synthetic canned demo** — a read-only viewer over fixed snapshots (Section 4).
- **Test / proof matrix** — the evidence-pack claims and test counts (currently **146/146** turf-wars tests,
  within the full **1297/1297** unit suite on `main`).
- **ADR / roadmap excerpts** — quoted design rationale (Phase 1–4 plans, ADR-050/051).
- **Downloadable local-only lab instructions** — "clone, `npm run test:unit`, run the evidence packs
  locally" — explicitly local, never a hosted runtime.

---

## 3. Forbidden showcase surfaces

The showcase must **never** include any of:

- public multiplayer;
- live P2P / networked runtime / peer discovery;
- public attacks against real users;
- an upload-your-block flow;
- account / login / profile;
- chat / DM / free text;
- image uploads;
- open creator ingestion;
- leaderboard;
- public territory ownership;
- rewards / prizes / cash / marketplace;
- kids / minors-facing copy;
- "play now" / "join" call-to-action into a live mode;
- production live loader (`LIVE_WORLD_LOADER_ENABLED` stays `false`).

If any of these appears, the surface is no longer a non-interactive showcase and falls back under the Phase 0
live/minors gate.

---

## 4. Static demo strategy

A safe static demo is **read-only over fixed synthetic data** — it replays what the lab already computes; it
accepts no input that could become live.

**Hard properties (all required):**
- only **canned synthetic snapshots** (fixtures, e.g. `identityFromSeed('demo-*')`);
- only **canned attack plans** (fixed seeds);
- **no user-submitted data** of any kind;
- **no network calls** (no fetch, no websocket, no peer transport);
- **no persistence** beyond local session state, if any;
- **no remote peer discovery**;
- **no public settlement** (settlement runs only over the canned fixtures, locally);
- **no real player identity** (all identities are seed-derived demo fixtures);
- **no editable UGC** (the viewer cannot author or submit a block);
- **no upload / export-to-live path** (nothing the demo produces can reach a live runtime).

**The demo MAY visualize (all from canned data):**
- **replay determinism** — the same seed regenerates the same outcome byte-for-byte;
- **fraud-proof mismatch** — `proveFraud` flags a forged/wrong-seed settlement;
- **reversible cosmetic scorch** — bounded, self-healing, never destructive, outside `blockFingerprint`;
- **beacon / challenge-window simulation** — the post-commit beacon and finalize predicate on canned heights;
- **overlay DAG visualization** — convergent fold of a fixed entry set (reorder/dup → same fingerprint);
- **safety-quorum concept** — only as a canned conceptual illustration, never a live clearance, and **only
  if** Phase 4 has been built under its own gates **and** the visualization has its **own** explicit
  `AUTHORIZED:` line. It is **not** unlocked by this plan, nor by the Section 10 canned-replay-demo gate
  (which covers Phases 1–3 only).

---

## 5. Public copy rules

**Allowed copy (accurate to current status):**
- "experimental lab prototype"
- "deterministic local simulation"
- "technical architecture showcase"
- "no live multiplayer"
- "no user uploads"
- "no real money"
- "not a public game mode"
- "safety / legal review required before any live use"

**Forbidden copy (must never appear as a claim; listed here only so a reviewer can reject it):**
- "play Turf Wars now"
- "kids can join"
- "public decentralized game"
- "attack other players live"
- "own territory"
- "earn rewards"
- "upload your world"
- "uncensored"
- "no moderation"
- "live P2P battle"
- "production ready"

---

## 6. Repo / README plan

A concise GitHub-facing structure (prose + diagrams; no runtime):

1. **What Turf Wars is** — a research prototype of a decentralized, replay-deterministic territory game with
   no central settlement authority.
2. **What is implemented** — the lab substrate: signed-op block logs, content-addressed snapshots, a
   deterministic attack simulator + one-op fraud-proof, the beacon + challenge-window, the convergent overlay
   with keyless fraud-proof revocation, the availability fabric (24 lab modules, 9 evidence/stress packs).
3. **What is intentionally NOT live** — no live loader, no public multiplayer, no UGC, no accounts, no chat,
   no P2P network; prod-denylisted; `LIVE_WORLD_LOADER_ENABLED=false`.
4. **Deterministic proof list** — the evidence-pack claims (attack / settlement / beacon / availability /
   overlay / fabric) and the test counts.
5. **Safety boundary** — link to the Phase 0 checklist + unblock packet; "the live/minors path is blocked
   pending counsel."
6. **How to run tests locally** — `npm run test:unit` (1297/1297), run the evidence packs locally.
7. **What is blocked before public launch** — counsel ruling, charter-superseding ADR, Phase 4 safety layer.

---

## 7. Clovelearn static page plan

A static page that lives **outside** the production game path (e.g. a `/labs/turf-wars` static doc page, not
the arcade runtime):

- **Title** — "Turf Wars — Technical Lab (experimental prototype)".
- **Section outline** — what it is · architecture · deterministic proofs · canned demo · what it does NOT do ·
  safety boundary.
- **Screenshots / diagrams** — architecture + sequence diagrams (Section 8).
- **Code snippets or pseudocode** — only safe, illustrative excerpts (pure predicate signatures; no secrets,
  no live config).
- **Test badges / results** — the proof matrix (146/146 turf-wars; 1297/1297 suite).
- **No play button. No upload button. No networked runtime. No live loader. No minors-facing language.**

The page must be a **static document surface**, not wired to the live world loader, the curated upload, or any
Worker/DO. Publishing it is a future gate (Section 10) and must pass the Section 9 checklist.

---

## 8. Evidence artifacts (to generate later, under their own gates)

- **Architecture diagram** — the layer stack (identity/canonical → block-log/snapshot → attack-sim/settlement
  → beacon/challenge-window → overlay/availability fabric → Phase 4 safety plan).
- **Sequence diagram** — `attack_commit → settle_attack → proveFraud` (the commit-reveal + fraud-proof path).
- **Replay proof transcript** — a regenerated, byte-identical canned lifecycle transcript.
- **Fraud-proof transcript** — a canned forged-settlement → `proveFraud` mismatch → keyless revocation trace.
- **Boundary matrix** — what is implemented vs intentionally-not-live vs counsel-blocked.
- **"What this does NOT do" section** — the explicit non-goals (no live/UGC/accounts/chat/economy/minors).
- **Video script** — a narration walking the canned demo, using only allowed copy (Section 5).

---

## 9. Boundary checklist (every showcase release must verify)

Before any showcase surface is built or published under a future gate, it must verify:

- [ ] `LIVE_WORLD_LOADER_ENABLED = false` (untouched);
- [ ] curated-upload turf-wars count remains `0`;
- [ ] no production import of any turf-wars lab module;
- [ ] no Worker / DO / D1 / R2 / config / secret change;
- [ ] no upload / deploy unless separately authorized by its own gate;
- [ ] no public gameplay copy (Section 5 forbidden list);
- [ ] no minors-facing copy;
- [ ] no UGC (no upload / ingestion / editable blocks);
- [ ] no accounts / login / profile;
- [ ] no chat / DM / free text;
- [ ] no marketplace / economy / reward / cash / ownership language;
- [ ] no network runtime / live P2P / peer discovery;
- [ ] no viewer data collection that could constitute personal data;
- [ ] carries the "experimental lab prototype, not a public game mode, safety/legal review required before any
      live use" framing.

---

## 10. Recommended next build gates

Each is a **separate, explicit** future gate; none is authorized by this plan. They are intentionally small
and independently shippable, and each must pass the Section 9 checklist:

- `AUTHORIZED: BUILD TURF WARS STATIC TECH SHOWCASE PAGE — NO LIVE GAME`
- `AUTHORIZED: BUILD TURF WARS CANNED REPLAY DEMO — LOCAL ONLY`
- `AUTHORIZED: RECORD TURF WARS PUBLIC README SECTION — DOCS ONLY`
- `AUTHORIZED: CREATE TURF WARS ARCHITECTURE DIAGRAMS — DOCS ONLY`

> The canned-replay-demo gate covers **Phases 1–3 only**. Any **Phase 4 safety-quorum visualization** is
> explicitly **out of scope** of these gates: it requires Phase 4 to be built under its own gates **and** a
> separate, named `AUTHORIZED:` line for the visualization itself — it is not unlocked by the demo gate.

---

## Final boundary statement

- This plan does **not** launch a live game.
- This plan does **not** make Turf Wars minors-facing.
- This plan does **not** enable public multiplayer or live P2P.
- This plan does **not** touch the live world loader, the curated upload, or any production surface.
- This plan does **not** claim legal clearance, minors clearance, or production readiness, and does **not**
  supersede the gameplay charter.
- This plan **defines a public-safe, non-interactive technical-showcase envelope** and the future gates that
  would build it — and nothing more.

The live game, minors-facing use, public multiplayer, the live loader, the production Turf Wars surface, and
counsel/charter clearance all remain **blocked**.
