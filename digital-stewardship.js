(() => {
  'use strict';

  const guides = Array.isArray(window.CLOVE_STEWARDSHIP_GUIDES) ? window.CLOVE_STEWARDSHIP_GUIDES : [];
  const guideIds = new Set(guides.map((guide) => guide.id));
  const guideStates = new Set(['NOT_STARTED', 'GUIDED', 'ACTION_REPORTED', 'INSPECTED', 'NEEDS_ATTENTION', 'NOT_APPLICABLE']);
  const confirmations = new Set(['NONE', 'SELF_ATTESTED', 'USER_INSPECTED', 'DETERMINISTIC_CHECK']);
  const categories = [
    ['foundations', 'FOUNDATIONS'],
    ['scams', 'SCAMS & VERIFICATION'],
    ['devices', 'DEVICES'],
    ['privacy', 'PRIVACY & SHARING'],
    ['recovery', 'RECOVERY'],
  ];
  const categoryNames = new Map(categories);
  const legacyMap = {
    clove_ds_i0_v1: 'recovery-readiness',
    clove_ds_i1_v1: 'app-permissions',
    clove_ds_i2_v1: 'unique-credentials',
    clove_ds_i3_v1: 'phishing-messages',
    clove_ds_i5_v1: 'public-sharing',
    clove_ds_i6_v1: 'recovery-readiness',
  };
  const KEY = 'clove_ds_l1_v1';
  const incidentPlans = [
    { id: 'clicked', label: 'I CLICKED SOMETHING', title: 'You clicked a link or opened a file', steps: ['Stop interacting with the page or message.', 'Close it and open the real service through a known route.', 'If you entered a secret or payment detail, contact the service or bank through its official route.', 'Keep the message for an official report; do not post it publicly.'] },
    { id: 'account', label: 'MY ACCOUNT MAY BE HACKED', title: 'Your account may be in trouble', steps: ['Use a known route to the account, not the message that caused the worry.', 'Protect the main account first and change affected sign-in details through the official page.', 'Review active sessions if the service offers that setting.', 'Ask the service’s official support for help.'] },
    { id: 'code', label: 'I GAVE SOMEONE A CODE', title: 'A sign-in code or recovery secret was shared', steps: ['Do not share another code.', 'Use the service’s official security and recovery pages immediately.', 'Change affected sign-in details and review active sessions when the service allows it.', 'Tell the bank, carrier, or service if money, identity, or a phone number is involved.'] },
    { id: 'lost-device', label: 'MY PHONE IS LOST', title: 'A phone or device is missing', steps: ['Use the maker’s official lost-device route to locate or lock it when possible.', 'Protect important accounts through a known clean device.', 'Contact the carrier or service through its official route.', 'Do not give a caller a code because they claim to have found the device.'] },
    { id: 'money', label: 'I SENT MONEY', title: 'Money was sent or a payment may be wrong', steps: ['Contact the bank or payment service immediately through its official route.', 'Save the message and payment details for that report.', 'Do not send more money to unlock, reverse, or prove the payment.', 'Ask a trusted person to stay with you while you make the call if needed.'] },
    { id: 'installed', label: 'I INSTALLED SOMETHING', title: 'You installed a suspicious app or file', steps: ['Stop using the new software and disconnect sensitive sessions when safe.', 'Use official device or maker support.', 'Review important accounts from a known clean device.', 'Do not give surprise support remote access to “fix” it.'] },
    { id: 'impersonation', label: 'SOMEONE IS IMPERSONATING ME', title: 'Someone is using your name or image', steps: ['Save the reportable message or page without spreading it.', 'Use the platform’s official reporting and account-help routes.', 'Tell people who may be contacted to verify requests through a known route.', 'If money or identity is involved, contact the bank or appropriate authority.'] },
    { id: 'unknown', label: 'I DON’T KNOW — SOMETHING FEELS WRONG', title: 'Start with a calm pause', steps: ['Do not click, reply, pay, or share a secret while you are unsure.', 'Use a known route to the account, bank, device maker, or person involved.', 'Ask a trusted person or official support for a second check.', 'Write down what happened while the details are fresh.'] },
  ];

  const $ = (selector) => document.querySelector(selector);
  const areas = $('#areas');
  const guidesEl = $('#guides');
  const progressSummary = $('#progress-summary');
  const incidentActions = $('#incidentActions');
  const incidentPanel = $('#incidentPanel');
  const helperGuides = $('#helper-guides');
  const nextTitle = $('#next-title');
  const nextCopy = $('#next-copy');
  const nextLink = $('#next-link');

  let storageAvailable = true;
  let state = blankState();

  function blankState() {
    return { schemaVersion: 1, guides: {}, incident: null };
  }

  function validRecord(record) {
    return Boolean(record)
      && guideStates.has(record.state ?? 'NOT_STARTED')
      && confirmations.has(record.confirmation ?? 'NONE');
  }

  function validState(candidate) {
    if (!candidate || candidate.schemaVersion !== 1 || typeof candidate.guides !== 'object' || candidate.guides === null) return false;
    if (candidate.incident !== null && !incidentPlans.some((item) => item.id === candidate.incident)) return false;
    return Object.entries(candidate.guides).every(([id, record]) => guideIds.has(id) && validRecord(record));
  }

  function save() {
    if (!storageAvailable) return;
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch { storageAvailable = false; }
  }

  function readLegacy(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  function migrateLegacy() {
    const migrated = blankState();
    for (const [key, id] of Object.entries(legacyMap)) {
      const old = readLegacy(key);
      if (!old || !guideIds.has(id) || old.stage === 'BOUNDARY' || old.stage === 'STOPPED_SAFE') continue;
      const inspected = key === 'clove_ds_i0_v1' && old.stage === 'COMPLETE' && old.recoveryCheckResult === 'current';
      const current = migrated.guides[id];
      if (inspected || !current) {
        migrated.guides[id] = inspected
          ? { state: 'INSPECTED', confirmation: 'USER_INSPECTED' }
          : { state: old.stage === 'COMPLETE' ? 'GUIDED' : 'GUIDED', confirmation: 'NONE' };
      }
    }
    return migrated;
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        state = validState(parsed) ? parsed : migrateLegacy();
        if (state !== parsed || !validState(parsed)) save();
        return;
      }
      state = migrateLegacy();
      if (Object.keys(state.guides).length > 0) save();
    } catch {
      storageAvailable = false;
      state = blankState();
    }
  }

  function recordFor(id) {
    return state.guides[id] ?? { state: 'NOT_STARTED', confirmation: 'NONE' };
  }

  function statusLabel(record) {
    const labels = {
      NOT_STARTED: 'NOT STARTED', GUIDED: 'GUIDED', ACTION_REPORTED: 'ACTION REPORTED',
      INSPECTED: 'INSPECTED', NEEDS_ATTENTION: 'NEEDS ATTENTION', NOT_APPLICABLE: 'NOT APPLICABLE',
    };
    const confirmation = record.confirmation === 'USER_INSPECTED' ? ' · USER-INSPECTED' : record.confirmation === 'SELF_ATTESTED' ? ' · SELF-ATTESTED' : '';
    return `${labels[record.state] ?? 'NOT STARTED'}${confirmation}`;
  }

  function setRecord(id, nextState, confirmation) {
    const current = recordFor(id);
    if (current.state === 'INSPECTED' && nextState === 'ACTION_REPORTED') return;
    state.guides[id] = { state: nextState, confirmation };
    save();
    const target = document.querySelector(`#guide-${id}`);
    if (target) {
      const status = target.querySelector('.guide-status');
      if (status) status.textContent = statusLabel(recordFor(id));
      target.open = true;
    }
    renderNext();
    updateProgress();
  }

  function make(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function list(items, ordered = false) {
    const node = document.createElement(ordered ? 'ol' : 'ul');
    for (const item of items) node.append(make('li', '', item));
    return node;
  }

  function sourceLinks(sources) {
    const node = make('ul');
    for (const source of sources) {
      const li = make('li');
      const link = make('a', '', source.authority);
      link.href = source.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      li.append(link, make('span', '', ` · ${source.topic} · reviewed ${source.reviewedAt}`));
      node.append(li);
    }
    return node;
  }

  function renderPractice(guide) {
    const box = make('div', 'practice');
    box.append(make('p', '', guide.practice.scenario));
    const result = make('p', 'practice-result');
    result.hidden = true;
    for (const choice of guide.practice.choices) {
      const button = make('button', 'practice-choice', choice.label);
      button.type = 'button';
      button.addEventListener('click', () => {
        result.hidden = false;
        result.textContent = `${choice.correct ? 'BEST MOVE' : 'TRY AGAIN'} — ${guide.practice.explanation}`;
      });
      box.append(button);
    }
    box.append(result);
    return box;
  }

  function renderGuide(guide) {
    const record = recordFor(guide.id);
    const details = make('details', 'guide');
    details.id = `guide-${guide.id}`;
    const summary = make('summary');
    const titleRow = make('div', 'guide-title');
    titleRow.append(make('strong', '', guide.title), make('span', 'guide-time', guide.time));
    summary.append(titleRow, make('p', 'guide-summary', guide.summary), make('div', 'guide-status', statusLabel(record)));
    details.append(summary);

    const body = make('div', 'guide-body');
    body.append(make('h3', '', 'Why this matters'), make('p', '', guide.why));
    body.append(make('h3', '', 'Do this'), list(guide.action));
    body.append(make('h3', '', 'Check it'), list(guide.inspection));
    const good = make('div', 'good');
    good.append(make('strong', '', 'What good looks like'), make('ul', '', ''));
    good.querySelector('ul').replaceWith(list(guide.good));
    body.append(good);
    body.append(make('h3', '', 'Practice'), renderPractice(guide));
    body.append(make('h3', '', 'If it goes wrong'), list(guide.recovery));
    body.append(make('h3', '', 'Avoid'), list(guide.avoid));
    body.append(make('h3', '', 'Sources'), sourceLinks(guide.sources));

    const actions = make('div', 'guide-actions');
    const report = make('button', 'guide-action attest', 'I DID THIS'); report.type = 'button';
    report.addEventListener('click', () => setRecord(guide.id, 'ACTION_REPORTED', 'SELF_ATTESTED'));
    const inspect = make('button', 'guide-action inspect', guide.confirmation.inspectedClaim === 'Recovery state inspected' ? 'I INSPECTED RECOVERY STATE' : 'I CHECKED THE SETTING'); inspect.type = 'button';
    inspect.addEventListener('click', () => setRecord(guide.id, 'INSPECTED', 'USER_INSPECTED'));
    const attention = make('button', 'guide-action attention', 'THIS NEEDS ATTENTION'); attention.type = 'button';
    attention.addEventListener('click', () => setRecord(guide.id, 'NEEDS_ATTENTION', 'NONE'));
    const notApplicable = make('button', 'guide-action na', 'NOT FOR ME'); notApplicable.type = 'button';
    notApplicable.addEventListener('click', () => setRecord(guide.id, 'NOT_APPLICABLE', 'NONE'));
    actions.append(report, inspect, attention, notApplicable);
    body.append(actions);
    details.append(body);
    details.addEventListener('toggle', () => {
      if (details.open && recordFor(guide.id).state === 'NOT_STARTED') {
        state.guides[guide.id] = { state: 'GUIDED', confirmation: 'NONE' };
        save();
        const status = details.querySelector('.guide-status');
        if (status) status.textContent = statusLabel(recordFor(guide.id));
        updateProgress();
      }
    });
    return details;
  }

  function updateProgress() {
    const records = guides.map((guide) => recordFor(guide.id));
    const inspected = records.filter((record) => record.state === 'INSPECTED').length;
    const attention = records.filter((record) => record.state === 'NEEDS_ATTENTION').length;
    const started = records.filter((record) => record.state !== 'NOT_STARTED').length;
    progressSummary.textContent = `${inspected} inspected · ${attention} need attention · ${guides.length - started} not started`;
    for (const [id, title] of categories) {
      const categoryGuides = guides.filter((guide) => guide.category === id);
      const count = categoryGuides.filter((guide) => recordFor(guide.id).state === 'INSPECTED').length;
      const need = categoryGuides.filter((guide) => recordFor(guide.id).state === 'NEEDS_ATTENTION').length;
      const target = document.querySelector(`[data-area="${id}"] span`);
      if (target) target.textContent = `${count} inspected${need ? ` · ${need} need attention` : ''}`;
      const heading = document.querySelector(`[data-area="${id}"] strong`);
      if (heading) heading.textContent = title;
    }
  }

  function renderAreas() {
    areas.replaceChildren();
    for (const [id, title] of categories) {
      const card = make('a', 'area');
      card.href = `#area-${id}`;
      card.dataset.area = id;
      card.append(make('strong', '', title), make('span', '', '0 inspected'));
      card.addEventListener('click', () => {
        const first = document.querySelector(`#area-${id}`);
        if (first) first.open = true;
      });
      areas.append(card);
    }
  }

  function renderGuides() {
    guidesEl.replaceChildren();
    helperGuides.replaceChildren();
    for (const [id, title] of categories) {
      const heading = make('h3', 'label', title);
      heading.id = `area-${id}`;
      heading.style.gridColumn = '1 / -1';
      guidesEl.append(heading);
      for (const guide of guides.filter((item) => item.category === id)) guidesEl.append(renderGuide(guide));
    }
    for (const guide of guides.filter((item) => item.category === 'helpers')) helperGuides.append(renderGuide(guide));
  }

  function renderNext() {
    const candidate = guides.find((guide) => recordFor(guide.id).state === 'NEEDS_ATTENTION')
      ?? guides.find((guide) => recordFor(guide.id).state === 'NOT_STARTED')
      ?? guides[0];
    if (!candidate) return;
    nextTitle.textContent = candidate.title;
    nextCopy.textContent = `${candidate.summary} About ${candidate.time}.`;
    nextLink.href = `#guide-${candidate.id}`;
  }

  function renderIncident(plan) {
    incidentPanel.replaceChildren();
    incidentPanel.hidden = false;
    incidentPanel.append(make('h3', '', plan.title), make('p', '', 'Contain → protect root accounts → recover → document → report where appropriate.'));
    incidentPanel.append(list(plan.steps, true));
    state.incident = plan.id;
    save();
  }

  function renderIncidents() {
    incidentActions.replaceChildren();
    for (const plan of incidentPlans) {
      const button = make('button', '', plan.label); button.type = 'button';
      button.addEventListener('click', () => renderIncident(plan));
      incidentActions.append(button);
    }
  }

  if (guides.length === 0) {
    document.body.textContent = 'The Stewardship guide content could not load. Nothing was saved or sent.';
    return;
  }
  load();
  renderAreas();
  renderGuides();
  renderIncidents();
  renderNext();
  updateProgress();
})();
