(function () {
  'use strict';

  const form = document.getElementById('research-form');
  const input = document.getElementById('question');
  const investigateButton = document.getElementById('investigate');
  const workspace = document.getElementById('workspace');
  let currentResearch = null;

  function signal(event) {
    if (window.cloveSignal && typeof window.cloveSignal.track === 'function' && window.cloveSignal.track(event) !== false) return;
    try {
      if (localStorage.getItem('clove_signals_optout_v1') === '1' || navigator.globalPrivacyControl === true || navigator.doNotTrack === '1') return;
    } catch {
      return;
    }
    const width = Math.min(screen.width || innerWidth, innerWidth || screen.width);
    const device = width <= 600 ? 'phone' : width <= 1024 ? 'tablet' : 'desktop';
    const body = JSON.stringify({
      event,
      surface: 'research',
      device,
      returnBucket: 'none',
      referrerGroup: 'direct',
      build: 'current',
      variant: 'none',
      detail: 'none',
      diagnostic: 'none',
    });
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/__clove/signal', new Blob([body], { type: 'application/json' }));
    } else {
      fetch('/__clove/signal', { method: 'POST', headers: { 'content-type': 'application/json' }, body, credentials: 'same-origin', keepalive: true }).catch(() => {});
    }
  }

  const escapeText = (value) => String(value ?? '');
  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = escapeText(text);
    return node;
  };
  const section = (title) => {
    const wrapper = make('section', 'result-block');
    wrapper.append(make('p', 'section-kicker', title));
    return wrapper;
  };
  const pill = (value) => make('span', 'pill', value);

  function showLoading(question) {
    workspace.replaceChildren();
    const box = make('div', 'workspace-empty');
    box.append(make('span', 'empty-mark', 'RUNNING'));
    box.append(make('h2', '', 'Following the evidence trail…'));
    box.append(make('p', '', question));
    workspace.append(box);
  }

  function renderTimeline(items) {
    const wrapper = document.createElement('section');
    wrapper.append(make('p', 'section-kicker', 'RESEARCH STATUS'));
    const list = make('ol', 'timeline');
    (items || []).forEach((item) => {
      const li = document.createElement('li');
      li.dataset.state = item.state;
      li.append(make('span', 'timeline-dot'));
      const copy = document.createElement('div');
      copy.append(make('strong', '', item.label));
      copy.append(make('span', '', item.detail));
      li.append(copy);
      list.append(li);
    });
    wrapper.append(list);
    return wrapper;
  }

  function renderClaims(research) {
    const wrapper = section('CLAIMS IN THE ANSWER');
    const list = make('ul', 'claim-list');
    (research.claims || []).forEach((claim) => {
      const item = make('li', 'claim-card');
      item.dataset.role = claim.evidenceRole;
      item.dataset.status = claim.status;
      item.append(make('p', 'claim-title', claim.proposition));
      const meta = make('div', 'claim-meta');
      meta.append(pill(claim.status));
      meta.append(pill(claim.evidenceRole));
      if (claim.measurementPeriod) meta.append(pill(claim.measurementPeriod));
      if (claim.sourceLocation && Object.values(claim.sourceLocation).some(Boolean)) {
        meta.append(pill(Object.values(claim.sourceLocation).filter(Boolean).join(' · ')));
      }
      item.append(meta);
      if (claim.sourceFragment) item.append(make('p', 'fragment', `Source fragment: ${claim.sourceFragment}`));
      list.append(item);
    });
    wrapper.append(list);
    return wrapper;
  }

  function renderSources(research) {
    const wrapper = section('SOURCES');
    const list = make('ul', 'source-list');
    (research.sources || []).forEach((source) => {
      const item = make('li', 'source-card');
      const link = document.createElement('a');
      link.href = source.url;
      link.target = '_blank';
      link.rel = 'noreferrer noopener';
      link.textContent = source.title;
      item.append(link);
      item.append(make('p', '', `${source.institution || 'Source'} · ${source.authority} authority · ${source.discoveryMethod}`));
      const meta = make('div', 'source-meta');
      meta.append(pill(source.sourceId));
      if (source.currentTo) meta.append(pill(`current to ${source.currentTo}`));
      if (source.measurementPeriod) meta.append(pill(source.measurementPeriod));
      item.append(meta);
      list.append(item);
    });
    wrapper.append(list);
    return wrapper;
  }

  function renderUnknowns(research) {
    const wrapper = section('WHAT REMAINS UNKNOWN');
    const list = make('ul', 'unknown-list');
    (research.unknowns || ['No unknowns were recorded.']).forEach((unknown) => list.append(make('li', 'unknown-card', unknown)));
    wrapper.append(list);
    return wrapper;
  }

  function renderDatapoint(research) {
    if (!research.strongestDatapoint) return null;
    const wrapper = section('STRONGEST DATAPOINT');
    const card = make('div', 'datapoint');
    const value = make('div');
    const formatted = typeof research.strongestDatapoint.value === 'number'
      ? research.strongestDatapoint.value.toLocaleString('en-CA')
      : research.strongestDatapoint.value;
    value.append(make('strong', '', `${formatted} ${research.strongestDatapoint.unit || ''}`.trim()));
    value.append(make('span', '', research.strongestDatapoint.proposition));
    card.append(value);
    card.append(make('span', 'period', research.strongestDatapoint.measurementPeriod || 'period not reported'));
    wrapper.append(card);
    return wrapper;
  }

  function renderLegal(research) {
    if (!research.legal) return null;
    const wrapper = section('OFFICIAL TEXT VS CLOVE READING');
    const official = make('div', 'official');
    official.append(make('h3', '', 'OFFICIAL JUSTICE LAWS TEXT'));
    official.append(make('p', '', research.legal.officialText));
    const interpretation = make('div', 'interpretation');
    interpretation.append(make('h3', '', research.legal.interpretationStatus === 'bounded_textual_reading' ? 'CLOVE INTERPRETATION · BOUNDED' : research.legal.interpretationStatus));
    interpretation.append(make('p', '', research.legal.interpretation));
    wrapper.append(official, interpretation);
    return wrapper;
  }

  function renderScience(research) {
    if (!research.science) return null;
    const wrapper = section('SCIENCE EVIDENCE LEVEL');
    const note = make('div', 'science-note');
    note.append(make('strong', '', `${research.science.evidenceLevel} · ${research.science.worksFound} work(s) found`));
    note.append(make('p', '', 'Bibliographic metadata is not a study result. Clove stops at research-required until study-level evidence is extracted and challenged.'));
    wrapper.append(note);
    return wrapper;
  }

  function renderGraph(research) {
    const wrapper = document.createElement('section');
    wrapper.append(make('p', 'section-kicker', 'CLICKABLE EVIDENCE GRAPH'));
    const nodes = make('div', 'graph-nodes');
    const detail = make('p', 'graph-detail', 'Select a node to inspect its role.');
    const claims = new Map((research.claims || []).map((claim) => [claim.id, claim]));
    const sources = new Map((research.sources || []).map((source) => [source.sourceId, source]));
    (research.graph?.nodes || []).forEach((graphNode) => {
      const button = make('button', 'graph-node', `${graphNode.type.toUpperCase()} · ${graphNode.label}`);
      button.type = 'button';
      button.addEventListener('click', () => {
        nodes.querySelectorAll('.graph-node').forEach((node) => node.setAttribute('aria-pressed', 'false'));
        button.setAttribute('aria-pressed', 'true');
        const claim = graphNode.claimId ? claims.get(graphNode.claimId) : null;
        const source = graphNode.sourceId ? sources.get(graphNode.sourceId) : null;
        detail.textContent = claim
          ? `${claim.status}: ${claim.sourceFragment || claim.proposition}`
          : source
            ? `${source.title} · ${source.url}`
            : graphNode.label;
      });
      nodes.append(button);
    });
    wrapper.append(nodes, detail);
    return wrapper;
  }

  function renderExport(research) {
    const wrapper = document.createElement('section');
    wrapper.append(make('p', 'section-kicker', 'OBSIDIAN EXPORT')); 
    const tree = make('ul', 'export-tree');
    (research.export?.files || []).map((file) => file.path).forEach((path) => tree.append(make('li', '', path)));
    wrapper.append(tree);
    return wrapper;
  }

  function showSource() {
    const source = currentResearch && currentResearch.strongestDatapoint && currentResearch.sources.find((item) => item.sourceId === currentResearch.strongestDatapoint.sourceId);
    const sourcePanel = document.getElementById('sources-panel');
    const note = document.getElementById('action-note');
    if (sourcePanel) sourcePanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (note) note.textContent = source ? `Source selected: ${source.title}. Use the link in the Sources panel to open the first-party material.` : 'The source panel is shown below.';
    signal('source_inspected');
  }

  function downloadExport() {
    if (!currentResearch || !currentResearch.export) return;
    const bundle = currentResearch.export.files.map((file) => `<!-- ${file.path} -->\n\n${file.content}`).join('\n\n---\n\n');
    const blob = new Blob([bundle], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'clove-research-export.md';
    link.click();
    URL.revokeObjectURL(url);
    const note = document.getElementById('action-note');
    if (note) note.textContent = `Downloaded ${currentResearch.export.files.length} Obsidian-compatible Markdown files as one portable bundle.`;
    signal('research_exported');
  }

  async function challenge() {
    if (!currentResearch) return;
    const note = document.getElementById('action-note');
    if (note) note.textContent = 'Running the configured challenger…';
    signal('challenge_opened');
    try {
      const response = await fetch('/research/challenge', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question: currentResearch.question }) });
      const payload = await response.json();
      if (payload.challenge) {
        currentResearch.challenge = payload.challenge;
        renderCurrent(currentResearch);
        const updated = document.getElementById('action-note');
        if (updated) updated.textContent = `${payload.challenge.label}: ${payload.challenge.detail}`;
      } else if (note) note.textContent = payload.error || 'The challenger did not return a result.';
    } catch (error) {
      if (note) note.textContent = error instanceof Error ? error.message : 'The challenger could not run.';
    }
  }

  function renderCurrent(research) {
    currentResearch = research;
    workspace.replaceChildren();
    const layout = make('div', 'research-layout');
    const main = make('article', 'main-result');
    const top = make('header', 'result-top');
    const title = make('div');
    title.append(make('p', 'eyebrow', `${research.recipeId} · ${research.generatedAt}`));
    title.append(make('h2', '', research.question));
    const status = make('span', 'status', research.status);
    status.dataset.status = research.status;
    status.dataset.testid = 'research-status';
    top.append(title, status);
    const body = make('div', 'result-body');
    body.append(make('p', 'section-kicker', 'BEST SUPPORTED ANSWER'));
    body.append(make('p', 'answer-copy', research.answer.text));
    body.append(make('p', 'why', research.whyThisAnswer));
    const datapoint = renderDatapoint(research);
    if (datapoint) body.append(datapoint);
    const legal = renderLegal(research);
    if (legal) body.append(legal);
    const science = renderScience(research);
    if (science) body.append(science);
    body.append(renderClaims(research));
    const sources = renderSources(research);
    sources.id = 'sources-panel';
    body.append(sources);
    body.append(renderUnknowns(research));
    const actions = make('div', 'actions');
    const challengeButton = make('button', 'action-button primary-action', 'CHALLENGE THIS');
    challengeButton.type = 'button';
    challengeButton.addEventListener('click', challenge);
    const sourceButton = make('button', 'action-button', 'SHOW ME THE SOURCE');
    sourceButton.type = 'button';
    sourceButton.addEventListener('click', showSource);
    const exportButton = make('button', 'action-button', 'EXPORT RESEARCH');
    exportButton.type = 'button';
    exportButton.addEventListener('click', downloadExport);
    actions.append(challengeButton, sourceButton, exportButton);
    const actionNote = make('p', 'action-note', '');
    actionNote.id = 'action-note';
    body.append(actions, actionNote);
    main.append(top, body);

    const side = make('aside', 'side-stack');
    side.append(renderTimeline(research.timeline));
    const challengePanel = document.createElement('section');
    challengePanel.append(make('p', 'section-kicker', 'CHALLENGE RESULT'));
    const challengeBox = make('div', 'challenge-box');
    challengeBox.append(make('strong', '', `${research.challenge.status.toUpperCase()} · ${research.challenge.label}`));
    challengeBox.append(make('p', '', research.challenge.detail));
    challengePanel.append(challengeBox);
    side.append(challengePanel);
    const graphPanel = document.createElement('section');
    graphPanel.append(renderGraph(research));
    side.append(graphPanel);
    const exportPanel = document.createElement('section');
    exportPanel.append(renderExport(research));
    side.append(exportPanel);
    layout.append(main, side);
    workspace.append(layout);
  }

  function renderFailure(payload, question) {
    workspace.replaceChildren();
    const box = make('div', 'error-state');
    box.dataset.status = payload.status || 'SOURCE_UNAVAILABLE';
    box.append(make('p', 'eyebrow', `${payload.status || 'RESEARCH_FAILED'} · ${question}`));
    box.append(make('h2', '', 'The evidence boundary stopped here.'));
    box.append(make('p', '', payload.error || payload.code || 'No supported result was returned. This is a valid research outcome.'));
    workspace.append(box);
  }

  async function investigate() {
    const question = input.value.trim();
    if (!question) return;
    investigateButton.disabled = true;
    signal('research_submitted');
    showLoading(question);
    try {
      const response = await fetch('/research/', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question, mode: 'investigate' }) });
      const payload = await response.json();
      if (payload.research) {
        renderCurrent(payload.research);
        const insufficient = ['INSUFFICIENT_EVIDENCE', 'SOURCE_UNAVAILABLE', 'RATE_LIMITED', 'RESEARCH_REQUIRED'].includes(payload.research.status);
        signal(insufficient ? 'research_insufficient' : 'research_completed');
      } else {
        renderFailure(payload, question);
        signal('research_insufficient');
      }
    } catch (error) {
      renderFailure({ status: 'SOURCE_UNAVAILABLE', error: error instanceof Error ? error.message : 'The research endpoint could not be reached.' }, question);
      signal('research_insufficient');
    } finally {
      investigateButton.disabled = false;
    }
  }

  signal('research_opened');
  form.addEventListener('submit', (event) => { event.preventDefault(); void investigate(); });
  document.querySelectorAll('[data-example]').forEach((button) => button.addEventListener('click', () => {
    input.value = button.dataset.example || '';
    input.focus();
  }));
}());
