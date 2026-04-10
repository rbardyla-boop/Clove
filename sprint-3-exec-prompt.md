🔧 CLAUDE CODE — SPRINT 3 EXECUTION PROMPT
FRICTION LAYER: Skip Gating + Spotify Upgrade

You are Claude Code working on `field-ops.html`. Sprints 1 and 2 are complete: the profile system exists, `consecutive_skips` is tracked in `showDebrief()`, and the entry checkpoint fork works. The RANDOM button currently always shows. This sprint locks it when a user has serial-skipped their way through sessions, and surfaces the Spotify upgrade prompt after proven execution.

Your objective: Gate RANDOM behind `consecutive_skips >= 2`, render a `.random-locked` message in its place, and show the upgrade prompt in the output screen after `total_executed >= 5`.

---

🎯 OBJECTIVE

Modify `randomButtonHTML()` to enforce serial-skip lockout, add `renderUpgrade()` and `dismissUpgrade()`, and wire the upgrade prompt into the output screen.

---

⚠️ HARD CONSTRAINTS

- Do NOT modify `skipCard()`, `advanceCard()`, or `showDebrief()` — `consecutive_skips` is already tracked. This sprint only changes what the UI renders based on that value.
- `K_UPDI` must be declared alongside `K_SAVE` at the top of the script — not inside a function.
- The upgrade prompt renders inside `#upgrade-root` — a div that must exist in the output screen HTML. Do not inject it into the card itself.
- `.random-locked` must be a new CSS class — confirm it does not exist before adding it.
- `dismissUpgrade()` writes `K_UPDI=true` to localStorage. After dismissal, the upgrade never shows again on this device.
- No changes to CSS variables. Use existing `var(--red)`, `var(--spot)`, `var(--dim2)`, `var(--dim3)`.

---

🧠 STEP 1 — ADD K_UPDI CONSTANT

Find the storage constants block at the top of `<script>`:

```javascript
const PROFILE_KEY = 'od_operator_profile';
const K_SAVE      = 'od_ff_saved';
```

Add `K_UPDI` immediately after `K_SAVE`:

```javascript
const PROFILE_KEY = 'od_operator_profile';
const K_SAVE      = 'od_ff_saved';
const K_UPDI      = 'od_ff_upgrade_dismissed';
```

**Integration point:** Storage constants block. One line added. If `K_UPDI` already exists anywhere else in the file, remove the duplicate — the constant must live here and only here.

---

🧠 STEP 2 — UPDATE randomButtonHTML(prof)

Find the current `randomButtonHTML()` implementation (added in Sprint 2 — returns the button unconditionally). Replace its entire body:

```javascript
// Returns RANDOM button HTML or locked state message based on consecutive_skips
function randomButtonHTML(prof){
  if(prof.consecutive_skips>=2){
    return `<div class="random-locked">RANDOM DISABLED<br>YOU'RE AVOIDING</div>`;
  }
  return `<button class="bg" onclick="enterRandom()">⚄ RANDOM</button>`;
}
```

**Integration point:** Replace the existing `randomButtonHTML()` function body. Function name and signature unchanged.

This change affects both the hook view (via `renderHook()`) and the checkpoint drawer (via `renderCheckpoint()`). Both call `randomButtonHTML(prof)` and will automatically reflect the locked state.

---

🧠 STEP 3 — ADD renderUpgrade() AND dismissUpgrade()

The upgrade prompt shows after 5 executions, once, and never again after dismissal. Add both functions immediately before `showDebrief()`:

```javascript
/* ─── UPGRADE PROMPT ──────────────────────────────────────────────────────── */
function renderUpgrade(){
  const el=document.getElementById('upgrade-root');
  if(!el) return;
  const prof=getProfile();
  if(prof.total_executed>=5&&!jg(K_UPDI)){
    el.innerHTML=`
      <div class="upgrade">
        <div class="up-tag">SIGNAL UPGRADE UNLOCKED</div>
        <div class="up-msg">You've proven execution. Now match every card to a real track from your Spotify library — by genre fingerprint. Runs once. Stays local.</div>
        <div class="up-row">
          <button class="btn-uyes" onclick="window.location.href='./music-ops.html'">CONNECT SPOTIFY →</button>
          <button class="btn-uno" onclick="dismissUpgrade()">NOT NOW</button>
        </div>
      </div>`;
  } else {
    el.innerHTML='';
  }
}

function dismissUpgrade(){
  js(K_UPDI,true);
  document.getElementById('upgrade-root').innerHTML='';
}
```

**Integration point:** Add as a new `/* ─── UPGRADE PROMPT ─── */` section, immediately before the `/* ─── DEBRIEF SCREEN ─── */` section.

---

🧠 STEP 4 — WIRE renderUpgrade() INTO renderCard()

Find `renderCard()`. It ends with the card HTML injection into `#card-root`. Add `renderUpgrade()` as the **last line** of the function:

```javascript
function renderCard(){
  // ... existing card rendering logic (unchanged) ...
  document.getElementById('card-root').innerHTML=`...`;  // existing — do not touch

  renderUpgrade();  // ← add this as the final line
}
```

**Integration point:** Last line of `renderCard()` body, after the `card-root.innerHTML` assignment.

---

🧠 STEP 5 — ADD #upgrade-root TO OUTPUT SCREEN HTML

Find `#s-output` in the HTML. Locate `<div class="out-body" id="card-root"></div>`. Add `#upgrade-root` directly after it:

```html
<div class="out-body" id="card-root"></div>
<div id="upgrade-root"></div>
```

**Integration point:** Inside `#s-output`, directly after `#card-root`. The upgrade div sits below the card, above the screen's bottom padding.

---

🧠 STEP 6 — ADD dismissUpgrade TO window.assign

Find `Object.assign(window, {...})` at the bottom of the script. Add `dismissUpgrade` to the list:

```javascript
Object.assign(window,{
  show,enterState,enterRandom,enterReturn,continueSession,toggleStateDrawer,
  runIt,didIt,skipCard,backToState,toggleSave,
  runAgain,dismissUpgrade,        // ← dismissUpgrade added here
  redirectState,dismissIntervention,
});
```

**Integration point:** `Object.assign(window,{...})` block. Add `dismissUpgrade` alongside `runAgain`.

---

🎨 CSS ADDITIONS

Add two new CSS sections inside the `<style>` tag.

**Section 1: `.random-locked`** — Add immediately after the `.bg` (RANDOM button) rule, inside the SCREEN 1 — ENTRY block:

```css
/* Serial-skip lockout — replaces RANDOM when consecutive_skips >= 2 */
.random-locked{
  flex:1;padding:12px 0;
  font-size:8.5px;font-family:'DM Mono',monospace;letter-spacing:1.5px;
  text-align:center;line-height:1.7;color:var(--red);
  border:1px solid rgba(192,57,43,.22);border-radius:9px;
}
```

**Section 2: Upgrade prompt styles** — Add inside the SCREEN 3 — OUTPUT block, after `.btn-save.on` rule:

```css
/* Spotify upgrade (fires after 5 executions) */
.upgrade{
  margin:0 16px 10px;padding:16px 18px;
  border:1px solid rgba(29,185,84,.1);border-radius:11px;text-align:center;
}
.up-tag{font-size:7.5px;font-family:'DM Mono',monospace;letter-spacing:3px;
  color:var(--spot);margin-bottom:6px}
.up-msg{color:#888;font-size:9px;font-family:Georgia,serif;
  font-style:italic;line-height:1.7;margin-bottom:12px}
.up-row{display:flex;gap:8px;justify-content:center}
.btn-uyes{background:var(--spot);color:#000;border:none;border-radius:8px;
  padding:9px 14px;font-size:8px;font-weight:900;font-family:'DM Mono',monospace;
  letter-spacing:1.5px;cursor:pointer}
.btn-uyes:active{background:#1ed760}
.btn-uno{background:none;color:var(--dim2);border:1px solid var(--dim3);
  border-radius:8px;padding:9px 11px;font-size:8px;
  font-family:'DM Mono',monospace;letter-spacing:1px;cursor:pointer}
.btn-uno:active{color:var(--dim)}
```

---

🧪 ACCEPTANCE CRITERIA

✔ **RANDOM lockout — trigger:** Open DevTools, set `consecutive_skips` to 2 in the profile object. Refresh. Entry screen shows `.random-locked` div ("RANDOM DISABLED / YOU'RE AVOIDING") instead of the RANDOM button — in both hook view and the checkpoint drawer.

✔ **RANDOM lockout — reset:** Set `consecutive_skips` to 0 in DevTools. Refresh. RANDOM button returns.

✔ **Lockout in both views:** If locked at entry, RANDOM is also locked in the state drawer that opens via SWITCH STATE.

✔ **Upgrade prompt — trigger:** Set `total_executed` to 5 in profile via DevTools. Load any card. Upgrade prompt appears below the card in the output screen.

✔ **Upgrade prompt — dismissal:** Click "NOT NOW". Prompt disappears. `od_ff_upgrade_dismissed` appears in localStorage as `true`. Refresh, run another card — prompt does not reappear.

✔ **Upgrade prompt — CONNECT SPOTIFY:** Clicking "CONNECT SPOTIFY →" navigates to `./music-ops.html`.

✔ **Upgrade prompt — below threshold:** If `total_executed < 5`, no upgrade prompt appears anywhere.

✔ **No regressions:** Checkpoint fork, CONTINUE, SWITCH STATE, full 3-card session → debrief → back to entry all work without errors.

✔ **No console errors** on load, card render, skip sequence, upgrade dismiss.

---

📋 DEPLOYMENT NOTES

- **Modified functions:** `randomButtonHTML()` (body replaced), `renderCard()` (1 line added at end)
- **New functions added:** `renderUpgrade()`, `dismissUpgrade()`
- **New constant:** `K_UPDI`
- **HTML change:** `#upgrade-root` div added inside `#s-output` after `#card-root`
- **CSS additions:** `.random-locked` (~6 lines), upgrade prompt styles (~18 lines)
- **window.assign addition:** `dismissUpgrade`
- **Cache:** Bump `sw.js` cache version — `#upgrade-root` HTML and `.random-locked` styles must be in the refreshed cache

---

🚫 NON-GOALS

- Do not change how `consecutive_skips` is incremented — that logic is in `showDebrief()` and is not touched
- No changes to `skipCard()` or `advanceCard()` — skip gating is a display decision at entry, not a navigation block
- No intervention system, no `consecutive_same_state`, no `REDIRECT_MAP` — Sprint 4
- `consecutive_skips` resets on any DID IT — already handled in `showDebrief()` from Sprint 1. Do not add reset logic here.
- Do not add any new profile fields in this sprint
