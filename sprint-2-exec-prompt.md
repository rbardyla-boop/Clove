🔧 CLAUDE CODE — SPRINT 2 EXECUTION PROMPT
ENTRY CHECKPOINT: Return Visit Fork

You are Claude Code working on `field-ops.html` — a single-file static PWA with no build pipeline. Sprint 1 is complete: `od_operator_profile` exists in localStorage after the first completed session. All state reads via `getProfile()`. Writes happen only in `showDebrief()`.

Your objective: Fork the entry screen — new users see the hook (existing state grid + random); returning users see a checkpoint with their last state, session history, and a CONTINUE / SWITCH STATE flow.

---

🎯 OBJECTIVE

Replace the flat `buildEntry()` call with a fork on `total_sessions > 0`, implement `renderCheckpoint()` and `renderStatusBar()`, and add the supporting HTML structure and CSS.

---

⚠️ HARD CONSTRAINTS

- `enterState()`, `enterReturn()`, `loadStateScreen()`, `startSession()` — **none of these change**. You are only modifying what the entry screen renders.
- `#hook-view` and `#checkpoint-view` must be independent. Showing one hides the other. No shared DOM state.
- CONTINUE → `continueSession()` → `enterReturn()` → `loadStateScreen()`. Do not shortcut this chain.
- All new CSS class names must be new — confirm none of `.chk-tag`, `.chk-state`, `.chk-meta`, `.btn-continue`, `.btn-switch`, `#state-drawer` exist before this sprint.
- `randomButtonHTML(prof)` in this sprint returns the RANDOM button unconditionally. The skip-gating check is Sprint 3.
- `buildStateGrid(containerId)` is a shared helper. It gets used in both hook and checkpoint views.

---

🧠 STEP 1 — UPDATE #s-entry HTML STRUCTURE

The current `#s-entry` has `.e-top` (hook content) + `.e-sec` (secondary row). Restructure it to hold both views. Find `#s-entry` in the HTML and update it to:

```html
<div class="scr on" id="s-entry">
  <nav class="nav">
    <a class="nav-l" href="./index.html?tab=more">← DECK</a>
    <span class="nav-r" style="font-size:8px;letter-spacing:2px">FIELD FREQUENCY</span>
  </nav>

  <!-- Status bar — shown on return visits, injected by renderStatusBar() -->
  <div id="status-bar"></div>

  <!-- Checkpoint view — shown on return visits, injected by renderCheckpoint() -->
  <div id="checkpoint-view"></div>

  <!-- Hook view — shown on first visit only -->
  <div class="e-top" id="hook-view">
    <div class="e-eye">OPERATOR'S DECK</div>
    <h1 class="e-h1">YOU'RE NOT STUCK.<br>YOU'RE <em>AVOIDING</em><br>SOMETHING.</h1>
    <p class="e-sub">PICK WHERE IT'S BREAKING:</p>
    <div class="sg" id="state-grid"></div>
  </div>

  <!-- Secondary row — hook mode only. Injected by renderHook(). -->
  <div class="e-sec" id="hook-secondary"></div>
  <p class="e-foot">🔒 Nothing leaves this device. No accounts. No tracking.</p>
</div>
```

**Integration point:** Replace the entire `#s-entry` block in the HTML. Nav, hook-view content, and footer copy remain the same. You are adding `#status-bar` and `#checkpoint-view` as empty containers and wrapping the existing content in `#hook-view`.

---

🧠 STEP 2 — ADD buildStateGrid() HELPER

This function is called by both hook view and checkpoint view. Add it immediately before `buildEntry()` in the JS:

```javascript
// Shared state grid builder — used by both hook and checkpoint drawer
function buildStateGrid(containerId){
  const el=document.getElementById(containerId);
  if(!el) return;
  el.innerHTML=Object.entries(STATES).map(([k,s])=>
    `<button class="sb" data-s="${k}" onclick="enterState('${k}')">
      <span class="sb-ico">${s.ico}</span>
      <span class="sb-lbl">${s.lbl}</span>
      <span class="sb-hint">${esc(s.hint)}</span>
    </button>`
  ).join('');
}
```

**Integration point:** Directly before `buildEntry()`, in the ENTRY SCREEN section of the JS.

---

🧠 STEP 3 — REPLACE buildEntry() WITH FORK LOGIC

Find the existing `buildEntry()` function. Replace its entire body:

```javascript
function buildEntry(){
  const prof=getProfile();
  if(prof.total_sessions>0){
    renderCheckpoint(prof);
  } else {
    renderHook();
  }
}
```

**Integration point:** Same location as existing `buildEntry()`. One-to-one replacement.

---

🧠 STEP 4 — ADD renderHook()

The first-visit path. Builds the state grid and injects the random button into `#hook-secondary`. Add immediately after `buildEntry()`:

```javascript
// HOOK — first visit, no profile data yet
function renderHook(){
  const prof=getProfile();
  document.getElementById('hook-view').style.display='flex';
  document.getElementById('hook-secondary').style.display='flex';
  document.getElementById('checkpoint-view').style.display='none';
  document.getElementById('status-bar').style.display='none';
  buildStateGrid('state-grid');
  document.getElementById('hook-secondary').innerHTML=randomButtonHTML(prof);
}
```

**Integration point:** After `buildEntry()`, before `renderCheckpoint()`.

---

🧠 STEP 5 — ADD renderCheckpoint(prof)

The return-visit path. Injects the full checkpoint UI — status bar, last-state callout, CONTINUE + SWITCH STATE buttons, and a collapsible state drawer. Add after `renderHook()`:

```javascript
// CHECKPOINT — return visit, profile populated
function renderCheckpoint(prof){
  document.getElementById('hook-view').style.display='none';
  document.getElementById('hook-secondary').style.display='none';

  renderStatusBar(prof);

  const st=STATES[prof.last_state]||Object.values(STATES)[0];
  const total=prof.total_executed+prof.total_skipped;
  const rate=total>0?Math.round((prof.total_executed/total)*100):0;
  const sessions=prof.total_sessions;

  document.getElementById('checkpoint-view').style.display='flex';
  document.getElementById('checkpoint-view').innerHTML=`
    <div class="chk-tag">YOU LEFT OFF</div>
    <div class="chk-state">${esc(st.lbl)}</div>
    <div class="chk-meta">${sessions} SESSION${sessions!==1?'S':''} · ${rate}% EXECUTED</div>
    <button class="btn-continue" onclick="continueSession()">CONTINUE →</button>
    <button class="btn-switch" id="btn-switch-state" onclick="toggleStateDrawer()">↓ SWITCH STATE</button>
    <div id="state-drawer">
      <div class="sg" id="state-grid-chk"></div>
      <div class="e-sec" style="padding:0;margin-top:8px">${randomButtonHTML(prof)}</div>
    </div>`;

  buildStateGrid('state-grid-chk');
}
```

**Integration point:** After `renderHook()`.

---

🧠 STEP 6 — ADD randomButtonHTML(prof)

Returns the HTML string for the RANDOM button. For this sprint it always returns the button — skip gating is Sprint 3. Add after `renderCheckpoint()`:

```javascript
// Returns RANDOM button HTML — skip gating added in Sprint 3
function randomButtonHTML(prof){
  return `<button class="bg" onclick="enterRandom()">⚄ RANDOM</button>`;
}
```

**Integration point:** After `renderCheckpoint()`, before `renderStatusBar()`.

---

🧠 STEP 7 — ADD renderStatusBar(prof)

Renders the level badge, optional streak indicator, and exec rate in `#status-bar`. Add after `randomButtonHTML()`:

```javascript
// STATUS BAR — level, optional streak, exec rate
function renderStatusBar(prof){
  const bar=document.getElementById('status-bar');
  const total=prof.total_executed+prof.total_skipped;
  const rate=total>0?Math.round((prof.total_executed/total)*100):0;

  const LC={unstable:'var(--red)',engaged:'var(--dim)',reliable:'var(--gld)',operator:'var(--grn)'};
  const lcol=LC[prof.level]||'var(--dim)';
  const RC=rate>=75?'var(--grn)':rate>=50?'var(--gld)':'var(--red)';

  const streakHTML=prof.streak>1
    ?`<span class="sb-sep">·</span><span class="sb-val">STREAK ${prof.streak}</span>`
    :'';

  bar.style.display='flex';
  bar.innerHTML=`
    <span class="sb-level" style="color:${lcol}">${prof.level.toUpperCase()}</span>
    ${streakHTML}
    <span class="sb-rate sb-val" style="color:${RC};margin-left:auto">${rate}% EXEC</span>`;
}
```

**Integration point:** After `randomButtonHTML()`, before the ENTRY PATHS section.

---

🧠 STEP 8 — ADD continueSession() AND toggleStateDrawer()

`continueSession()` is the CONTINUE button handler — alias for `enterReturn()`. `toggleStateDrawer()` opens/closes the SWITCH STATE drawer. Add these after `enterReturn()`:

```javascript
// Path D: CONTINUE from checkpoint → same as enterReturn (state screen + memory)
function continueSession(){
  enterReturn();
}

// Toggle state drawer in checkpoint view
function toggleStateDrawer(){
  const d=document.getElementById('state-drawer');
  const b=document.getElementById('btn-switch-state');
  if(!d) return;
  const open=d.classList.toggle('open');
  if(b) b.textContent=open?'↑ HIDE STATES':'↓ SWITCH STATE';
}
```

Add both to `Object.assign(window, {...})` at the bottom of the script: `continueSession, toggleStateDrawer`.

---

🎨 CSS ADDITIONS

Add this block inside the `<style>` tag, immediately after the `.e-foot` rule and before the STATE screen section (`/* ══ SCREEN 2 — STATE ══ */`):

```css
/* ─── STATUS BAR (return visits only) ───────────────────────────────────── */
#status-bar{
  display:none;flex-direction:row;align-items:center;
  padding:8px 26px 0;gap:8px;
  font-size:8px;font-family:'DM Mono',monospace;letter-spacing:1.5px;
}
.sb-level{font-weight:800;letter-spacing:2.5px}
.sb-sep{color:var(--dim3);font-size:10px;line-height:1}
.sb-val{color:var(--dim2)}
.sb-rate{margin-left:auto}

/* ─── CHECKPOINT VIEW (return visits only) ───────────────────────────────── */
#checkpoint-view{
  flex:1;display:none;flex-direction:column;justify-content:center;
  padding:0 26px;
}
.chk-tag{font-size:8px;letter-spacing:4px;color:var(--dim2);
  font-family:'DM Mono',monospace;margin-bottom:14px}
.chk-state{font-family:'Bebas Neue',monospace;font-size:52px;
  letter-spacing:.5px;line-height:1;margin-bottom:8px}
.chk-meta{font-size:9px;font-family:'DM Mono',monospace;
  letter-spacing:1.5px;color:var(--dim);margin-bottom:28px}
.btn-continue{
  width:100%;background:var(--red);color:#fff;border:none;
  border-radius:12px;padding:18px 0;font-size:14px;font-weight:900;
  font-family:'DM Mono',monospace;letter-spacing:4px;cursor:pointer;
  margin-bottom:10px;transition:background .15s,transform .12s;
}
.btn-continue:active{transform:scale(.98);background:#a93226}
.btn-switch{
  width:100%;background:none;border:1px solid var(--dim3);border-radius:10px;
  padding:13px 0;font-size:8px;font-family:'DM Mono',monospace;
  letter-spacing:2px;color:var(--dim2);cursor:pointer;margin-bottom:14px;
  transition:color .15s,border-color .15s;
}
.btn-switch:active{color:#fff;border-color:var(--dim)}
/* Drawer — collapsed by default */
#state-drawer{display:none;padding-top:4px}
#state-drawer.open{display:block}
```

---

🧪 ACCEPTANCE CRITERIA

✔ **First visit (total_sessions === 0):** Hook view shows. State grid populates. RANDOM button visible. No status bar, no checkpoint view. Complete a session → go to debrief → return to entry → checkpoint view now shows.

✔ **Return visit:** Status bar shows level in correct color, exec rate right-aligned. "YOU LEFT OFF" tag, last state name in Bebas 52px, session count and exec % in meta line. CONTINUE button visible in red.

✔ **CONTINUE flow:** Click CONTINUE → state screen for last state → memory banner shows. RUN IT → card renders. Full loop working.

✔ **SWITCH STATE flow:** Click "↓ SWITCH STATE" → drawer opens with 6 state buttons and RANDOM. Click any state → that state's screen. Label toggles to "↑ HIDE STATES".

✔ **Edge case — null last_state:** If `prof.last_state` is null, `renderCheckpoint()` falls back to `Object.values(STATES)[0]`. No crash.

✔ **Level color:** unstable → red. engaged → `var(--dim)`. reliable → gold. operator → green.

✔ **No regressions:** Hook view works on first visit. `enterState()`, `enterRandom()`, `enterReturn()` all function normally.

✔ **No console errors** on first visit, return visit, CONTINUE, SWITCH STATE.

---

📋 DEPLOYMENT NOTES

- **Modified functions:** `buildEntry()` (body replaced)
- **New functions added:** `buildStateGrid()`, `renderHook()`, `renderCheckpoint()`, `randomButtonHTML()`, `renderStatusBar()`, `continueSession()`, `toggleStateDrawer()`
- **HTML change:** `#s-entry` restructured — adds `#status-bar`, `#checkpoint-view`, `#hook-view` wrapper
- **CSS block added:** ~35 lines after `.e-foot` rule
- **window.assign additions:** `continueSession, toggleStateDrawer`
- **Cache:** Bump `sw.js` cache version — both the HTML structure change and new CSS must be in the refreshed cache

---

🚫 NON-GOALS

- No skip gating on RANDOM — `randomButtonHTML()` does not check `consecutive_skips` yet. Sprint 3.
- No Spotify upgrade prompt — Sprint 3
- No intervention panel on the state screen — Sprint 4
- No `state_history`, `consecutive_same_state` fields — Sprint 4
- Do not modify the state screen, output screen, or debrief screen HTML
- Do not refactor `enterReturn()`, `showMem()`, `hideMem()`, `timeAgo()`
