/*
 * Application controller: state, emphasis, drawer, explorers, presentation / walkthrough,
 * AC tracing, search, tooltips, source viewer, deep links and keyboard handling.
 * All workflow content comes from window.WFWorkflow; nothing here is workflow-specific
 * except wiring.
 */
(function () {
  const wf = window.WFWorkflow;
  const U = window.WFUtil;
  const P = window.WFPanels;
  const { $, $$, h, s, put } = U;

  /* ── derived indexes ────────────────────────────────────────────────────────── */
  const rulesById = Object.fromEntries(wf.rules.map((r) => [r.id, r]));
  const allNodes = [...wf.stages, ...wf.humans, ...wf.decisions, ...wf.services];
  const nodeById = Object.fromEntries([...allNodes, ...wf.connectors, ...wf.notes].map((n) => [n.id, n]));
  const nodesForAgent = (agent) => allNodes.filter((n) => (n.agents || []).includes(agent)).map((n) => n.id);
  const artifactEdges = (aid) => wf.edges.filter((e) => (wf.edgeDetails[e.id]?.artifacts || []).includes(aid)).map((e) => e.id);

  /* ── state ──────────────────────────────────────────────────────────────────── */
  const state = {
    mode: 'explore', // explore | present | walk
    deck: null,
    step: -1,
    filter: 'all',
    agent: null,
    toggles: { artifacts: false, decisions: false, humans: false, jev: false, verification: false, agents: false },
    selection: null, // { type, id }
    trace: null, // { ac, i }
    searchHits: null,
    legendHover: null,
    view: 'diagram',
    tab: 'rules',
  };
  const history = [];

  const A = { wf, rulesById, nodesForAgent };

  /* ── diagram ────────────────────────────────────────────────────────────────── */
  const svg = $('#diagram');
  const D = window.WFDiagram.create(svg, wf, {
    onActivate(target) {
      if (!target) return;
      if (target.dataset.open) return open(target.dataset.open);
      if (target.dataset.edge) return open(`edge:${target.dataset.edge}`);
      const id = target.dataset.id;
      if (target.dataset.type === 'edge') return open(`edge:${id}`);
      if (id) return open(`node:${id}`);
    },
    onView(view) {
      $('#zoom-level').textContent = `${Math.round(view.k * 100)}%`;
    },
  });
  A.diagram = D;

  /* ── emphasis ───────────────────────────────────────────────────────────────── */
  function filterSet(filterId) {
    const f = wf.filters.find((x) => x.id === filterId);
    if (!f || f.id === 'all') return null;
    if (f.verification) return new Set(allNodes.filter((n) => n.verification || (n.agents || []).includes('reviewer')).map((n) => n.id));
    return new Set(allNodes.filter((n) => (n.agents || []).some((a) => f.agents.includes(a))).map((n) => n.id));
  }
  const kindSet = (kinds) => new Set(allNodes.filter((n) => kinds.includes(n.kind)).map((n) => n.id));
  const toggleSets = {
    humans: () => new Set(wf.humanCategories.flatMap((c) => c.nodes)),
    jev: () => new Set(wf.jevDecisions.flatMap((j) => j.nodes)),
    verification: () => filterSet('verification'),
    decisions: () => new Set([...wf.decisions.map((d) => d.id), ...wf.stages.filter((x) => x.decisionPoint).map((x) => x.id)]),
  };
  const LEGEND = [
    { id: 'grok', label: 'Grok bots', swatch: 'kind-grok', tip: 'WFTasks, WFRelease, WFReview and WFCoder inside the Grok bot app.', set: () => kindSet(['grok']) },
    { id: 'jev', label: 'Jev decisions', swatch: 'kind-jev', tip: 'Jev decision stages: only WFJev invokes Jev; the calling controller applies policy.', set: () => kindSet(['jev']) },
    { id: 'agent', label: 'Coding / review agents', swatch: 'kind-agent', tip: 'Worker, coding agent and independent reviewers.', set: () => kindSet(['agent']) },
    { id: 'ci', label: 'CI / release runners', swatch: 'kind-ci', tip: 'CI service and release automation.', set: () => new Set([...kindSet(['ci', 'release']), 'ci-service']) },
    { id: 'human', label: 'Human / QA', swatch: 'kind-human', tip: 'Humans and QA: requirement owners, acceptance, decisions.', set: () => kindSet(['human']) },
    { id: 'decision', label: 'Decision', swatch: 'sw-diamond', tip: 'Branch points. Each is owned by a Jev decision stage.', set: () => new Set(wf.decisions.map((d) => d.id)) },
    { id: 'connector', label: 'Connector R / Q', swatch: 'sw-connector', tip: 'Off-page connectors: R = redispatch into 03, Q = QA failure into 15.', set: () => new Set(wf.connectors.map((c) => c.id)) },
    { id: 'boundary', label: 'Physical boundary', swatch: 'sw-boundary', tip: 'Dashed: physical app / machine boundary.', set: () => new Set(), cls: 'legend-boundary' },
    { id: 'e-success', label: 'Pass / auto', swatch: 'sw-edge ek-success', tip: 'Passing gate or automatic progression.', edges: 'success' },
    { id: 'e-fail', label: 'Failure / rework / human', swatch: 'sw-edge ek-fail', tip: 'Failure, rework, clarification or human path.', edges: 'fail' },
    { id: 'e-flow', label: 'Flow', swatch: 'sw-edge ek-flow', tip: 'Normal hand-off.', edges: 'flow' },
    { id: 'artifact', label: 'Artifact', swatch: 'sw-artifact', tip: 'Artifacts that cross a boundary. Hover to show them on the diagram.', set: () => new Set(), artifacts: true },
  ];

  function computeEmphasis() {
    let hl = null;
    let strength = null;
    const edgeHl = new Set();
    let current = null;
    const sel = state.selection;
    if (state.legendHover) {
      const L = LEGEND.find((x) => x.id === state.legendHover);
      hl = L.set ? L.set() : new Set();
      strength = 'strong';
      if (L.edges) wf.edges.filter((e) => e.kind === L.edges).forEach((e) => edgeHl.add(e.id));
      if (L.artifacts) wf.edges.filter((e) => wf.edgeDetails[e.id]?.artifacts?.length).forEach((e) => edgeHl.add(e.id));
    } else if (state.mode !== 'explore' && state.step >= 0) {
      const st = wf.decks[state.deck].steps[state.step];
      hl = new Set(st.focus);
      current = new Set(st.focus);
      strength = 'strong';
      (st.edges || []).forEach((e) => edgeHl.add(e));
    } else if (state.trace) {
      const steps = wf.example.trace[state.trace.ac];
      hl = new Set(steps.map((x) => x.node));
      current = new Set([steps[state.trace.i].node]);
      steps.slice(0, state.trace.i + 1).forEach((x) => (x.edges || []).forEach((e) => edgeHl.add(e)));
      strength = 'strong';
    } else if (sel && sel.type === 'artifact') {
      const a = wf.artifacts.find((x) => x.id === sel.id);
      hl = new Set([...a.producedBy, ...a.consumedBy]);
      artifactEdges(sel.id).forEach((e) => edgeHl.add(e));
      strength = 'soft';
    } else if (sel && sel.type === 'jev') {
      hl = new Set(wf.jevDecisions.find((j) => j.id === sel.id).nodes);
      strength = 'soft';
    } else if (state.agent || state.filter !== 'all') {
      hl = state.agent ? new Set(nodesForAgent(state.agent)) : filterSet(state.filter);
      strength = 'strong';
    } else if (state.searchHits) {
      hl = state.searchHits;
      strength = 'soft';
    } else {
      const on = Object.entries(toggleSets).filter(([k]) => state.toggles[k]);
      if (on.length) { hl = new Set(on.flatMap(([, f]) => [...f()])); strength = 'soft'; }
    }
    const selected = sel && (sel.type === 'node' || sel.type === 'edge') ? sel.id : null;
    if (sel && sel.type === 'node') {
      wf.edges.filter((e) => e.from === sel.id || e.to === sel.id).forEach((e) => edgeHl.add(e.id));
    }
    D.setEmphasis({ hl, strength, edgeHl, selected, current, searchHits: state.searchHits });
    svg.classList.toggle('legend-boundary', state.legendHover === 'boundary');
    renderOverlays();
  }

  /* ── overlays for the toggles ───────────────────────────────────────────────── */
  function renderOverlays() {
    D.clearOverlays();
    const t = state.toggles;
    const layer = D.layers.overlay;
    if (t.decisions) {
      for (const d of wf.decisions) D.halo(d.id, 'halo-decision');
      for (const st of wf.stages.filter((x) => x.decisionPoint)) D.badge(st.id, 'DECISION', 'b-decision', { corner: 'bl', offset: 0 });
    }
    if (t.humans) {
      for (const c of wf.humanCategories) for (const n of c.nodes) D.halo(n, 'halo-human');
      const seen = new Set();
      for (const n of wf.humanCategories.flatMap((c) => c.nodes)) {
        if (seen.has(n)) continue;
        seen.add(n);
        const node = nodeById[n];
        D.badge(n, `HUMAN AUTHORITY · ${(node.human?.role || '').split(' ')[0].replace(/\W+$/, '')}`, 'b-human', { corner: 'tl' });
      }
    }
    if (t.jev) {
      const perStage = new Map();
      for (const j of wf.jevDecisions) {
        const stage = j.nodes.find((n) => n.startsWith('s'));
        const offset = perStage.get(stage) || 0;
        perStage.set(stage, offset + 1);
        D.badge(stage, `JEV · ${j.title}`, 'b-jev', { corner: 'tr', offset, open: `jev:${j.id}` });
        for (const n of j.nodes) if (n.startsWith('d-')) D.halo(n, 'halo-jev');
      }
    }
    if (t.verification) {
      for (const n of filterSet('verification')) D.badge(n, n === 's06b' ? 'PROOF · semantic' : n === 'ci-service' ? 'MECHANICAL EVIDENCE' : n === 's04' ? 'PLAN · IMPLEMENT · VERIFY' : 'VERIFICATION', n === 's06b' ? 'b-proof' : 'b-verify', { corner: 'br' });
    }
    if (t.artifacts || state.legendHover === 'artifact') {
      for (const e of wf.edges) {
        const ids = wf.edgeDetails[e.id]?.artifacts;
        if (ids && ids.length) D.edgeChip(e.id, ids.slice(0, 2).map((id) => wf.artifacts.find((a) => a.id === id)));
      }
    }
    if (t.agents) {
      for (const n of allNodes) {
        const b = D.bboxOf([n.id]);
        if (!b || !n.agents) continue;
        n.agents.forEach((ag, i) => layer.append(s('circle', { class: `agent-dot ag-${ag}`, cx: b.x + b.w - 30 - i * 44, cy: b.y + b.h - 30, r: 16, 'data-open': `agent:${ag}` }, s('title', {}, wf.agents.find((a) => a.id === ag).name))));
      }
    }
    if (state.trace) {
      const steps = wf.example.trace[state.trace.ac];
      const byNode = {};
      steps.forEach((st, i) => (byNode[st.node] = byNode[st.node] || []).push(i + 1));
      for (const [n, nums] of Object.entries(byNode)) D.badge(n, `${state.trace.ac} · ${nums.join(' · ')}`, 'b-trace', { corner: 'tl', open: `ac:${state.trace.ac}:${nums[0] - 1}` });
    }
  }

  /* ── drawer ─────────────────────────────────────────────────────────────────── */
  const drawer = $('#drawer');
  const drawerBody = $('#drawer-body');
  function showDrawer(r, ref) {
    $('#drawer-kicker').textContent = r.kicker || '';
    $('#drawer-title').textContent = r.title;
    drawer.dataset.kind = r.kind || '';
    put(drawerBody, r.body);
    drawerBody.scrollTop = 0;
    $('#drawer-back').hidden = history.length < 2;
    $('#drawer-focus').hidden = !(ref.startsWith('node:') || ref.startsWith('edge:') || ref.startsWith('jev:') || ref.startsWith('ac:') || ref.startsWith('artifact:'));
    if (!drawer.classList.contains('open')) {
      drawer.classList.add('open');
      drawer.removeAttribute('aria-hidden');
      document.body.classList.add('drawer-open');
      setTimeout(() => D.resized(), 20);
    }
  }
  function closeDrawer() {
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('drawer-open');
    history.length = 0;
    state.selection = null;
    if (state.trace) state.trace = null;
    computeEmphasis();
    setHash('');
  }
  $('#drawer-close').addEventListener('click', closeDrawer);
  $('#drawer-back').addEventListener('click', () => {
    history.pop();
    const prev = history.pop();
    if (prev) open(prev);
  });
  $('#drawer-focus').addEventListener('click', () => focusSelection());
  function focusSelection() {
    const sel = state.selection;
    if (state.trace) return D.focus([wf.example.trace[state.trace.ac][state.trace.i].node]);
    if (!sel) return;
    if (sel.type === 'node' || sel.type === 'edge') D.focus([sel.id], { maxK: 0.9 });
    if (sel.type === 'jev') D.focus(wf.jevDecisions.find((j) => j.id === sel.id).nodes);
    if (sel.type === 'artifact') D.focus(artifactEdges(sel.id));
  }

  /* ── open(ref): the single navigation entry point ───────────────────────────── */
  function open(ref, opts = {}) {
    const [type, id, extra] = ref.split(/:(.*)/s)[0] === 'source' ? ['source', ref.slice(7)] : ref.split(':');
    if (type === 'explorer') return showExplorer(id, true);
    if (type === 'source') return openSource(id);
    if (type === 'present' || type === 'walk') return startDeck(type === 'present' ? 'workflow' : 'example', Number(id) || 0);
    if (state.mode !== 'explore' && !opts.keepMode) setMode('explore', { silent: true });
    if (type !== 'ac') state.trace = null;
    let r;
    switch (type) {
      case 'node':
        if (!nodeById[id]) return;
        state.selection = { type: 'node', id };
        r = P.node(A, id);
        D.reveal(id);
        break;
      case 'edge':
        state.selection = { type: 'edge', id };
        r = P.edge(A, id);
        D.reveal(id);
        { const a = wf.edgeDetails[id]?.artifacts?.[0]; if (a) setTimeout(() => A.animateEdge(id, a), 250); }
        break;
      case 'artifact':
        state.selection = { type: 'artifact', id };
        r = P.artifact(A, id);
        break;
      case 'agent':
        state.selection = { type: 'agent', id };
        state.agent = id;
        state.filter = 'all';
        syncChips();
        r = P.agent(A, id);
        break;
      case 'skill':
        state.selection = { type: 'skill', id };
        r = P.skill(A, id);
        { const det = document.getElementById(`skill-${id}`); if (det) det.open = true; }
        break;
      case 'rule':
        if (!rulesById[id]) return;
        state.selection = { type: 'rule', id };
        r = P.rule(A, id);
        break;
      case 'jev':
        state.selection = { type: 'jev', id };
        r = P.jev(A, id);
        D.focus(wf.jevDecisions.find((j) => j.id === id).nodes, { maxK: 0.6 });
        break;
      case 'ac': {
        const steps = wf.example.trace[id];
        if (!steps) return;
        const i = Math.max(0, Math.min(steps.length - 1, Number(extra) || 0));
        state.selection = null;
        state.trace = { ac: id, i };
        r = P.trace(A, id, i);
        D.focus([steps[i].node, ...(steps[i].edges || [])], { maxK: 0.55 });
        break;
      }
      case 'status':
        state.selection = { type: 'status', id };
        r = P.status(A, id);
        break;
      default:
        return;
    }
    if (history[history.length - 1] !== ref) history.push(ref);
    showDrawer(r, ref);
    computeEmphasis();
    if (!opts.fromHash) setHash(hashFor(type, id, extra));
  }
  A.open = open;

  A.animateEdge = (edgeId, artifactId) => D.token(edgeId, wf.artifacts.find((a) => a.id === artifactId));
  A.animateArtifact = async (aid) => {
    const art = wf.artifacts.find((a) => a.id === aid);
    const edges = artifactEdges(aid);
    D.focus(edges, { maxK: 0.5 });
    await new Promise((r) => setTimeout(r, U.prefersReducedMotion() ? 0 : 500));
    for (const e of edges.slice(0, 6)) await D.token(e, art);
  };

  /* ── delegated clicks for data-open anywhere in the page ────────────────────── */
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-open]');
    if (!t || svg.contains(t)) return;
    e.preventDefault();
    open(t.dataset.open);
  });

  /* ── hash routing ───────────────────────────────────────────────────────────── */
  function hashFor(type, id, extra) {
    switch (type) {
      case 'node': { const st = wf.stages.find((x) => x.id === id); return st ? `step-${st.id.slice(1)}` : `node-${id}`; }
      case 'edge': return `edge-${id.replace(/^e-/, '')}`;
      case 'artifact': return `artifact-${id}`;
      case 'agent': return `agent-${id}`;
      case 'skill': return `skill-${id}`;
      case 'rule': return `rule-${id}`;
      case 'jev': return `jev-${id.replace(/^jd-/, '')}`;
      case 'ac': return `ac-${id.replace('AC-', '')}${Number(extra) ? `-step-${Number(extra) + 1}` : ''}`;
      case 'status': return `status-ac-${id.replace('AC-', '')}`;
      default: return '';
    }
  }
  let settingHash = false;
  function setHash(hash) {
    settingHash = true;
    const url = `${location.pathname}${location.search}${hash ? `#${hash}` : ''}`;
    try { window.history.replaceState(null, '', url); } catch { /* file:// in some browsers */ }
    settingHash = false;
  }
  function routeHash() {
    const hsh = decodeURIComponent(location.hash.replace(/^#/, ''));
    if (!hsh) return false;
    if (hsh === 'top' || hsh === 'setup') {
      setMode('explore', { silent: true });
      closeDrawerQuiet();
      document.getElementById(hsh).scrollIntoView({ block: 'start' });
      return true;
    }
    if (hsh === 'workflow') {
      setMode('explore', { silent: true });
      closeDrawerQuiet();
      state.selection = null;
      state.trace = null;
      computeEmphasis();
      D.fitWidth(false);
      $('#workflow').scrollIntoView({ block: 'start' });
      return true;
    }
    // Deep links enter the explorer directly, even with the introduction above it.
    if (/^(step|node|edge|ac|status-ac|jev|artifact|agent|skill|rule|present|walkthrough)-/.test(hsh)) {
      $('#workflow').scrollIntoView({ block: 'start' });
    }
    let m;
    if ((m = hsh.match(/^step-(\w+)$/))) { const key = m[1].toLowerCase(); const st = wf.stages.find((x) => x.id.slice(1) === key); if (st) { open(`node:${st.id}`, { fromHash: true }); D.focus([st.id], { maxK: 0.8 }); return true; } }
    if ((m = hsh.match(/^node-(.+)$/))) { open(`node:${m[1]}`, { fromHash: true }); D.focus([m[1]], { maxK: 0.8 }); return true; }
    if ((m = hsh.match(/^edge-(.+)$/))) { open(`edge:e-${m[1]}`, { fromHash: true }); D.focus([`e-${m[1]}`], { maxK: 0.7 }); return true; }
    if ((m = hsh.match(/^ac-(\d+)(?:-step-(\d+))?$/))) { open(`ac:AC-${m[1]}:${m[2] ? Number(m[2]) - 1 : 0}`, { fromHash: true }); return true; }
    if ((m = hsh.match(/^status-ac-(\d+)$/))) { open(`status:AC-${m[1]}`, { fromHash: true }); return true; }
    if ((m = hsh.match(/^jev-(.+)$/))) { open(`jev:jd-${m[1]}`, { fromHash: true }); return true; }
    if ((m = hsh.match(/^(artifact|agent|skill|rule)-(.+)$/))) {
      open(`${m[1]}:${m[2]}`, { fromHash: true });
      if (m[1] === 'skill') showExplorer('rules', false);
      return true;
    }
    if ((m = hsh.match(/^explorer-(\w+)$/))) { showExplorer(m[1], true); return true; }
    if ((m = hsh.match(/^(present|walkthrough)-(\d+)$/))) { startDeck(m[1] === 'present' ? 'workflow' : 'example', Number(m[2]) - 1); return true; }
    return false;
  }
  window.addEventListener('hashchange', () => { if (!settingHash) routeHash(); });

  /* ── toolbar: filters, toggles, legend, view ────────────────────────────────── */
  function syncChips() {
    for (const b of $$('#filters [data-filter]')) b.setAttribute('aria-pressed', String(!state.agent && state.filter === b.dataset.filter));
    for (const b of $$('#agent-row [data-agent]')) b.setAttribute('aria-pressed', String(state.agent === b.dataset.agent));
  }
  $('#filters').append(...wf.filters.map((f) => h('button', {
    type: 'button', class: 'chip', 'data-filter': f.id, 'aria-pressed': String(f.id === 'all'),
    onclick: () => { state.filter = f.id; state.agent = null; syncChips(); computeEmphasis(); if (f.id !== 'all') D.focus([...filterSet(f.id)], { maxK: 0.3 }); },
  }, f.label)));
  const TOGGLES = [
    ['artifacts', 'Artifacts', 'Show the artifacts that cross each boundary.'],
    ['decisions', 'Decision points', 'Ring every branch and decision stage.'],
    ['humans', 'Human touchpoints', 'Show where human authority sits and why.'],
    ['jev', 'Jev decisions', 'Mark every place Jev participates.'],
    ['verification', 'Verification', 'Separate HOW, mechanical evidence and semantic PROOF.'],
    ['agents', 'Agents', 'Show agent markers and the agent picker.'],
  ];
  $('#toggles').append(...TOGGLES.map(([k, label, tip]) => h('button', {
    type: 'button', class: `toggle t-${k}`, 'data-toggle': k, 'aria-pressed': 'false', 'data-tip': tip,
    onclick: (e) => {
      state.toggles[k] = !state.toggles[k];
      e.currentTarget.setAttribute('aria-pressed', String(state.toggles[k]));
      if (k === 'agents') $('#agent-row').hidden = !state.toggles.agents;
      computeEmphasis();
    },
  }, h('span', { class: 'tg-box', 'aria-hidden': 'true' }), label)));
  $('#agent-row').append(h('span', { class: 'row-label' }, 'Agents:'), ...wf.agents.map((ag) => h('button', {
    type: 'button', class: `chip agent-chip ag-${ag.id}`, 'data-agent': ag.id, 'aria-pressed': 'false', 'data-tip': ag.long,
    onclick: () => { if (state.agent === ag.id) { state.agent = null; syncChips(); computeEmphasis(); } else open(`agent:${ag.id}`); },
  }, h('span', { class: 'dot' }), ag.name)));
  $('#legend').append(...LEGEND.map((L) => h('button', {
    type: 'button', class: 'legend-item', 'data-legend': L.id, 'data-tip': L.tip,
    onpointerenter: () => { state.legendHover = L.id; computeEmphasis(); },
    onpointerleave: () => { state.legendHover = null; computeEmphasis(); },
    onfocus: () => { state.legendHover = L.id; computeEmphasis(); },
    onblur: () => { state.legendHover = null; computeEmphasis(); },
    onclick: () => { state.legendHover = state.legendHover === L.id ? null : L.id; computeEmphasis(); },
  }, h('span', { class: `sw ${L.swatch}`, 'aria-hidden': 'true' }), L.label)));

  $('#zoom-in').addEventListener('click', () => D.zoomBy(1.25));
  $('#zoom-out').addEventListener('click', () => D.zoomBy(0.8));
  $('#zoom-fit').addEventListener('click', () => D.fit(true));
  $('#zoom-reset').addEventListener('click', () => D.fitWidth(true));

  function setView(v) {
    state.view = v;
    document.body.dataset.view = v;
    for (const b of $$('button[data-view]')) b.setAttribute('aria-pressed', String(b.dataset.view === v));
    if (v === 'diagram') setTimeout(() => D.resized(), 20);
  }
  for (const b of $$('button[data-view]')) b.addEventListener('click', () => setView(b.dataset.view));

  /* ── list view (simplified mobile interaction) ──────────────────────────────── */
  function renderList() {
    const el = $('#list-view');
    put(el, h('div', { class: 'lv-bar' },
      h('p', { class: 'meta-muted' }, 'Simplified list of the approved workflow, in diagram order. Tap a card for details.'),
      h('span', { class: 'seg', role: 'group', 'aria-label': 'View' },
        h('button', { type: 'button', class: 'seg-btn', 'data-view': 'diagram', 'aria-pressed': 'false', onclick: () => setView('diagram') }, 'Diagram'),
        h('button', { type: 'button', class: 'seg-btn', 'data-view': 'list', 'aria-pressed': 'true', onclick: () => setView('list') }, 'List'))),
    ...wf.phases.map((ph) => h('section', { class: 'lv-phase' },
      h('h2', {}, ph.title),
      ...ph.nodes.map((id) => {
        const n = nodeById[id];
        const outs = wf.edges.filter((e) => e.from === id);
        const title = n.title || (n.label ? `◆ ${n.label.join(' ')}` : 'CI service');
        return h('button', { type: 'button', class: `lv-card kind-${n.kind || (n.label ? 'decision' : 'ci')}`, 'data-open': `node:${id}` },
          h('span', { class: 'lv-top' }, n.num ? h('span', { class: 'lv-num' }, n.num) : null, h('span', { class: 'lv-title' }, title)),
          n.owner ? h('span', { class: 'lv-owner' }, n.owner, n.status ? ` · ${n.status}` : '') : null,
          h('span', { class: 'lv-dots' }, (n.agents || []).map((a) => h('span', { class: `dot ag-${a}`, title: a }))),
          outs.length ? h('span', { class: 'lv-next' }, outs.map((e) => `→ ${U.nodeLabel(wf, e.to).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&')}${e.label ? ` (${e.label.text})` : ''}`).join('  ·  ')) : null);
      }))));
  }

  /* ── explorers ──────────────────────────────────────────────────────────────── */
  const EXPLORERS = [
    ['rules', 'Rules & skills'], ['trace', 'Trace AC'], ['verification', 'Verification · 06B'], ['ci', 'CI & mutation'],
    ['jev', 'Jev decisions'], ['promotion', 'Merge & promotion'], ['artifacts', 'Artifacts'], ['agents', 'Agents & humans'],
  ];
  const rendered = new Set();
  $('#explorer-tabs').append(...EXPLORERS.map(([id, label]) => h('button', {
    type: 'button', role: 'tab', id: `tab-${id}`, 'aria-controls': `panel-${id}`, 'aria-selected': 'false', tabindex: '-1', 'data-tab': id,
    onclick: () => showExplorer(id, false),
  }, label)));
  $('#explorer-panels').append(...EXPLORERS.map(([id]) => h('div', { role: 'tabpanel', id: `panel-${id}`, 'aria-labelledby': `tab-${id}`, hidden: true, class: 'ex-panel' })));
  $('#explorer-tabs').addEventListener('keydown', (e) => {
    const ids = EXPLORERS.map((x) => x[0]);
    const i = ids.indexOf(state.tab);
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      e.stopPropagation();
      const next = ids[(i + (e.key === 'ArrowRight' ? 1 : ids.length - 1)) % ids.length];
      showExplorer(next, false);
      $(`#tab-${next}`).focus();
    }
  });
  function showExplorer(id, scroll) {
    if (!EXPLORERS.some((x) => x[0] === id)) return;
    state.tab = id;
    for (const [tid] of EXPLORERS) {
      const on = tid === id;
      $(`#tab-${tid}`).setAttribute('aria-selected', String(on));
      $(`#tab-${tid}`).tabIndex = on ? 0 : -1;
      $(`#panel-${tid}`).hidden = !on;
    }
    if (!rendered.has(id)) { $(`#panel-${id}`).append(P.explorers[id](A)); rendered.add(id); }
    if (scroll) $('#explorers').scrollIntoView({ behavior: U.prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
  }

  /* ── presentation / walkthrough ─────────────────────────────────────────────── */
  const caption = $('#caption');
  function setMode(mode, { silent } = {}) {
    state.mode = mode;
    document.body.dataset.mode = mode;
    for (const b of $$('button[data-mode]')) b.setAttribute('aria-pressed', String(b.dataset.mode === mode));
    if (mode === 'explore') {
      state.deck = null;
      state.step = -1;
      caption.hidden = true;
      if (!silent) { computeEmphasis(); setHash(''); }
    }
  }
  for (const b of $$('button[data-mode]')) {
    b.addEventListener('click', () => {
      const m = b.dataset.mode;
      if (m === 'explore') setMode('explore');
      else startDeck(m === 'present' ? 'workflow' : 'example', 0);
    });
  }
  function startDeck(deck, i) {
    closeDrawerQuiet();
    state.trace = null;
    state.selection = null;
    state.agent = null;
    state.filter = 'all';
    syncChips();
    setView('diagram');
    setMode(deck === 'workflow' ? 'present' : 'walk', { silent: true });
    state.deck = deck;
    goStep(Math.max(-1, Math.min(wf.decks[deck].steps.length - 1, i)));
  }
  function closeDrawerQuiet() {
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('drawer-open');
    history.length = 0;
  }
  function goStep(i) {
    const deck = wf.decks[state.deck];
    state.step = i;
    caption.hidden = false;
    const total = deck.steps.length;
    if (i < 0) {
      put(caption, 
        h('div', { class: 'cap-kicker' }, `${deck.title} · overview`),
        h('h2', { class: 'cap-title' }, state.deck === 'workflow' ? 'From ticket to verified release' : wf.example.ticket.title),
        h('ol', { class: 'cap-overview' }, deck.steps.map((st, j) => h('li', {}, h('button', { type: 'button', onclick: () => goStep(j) }, st.title)))),
        capNav(i, total));
      D.fit(true);
      computeEmphasis();
      setHash(`${state.deck === 'workflow' ? 'present' : 'walkthrough'}-0`);
      return;
    }
    const st = deck.steps[i];
    put(caption, 
      h('div', { class: 'cap-kicker' }, `${deck.title} · ${i + 1} / ${total}`),
      h('h2', { class: 'cap-title' }, st.title),
      h('p', { class: 'cap-text', html: U.fmt(st.text, wf) }),
      state.deck === 'example' ? h('p', { class: 'cap-note' }, P.tag('example'), ' ', wf.example.ticket.note) : null,
      h('div', { class: 'cap-progress', 'aria-hidden': 'true' }, deck.steps.map((_, j) => h('span', { class: j === i ? 'on' : j < i ? 'done' : '' }))),
      capNav(i, total));
    computeEmphasis();
    if (st.fit) D.fit(true);
    else D.focus([...st.focus, ...(st.edges || [])], { maxK: 0.7 });
    if (st.artifact) setTimeout(() => { if (state.step === i) A.animateEdge(st.artifact.edge, st.artifact.id); }, U.prefersReducedMotion() ? 0 : 650);
    setHash(`${state.deck === 'workflow' ? 'present' : 'walkthrough'}-${i + 1}`);
  }
  function capNav(i, total) {
    const st = i >= 0 ? wf.decks[state.deck].steps[i] : null;
    return h('div', { class: 'cap-nav' },
      h('button', { type: 'button', class: 'btn', onclick: () => goStep(-1), disabled: i < 0 }, 'Overview'),
      h('button', { type: 'button', class: 'btn', 'aria-label': 'Previous step', onclick: () => goStep(Math.max(-1, i - 1)), disabled: i < 0 }, '← Previous'),
      h('button', { type: 'button', class: 'btn btn-primary', 'aria-label': 'Next step', onclick: () => goStep(Math.min(total - 1, i + 1)), disabled: i >= total - 1 }, 'Next →'),
      st ? h('button', { type: 'button', class: 'btn', onclick: () => { const id = st.focus[0]; setMode('explore', { silent: true }); open(`node:${id}`); } }, 'Details') : null,
      h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => setMode('explore') }, 'Exit'));
  }

  /* ── search ─────────────────────────────────────────────────────────────────── */
  const KEYWORDS = { s08: 'auto merge automerge automatic promotion staging', 'd-auto': 'auto merge automerge automatic', s10: 'merge promotion release', s12: 'promotion release production ready for release hold', s13: 'production release decision deploy_production strict done', 'd-release': 'release now automatic release production', s06b: 'counterexample test strength semantic proof verified unverified failed', s03: 'superset handoff launch payload', s04: 'verification plan scenarios how implementation tests mutation ci green session', s02: 'readiness needs_clarification ac', 'ci-service': 'mutation visual regression browser ci' };
  const plain = (x) => String(x).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&');
  const index = [];
  for (const n of allNodes) {
    const d = wf.details[n.id] || {};
    const text = [n.num, n.title, n.owner, n.status, n.short, ...(n.card ? Object.values(n.card).flat() : []), ...(n.lines || []).map((l) => l.text || l), (n.label || []).join(' '),
      d.responsibility, ...(d.mustNot || []), d.example, d.verification, KEYWORDS[n.id]].filter(Boolean).join(' ');
    index.push({ type: n.num ? `Step ${n.num}` : n.label ? 'Decision' : n.lines ? 'Human' : 'Node', label: plain(U.nodeLabel(wf, n.id)), text, open: `node:${n.id}`, nodes: [n.id] });
  }
  for (const e of wf.edges) {
    const d = wf.edgeDetails[e.id];
    index.push({ type: 'Transition', label: e.label ? e.label.text : `${plain(U.nodeLabel(wf, e.from))} → ${plain(U.nodeLabel(wf, e.to))}`, text: [e.label?.text, ...(d.transfers || []), ...(d.notTransferred || []), d.boundary].join(' '), open: `edge:${e.id}`, nodes: [e.from, e.to] });
  }
  for (const a of wf.artifacts) index.push({ type: 'Artifact', label: a.name, text: `${a.name} ${a.purpose} ${a.example}`, open: `artifact:${a.id}`, nodes: [...a.producedBy, ...a.consumedBy] });
  for (const r of wf.rules) index.push({ type: 'Rule', label: r.title, sub: r.file, text: `${r.title} ${r.quote} ${r.file} ${r.section}`, open: `rule:${r.id}`, nodes: Object.entries(wf.details).filter(([, d]) => (d.rules || []).includes(r.id)).map(([n]) => n) });
  for (const k of wf.skills) index.push({ type: 'Skill', label: k.title, text: `${k.title} ${k.explain}`, open: `skill:${k.id}`, nodes: Object.entries(wf.details).filter(([, d]) => (d.skills || []).includes(k.id)).map(([n]) => n) });
  for (const [k, g] of Object.entries(wf.glossary)) index.push({ type: 'Concept', label: g.term, text: `${g.term} ${g.text}`, term: k, nodes: [] });
  for (const ac of wf.example.acceptanceCriteria) index.push({ type: 'AC (example)', label: `${ac.id} ${ac.text}`, text: `${ac.id} ac ${ac.text} trace`, open: `ac:${ac.id}`, nodes: wf.example.trace[ac.id].map((x) => x.node) });
  for (const j of wf.jevDecisions) index.push({ type: 'Jev decision', label: j.title, text: `jev ${j.title} ${j.question} ${j.questions.join(' ')}`, open: `jev:${j.id}`, nodes: j.nodes });
  for (const c of wf.example.counterexamples) index.push({ type: 'Counterexample', label: c.probe, text: `counterexample ${c.probe} ${c.attempt} ${c.result}`, open: 'explorer:verification', nodes: ['s06b'] });
  for (const c of wf.ciChecks) index.push({ type: 'CI check', label: c.name, text: `${c.name} ${c.proves} ${c.cannot}`, open: 'explorer:ci', nodes: ['s04', 'ci-service'] });
  for (const ag of wf.agents) index.push({ type: 'Agent', label: ag.name, text: `${ag.name} ${ag.long} ${ag.summary}`, open: `agent:${ag.id}`, nodes: nodesForAgent(ag.id) });
  index.forEach((x) => (x.lc = `${x.label} ${x.text}`.toLowerCase()));

  const searchInput = $('#search');
  const results = $('#search-results');
  let active = -1;
  let current = [];
  function runSearch(q) {
    q = q.trim().toLowerCase();
    if (q.length < 2) { current = []; state.searchHits = null; results.hidden = true; searchInput.setAttribute('aria-expanded', 'false'); computeEmphasis(); return; }
    const terms = q.split(/\s+/);
    current = index.filter((x) => terms.every((t) => x.lc.includes(t)))
      .map((x) => ({ x, score: (x.label.toLowerCase().includes(q) ? 0 : 1) + (x.type === 'Rule' ? 0.5 : 0) }))
      .sort((a, b) => a.score - b.score).map((r) => r.x);
    state.searchHits = new Set(current.flatMap((x) => x.nodes));
    active = current.length ? 0 : -1;
    renderResults();
    computeEmphasis();
  }
  function renderResults() {
    results.hidden = false;
    searchInput.setAttribute('aria-expanded', 'true');
    put(results, ...(current.length ? current.slice(0, 14).map((x, i) => h('li', {
      role: 'option', id: `sr-${i}`, 'aria-selected': String(i === active), class: i === active ? 'active' : '',
      onmousedown: (e) => { e.preventDefault(); choose(i); },
    }, h('span', { class: 'sr-type' }, x.type), h('span', { class: 'sr-label' }, x.label), x.sub ? h('span', { class: 'sr-sub' }, x.sub) : null))
      : [h('li', { class: 'sr-empty' }, 'No matches')]),
    h('li', { class: 'sr-foot', 'aria-hidden': 'true' }, `${current.length} results · ${state.searchHits ? state.searchHits.size : 0} diagram elements highlighted`));
    searchInput.setAttribute('aria-activedescendant', active >= 0 ? `sr-${active}` : '');
  }
  function choose(i) {
    const x = current[i];
    if (!x) return;
    results.hidden = true;
    searchInput.setAttribute('aria-expanded', 'false');
    if (x.term) return showTip(searchInput, x.term);
    open(x.open);
  }
  searchInput.addEventListener('input', () => runSearch(searchInput.value));
  searchInput.addEventListener('focus', () => { if (searchInput.value.trim().length >= 2) runSearch(searchInput.value); });
  searchInput.addEventListener('blur', () => setTimeout(() => { results.hidden = true; searchInput.setAttribute('aria-expanded', 'false'); }, 120));
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(current.length - 1, active + 1); renderResults(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(0, active - 1); renderResults(); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(Math.max(0, active)); }
    else if (e.key === 'Escape') { e.stopPropagation(); searchInput.value = ''; runSearch(''); searchInput.blur(); }
  });

  /* ── tooltips ───────────────────────────────────────────────────────────────── */
  const tip = $('#tooltip');
  let tipFor = null;
  function showTip(el, termKey, text) {
    const g = termKey ? wf.glossary[termKey] : null;
    put(tip, g ? h('strong', {}, g.term) : null, h('span', { html: U.fmt(g ? g.text : text, wf) }));
    tip.hidden = false;
    const r = el.getBoundingClientRect();
    const tw = Math.min(340, window.innerWidth - 24);
    tip.style.maxWidth = `${tw}px`;
    const left = Math.max(12, Math.min(window.innerWidth - tw - 12, r.left + r.width / 2 - tw / 2));
    const below = r.bottom + 10 + tip.offsetHeight < window.innerHeight;
    tip.style.left = `${left}px`;
    tip.style.top = `${below ? r.bottom + 8 : r.top - tip.offsetHeight - 8}px`;
    tipFor = el;
  }
  function hideTip() { tip.hidden = true; tipFor = null; }
  const tipTarget = (e) => e.target.closest && e.target.closest('[data-term], [data-tip]');
  document.addEventListener('pointerover', (e) => { const t = tipTarget(e); if (t && e.pointerType !== 'touch') showTip(t, t.dataset.term, t.dataset.tip); });
  document.addEventListener('pointerout', (e) => { const t = tipTarget(e); if (t && t === tipFor && !t.contains(e.relatedTarget)) hideTip(); });
  document.addEventListener('focusin', (e) => { const t = tipTarget(e); if (t) showTip(t, t.dataset.term, t.dataset.tip); });
  document.addEventListener('focusout', (e) => { if (tipTarget(e) === tipFor) hideTip(); });
  document.addEventListener('click', (e) => {
    const t = e.target.closest('.term');
    if (t) { e.preventDefault(); if (tipFor === t) hideTip(); else showTip(t, t.dataset.term); }
    else if (tipFor && !e.target.closest('#tooltip')) hideTip();
  });
  window.addEventListener('scroll', hideTip, { passive: true });

  /* ── source viewer ──────────────────────────────────────────────────────────── */
  const dialog = $('#source-dialog');
  function openSource(spec) {
    const [path, anchor] = spec.split('#');
    const text = window.WFSources?.[path];
    const body = $('#source-body');
    $('#source-path').textContent = path;
    let hit = null;
    let sectionLine = -1;
    let label = 'Full file';
    if (text == null) {
      body.innerHTML = `<p class="src-missing">This file is not embedded. Run <code>node orchestration/presentation/scripts/build-sources.mjs</code>.</p>`;
    } else {
      if (anchor && anchor.startsWith('rule:')) {
        const r = rulesById[anchor.slice(5)];
        sectionLine = U.findSectionLine(text, r.section, path.endsWith('.json'));
        const hitAll = U.findQuoteLines(text.split('\n').slice(Math.max(0, sectionLine)).join('\n'), r.quote);
        hit = hitAll ? hitAll.map((x) => x + Math.max(0, sectionLine)) : null;
        label = `§ ${r.section} — highlighted: “${r.title}”`;
      } else if (anchor && anchor.startsWith('section:')) {
        sectionLine = U.findSectionLine(text, anchor.slice(8), path.endsWith('.json'));
        label = `§ ${anchor.slice(8)}`;
      }
      body.innerHTML = `<pre class="src" tabindex="0" aria-label="${U.esc(path)}">${U.highlightSource(text, path, hit, sectionLine)}</pre>`;
    }
    $('#source-section').textContent = label;
    const headings = text ? text.split('\n').map((l, i) => [l, i]).filter(([l]) => /^#{1,3}\s/.test(l)) : [];
    put($('#source-toc'), ...headings.map(([l, i]) => h('button', { type: 'button', class: 'toc-item', onclick: () => scrollToLine(i) }, l.replace(/^#+\s*/, ''))));
    $('#source-toc').hidden = !headings.length;
    if (!dialog.open) dialog.showModal();
    const target = hit ? hit[0] : sectionLine;
    requestAnimationFrame(() => scrollToLine(target));
  }
  function scrollToLine(i) {
    const el = i >= 0 ? $(`#source-body .src-line[data-line="${i + 1}"]`) : null;
    if (el) el.scrollIntoView({ block: 'center' });
    else $('#source-body').scrollTop = 0;
  }
  $('#source-back').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });

  /* ── keyboard ───────────────────────────────────────────────────────────────── */
  document.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    if (dialog.open || $('#help-dialog').open) return;
    if (U.isTyping(e)) return;
    const inDeck = state.mode !== 'explore' && state.deck;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      if (e.target.closest && e.target.closest('[role="tablist"]')) return;
      const dir = e.key === 'ArrowRight' ? 1 : -1;
      if (inDeck) { e.preventDefault(); goStep(Math.max(-1, Math.min(wf.decks[state.deck].steps.length - 1, state.step + dir))); }
      else if (state.trace) {
        e.preventDefault();
        const n = wf.example.trace[state.trace.ac].length;
        open(`ac:${state.trace.ac}:${Math.max(0, Math.min(n - 1, state.trace.i + dir))}`);
      }
      return;
    }
    if (e.key === 'Escape') {
      if (tipFor) return hideTip();
      if (inDeck) return state.step >= 0 ? goStep(-1) : setMode('explore');
      if (drawer.classList.contains('open')) return closeDrawer();
      if (state.legendHover) { state.legendHover = null; return computeEmphasis(); }
      if (state.filter !== 'all' || state.agent) { state.filter = 'all'; state.agent = null; syncChips(); return computeEmphasis(); }
      return;
    }
    if (e.key === '/') { e.preventDefault(); searchInput.focus(); return; }
    if (e.key === '+' || e.key === '=') return D.zoomBy(1.25);
    if (e.key === '-' || e.key === '_') return D.zoomBy(0.8);
    if (e.key === '0') return D.fit(true);
    if (e.key === 'f' || e.key === 'F') return focusSelection();
    if (e.key === '?') return $('#help-dialog').showModal();
  });
  $('#help-btn').addEventListener('click', () => $('#help-dialog').showModal());
  $('#help-close').addEventListener('click', () => $('#help-dialog').close());

  /* ── theme ──────────────────────────────────────────────────────────────────── */
  const themeBtn = $('#theme-btn');
  function applyTheme(t) {
    if (t) document.documentElement.dataset.theme = t;
    else delete document.documentElement.dataset.theme;
    const dark = t ? t === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    themeBtn.setAttribute('aria-pressed', String(dark));
    themeBtn.querySelector('.theme-label').textContent = dark ? 'Dark' : 'Light';
  }
  applyTheme(U.store.get('theme', null));
  themeBtn.addEventListener('click', () => {
    const dark = themeBtn.getAttribute('aria-pressed') === 'true';
    const next = dark ? 'light' : 'dark';
    U.store.set('theme', next);
    applyTheme(next);
  });

  /* ── boot ───────────────────────────────────────────────────────────────────── */
  renderList();
  $('#what-how-proof').append(...wf.meta.whatHowProof.map((w, i) => [
    i ? h('span', { class: 'whp-arrow', 'aria-hidden': 'true' }, '→') : null,
    h('button', { type: 'button', class: `whp whp-${w.key.toLowerCase()}`, 'data-term': w.term }, h('strong', {}, w.key), ` ${w.text}`),
  ]).flat().filter(Boolean));
  new ResizeObserver(() => D.resized()).observe(svg);
  const stageArea = $('.stage-area');
  const measureChrome = () => {
    const height = stageArea.getBoundingClientRect().top - $('#workflow').getBoundingClientRect().top;
    document.documentElement.style.setProperty('--chrome-h', `${Math.round(height)}px`);
  };
  const chromeObserver = new ResizeObserver(measureChrome);
  for (const el of $$('.top, .toolbar, .legend, .agent-row')) chromeObserver.observe(el);
  window.addEventListener('resize', measureChrome);
  measureChrome();
  const narrow = window.matchMedia('(max-width: 700px)').matches;
  setView(narrow ? 'list' : 'diagram');
  setMode('explore', { silent: true });
  showExplorer('rules', false);
  requestAnimationFrame(() => {
    D.fitWidth(false);
    if (!routeHash()) computeEmphasis();
    document.body.classList.add('ready');
  });

  // Exposed for tests and debugging.
  window.WFApp = { state, open, goStep, startDeck, setMode, diagram: D, computeEmphasis };
})();
