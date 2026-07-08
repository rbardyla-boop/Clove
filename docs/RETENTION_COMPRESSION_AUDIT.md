# Retention Compression Audit — Epistemic Compression Loop applied to clovelearn.io

- **Date:** 2026-07-08
- **Repo state:** `main` at `a342f59` (+ the two uncommitted front-door edits recorded in §Applied)
- **Method:** the 11-step Epistemic Compression Loop (Perception → Definition → Analogy → Value →
  Compression → Test → Falsification → Replay → Assumption Audit → Formalization → Variant Search),
  run against measured evidence only: live-site fetches (curl, served bytes), the repo link graph,
  and two independent read-only source sweeps. Observation, inference and speculation are labeled.
- **Operator directives received mid-audit (they anchor the Value step):**
  1. *"I want the free mental health to be at the forefront and optimized for it."*
  2. *"The games and stuff are for the retention — help them come back, or take a break for self-help."*
- This file lives under `docs/` (production-upload denylist); it does not ship.

---

## 1. Perception — what is the deeper structure?

The retention question is not "is there enough content." The site has five product lines
(live multiplayer arcade, standalone games, a six-game mini arcade, three overlapping game-maker
tools, and a mental-health growth-plan program) exiting one unbranded door. The deep structure:
**an identity problem expressing itself as a choice-architecture problem** — plus a set of
mechanical breakages that make the first session feel unfinished.

## 2. Definition — what is "retention" here, operationally?

The site is privacy-first: no accounts, no analytics. Retention must therefore be defined
**on-device**, with local, checkable proxies:

- **R1 — Return signal:** `od_operator_profile.last_seen` / `streak` increments (field-ops.html:1925–1935).
- **R2 — Plan continuation:** `clovelearn_onboarding_v1.completedAt` exists AND growth-plan is revisited.
- **R3 — Session depth:** a visit reaches a second surface (game or plan) beyond the landing.
- **R4 — Game return:** persisted local bests grow across visits (`nodehopper-best`, `singularity_save`).

"Better retention" = these proxies improving. Anything not expressible in these terms is vibes.

## 3. Analogy — what hidden field does this resemble?

The operator's model (directive 2) is the **gym-with-a-lounge** pattern, not the theme-park
pattern: the product is the practice (growth plan); the games are the lounge that makes the
building worth walking back into on days you can't face the practice. Retail calls this an
anchor-and-dwell layout. The design implication: one anchor, clearly first; the lounge labeled
as a lounge — never five co-equal storefronts.

## 4. Value — what is worth caring about?

Resolved by directive 1: **the free mental-health program is the product.** Retention is
retention *into the plan*; games are the come-back/take-a-break loop that serves it.
Care-first constraint (observation → policy): this is a mental-health surface, plausibly used by
minors — optimize for *returning to something that helps*, never for engagement-maximizing
dark patterns. The games-as-break framing is inherently the healthy version of this.

## 5. Compression — the smallest model that explains the most

> **The front door sells five identities, and the strongest retention loop on the site is
> buried behind the one with a typo in its name.**

Everything measured below is a corollary of that sentence.

## 6. Test — the claims, and what the evidence shows

| # | Claim (falsifiable) | Verdict | Evidence |
|---|---|---|---|
| C1 | "The landing is overwhelming" | **CONFIRMED — at identity level, not link level** | 7 co-equal cards (index.html), 7 differently-colored CTAs, no primary action, ~5 product lines; title literally `Welcome`; only 7 links total (modest), ~13 pages within 2 clicks |
| C2 | "It's not smooth" | **CONFIRMED — specific, mechanical** | (a) `_redirects` rule `/index.html → /deck.html 302` hijacks the only "← Home" link (whats-live.html:151) into the therapy deck app — verified live (`GET /index.html → 302 → deck.html`); (b) 6 of 7 first-click destinations have **no navigation back** (game/index.html, game/Arcade, mind machine, node hopper, arcade/, arcade/city/); (c) the *most-promoted* card (Neon Circuit) is the *slowest to first play*: 2 page-clicks + interstitial + WASD walk + E, vs 1 click for lesser cards |
| C3 | "Performance is the problem" | **REFUTED** | all measured pages ≤ 25 KB HTML, 200–310 ms fetch; heaviest asset found 246 KB (`game/main.js`) |
| C4 | "The arcade retention loop works" | **CONFIRMED — arcade is LIVE in production** (first verdict here was wrong; see Gate-1 addendum) | Real-browser probe 2026-07-08: headless chromium on `https://clovelearn.io/arcade/` opened `wss://clovelearn.io/arcade/ws?room=main-floor` — **19 frames received, socket stayed open, 0 console errors**; city opened `wss://clovelearn.io/arcade/city/ws?city=downtown-01` — 12 frames, open, clean. `GET /arcade/health` → 200 `{"ok":true,"service":"neon-arcade-mesh",…}`. The `YOUR-SUBDOMAIN` placeholder in the served bytes sits **inside an HTML comment** — it is an inert template (arcade/index.html:9-16), the client resolves same-origin, and the 2026-06-05 launch wiring is intact. `whats-live.html`'s "Live now" is accurate. |
| C5 | "The mental-health side has retention machinery" | **CONFIRMED, but disconnected** | real daily streak (field-ops.html:1925–1935, `od_operator_profile`), onboarding return-skip (onboarding.html:4; index.html:277 onclick) — but: the streak is visible only inside field-ops; the landing gave the program card slot 5 of 7, half-width, titled "CloveLEarn" (typo, index.html:279); and `cl_notify_granted` (onboarding.html:2289) is **set but never read** — the reminder button collects notification permission and then nothing ever uses it |
| C6 | "I went too far" (too much stuff) | **PARTLY CONFIRMED** | 76 root HTML pages / 296-file upload exist, but the public funnel exposes only ~13 pages within 2 clicks — the sprawl is mostly *hidden*; what leaks is identity confusion, not page count |

## 7. Falsification — what would prove the compressed model wrong

If, after the front-door re-hierarchy ships, the local proxies (R1/R2) do not move — returning
users still don't continue plans — then the bottleneck is **not** the door; it is the plan
content or the streak surfacing, and the next bet moves there.

The falsifier also applies to the audit itself, and it fired once: the initial C4 verdict
("arcade dark in production") was confidently wrong and died under a stronger, client-faithful
test. See the Gate-1 addendum for the post-mortem.

## 8. Replay — how anyone re-runs this audit

- Live checks: `curl -sL https://clovelearn.io/arcade/ | grep -o 'wsUrl[^,}]*'` ·
  `curl -s -o /dev/null -w "%{http_code} %{redirect_url}" https://clovelearn.io/index.html`
- Funnel census: count `href=` targets in `index.html`, `whats-live.html`; trace clicks-to-first-play.
- Page harness: `AUDIT_MATCH='^(index|whats-live)\.html$' npm run audit:product` (scoped audit).
- Retention proxies: inspect the localStorage keys in §2 on any browser profile.

## 9. Assumption Audit — hidden assumptions surfaced

1. **"Retention is good"** — only under the care-first constraint of §4; the target is return-to-help, not time-on-site.
2. **"The splash is the entry point"** — unverified; visitors may deep-link into games. Unmeasurable without server-side (Cloudflare Pages analytics could answer without client tracking).
3. **"No analytics ⇒ can't measure"** — false; §2's local proxies are measurable on-device.
4. **"A grep hit means active code"** — false on HTML: the `YOUR-SUBDOMAIN` config string lives inside an HTML comment, and two *independent* readers both mistook it for live config because both used the same method (substring grep). Method diversity beats reader redundancy. Corollary: curl's fake WS handshake is not a client-faithful test against Cloudflare Workers (this worker 500s curl but accepts real browsers) — only a real WS client counts.
5. **"The typo is a typo"** — "CloveLEarn" was treated as a defect and normalized; if it was intentional branding, revert is one line.

## 10. Formalization — the overwhelm score

`Overwhelm = (product identities exposed at entry) × (co-equal primary CTAs)`.
Before: 5 × 7 = **35**. After the applied edits: 1 primary + one labeled shelf = **~6** (1 anchor
+ 6 shelf items under one label). Crude, but monotone and replayable — recompute it on any future
landing change.

## 11. Variant Search — alternatives considered

| Variant | Verdict |
|---|---|
| A. Mental-health-first anchor + labeled "take a break" games shelf | **Chosen** — matches both directives; smallest change that fixes C1/C5 |
| B. Two-door split landing ("Grow" / "Play") | Rejected for now: still forces a first-visit identity choice; viable later if the games side earns its own audience |
| C. Separate domains/sections (games subdomain) | Rejected: highest effort, breaks existing links, no proxy evidence yet that it's needed |
| D. Keep 7-card grid, only reorder | Rejected: reordering without hierarchy leaves Overwhelm ≈ 30 |

True A/B is impossible without analytics; the comparison gate is the R1–R3 proxies plus the
falsifier in §7.

---

## Applied in this pass (uncommitted; deploy remains the operator's dashboard gate)

1. **index.html** — mental-health anchor first: growth-plan card promoted to slot 1, full-width;
   "CloveLEarn" typo fixed; page titled; lede reframed to directive 2's model; returning users
   with a completed plan see "CONTINUE YOUR PLAN"; remaining games grouped under a
   "TAKE A BREAK · FREE GAMES & MAKER" shelf label. Visual language preserved.
2. **whats-live.html:151** — "← Home" now targets `/` (the splash) instead of `index.html`
   (which the `_redirects` rule 302s into deck.html).

## Ranked follow-up gates (each is its own `AUTHORIZED:` decision)

1. **Arcade truth-reconciliation** — ✅ **CLOSED 2026-07-08, no site change needed.** The gate's
   probe (real-browser WS clients against production) proved the arcade LIVE and the "Live now"
   claims accurate; the defect was in this audit's own C4 verdict. Evidence and post-mortem in
   the Gate-1 addendum below. (The Phase-0 counsel question about the minors-facing economy is
   untouched by this: the economy has been live since the 2026-06-05 launch — that standing
   risk is tracked in the platform reality audit, not here.)
2. **Wire or remove the dead reminder hook** — ✅ **CLOSED 2026-07-08 (AUTHORIZED): wired, by
   changing mechanism.** Finding on inspection: the onboarding flow *promises* "one quiet
   reminder a day" at a user-chosen time, but a static site with no push backend cannot keep
   that promise via the Notification API — the permission button was unfixably cosmetic. The
   promise is now delivered by the one mechanism a private static site can keep: the receipt's
   button generates a client-side **.ics calendar file** (daily RRULE at the user's chosen
   time, 10-minute event, alarm, link back to growth-plan) — no permission, no server, nothing
   leaves the device. The `Notification.requestPermission()` path and the never-read
   `cl_notify_granted` flag are removed (plus a one-line stale-flag cleanup for users who had
   granted). Check hook: verified — headless-browser drive of the real receipt: button click →
   `clovelearn-daily-reminder.ics` downloaded with `RRULE:FREQ=DAILY`, `DTSTART …T090000` for a
   09:00 choice, VALARM present; old button/flag absent; "no reminder" branch renders no
   button (10/10 checks), page audit 2 runs / 0 failures.
3. **Surface the streak where it can retain** — ✅ **CLOSED 2026-07-08 (AUTHORIZED).** Finding
   on inspection: growth-plan already had a "streak card," but it displayed **elapsed calendar
   days since onboarding** as streak progress (`daysSince(completedAt)` over the onboarding
   *target* answer) — it "completed" by pure passage of time with zero practice. Reworked: the
   card now reads the **real practice streak** from `od_operator_profile` (read-only; field-ops
   keeps every write), using the canonical liveness rule (streak counts only if last practice
   was today/yesterday — a lapsed streak shows as none, since field-ops will reset it anyway).
   The onboarding-chosen streak goal (default 7) is the bar target; honest empty/lapsed state
   points to the tools below ("your streak starts with one practice today"). Check hook:
   verified — 9/9 seeded-localStorage browser scenarios (no-profile shows 0 not elapsed-5;
   alive 5/7; lapsed→none; day-1; goal-reached; custom target 14; empty-state untouched); page
   audit 2 runs / 0 failures.
4. **Back-navigation on the 6 dead-end game pages** — ✅ **CLOSED 2026-07-08 (AUTHORIZED).**
   All six (Singularity, Operator's Deck, Mind Machine, Node Hopper, arcade floor, city) now
   carry a small self-contained "← CLOVE" pill linking to `/` (never `index.html` — the
   `_redirects` hijack), placed per page's free zone after screenshot collision review, with an
   iframe guard so the floor embedded inside the city interior does not show it. Check hook:
   verified — pill visible with `href="/"` on all six, removed when the floor is iframed,
   click lands on the splash; screenshots reviewed at 1280×800 for HUD collisions (two rounds —
   5 of 6 first-round placements collided with page HUDs and were moved).
5. **"Take a break" cross-link from the plan side** — ✅ **CLOSED 2026-07-08 (AUTHORIZED).**
   growth-plan now ends with a "Take a break" section reusing the page's tool-card component,
   linking to **Mind Machine** (chosen deliberately: on-theme "clarity" physics puzzle with a
   daily-puzzle return hook) with care-first copy ("Ten minutes off is part of the practice.
   Your plan will be here when you're back."). One suggestion, not a catalog — no re-created
   choice overload. Check hook: verified — full loop drives end-to-end in a browser: plan →
   break card → Mind Machine → "← CLOVE" pill → splash. Combined page audit: 7 pages,
   14 runs, 143 controls, 0 failures.

## Bottom line

The operator's instinct was right twice: it *is* overwhelming (but at the identity level — the
cure is hierarchy, not deletion) and it *isn't* smooth (but the roughness is three mechanical,
individually small defects — a hijacked Home link, dead-end game pages, and a flagship path
that is the slowest route to first play). None of it requires building new things; all of it is
arrangement and wiring what already exists.

---

## Gate-1 addendum — arcade truth-reconciliation (AUTHORIZED, run 2026-07-08)

**Outcome: the production arcade is LIVE; the audit's original C4 verdict was wrong; no site
change was needed.**

Evidence (replayable):

- `GET https://clovelearn.io/arcade/health` → 200
  `{"ok":true,"service":"neon-arcade-mesh","phase":"2c","rooms":["main-floor","neon-training","late-night-circuit"],"sharded":true}`
  (the `"2c"` is a hardcoded label in `workers/arcade/src/index.ts:91`, not a staleness signal).
- Real-browser probe (headless chromium, production pages, scratchpad `probe-prod-ws.mjs`):
  floor page opened `wss://clovelearn.io/arcade/ws?room=main-floor` → **19 frames received,
  socket open, 0 console errors**; city page opened
  `wss://clovelearn.io/arcade/city/ws?city=downtown-01` → **12 frames, open, clean**.
- The `YOUR-SUBDOMAIN` placeholder in the served bytes is inside an HTML **comment**
  (`arcade/index.html:9-16`, `arcade/city/index.html:9-14`) — an inert documentation template,
  exactly as `docs/NEON_CIRCUIT_PHASE3_LAUNCH_READINESS.md:135` describes. At runtime
  `window.__NEON_ARCADE_CONFIG__` is undefined and `resolveWsUrl()` falls through to
  same-origin, which the 2026-06-05 launch routed (narrow `/arcade/…*` routes,
  `docs/PRODUCTION_ROLLOUT_PLAN.md` §0, operator-validated cross-device multiplayer).

Post-mortem (how the false verdict happened — three stacked method errors):

1. **Comment-blind grep**: `grep -o 'wsUrl…'` on served bytes matches inside HTML comments.
   Two independent readers (main audit + a fresh-context subagent) made the identical mistake —
   redundancy without method diversity is not verification.
2. **False corroboration**: `curl` probes of `/arcade/ws` returned 500, which "confirmed" the
   dark-arcade story. But this worker 500s non-browser handshakes while accepting real clients;
   curl was measuring curl, not the product.
3. **Plausibility prior**: a placeholder-breaks-prod story fit the known Phase-7F gap ("no
   multiplayer proof ever ran") and was accepted at two agreeing-but-correlated signals.

Rule distilled: **for any "X is broken in prod" claim, the confirming test must be the real
client path** (a browser driving the shipped page), and any grep-based "active code" claim must
show the match is outside comments. This addendum is the ECL falsifier working as designed —
the loop's §7 test killed its own §6 verdict before it shipped as a decision.
