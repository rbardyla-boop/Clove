# Directive Anchor — Integration Guide
# field-ops.html · One Sprint · Zero External Dependencies

---

## What this feature does

**Before:** session → debrief (SEEN / EXECUTED / SKIPPED / RUN IT AGAIN →)
**After:**  session → debrief → [50ms: ANCHOR EXEC RATE injected as 4th stat] →
           [120ms: Anchor overlay] → user selects directive + time → .ics downloads →
           tension meter lives on entry screen until directive is executed or expires

No new packages. No accounts. No external calls. Three localStorage keys.

---

## File inventory

```
anchor/
  entropy.js       — entropy math: f(t) = 1 − e^(−t/τ)
  ics.js           — RFC 5545 .ics generation + download (iOS + desktop paths)
  db.js            — localStorage CRUD (od_anchor, od_anchor_meta, od_anchor_nodim)
  tension-meter.js — entry screen meter HTML/CSS injection + render
  anchor-step.js   — debrief overlay + showDebrief patch + meter init
  anchor-ratio.js  — CFO measurement: injects ANCHOR EXEC RATE into debrief stats
  integration-guide.md  — this file
  field-ops.html.patch.md — exact diff for field-ops.html
```

---

## Integration steps

### Step 1 — Copy anchor/ folder to repo root

```
clovelearn_v3_final_deploy/
  anchor/           ← place here, alongside field-ops.html
  field-ops.html
  od-core.js
  sw.js
  ...
```

### Step 2 — Patch field-ops.html

See `anchor/field-ops.html.patch.md` for the exact diff.
**Summary:** add 6 `<script>` tags after the main `</script>`, before the SW line.
Load order is mandatory: entropy → ics → db → tension-meter → anchor-step → anchor-ratio.

### Step 3 — Update sw.js cache manifest

Add 6 paths to the static assets array and bump CACHE_VERSION.
See `field-ops.html.patch.md` for the exact strings.

---

## localStorage keys

| Key | Purpose | TTL |
|---|---|---|
| `od_anchor` | Active anchor record (directive, time, executed flag) | 30 days if unexecuted; kept if executed |
| `od_anchor_meta` | `firstSessionAt`, `anchorCount`, `executedCount`, `skipStreak` | Permanent |
| `od_anchor_nodim` | Permanent meter dismiss (`JSON.stringify(true)`) | Permanent |

All three use the existing `od_` prefix. Ignored if anchor scripts are removed.

---

## Mandatory window logic

- **Days 0–30** since `od_anchor_meta.firstSessionAt`: skip requires 2 clicks
  - Click 1 → "SKIP — FIELD PROTOCOL ACTIVE"
  - Click 2 → "CONFIRM SKIP — DIRECTIVE EXPIRES THIS SESSION"
- **Day 31+**: single-click skip
- **Adaptive override**: if `skipStreak ≥ 3`, mandatory suspended for that session
  (prevents the step from becoming bureaucratic overhead; resets on next anchor save)

---

## CFO measurement: reading the ratio

After launch, open the browser console on any debrief screen and run:

```javascript
JSON.parse(localStorage.getItem('od_anchor_meta'))
// → { firstSessionAt: 1743840000000, anchorCount: 12, executedCount: 7, skipStreak: 0 }
// ratio: 7/12 = 58% — above 50%, below 75% — watch for 30 days
```

The ANCHOR EXEC RATE stat block in the debrief shows this ratio visually:
- ≥75% → green
- 50–74% → gold
- <50% → red

**Interpretation:**
- anchorCount high, executedCount low, ratio flat → compliance theater (Rank 3 falsification)
- ratio rising over 30 days → the tool is producing behavior change
- ratio unmeasurable (no anchors yet) → stat block is hidden automatically

---

## Incognito

`localStorage` is available in incognito but cleared when the tab closes.
Overlay renders. `.ics` downloads. Meter and ratio don't persist. Expected behavior.
No message, no warning. Ephemerality is the product.

---

## Five-expert synthesis (in the artifact that ships)

| Expert | What satisfies them in this implementation |
|---|---|
| **CFO** | `od_anchor_meta.executedCount / anchorCount` ratio is visible in the debrief stats strip on every session — no server, no dashboard, no tracking. The signal is local and immediate. |
| **Philosopher** | Overlay copy is pull ("BEFORE YOU LEAVE — WHICH ONE STAYS WITH YOU?"), not push. Permanent dismiss (× button) always visible. 30-day expiry with no punitive notice. Width-only entropy meter — no color valence, no judgment. The tool externalizes the operator's stated commitment; it does not impose a new one. |
| **Veteran** | "FIELD PROTOCOL" language throughout. 15-minute calendar block = mission brief with a time on it. Two-click skip during mandatory window = deliberate choice, not coercion. The directive overlay shows ACTION text alongside the directive — operators need both. |
| **Physicist** | `f(t) = 1 − e^(−t/τ)`, τ = 24h. Half-entropy time (τ × ln 2 ≈ 16.6h) is derivable from the formula in entropy.js. The meter displays "XX% ENTROPY" and elapsed hours — not a score, not a streak, not a point. Thermodynamic saturation displayed as width: the ordering of the committed state decays toward maximum disorder. |
| **Harshest Critic** | Compliance theater is named (integration guide), tracked (`executedCount/anchorCount`), and visible (debrief stat). `skipStreak` adaptive logic prevents gaming the mandatory window. Double-patch guard prevents overlay firing twice if scripts are accidentally loaded twice. iOS fallback path (data: URI) handles the highest-probability hardware failure mode. The anchor is saved even when calendar export fails — the commitment precedes the scheduling. |

---

## Testing checklist

- [ ] Complete a 3-card session → debrief renders with 3 stats → ~50ms later ANCHOR EXEC RATE appears as 4th stat (hidden if anchorCount = 0)
- [ ] Anchor overlay appears ~120ms after debrief
- [ ] Select a directive → border turns gold → EXPORT button enables
- [ ] Set a future time → click EXPORT → `clovelearn_directive.ics` downloads → overlay closes → green toast
- [ ] Return to entry screen → Field Tension Meter visible below status bar
- [ ] Meter shows directive text (italic), elapsed hours, entropy %
- [ ] Click MARK EXECUTED → meter disappears → green toast
- [ ] Click × (dismiss) → meter gone permanently, does not return after reload
- [ ] Skip once (days 0–30) → copy changes to "CONFIRM SKIP"
- [ ] Confirm skip → closes; skip 2 more times → 4th session → single-click skip
- [ ] Run 2+ sessions → check debrief 4th stat shows correct ratio
- [ ] Chrome incognito: overlay works, meter absent on next tab (expected)
- [ ] iOS Safari: .ics prompts Calendar import or saves to Files
- [ ] Android Chrome: .ics downloads normally
- [ ] sw.js CACHE_VERSION bumped → new scripts served (not cached old version)

---

## Rollback

Remove the 6 `<script>` tags from `field-ops.html`.
Delete the `anchor/` folder.
Revert sw.js CACHE_VERSION.
The three `od_anchor*` keys are silently ignored. No other changes needed.
