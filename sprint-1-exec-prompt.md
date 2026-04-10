🔧 CLAUDE CODE — SPRINT 1 EXECUTION PROMPT
THE SPINE: Operator Profile System

You are Claude Code working on a single-file static PWA: `field-ops.html`. There is no build pipeline, no framework, no server. All state lives in `localStorage`. You are making surgical additions to a working file — no rewrites, no feature creep, no cleanup of adjacent code.

Your objective: Install the `od_operator_profile` system — replace the legacy flat session key with a structured profile object, wire `showDebrief()` to write it, and surface lifetime execution rate in the debrief screen.

---

🎯 OBJECTIVE

Replace `od_ff_session` (legacy flat key) with `od_operator_profile` (structured object), wire the debrief to update it, and render lifetime exec rate in the debrief UI.

---

⚠️ HARD CONSTRAINTS

- Profile is written **once per session** — in `showDebrief()` only. No writes during card navigation.
- `getProfile()` must initialize every field with a default value. No undefined at runtime.
- `startSession()`, `renderCard()`, `advanceCard()`, `skipCard()`, `didIt()` are untouched. This sprint only modifies `showDebrief()` internals and adds three new functions.
- The legacy key removal must be silent. Users cannot tell it happened.
- Do not add `state_history`, `consecutive_same_state`, or `intervention_dismissals` — those are Sprint 4.
- All new JS goes inside the existing `<script>` block. No new files.

---

🧠 STEP 1 — ESTABLISH STORAGE CONSTANTS

The file already defines `K_SAVE` and `K_UPDI`. Add `PROFILE_KEY` directly above them. This is the only key that holds persistent behavioral state.

Find this existing block near the top of the `<script>` tag:

```javascript
/* ─── STORAGE KEYS (od_ prefix — stays on device) ────────────────────────── */
const K_SAVE = 'od_ff_saved';
const K_UPDI = 'od_ff_upgrade_dismissed';
```

Add `PROFILE_KEY` as a new constant above `K_SAVE`. Final result:

```javascript
/* ─── STORAGE KEYS (od_ prefix — stays on device) ────────────────────────── */
const PROFILE_KEY = 'od_operator_profile';
const K_SAVE      = 'od_ff_saved';
const K_UPDI      = 'od_ff_upgrade_dismissed';
```

**Integration point:** Top of `<script>`, immediately after `'use strict';` and any existing comment headers.

---

🧠 STEP 2 — ADD PROFILE FUNCTIONS

These three functions are the backbone of all persistence in Sprints 1–4. Add them as a new `/* ─── SYSTEM CORE ─── */` section, immediately after the storage constants block.

```javascript
/* ─── SYSTEM CORE ─────────────────────────────────────────────────────────── */

function getProfile(){
  try{
    const p=JSON.parse(localStorage.getItem(PROFILE_KEY));
    if(p) return p;
  }catch(e){}
  // Fresh profile — all fields initialized with safe defaults
  const fresh={
    last_state:null,
    last_session:{did_it:0,cards_seen:0,started_at:null,pool_offset:0},
    total_sessions:0,
    total_executed:0,
    total_skipped:0,
    consecutive_skips:0,
    streak:0,
    last_seen:null,
    level:'unstable'
    // state_history, consecutive_same_state, intervention_dismissals added in Sprint 4
  };
  localStorage.setItem(PROFILE_KEY,JSON.stringify(fresh));
  return fresh;
}

function saveProfile(p){
  try{localStorage.setItem(PROFILE_KEY,JSON.stringify(p))}catch(e){}
}

function updateLevel(p){
  const total=p.total_executed+p.total_skipped;
  const rate=total>0?p.total_executed/total:0;
  if(p.total_sessions>=15&&rate>=0.75)       p.level='operator';
  else if(p.total_sessions>=8&&rate>=0.6)    p.level='reliable';
  else if(p.total_sessions>=3&&rate>=0.3)    p.level='engaged';
  else                                        p.level='unstable';
}
```

**Integration point:** After the storage constants, before `SESSION_MAX` and the `STATES` definition.

---

🧠 STEP 3 — LEGACY KEY MIGRATION

Remove the old `od_ff_session` key at startup. It may not exist on all devices — the call is always safe. No data is worth migrating from it; the new profile starts fresh.

Find the existing `init()` function and add the migration call as the **first line** inside it:

```javascript
function init(){
  // Sprint 1: remove legacy flat session key
  localStorage.removeItem('od_ff_session');

  buildEntry();
  const p=new URLSearchParams(location.search);
  const pre=p.get('state');
  if(pre&&POOLS[pre]){
    currentState=pre;
    hideMem();
    loadStateScreen(pre);
    show('state');
    return;
  }
  show('entry');
}
```

**Integration point:** First line of `init()` body. One line. Does not change any other `init()` logic.

---

🧠 STEP 4 — WIRE showDebrief() TO PROFILE SYSTEM

This is the only place profile state is written. Find the existing `showDebrief()` function. Inside it, **replace the existing session-save logic** with the following profile update block. Place it at the top of the function body, after the `if(!sess) return;` guard:

```javascript
function showDebrief(){
  if(!sess) return;

  /* ── 1. UPDATE PROFILE (single write point for all session data) ── */
  const prof=getProfile();
  const prevLastSeen=prof.last_seen;     // capture before overwrite for streak calc

  prof.total_sessions  += 1;
  prof.total_executed  += sess.did_it;
  prof.total_skipped   += sess.skipped;

  prof.last_state   = sess.state;
  prof.last_session = {
    did_it:      sess.did_it,
    cards_seen:  sess.cards_seen,
    started_at:  sess.started_at,
    pool_offset: sess.pool_offset
  };

  // Consecutive skip tracking (resets on any DID IT this session)
  if(sess.did_it===0) prof.consecutive_skips++;
  else                prof.consecutive_skips=0;

  // Streak: daily — compare prev last_seen to now
  if(prevLastSeen){
    const diffDays=Math.floor((Date.now()-prevLastSeen)/(1000*60*60*24));
    if(diffDays===1&&sess.did_it>0)      prof.streak++;
    else if(diffDays>1)                  prof.streak=sess.did_it>0?1:0;
    // same-day re-run: streak unchanged
  } else if(sess.did_it>0){
    prof.streak=1; // first ever session with execution
  }

  prof.last_seen=Date.now();
  updateLevel(prof);
  saveProfile(prof);  // ← ONLY localStorage write in the entire session

  /* ── 2. COMPUTE DISPLAY VALUES ── */
  const lifeTotal=prof.total_executed+prof.total_skipped;
  const execRate=lifeTotal>0?Math.round((prof.total_executed/lifeTotal)*100):null;

  const {verdict,sub}=debriefCopy(sess.did_it,SESSION_MAX);

  /* ── 3. RENDER STATS ── */
  document.getElementById('db-seen').textContent=sess.cards_seen;
  document.getElementById('db-did').textContent=sess.did_it;
  document.getElementById('db-skip').textContent=sess.skipped;

  const ratio=sess.did_it/SESSION_MAX;
  document.getElementById('db-did').style.color=
    ratio===1?'var(--grn)':ratio>=0.66?'var(--gld)':'var(--red)';

  // Exec rate — show after first session completes
  const rateEl=document.getElementById('db-rate');
  if(rateEl){
    if(execRate!==null){
      rateEl.style.display='flex';
      document.getElementById('db-rv').textContent=execRate+'%';
      document.getElementById('db-rv').style.color=
        execRate>=75?'var(--grn)':execRate>=50?'var(--gld)':'var(--red)';
    } else {
      rateEl.style.display='none';
    }
  }

  document.getElementById('db-verdict').textContent=verdict;
  document.getElementById('db-sub').textContent=sub;

  document.getElementById('btn-again').textContent=
    sess.did_it===SESSION_MAX?'NEXT LEVEL →':'RUN IT AGAIN →';

  show('debrief');
}
```

**Integration point:** Replace the entire existing `showDebrief()` body. Preserve the function name and opening `if(!sess) return;` guard.

---

🧠 STEP 5 — ADD EXEC RATE HTML TO DEBRIEF SCREEN

The debrief screen needs a stat block for lifetime exec rate. It hides until the first session completes. Find `#s-debrief` in the HTML and locate the `.db-stats` strip (the three SEEN / EXECUTED / SKIPPED blocks). Add the exec rate block **immediately after** `.db-stats`, before `.db-verdict`:

```html
<!-- Exec rate — hidden until ≥1 session complete -->
<div class="db-stat" id="db-rate"
  style="display:none;flex-direction:column;align-items:center;
         padding:10px 8px;background:var(--bg2);border-radius:9px;
         border:1px solid var(--dim3);margin-bottom:20px;text-align:center">
  <div class="db-sv" id="db-rv" style="font-size:22px">--%</div>
  <div class="db-sl">LIFETIME EXEC<br>RATE</div>
</div>
```

**Integration point:** Inside `#s-debrief > .db-body`, after `.db-stats` div, before `.db-verdict`.

---

🧪 ACCEPTANCE CRITERIA

✔ **First pass:** Run a full 3-card session → hit debrief → `od_operator_profile` appears in DevTools > Application > localStorage. Object contains `total_sessions:1`, `total_executed` matches DID IT count, `level` is populated.

✔ **Exec rate display:** Complete the first session → `#db-rate` shows a percentage in red/gold/green. (lifeTotal > 0 immediately after the first completed session.)

✔ **Edge case — legacy key:** Open DevTools, set `localStorage.setItem('od_ff_session', '99')`, refresh. Key is gone after init. No errors.

✔ **Edge case — first-timer:** Clear all localStorage. Complete one session. `total_sessions` = 1. `streak` = 1 if `did_it > 0`, else 0. `level` = 'unstable'.

✔ **Edge case — streak reset:** Set `last_seen` in profile to 3 days ago via DevTools. Run a session with DID IT. Streak resets to 1, not increments.

✔ **No regressions:** Entry screen, state screen, card rendering, SAVE CARD, SKIP, DID IT — all unchanged in behavior.

✔ **No console errors** on load, session start, debrief, or refresh.

---

📋 DEPLOYMENT NOTES

- **Modified functions:** `init()` (1 line added), `showDebrief()` (full body replaced)
- **New functions added:** `getProfile()`, `saveProfile()`, `updateLevel()`
- **New constant:** `PROFILE_KEY`
- **HTML change:** `#db-rate` div block added to `#s-debrief > .db-body`
- **No CSS additions** in this sprint
- **Cache:** Bump `sw.js` cache version — the new debrief HTML element must be in the cached response

---

🚫 NON-GOALS

- No entry screen changes — Sprint 2
- No status bar, no checkpoint view, no CONTINUE button
- No `state_history`, `consecutive_same_state`, `intervention_dismissals` — Sprint 4
- No RANDOM gating — Sprint 3
- No Spotify upgrade prompt — Sprint 3
- Do not refactor `debriefCopy()`, `runAgain()`, or any other debrief-adjacent function
