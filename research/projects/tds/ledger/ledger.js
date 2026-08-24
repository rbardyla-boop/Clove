(function () {
  'use strict';

  const ROOT = '/research/projects/tds/ledger/';
  const page = document.body.dataset.ledgerPage || 'index';
  const main = document.querySelector('main');

  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  };
  const link = (href, label, className = '') => {
    const node = make('a', className, label);
    node.href = href;
    return node;
  };
  const badge = (value) => make('span', `badge ${String(value).toLowerCase()}`, value);
  const detail = (label, value, className = '') => {
    if (!value) return null;
    const wrapper = make('div', `detail ${className}`);
    wrapper.append(make('strong', '', label));
    wrapper.append(make('p', '', value));
    return wrapper;
  };
  const fetchJson = async (name) => {
    const response = await fetch(`${ROOT}${name}.json`, { credentials: 'same-origin' });
    if (!response.ok) throw new Error(`${name}.json returned ${response.status}`);
    return response.json();
  };
  const clearAndAppend = (...nodes) => { main.replaceChildren(...nodes.filter(Boolean)); };
  const error = (message) => make('p', 'error', `The public ledger could not load: ${message}`);

  function provenancePanel(provenance) {
    const section = make('section', 'provenance');
    const copy = make('div', 'panel');
    copy.append(make('h2', '', 'Provenance you can inspect'));
    copy.append(make('p', '', 'This is the evidence underneath the argument. v0.11 is a schema-normalized successor reconstructed from verified v0.9. It is not a recovered copy of historical v0.10.'));
    copy.append(make('p', '', 'Be shocking in story. Be boring in receipt.'));
    const data = make('dl', 'meta');
    [['Version', provenance.canonical_version], ['Created', provenance.created], ['Parent', `${provenance.parent_version} · ${provenance.parent_artifact}`], ['Parent SHA-256', provenance.parent_sha256], ['File', provenance.canonical_filename], ['SHA-256', provenance.canonical_sha256], ['Claims', provenance.claim_count]].forEach(([label, value]) => {
      const row = make('div');
      row.append(make('dt', '', label));
      row.append(make('dd', label === 'SHA-256' || label === 'File' ? 'mono' : '', value));
      data.append(row);
    });
    const panel = make('div', 'panel');
    panel.append(make('h2', '', 'Publication boundary'));
    panel.append(data);
    section.append(copy, panel);
    return section;
  }

  async function renderIndex() {
    const [coverage, provenance, firewall] = await Promise.all([
      fetchJson('coverage'), fetchJson('provenance'), fetchJson('publication-firewall'),
    ]);
    const hero = make('section', 'hero');
    hero.append(make('p', 'eyebrow', 'TDS · PUBLIC EVIDENCE SURFACE'));
    hero.append(make('h1', '', 'TDS PUBLIC PROOF LEDGER'));
    hero.querySelector('h1').append(make('span', '', ' The receipts.'));
    hero.append(make('p', 'lede', 'This is the evidence underneath the argument. The ledger shows what survived, how strong the evidence is, what cuts against each claim, what cannot safely be claimed, and what the investigation killed.'));
    main.append(hero, provenancePanel(provenance));
    const stats = make('section', 'section');
    stats.append(make('h2', '', 'At a glance'));
    const grid = make('div', 'stat-grid');
    [['Claims', coverage.claim_count], ['Public', coverage.by_public_classification.PUBLIC || 0], ['Caution', coverage.by_public_classification.CAUTION || 0], ['Hold', coverage.by_public_classification.HOLD || 0], ['Killed', coverage.killed_claim_count], ['Dossiers', coverage.dossier_count], ['Sources', coverage.source_registry_count], ['Firewall', firewall.status]].forEach(([label, value]) => {
      const card = make('div', 'stat');
      card.append(make('strong', '', value));
      card.append(make('span', '', label));
      grid.append(card);
    });
    stats.append(grid);
    const routes = make('div', 'route-grid');
    [['claims/', 'Claims', 'Read each proposition with its limits.'], ['dossiers/', 'Dossiers', 'Browse the 12 stable evidence sections.'], ['killed/', 'Killed claims', 'Things the investigation tried and the evidence did not let us keep.'], ['sources/', 'Source registry', 'See URLs, named sources, and resolution state.']].forEach(([href, label, description]) => {
      const card = make('a', 'route');
      card.href = `${ROOT}${href}`;
      card.append(make('strong', '', label));
      card.append(make('span', '', description));
      routes.append(card);
    });
    stats.append(routes);
    main.append(stats);
  }

  function claimCard(claim) {
    const item = make('article', 'card claim-card');
    item.dataset.classification = claim.public_classification;
    const heading = make('div', 'claim-heading');
    heading.append(make('h2', '', `${claim.claim_id} — ${claim.title}`));
    const badges = make('div', 'badges');
    badges.append(badge(claim.public_classification), badge(claim.evidence_status), badge(claim.audit_state));
    heading.append(badges);
    item.append(heading);
    item.append(make('p', 'claim-sentence', claim.publishable_sentence || 'No publishable sentence recorded.'));
    const details = make('div', 'detail-grid');
    [
      detail('QUALIFIER', claim.status_qualifier, 'qualifier'),
      detail('DIRECT / PRIMARY SOURCE', claim.direct_primary_source),
      detail('BEST SECONDARY SOURCE', claim.best_secondary_source),
      detail('COUNTEREVIDENCE / BOUNDARY', claim.counterevidence_boundary),
      detail('EFFECT / DENOMINATOR', claim.effect_denominator),
      detail('JURISDICTION', claim.jurisdiction),
      detail('CANNOT CLAIM', claim.cannot_claim),
      detail('CHAPTER / DESTINATION', claim.chapter_destination),
      detail('SOURCE RESOLUTION', `${claim.source_resolution_state}${claim.source_resolution_required ? ' · resolution required before independent public display' : ''}`),
    ].forEach((node) => { if (node) details.append(node); });
    if (claim.source_urls?.length) {
      const urls = make('div', 'detail');
      urls.append(make('strong', '', 'SOURCE URLS'));
      const list = make('ul');
      claim.source_urls.forEach((url) => { const li = make('li'); li.append(link(url, url)); list.append(li); });
      urls.append(list); details.append(urls);
    }
    item.append(details);
    return item;
  }

  async function renderClaims() {
    const [claims, provenance] = await Promise.all([fetchJson('claims'), fetchJson('provenance')]);
    const hero = make('section', 'hero');
    hero.append(make('p', 'eyebrow', 'TDS · CLAIM REGISTER'));
    hero.append(make('h1', '', 'The claims.'));
    hero.append(make('p', 'lede', 'Every record keeps its evidence status, audit state, counterevidence, CANNOT CLAIM boundary, and provenance. A hold is visible; it is not quietly promoted.'));
    main.append(hero, provenancePanel(provenance));
    const section = make('section', 'section');
    const toolbar = make('div', 'toolbar');
    const label = make('label', '', 'Show classification');
    const select = document.createElement('select');
    [['ALL', 'All claims'], ['PUBLIC', 'PUBLIC'], ['CAUTION', 'CAUTION'], ['HOLD', 'HOLD']].forEach(([value, text]) => { const option = make('option', '', text); option.value = value; select.append(option); });
    label.append(select); toolbar.append(label);
    const note = make('p', 'count-note'); toolbar.append(note); section.append(toolbar);
    const list = make('div', 'claim-list'); section.append(list); main.append(section);
    const dossier = new URLSearchParams(window.location.search).get('dossier');
    const draw = () => {
      const filter = select.value;
      const shown = claims.filter((claim) => (filter === 'ALL' || claim.public_classification === filter) && (!dossier || claim.section === dossier));
      list.replaceChildren(...shown.map(claimCard));
      note.textContent = `${shown.length} of ${dossier ? `claims in ${dossier}` : `${claims.length} total claims`}.`;
    };
    select.addEventListener('change', draw); draw();
  }

  async function renderDossiers() {
    const [dossiers, provenance] = await Promise.all([fetchJson('dossiers'), fetchJson('provenance')]);
    const hero = make('section', 'hero');
    hero.append(make('p', 'eyebrow', 'TDS · DOSSIER INDEX'));
    hero.append(make('h1', '', 'The dossiers.'));
    hero.append(make('p', 'lede', 'Stable sections derived from the ledger. Chapter mappings are not inferred where the canonical source does not provide them.'));
    main.append(hero, provenancePanel(provenance));
    const grid = make('div', 'dossier-grid');
    dossiers.forEach((dossier) => {
      const card = make('a', 'card dossier-card');
      card.href = `${ROOT}claims/?dossier=${encodeURIComponent(dossier.section)}`;
      card.append(make('h2', '', dossier.section));
      card.append(make('p', '', `${dossier.claim_count} claims · ${dossier.public_count} public · ${dossier.caution_count} caution · ${dossier.hold_count} hold`));
      const counts = make('div', 'dossier-counts');
      [['PUBLIC', dossier.public_count], ['CAUTION', dossier.caution_count], ['HOLD', dossier.hold_count]].forEach(([label, value]) => { counts.append(badge(`${label} ${value}`)); });
      card.append(counts);
      if (dossier.coverage_warnings.length) card.append(make('p', 'warning', `${dossier.coverage_warnings.length} coverage warning(s)`));
      grid.append(card);
    });
    const section = make('section', 'section'); section.append(grid); main.append(section);
  }

  async function renderKilled() {
    const [killed, provenance] = await Promise.all([fetchJson('killed-claims'), fetchJson('provenance')]);
    const hero = make('section', 'hero');
    hero.append(make('p', 'eyebrow', 'TDS · PRESERVED FAILURES'));
    hero.append(make('h1', '', 'The claims we killed.'));
    hero.append(make('p', 'lede', 'Things the investigation tried and the evidence did not let us keep. The ledger preserves the disposition without inventing a replacement theory.'));
    main.append(hero, provenancePanel(provenance));
    const list = make('div', 'killed-list');
    killed.forEach((entry) => {
      const card = make('article', 'card killed-card');
      card.append(make('p', '', entry.claim_or_myth));
      if (entry.reason_or_disposition) card.append(make('small', '', `Disposition: ${entry.reason_or_disposition}`));
      card.append(make('small', '', entry.source_section));
      list.append(card);
    });
    const section = make('section', 'section'); section.append(list); main.append(section);
  }

  async function renderSources() {
    const [sources, coverage, provenance] = await Promise.all([fetchJson('sources'), fetchJson('source-coverage'), fetchJson('provenance')]);
    const hero = make('section', 'hero');
    hero.append(make('p', 'eyebrow', 'TDS · SOURCE REGISTRY'));
    hero.append(make('h1', '', 'The receipts.'));
    hero.append(make('p', 'lede', 'A source identity is not the same as an independently resolved URL. This registry keeps that distinction visible.'));
    main.append(hero, provenancePanel(provenance));
    const section = make('section', 'section');
    section.append(make('p', 'count-note', `${sources.length} source records · ${coverage.length} claim-source assessments.`));
    const list = make('div', 'source-list');
    sources.forEach((source) => {
      const card = make('article', 'card source-card');
      card.append(make('h2', '', source.source_id));
      if (source.url) card.append(link(source.url, source.url));
      else card.append(make('p', '', source.label));
      card.append(make('p', '', `${source.source_type} · ${source.claim_ids.length} claim(s)`));
      list.append(card);
    });
    section.append(list); main.append(section);
  }

  async function render() {
    try {
      main.replaceChildren();
      if (page === 'claims') await renderClaims();
      else if (page === 'dossiers') await renderDossiers();
      else if (page === 'killed') await renderKilled();
      else if (page === 'sources') await renderSources();
      else await renderIndex();
    } catch (loadError) {
      clearAndAppend(error(loadError instanceof Error ? loadError.message : 'unknown error'));
    }
  }
  render();
}());
