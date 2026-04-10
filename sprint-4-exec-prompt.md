🔧 CLAUDE CODE — SPRINT 4 EXECUTION PROMPT
ADAPTIVE PRESSURE: Pattern Intervention System

You are Claude Code working on `field-ops.html`. Sprints 1–3 are complete. The profile object is live, the entry checkpoint works, and the friction layer is in place. The profile currently lacks three fields: `state_history`, `consecutive_same_state`, `intervention_dismissals`. The state screen has no mechanism to detect or confront repeated behavioral patterns.

Your objective: Add per-state run tracking to the profile, detect when a user has chosen the same state 3+ consecutive sessions, and render a psychological redirect panel on the state screen — with escalating confrontational copy on repeat dismissals.

---

🎯 OBJECTIVE

Add three fields to `getProfile()`, track same-state behavior in `showDebrief()`, build the `REDIRECT_MAP` + intervention rendering system, and wire it into `loadStateScreen()`.

---

⚠️ HARD CONSTRAINTS

- The three new profile fields (`state_history`, `consecutive_same_state`, `intervention_dismissals`) **must be initialized in `getProfile()`**. No runtime `||` fallback substitutes for missing initialization on fresh profiles.
- `showDebrief()` must capture `prevLastState` **before** overwriting `prof.last_state`. The same-state detection compares previous state to session state — order of operations is critical.
- `maybeShowIntervention()` calls `getProfile()` directly — it does not receive `prof` as a parameter. It always reads the saved state, not in-flight state.
- `redirectState(newState)` calls `loadStateScreen(newState)` which calls `maybeShowIntervention()` again. This is safe: the redirected state will have `consecutive_same_state` of 1, so the intervention will not re-fire.
- `dismissIntervention()` writes to localStorage immediately. One tap, one write. No deferred save.
- `#iv-panel` must exist in the HTML before `loadStateScreen()` is called. If the div is missing, `maybeShowIntervention()` exits silently — no throw.
- Do not change `STATES`, `POOLS`, `SESSION_MAX`, or any function outside `getProfile()`, `showDebrief()`, `loadStateScreen()`, and the new functions added in this sprint.

---

🧠 STEP 1 — UPDATE getProfile() WITH THREE NEW FIELDS

Find `getProfile()`. Inside the `fresh` object literal, add the three new fields **after** `level:'unstable'`:

Before (end of fresh object):
```javascript
    level:'unstable'
  };
```

After:
```javascript
    level:'unstable',
    state_history:{},              // { stateName: lifetimeRunCount }
    consecutive_same_state:0,      // resets to 1 on any state change
    intervention_dismissals:0      // STAY HERE clicks — escalates intervention copy
  };
```

**Integration point:** Inside the `fresh={}` object in `getProfile()`. Add the three lines after `level:'unstable'`. Preserve the trailing comma on `level` and close the object correctly.

**Existing users:** Their stored profile will not have these three fields. The `||` guards in Steps 3–6 handle `undefined` safely. After their next session completes, all three fields will be present in localStorage.

---

🧠 STEP 2 — ADD REDIRECT_MAP CONSTANT

The redirect map encodes the psychological root of each stuck state. Add this constant as a new section, placed after the ENTRY PATHS section and before `startSession()`:

```javascript
/* ─── INTERVENTION SYSTEM ─────────────────────────────────────────────────── */
// Psychology-informed: each redirect collapses the hiding pattern into its root
const REDIRECT_MAP={
  numb:          'anger',        // numbness masks suppressed anger
  anger:         'discipline',   // redirect destructive energy into output
  discipline:    'direction',    // execution without purpose loops endlessly
  focus:         'direction',    // can't lock in because the target is unclear
  direction:     'discipline',   // stop planning, start doing
  relationships: 'numb',         // externalization surfaces what's underneath
};
```

**Integration point:** New `/* ─── INTERVENTION SYSTEM ─── */` section. `REDIRECT_MAP` is a const — defined once at module level, not inside a function.

---

🧠 STEP 3 — ADD maybeShowIntervention(state)

The trigger function. Reads the profile, checks the consecutive threshold, and injects the redirect panel. Copy escalates after 2 dismissals. Add immediately after `REDIRECT_MAP`:

```javascript
function maybeShowIntervention(state){
  const prof=getProfile();
  if((prof.consecutive_same_state||0)<3) return;  // threshold not hit

  const redirectTo=REDIRECT_MAP[state];
  if(!redirectTo||!STATES[redirectTo]) return;    // no redirect defined

  const count=prof.consecutive_same_state;
  const dismissals=prof.intervention_dismissals||0;
  const target=STATES[redirectTo];

  // Escalated copy after ≥2 dismissals — the user is choosing the pattern
  const msgLine=dismissals>=2
    ? `You've ignored this ${dismissals} times.<br>You're not stuck.<br>You're choosing this.`
    : `That's not a state — it's a habit.`;

  const panel=document.getElementById('iv-panel');
  if(!panel) return;
  panel.innerHTML=`
    <div class="iv-wrap">
      <div class="iv-tag">PATTERN DETECTED</div>
      <div class="iv-count">You've chosen ${esc(STATES[state].lbl)} ${count} times in a row.</div>
      <div class="iv-msg">${msgLine}</div>
      <div class="iv-btns">
        <button class="btn-iv-yes" onclick="redirectState('${esc(redirectTo)}')">→ RUN ${esc(target.lbl)} INSTEAD</button>
        <button class="btn-iv-no" onclick="dismissIntervention()">STAY HERE</button>
      </div>
    </div>`;
}
```

**Integration point:** Immediately after `REDIRECT_MAP`, inside the same intervention section.

---

🧠 STEP 4 — ADD redirectState() AND dismissIntervention()

```javascript
// Swap to redirected state — clears panel naturally via loadStateScreen re-call
function redirectState(newState){
  if(!STATES[newState]) return;
  currentState=newState;
  fromReturn=false;
  hideMem();
  loadStateScreen(newState);
}

// STAY HERE — increments dismissal count, escalates copy on next intervention
function dismissIntervention(){
  const prof=getProfile();
  prof.intervention_dismissals=(prof.intervention_dismissals||0)+1;
  saveProfile(prof);
  const panel=document.getElementById('iv-panel');
  if(panel) panel.innerHTML='';
}
```

**Integration point:** After `maybeShowIntervention()`, still inside the intervention section. Both are exposed on `window` in Step 8.

---

🧠 STEP 5 — UPDATE loadStateScreen() TO CALL maybeShowIntervention()

Find `loadStateScreen(s)`. It currently sets the tag, callout, and truth text. Add three lines at the end:

```javascript
function loadStateScreen(s){
  const st=STATES[s];
  document.getElementById('st-tag').textContent=st.lbl;
  document.getElementById('st-call').textContent=st.callout;
  document.getElementById('st-truth').textContent=st.truth;
  // Always clear first — redirectState re-calls this with a new state
  const iv=document.getElementById('iv-panel');
  if(iv) iv.innerHTML='';
  maybeShowIntervention(s);  // ← fires if consecutive_same_state >= 3
}
```

**Integration point:** Add the three new lines at the end of the existing `loadStateScreen()` body. Preserve everything above them exactly.

---

🧠 STEP 6 — UPDATE showDebrief() WITH SAME-STATE TRACKING

Find `showDebrief()`. Inside the profile update block, make two changes:

1. Add `prevLastState` capture immediately after `prevLastSeen`:
```javascript
const prevLastSeen=prof.last_seen;
const prevLastState=prof.last_state;   // ← add this line
```

2. Add the same-state tracking block and `state_history` update **after** the `total_skipped` increment and **before** the `prof.last_state` assignment:

```javascript
prof.total_sessions  += 1;
prof.total_executed  += sess.did_it;
prof.total_skipped   += sess.skipped;

// Same-state consecutive tracking (compare BEFORE updating last_state)
if(prevLastState === sess.state){
  prof.consecutive_same_state = (prof.consecutive_same_state||0) + 1;
} else {
  prof.consecutive_same_state = 1; // first session of a new state = count of 1
}

// Per-state lifetime run count
prof.state_history = prof.state_history || {};
prof.state_history[sess.state] = (prof.state_history[sess.state]||0) + 1;

prof.last_state   = sess.state;  // ← this line already exists, do not duplicate
// ... rest of existing showDebrief() unchanged ...
```

**Integration point:** Inside the existing profile update block in `showDebrief()`. You are inserting the same-state block and `state_history` update between the totals increment and the `prof.last_state` assignment. The `prevLastState` capture is a new line added after `prevLastSeen`. Everything else in `showDebrief()` is untouched.

---

🧠 STEP 7 — ADD #iv-panel TO STATE SCREEN HTML

Find `#s-state` in the HTML. Inside `.st-body`, add `#iv-panel` as an empty div immediately before `#st-tag`:

```html
<div class="st-body">
  <!-- Memory banner — shown on RETURN path -->
  <div class="mem-banner" id="mem-banner">
    <div class="mem-tag">LAST SESSION</div>
    <div class="mem-val" id="mem-val"></div>
    <div class="mem-sub" id="mem-sub"></div>
  </div>
  <!-- Intervention panel — injected by maybeShowIntervention() -->
  <div id="iv-panel"></div>
  <div class="st-tag" id="st-tag"></div>
  <div class="st-call" id="st-call"></div>
  <p class="st-truth" id="st-truth"></p>
</div>
```

**Integration point:** Inside `.st-body`, between `.mem-banner` and `#st-tag`. One empty div. CSS gives it `margin-bottom:20px` only when populated.

---

🧠 STEP 8 — ADD redirectState AND dismissIntervention TO window.assign

Find `Object.assign(window, {...})` at the bottom of the script. Add the two intervention handlers:

```javascript
Object.assign(window,{
  show,enterState,enterRandom,enterReturn,continueSession,toggleStateDrawer,
  runIt,didIt,skipCard,backToState,toggleSave,
  runAgain,dismissUpgrade,
  redirectState,dismissIntervention,  // ← Sprint 4 additions
});
```

**Integration point:** The existing `Object.assign` block. Add `redirectState, dismissIntervention` as the final line before the closing `}`.

---

🎨 CSS ADDITIONS

Add the intervention panel styles inside the `<style>` tag. Place this block after the `#state-drawer` rules and before the `/* ══ SCREEN 2 — STATE ══ */` header:

```css
/* ─── INTERVENTION PANEL (state screen — fires at consecutive_same_state >= 3) */
#iv-panel{margin-bottom:20px}  /* spacing above callout when populated */
.iv-wrap{
  padding:16px 18px;
  border:1px solid rgba(192,57,43,.3);border-radius:11px;
  background:rgba(192,57,43,.04);
}
.iv-tag{
  font-size:7.5px;font-family:'DM Mono',monospace;letter-spacing:4px;
  color:var(--red);margin-bottom:8px;
}
.iv-count{
  font-family:'Bebas Neue',monospace;font-size:22px;letter-spacing:.5px;
  line-height:1.1;margin-bottom:8px;
}
.iv-msg{
  font-family:Georgia,serif;font-size:11px;font-style:italic;
  color:var(--dim);line-height:1.75;margin-bottom:16px;
}
.iv-btns{display:flex;flex-direction:column;gap:8px}
.btn-iv-yes{
  width:100%;background:var(--red);color:#fff;border:none;
  border-radius:9px;padding:13px 0;font-size:9px;font-weight:900;
  font-family:'DM Mono',monospace;letter-spacing:2px;cursor:pointer;
  transition:background .15s,transform .12s;
}
.btn-iv-yes:active{transform:scale(.98);background:#a93226}
.btn-iv-no{
  width:100%;background:none;color:var(--dim2);
  border:1px solid var(--dim3);border-radius:9px;
  padding:11px 0;font-size:8px;font-family:'DM Mono',monospace;
  letter-spacing:1.5px;cursor:pointer;transition:color .15s;
}
.btn-iv-no:active{color:var(--dim)}
```

---

🧪 ACCEPTANCE CRITERIA

✔ **Intervention trigger:** In DevTools, set `consecutive_same_state` to 3, `last_state` to `"numb"`. Refresh. Navigate to NUMB state. Intervention panel appears above the callout: "PATTERN DETECTED / You've chosen NUMB 3 times in a row. / That's not a state — it's a habit." Two buttons: "→ RUN ANGER INSTEAD" and "STAY HERE".

✔ **Redirect path:** Click "→ RUN ANGER INSTEAD". State screen updates to ANGER callout. Intervention panel is gone. `currentState` is `anger`. RUN IT starts an ANGER session.

✔ **STAY HERE path:** Click "STAY HERE". Panel disappears. `intervention_dismissals` increments to 1 in localStorage. On next intervention appearance (still `consecutive_same_state >= 3`), hit STAY HERE again. Third appearance shows escalated copy: "You've ignored this 2 times. You're not stuck. You're choosing this."

✔ **State change resets counter:** Complete a NUMB session, then switch to DISCIPLINE and complete one. Profile shows `consecutive_same_state` = 1. No intervention on DISCIPLINE screen.

✔ **Three consecutive same-state sessions:** Start from scratch. Run ANGER 3 times (3 full sessions). On the 4th entry to the ANGER state screen, intervention fires.

✔ **state_history accumulates:** After 3 ANGER + 2 NUMB sessions: `state_history.anger` = 3, `state_history.numb` = 2. Verify in DevTools.

✔ **Existing users (missing new fields):** Profile in localStorage without the three new fields. Run one session. No crashes. `||0` and `||{}` guards handle undefined. After session: all three fields present in saved profile.

✔ **REDIRECT_MAP coverage — all 6 states:** numb→anger, anger→discipline, discipline→direction, focus→direction, direction→discipline, relationships→numb.

✔ **No console errors** on load, state selection, intervention trigger, redirect, dismissal, full session loop.

---

📋 DEPLOYMENT NOTES

- **Modified functions:** `getProfile()` (3 new fields in fresh object), `loadStateScreen()` (3 lines added at end), `showDebrief()` (prevLastState capture + same-state tracking block added)
- **New functions added:** `maybeShowIntervention()`, `redirectState()`, `dismissIntervention()`
- **New constant:** `REDIRECT_MAP`
- **HTML change:** `#iv-panel` empty div added to `#s-state > .st-body`
- **CSS additions:** `#iv-panel` + 8 new class definitions, ~35 lines
- **window.assign additions:** `redirectState, dismissIntervention`
- **Cache:** Bump `sw.js` cache version — `#iv-panel` HTML and all `.iv-*` styles must be in the refreshed cache

---

🚫 NON-GOALS

- No pattern history UI anywhere. The intervention panel is the only surface for this data.
- Do not persist `consecutive_same_state` across intervention clicks — it resets only when the user runs a different state, tracked in `showDebrief()`.
- Do not add a global intervention count metric. `intervention_dismissals` drives copy escalation only.
- Do not change the REDIRECT_MAP entries. The psychological mappings are fixed.
- If `REDIRECT_MAP[state]` is undefined, return early silently — the function already does this.
- No new screens. No modals. The intervention panel lives on the state screen, inline.
