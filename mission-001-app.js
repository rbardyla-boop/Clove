(() => {
  'use strict';

  const KEY = 'clove_v2_mission_001';
  const OPTOUT = 'clove_signals_optout_v1';
  const classes = {
    fix: {
      prompt: 'FIX means repair, restore, maintain, diagnose, or improve a real physical thing. A failed repair still counts as an honest mission attempt if you record the result.',
      evidence: 'What is the object’s observable state now? Say whether it is functional, improved, unchanged, or worse, and what changed.'
    },
    serve: {
      prompt: 'SERVE means a bounded task another person, household, community, or organization actually wants done. Do not manufacture a rescue or expose somebody else’s vulnerability.',
      evidence: 'What observable result existed afterward, and was the action actually wanted/useful rather than imposed?'
    },
    learn: {
      prompt: 'LEARN means acquire one concrete skill or sub-skill and demonstrate it. Watching or reading alone is not completion.',
      evidence: 'What can you now demonstrate against the completion check? Describe the demonstration, not the content you consumed.'
    },
    build: {
      prompt: 'BUILD means create or improve a physical or digital artifact another person could actually use. Novelty is not the goal; usefulness is.',
      evidence: 'What exists now, who or what is it for, and how did you test whether it works for that purpose?'
    }
  };

  const sections = ['choose','commit','locked','away','return','debriefSuccess','debriefFailed','debriefNotStarted','complete'];
  let state = null;

  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  async function load() {
    if (!window.ClovePrivateStore) throw new Error('private_store_missing');
    return window.ClovePrivateStore.get(KEY, null);
  }

  async function save(next) {
    if (!window.ClovePrivateStore) throw new Error('private_store_missing');
    await window.ClovePrivateStore.set(KEY, next);
    state = next;
    return state;
  }

  function clear() {
    state = null;
    try { window.ClovePrivateStore?.del(KEY); } catch {}
  }

  function storageFailure(error) {
    let node = $('storageFailure');
    if (!node) {
      node = document.createElement('div');
      node.id = 'storageFailure';
      node.className = 'notice';
      node.setAttribute('role', 'alert');
      document.querySelector('main')?.prepend(node);
    }
    node.textContent = 'Private mission storage is unavailable in this browser. Your mission was not saved. Do not enter private details until storage is working.';
    try { console.error('Mission private storage failed:', error); } catch {}
  }

  function hidden(id, value) { $(id).hidden = value; }
  function showOnly(id) { sections.forEach(s => hidden(s, s !== id)); window.scrollTo({top:0, behavior:'smooth'}); }
  function device() { const w = Math.min(screen.width || innerWidth, innerWidth || screen.width); return w <= 600 ? 'phone' : w <= 1024 ? 'tablet' : 'desktop'; }
  function referrerGroup() {
    if (!document.referrer) return 'direct';
    try {
      const h = new URL(document.referrer).hostname.toLowerCase();
      if (h === location.hostname) return 'direct';
      if (/(google|bing|duckduckgo|yahoo|brave|ecosia)\./.test(h)) return 'search';
      if (/(reddit|facebook|instagram|youtube|tiktok|bsky|twitter|x\.com|t\.co)/.test(h)) return 'social';
      return 'other';
    } catch { return 'other'; }
  }
  function signalsOff() { try { return localStorage.getItem(OPTOUT) === '1' || navigator.globalPrivacyControl === true || navigator.doNotTrack === '1'; } catch { return true; } }
  function signal(event, detail = 'none') {
    if (signalsOff()) return;
    const payload = {event, surface:'mission', device:device(), returnBucket:'none', referrerGroup:referrerGroup(), build:'v2', variant:'none', detail, diagnostic:'none'};
    const body = JSON.stringify(payload);
    try {
      if (navigator.sendBeacon) { navigator.sendBeacon('/__clove/signal', new Blob([body], {type:'application/json'})); return; }
      fetch('/__clove/signal', {method:'POST', headers:{'content-type':'application/json'}, body, credentials:'same-origin', keepalive:true}).catch(() => {});
    } catch {}
  }

  function summary(target, s = state) {
    $(target).innerHTML = `
      <div class="row"><b>Class</b><div>${esc((s?.class || '').toUpperCase())}</div></div>
      <div class="row"><b>Mission</b><div>${esc(s?.action)}</div></div>
      <div class="row"><b>Done when</b><div>${esc(s?.doneWhen)}</div></div>
      <div class="row"><b>First action</b><div>${esc(s?.firstAction)}</div></div>`;
  }

  function validText(id) { return $(id).value.trim().length > 0; }

  document.querySelectorAll('[data-class]').forEach(btn => btn.addEventListener('click', async () => {
    document.querySelectorAll('[data-class]').forEach(b => b.setAttribute('aria-pressed', 'false'));
    btn.setAttribute('aria-pressed', 'true');
    const cls = btn.dataset.class;
    signal('mission_class_selected', cls);
    $('classPrompt').textContent = classes[cls].prompt;
    hidden('commit', false);
    try { await save({class:cls, status:'planning'}); }
    catch (error) { storageFailure(error); return; }
    $('commit').scrollIntoView({behavior:'smooth', block:'start'});
  }));

  $('backToClasses').addEventListener('click', () => { clear(); showOnly('choose'); });

  $('commitForm').addEventListener('submit', async event => {
    event.preventDefault();
    $('commitError').textContent = '';
    const cls = state?.class;
    if (!cls || !classes[cls] || !validText('missionAction') || !validText('doneWhen') || !$('duration').value || !validText('firstAction') || !$('safetyCheck').checked) {
      $('commitError').textContent = 'Complete the mission, finish check, duration, first physical action, and safety confirmation.';
      return;
    }
    const next = {
      class:cls,
      status:'committed',
      action:$('missionAction').value.trim(),
      doneWhen:$('doneWhen').value.trim(),
      duration:$('duration').value,
      firstAction:$('firstAction').value.trim(),
      startNote:$('startNote').value.trim(),
      committedAt:Date.now(),
      returnedTracked:false
    };
    try { await save(next); }
    catch (error) { storageFailure(error); $('commitError').textContent = 'Could not save this mission privately. Nothing was committed.'; return; }
    signal('mission_committed', cls);
    summary('lockedSummary');
    showOnly('locked');
  });

  $('editMission').addEventListener('click', () => {
    if (!state) return;
    showOnly('commit');
    $('classPrompt').textContent = classes[state.class].prompt;
    $('missionAction').value = state.action || '';
    $('doneWhen').value = state.doneWhen || '';
    $('duration').value = state.duration || '';
    $('firstAction').value = state.firstAction || '';
    $('startNote').value = state.startNote || '';
    $('safetyCheck').checked = true;
  });

  $('leaveButton').addEventListener('click', async () => {
    if (!state) return;
    try { await save({...state, status:'left', leftAt:Date.now(), returnedTracked:false}); }
    catch (error) { storageFailure(error); return; }
    signal('mission_exit_prompt_seen', state.class);
    showOnly('away');
  });

  document.querySelectorAll('[data-outcome]').forEach(btn => btn.addEventListener('click', async () => {
    if (!state) return;
    const outcome = btn.dataset.outcome;
    const eventMap = {done:'mission_done', partly:'mission_partly_done', failed:'mission_failed', not_started:'mission_not_started'};
    try { await save({...state, status:'debrief', outcome}); }
    catch (error) { storageFailure(error); return; }
    signal(eventMap[outcome], state.class);
    if (outcome === 'done' || outcome === 'partly') {
      $('classEvidenceLabel').firstChild.textContent = classes[state.class].evidence + ' ';
      showOnly('debriefSuccess');
    } else if (outcome === 'failed') showOnly('debriefFailed');
    else showOnly('debriefNotStarted');
  }));

  $('helpedOther').addEventListener('change', () => {});
  $('failedNext').addEventListener('change', () => hidden('abandonReasonWrap', $('failedNext').value !== 'abandon'));
  $('notStartedNext').addEventListener('change', () => hidden('dropReasonWrap', $('notStartedNext').value !== 'drop'));

  $('successForm').addEventListener('submit', async event => {
    event.preventDefault();
    $('successError').textContent = '';
    const required = ['actualDid','classEvidence','different','harder','learnedSuccess'];
    if (required.some(id => !validText(id)) || !$('helpedOther').value) {
      $('successError').textContent = 'Complete the observable result and debrief fields.';
      return;
    }
    const helped = $('helpedOther').value;
    const debrief = {
      actual:$('actualDid').value.trim(),
      evidence:$('classEvidence').value.trim(),
      different:$('different').value.trim(),
      harder:$('harder').value.trim(),
      learned:$('learnedSuccess').value.trim(),
      helped,
      next:$('nextUseful').value.trim()
    };
    try { await save({...state, status:'complete', debrief, completedAt:Date.now()}); }
    catch (error) { storageFailure(error); $('successError').textContent = 'Could not save this debrief privately.'; return; }
    signal(`mission_helped_other_${helped}`, state.class);
    signal('mission_debrief_completed', state.class);
    finish();
  });

  $('failedForm').addEventListener('submit', async event => {
    event.preventDefault();
    $('failedError').textContent = '';
    if (!validText('failedAttempt') || !validText('failedWhere') || !$('failedCause').value || !validText('failedLearn') || !$('failedNext').value) {
      $('failedError').textContent = 'Complete the failure point, blocker, lesson, and next move.';
      return;
    }
    if ($('failedNext').value === 'abandon' && !validText('abandonReason')) {
      $('failedError').textContent = 'Give the reason for abandoning so this is a decision, not silent disappearance.';
      return;
    }
    const next = $('failedNext').value;
    const debrief = {
      attempt:$('failedAttempt').value.trim(),
      where:$('failedWhere').value.trim(),
      cause:$('failedCause').value,
      learned:$('failedLearn').value.trim(),
      next,
      reason:$('abandonReason').value.trim()
    };
    try { await save({...state, status:'complete', debrief, completedAt:Date.now()}); }
    catch (error) { storageFailure(error); $('failedError').textContent = 'Could not save this failure debrief privately.'; return; }
    if (next === 'smaller') signal('mission_smaller_selected', state.class);
    if (next === 'help') signal('mission_help_requested', state.class);
    if (next === 'abandon') signal('mission_abandoned_reasoned', state.class);
    signal('mission_debrief_completed', state.class);
    finish();
  });

  $('notStartedForm').addEventListener('submit', async event => {
    event.preventDefault();
    $('notStartedError').textContent = '';
    if (!validText('stoppedFirst') || !$('notStartedCause').value || !$('notStartedNext').value) {
      $('notStartedError').textContent = 'Name what blocked the first action and choose a next move.';
      return;
    }
    if ($('notStartedNext').value === 'drop' && !validText('dropReason')) {
      $('notStartedError').textContent = 'Give the reason for dropping the mission.';
      return;
    }
    const next = $('notStartedNext').value;
    const debrief = {
      stopped:$('stoppedFirst').value.trim(),
      cause:$('notStartedCause').value,
      next,
      reason:$('dropReason').value.trim()
    };
    try { await save({...state, status:'complete', debrief, completedAt:Date.now()}); }
    catch (error) { storageFailure(error); $('notStartedError').textContent = 'Could not save this start debrief privately.'; return; }
    if (next === 'shrink') signal('mission_smaller_selected', state.class);
    if (next === 'replace') signal('mission_retry_selected', state.class);
    if (next === 'drop') signal('mission_abandoned_reasoned', state.class);
    signal('mission_debrief_completed', state.class);
    finish();
  });

  function finish() {
    summary('completeSummary');
    const next = state?.debrief?.next;
    $('closingLine').textContent = next ? `Next useful action: ${next}` : 'The result is recorded. You do not need to stay on Clove.';
    showOnly('complete');
  }

  $('newMission').addEventListener('click', () => { clear(); location.reload(); });
  $('leaveClove').addEventListener('click', () => showOnly('away'));

  async function boot() {
    try { state = await load(); }
    catch (error) {
      state = null;
      storageFailure(error);
      signal('mission_viewed', 'none');
      showOnly('choose');
      return;
    }

    signal('mission_viewed', state?.class || 'none');
    if (!state) { showOnly('choose'); return; }
    if (state.status === 'planning') {
      document.querySelector(`[data-class="${state.class}"]`)?.setAttribute('aria-pressed', 'true');
      $('classPrompt').textContent = classes[state.class]?.prompt || '';
      showOnly('commit');
      return;
    }
    if (state.status === 'committed') { summary('lockedSummary'); showOnly('locked'); return; }
    if (state.status === 'left') {
      if (!state.returnedTracked) {
        signal('mission_returned', state.class);
        try { await save({...state, returnedTracked:true}); }
        catch (error) { storageFailure(error); }
      }
      summary('returnSummary');
      showOnly('return');
      return;
    }
    if (state.status === 'debrief') {
      if (state.outcome === 'done' || state.outcome === 'partly') {
        $('classEvidenceLabel').firstChild.textContent = classes[state.class].evidence + ' ';
        showOnly('debriefSuccess');
      } else if (state.outcome === 'failed') showOnly('debriefFailed');
      else showOnly('debriefNotStarted');
      return;
    }
    if (state.status === 'complete') { finish(); return; }
    clear();
    showOnly('choose');
  }

  boot();
})();
