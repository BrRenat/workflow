/*
 * Detail drawer renderers, explorer sections and interactive evaluators.
 * Every renderer takes the app context `A` ({ wf, open, animateArtifact, … }) and
 * returns DOM. Links use data-open="type:id" and are resolved by app.js.
 */
(function (root) {
  const { h, fmt, esc, nodeLabel, put } = root.WFUtil;
  const EV = root.WFEvaluators;
  const P = (root.WFPanels = {});

  /* ── shared building blocks ─────────────────────────────────────────────────── */
  const TAGS = {
    diagram: ['Approved diagram', 'tag-diagram', 'Verbatim from orchestration/assets/workflow.svg'],
    doc: ['Documentation explanation', 'tag-doc', 'UI explanation derived from the cited repository documents; not itself an operational rule'],
    rule: ['Actual rule', 'tag-rule', 'Verbatim quote from a repository file'],
    example: ['Illustrative example', 'tag-example', 'Made-up web widget example; does not change the workflow'],
    policy: ['Committed example policy', 'tag-rule', 'Values from the committed example policy files (shadow mode)'],
    unavailable: ['Not configured in repository', 'tag-unavailable', 'The repository has no configured value for this'],
  };
  P.tag = (kind) => { const [label, cls, title] = TAGS[kind]; return h('span', { class: `prov-tag ${cls}`, title }, label); };

  P.section = function (title, kind, ...content) {
    return h('section', { class: 'd-section' },
      h('h3', { class: 'd-h' }, h('span', {}, title), kind ? P.tag(kind) : null),
      ...content);
  };
  const html = (s, A) => h('div', { class: 'rich', html: fmt(s, A.wf) });
  const VTERM = { VERIFIED: 'verified', FAILED: 'failed', UNVERIFIED: 'unverified' };
  /** Verdict badge with a glossary tooltip. */
  P.verdict = (v, extra = {}) => h(extra['data-open'] ? 'button' : 'span', { type: extra['data-open'] ? 'button' : null, class: `verdict v-${v}`, 'data-term': VTERM[v], ...extra }, v);
  const list = (items, A, cls = '') => h('ul', { class: `d-list ${cls}` }, items.map((it) => h('li', { html: fmt(typeof it === 'string' ? it : it.text, A.wf) })));

  P.nodeChip = (A, id, label) => h('button', { type: 'button', class: `chip-link node-link`, 'data-open': `node:${id}`, html: label || nodeLabel(A.wf, id) });
  P.artifactChip = (A, id) => {
    const a = A.wf.artifacts.find((x) => x.id === id);
    return h('button', { type: 'button', class: 'chip-link artifact-link', 'data-open': `artifact:${id}` }, h('span', { class: 'a-icon' }, a.icon), a.name);
  };
  P.agentChip = (A, id) => {
    const a = A.wf.agents.find((x) => x.id === id);
    return h('button', { type: 'button', class: `chip-link agent-chip ag-${id}`, 'data-open': `agent:${id}` }, h('span', { class: 'dot' }), a.name);
  };

  P.ruleCard = function (A, id, { compact = false } = {}) {
    const r = A.rulesById[id];
    if (!r) return h('div', { class: 'rule-card missing' }, `Unknown rule ${id}`);
    return h('article', { class: 'rule-card', id: `rule-card-${id}` },
      h('header', {}, h('strong', {}, r.title), P.tag('rule')),
      r.file.endsWith('.json') ? h('blockquote', { class: 'json' }, h('code', {}, r.quote)) : h('blockquote', { html: fmt(r.quote, A.wf) }),
      h('footer', {},
        h('span', { class: 'prov' }, h('span', { class: 'prov-k' }, 'Source '), h('code', {}, r.file), h('span', { class: 'prov-k' }, ' § '), r.section),
        compact ? null : h('span', { class: 'prov' }, h('span', { class: 'prov-k' }, 'Agent '), r.agent === 'all' ? 'all agents' : (A.wf.agents.find((a) => a.id === r.agent) || {}).name || r.agent),
        h('button', { type: 'button', class: 'btn-mini', 'data-open': `source:${r.file}#rule:${r.id}` }, 'Open rule ↗')));
  };
  const rulesBlock = (A, ids) => h('div', { class: 'rule-list' }, ids.map((id) => P.ruleCard(A, id, { compact: true })));

  /* ── node drawer ────────────────────────────────────────────────────────────── */
  P.node = function (A, id) {
    const wf = A.wf;
    const st = wf.stages.find((x) => x.id === id);
    const hu = wf.humans.find((x) => x.id === id);
    const dm = wf.decisions.find((x) => x.id === id);
    const cn = wf.connectors.find((x) => x.id === id);
    const sv = wf.services.find((x) => x.id === id);
    const nt = wf.notes.find((x) => x.id === id);
    const d = wf.details[id] || {};
    const out = h('div', { class: 'd-body' });

    if (nt) {
      out.append(P.section('Diagram note', 'diagram', h('p', { class: 'verbatim' }, nt.lines.map((l) => l.text).join(' '))));
      const o = nt.opens;
      const label = { stage: 'Open stage', edge: 'Open transition', decision: 'Open decision', explorer: 'Open explorer' }[o.type];
      out.append(h('p', {}, h('button', { type: 'button', class: 'btn', 'data-open': `${o.type === 'stage' ? 'node' : o.type === 'decision' ? 'jev' : o.type}:${o.id}` }, `${label} →`)));
      return { title: 'Diagram note', kicker: 'Note', body: out };
    }

    if (st) {
      const card = h('dl', { class: 'card-grid' });
      for (const [k, label] of [['ready', 'Ready'], ['scope', 'Scope'], ['tools', 'Tools'], ['pass', 'Pass']]) {
        card.append(h('dt', {}, label), h('dd', {}, st.card[k].join(' ')));
      }
      out.append(h('div', { class: 'd-meta' },
        h('span', { class: `owner-pill kind-${st.kind}` }, st.owner),
        st.status ? h('span', { class: 'status-pill' }, st.status) : null,
        h('span', { class: 'meta-muted' }, `Ticket status: ${st.ticketStatus}`)));
      out.append(h('div', { class: 'd-agents' }, st.agents.map((a) => P.agentChip(A, a))));
      if (st.decision) out.append(h('button', { type: 'button', class: 'btn btn-jev', 'data-open': `jev:${st.decision}` }, 'Explain decision →'));
      if (d.explorer) out.append(h('button', { type: 'button', class: 'btn', 'data-open': `explorer:${d.explorer}` }, d.explorer === 'verification' ? 'Open the 06B explorer →' : 'Open explorer →'));
      out.append(P.section('Diagram card', 'diagram', card));
    }
    if (hu) out.append(P.section('Diagram text', 'diagram', h('p', { class: 'verbatim' }, hu.lines.join(' '))));
    if (dm) out.append(P.section('Diagram', 'diagram', h('p', {}, `◆ ${dm.label.join(' ')}`)), h('button', { type: 'button', class: 'btn btn-jev', 'data-open': `jev:${dm.decision}` }, 'Explain decision →'));
    if (sv) out.append(P.section('Diagram text', 'diagram', h('p', { class: 'verbatim' }, sv.lines.map((l) => l.text).join(' '))));

    if (d.responsibility) out.append(P.section(st ? 'Responsibility' : 'What happens here', 'doc', html(d.responsibility, A), d.basis ? h('p', { class: 'basis' }, `Basis: ${d.basis}`) : null));
    if (d.mustNot) {
      out.append(P.section('Must NOT do', 'doc',
        d.mustNotLead ? h('p', { class: 'must-not-lead' }, d.mustNotLead) : null,
        list(d.mustNot, A, 'x-list')));
    }
    if (d.inputs) out.append(P.section('Inputs', 'doc', list(d.inputs, A)));
    if (d.outputs) out.append(P.section('Outputs', 'doc', list(d.outputs, A)));
    if (d.readiness) out.append(P.section('Readiness criteria', 'diagram', list(d.readiness, A)));
    if (d.completion) out.append(P.section('Completion criteria', 'diagram', list(d.completion, A)));
    if (d.rules && d.rules.length) out.append(P.section('Rules', 'rule', rulesBlock(A, d.rules)));
    if (d.skills && d.skills.length) out.append(P.section('Skills', null, h('div', { class: 'chip-row' }, d.skills.map((sid) => h('button', { type: 'button', class: 'chip-link skill-link', 'data-open': `skill:${sid}` }, A.wf.skills.find((x) => x.id === sid).title)))));
    if (d.tools) out.append(P.section('Tools', 'doc', list(d.tools, A)));
    if (d.verification) out.append(P.section('Verification', 'doc', html(d.verification, A)));
    if (d.failures && d.failures.length) {
      out.append(P.section('Failure paths', 'doc', h('ul', { class: 'd-list fail-list' }, d.failures.map((f) => h('li', {},
        h('span', { html: fmt(f.text, A.wf) }),
        f.edge ? h('button', { type: 'button', class: 'btn-mini', 'data-open': `edge:${f.edge}` }, 'Show path') : null,
        f.implicit ? h('span', { class: 'meta-muted' }, ' · described, not drawn') : null)))));
    }
    if (d.example) out.append(P.section('Web widget example', 'example', html(d.example, A)));

    const ins = wf.edges.filter((e) => e.to === id);
    const outs = wf.edges.filter((e) => e.from === id);
    const implicit = wf.implicitEdges.filter((e) => e.from === id || e.to === id);
    if (ins.length || outs.length || implicit.length) {
      const edgeBtn = (e, dir) => h('li', {}, h('button', { type: 'button', class: `chip-link edge-link ek-${e.kind}`, 'data-open': `edge:${e.id}` },
        dir === 'in' ? `← ${nodeLabel(wf, e.from).replace(/<[^>]+>/g, '')}` : `→ ${nodeLabel(wf, e.to).replace(/<[^>]+>/g, '')}`),
        e.label ? h('span', { class: 'meta-muted' }, ` “${e.label.text}”`) : null);
      out.append(P.section('Connections', 'diagram',
        h('ul', { class: 'd-list edge-list' }, ins.map((e) => edgeBtn(e, 'in')), outs.map((e) => edgeBtn(e, 'out'))),
        implicit.length ? h('div', { class: 'implicit' }, h('p', { class: 'meta-muted' }, 'Described in the diagram text / PIPELINE.md but not drawn as arrows:'),
          h('ul', { class: 'd-list' }, implicit.map((e) => h('li', {}, P.nodeChip(A, e.from), ' → ', P.nodeChip(A, e.to), h('span', { class: 'meta-muted' }, ` ${e.text}`))))) : null));
    }

    const kicker = st ? `Step ${st.num}` : hu ? 'Human touchpoint' : dm ? 'Decision point' : cn ? 'Off-page connector' : sv ? 'CI / automation' : '';
    const title = st ? st.title : hu ? hu.title : dm ? dm.label.join(' ') : cn ? `Connector ${cn.letter}` : sv ? 'CI service' : id;
    return { title, kicker, body: out, kind: st ? st.kind : hu ? 'human' : dm ? 'jev' : sv ? 'ci' : cn ? 'fail' : '' };
  };

  /* ── edge drawer ────────────────────────────────────────────────────────────── */
  P.edge = function (A, id) {
    const wf = A.wf;
    const e = wf.edges.find((x) => x.id === id);
    const d = wf.edgeDetails[id] || { transfers: [] };
    const out = h('div', { class: 'd-body' });
    out.append(h('div', { class: 'edge-head' }, P.nodeChip(A, e.from), h('span', { class: `edge-arrow ek-${e.kind}` }, '→'), P.nodeChip(A, e.to)));
    if (e.label) out.append(P.section('Diagram label', 'diagram', h('p', { class: `verbatim tone-${e.label.tone}` }, e.label.text)));
    out.append(P.section('Transferred', 'doc', list(d.transfers, A, 'check-list')));
    if (d.notTransferred) out.append(P.section('Not transferred', 'doc', list(d.notTransferred, A, 'x-list')));
    if (d.fetchedDirectly) out.append(P.section('Fetched directly by the receiving session', 'doc', list(d.fetchedDirectly, A)));
    if (d.boundary) out.append(P.section('Boundary', 'doc', html(d.boundary, A)));
    if (d.artifacts && d.artifacts.length) {
      out.append(P.section('Artifacts on this path', null, h('div', { class: 'chip-row' }, d.artifacts.map((a) => P.artifactChip(A, a))),
        h('button', { type: 'button', class: 'btn', onclick: () => A.animateEdge(id, d.artifacts[0]) }, '▶ Animate artifact')));
    }
    if (d.rules && d.rules.length) out.append(P.section('Rules', 'rule', rulesBlock(A, d.rules)));
    const kindLabel = wf.edgeKinds[e.kind].label;
    return { title: e.label ? e.label.text : `${nodeLabel(wf, e.from).replace(/<[^>]+>/g, '')} → ${nodeLabel(wf, e.to).replace(/<[^>]+>/g, '')}`, kicker: `Transition · ${kindLabel}`, body: out, kind: e.kind };
  };

  /* ── artifact drawer ────────────────────────────────────────────────────────── */
  P.artifact = function (A, id) {
    const a = A.wf.artifacts.find((x) => x.id === id);
    const carried = A.wf.edges.filter((e) => (A.wf.edgeDetails[e.id]?.artifacts || []).includes(id));
    const out = h('div', { class: 'd-body' });
    out.append(P.section('Purpose', 'doc', html(a.purpose, A)));
    out.append(P.section('Produced by', null, h('div', { class: 'chip-row' }, a.producedBy.map((n) => P.nodeChip(A, n)))));
    out.append(P.section('Consumed by', null, h('div', { class: 'chip-row' }, a.consumedBy.map((n) => P.nodeChip(A, n)))));
    out.append(P.section('Example structure', 'example', h('pre', { class: 'code' }, a.example)));
    out.append(P.section('Validation rules', 'doc', list(a.validation, A), rulesBlock(A, a.rules)));
    if (carried.length) {
      out.append(P.section('Travels along', 'diagram',
        h('div', { class: 'chip-row' }, carried.map((e) => h('button', { type: 'button', class: `chip-link edge-link ek-${e.kind}`, 'data-open': `edge:${e.id}` }, e.label ? e.label.text : `${e.from.replace('s', '')} → ${e.to.replace('s', '')}`))),
        h('button', { type: 'button', class: 'btn', onclick: () => A.animateArtifact(id) }, '▶ Show artifact flow')));
    }
    return { title: a.name, kicker: 'Artifact', body: out, icon: a.icon };
  };

  /* ── agent drawer ───────────────────────────────────────────────────────────── */
  P.agent = function (A, id) {
    const ag = A.wf.agents.find((x) => x.id === id);
    const nodes = A.nodesForAgent(id);
    const skills = A.wf.skills.filter((s) => s.agent === id);
    const out = h('div', { class: 'd-body' });
    out.append(P.section('Role', 'doc', html(ag.summary, A), h('p', { class: 'meta-muted' }, ag.long)));
    out.append(P.section(`Participates in ${nodes.length} places`, 'diagram', h('div', { class: 'chip-row' }, nodes.map((n) => P.nodeChip(A, n)))));
    if (skills.length) out.append(P.section('Skills', null, h('div', { class: 'chip-row' }, skills.map((s) => h('button', { type: 'button', class: 'chip-link skill-link', 'data-open': `skill:${s.id}` }, s.title)))));
    if (id === 'human') {
      out.append(P.section('Human authority', 'doc', h('ul', { class: 'd-list' }, A.wf.humanCategories.map((c) => h('li', {}, h('strong', {}, c.label), ' — ', ...c.nodes.map((n) => P.nodeChip(A, n)))))),
        P.ruleCard(A, 'human-return', { compact: true }));
    }
    return { title: ag.name, kicker: 'Agent', body: out, kind: `ag-${id}` };
  };

  /* ── skill / rule drawers ───────────────────────────────────────────────────── */
  P.skill = function (A, id) {
    const sk = A.wf.skills.find((x) => x.id === id);
    const ag = A.wf.agents.find((a) => a.id === sk.agent);
    const out = h('div', { class: 'd-body' });
    out.append(P.section('What this skill covers', 'doc', html(sk.explain, A)));
    out.append(P.section('Source files', null,
      sk.dedicated ? null : h('p', { class: 'meta-muted' }, 'No dedicated skill file exists for this; its rules come from the files below.'),
      h('ul', { class: 'd-list' }, sk.files.map((f) => h('li', {}, h('button', { type: 'button', class: 'chip-link', 'data-open': `source:${f}` }, h('code', {}, f)))))));
    out.append(P.section(`Rules (${sk.rules.length})`, 'rule', rulesBlock(A, sk.rules)));
    return { title: sk.title, kicker: `Skill · ${ag.name}`, body: out };
  };
  P.rule = function (A, id) {
    const r = A.rulesById[id];
    const usedBy = Object.entries(A.wf.details).filter(([, d]) => (d.rules || []).includes(id)).map(([n]) => n);
    const skills = A.wf.skills.filter((s) => s.rules.includes(id));
    const out = h('div', { class: 'd-body' }, P.ruleCard(A, id));
    if (usedBy.length) out.append(P.section('Governs', null, h('div', { class: 'chip-row' }, usedBy.map((n) => P.nodeChip(A, n)))));
    if (skills.length) out.append(P.section('Part of skills', null, h('div', { class: 'chip-row' }, skills.map((s) => h('button', { type: 'button', class: 'chip-link skill-link', 'data-open': `skill:${s.id}` }, s.title)))));
    return { title: r.title, kicker: 'Actual rule', body: out };
  };

  /* ── evaluators (Explain decision) ─────────────────────────────────────────── */
  const TRI = [['pass', 'Pass'], ['uncertain', 'Uncertain'], ['fail', 'Fail']];
  const YNU = [['no', 'No'], ['uncertain', 'Uncertain'], ['yes', 'Yes']];
  const BOOL = [[true, 'Yes'], [false, 'No']];
  const EVALS = {
    readiness: {
      title: '02 · Issue readiness', fn: EV.readiness,
      fields: [
        ['access', 'tracker issue readable', BOOL], ['dependency', 'Dependencies', [['resolved', 'Resolved'], ['pending', 'Pending']]],
        ['present', 'Explicit AC present (code check)', BOOL], ['jev', 'Jev tool / API', [['available', 'Available'], ['unavailable', 'Unavailable']]],
        ['unambiguous', 'AC unambiguous', TRI], ['verifiable', 'AC verifiable', TRI], ['consistent', 'AC consistent', TRI], ['context', 'Enough implementation context', TRI],
        ['risk', 'Elevated change risk', BOOL], ['capacity', 'Eligible worker capacity', [['available', 'Available'], ['exhausted', 'Exhausted'], ['unknown', 'Quota unknown']]],
      ],
      presets: [
        { id: 'web123', label: 'WEB-123 (ready)', note: 'The illustrative ticket: four explicit, observable, consistent AC.', v: { access: true, dependency: 'resolved', present: true, jev: 'available', unambiguous: 'pass', verifiable: 'pass', consistent: 'pass', context: 'pass', risk: false, capacity: 'available' } },
        { id: 'fix-layout', label: '“Fix responsive layout”', note: 'The repository’s own example: a ticket containing only “Fix responsive layout”.', quote: 'readiness-example', v: { access: true, dependency: 'resolved', present: false, jev: 'available', unambiguous: 'fail', verifiable: 'fail', consistent: 'pass', context: 'fail', risk: false, capacity: 'available' } },
        { id: 'resize', label: 'Resize behavior undefined', note: 'Illustrative: the AC define a compact layout below 480px, and the description says host layouts change at runtime, but the AC do not define the expected behavior for runtime container resize. Result → NEEDS_CLARIFICATION. Reason: AC do not define expected behavior for runtime container resize. Action: return to human.', v: { access: true, dependency: 'resolved', present: true, jev: 'available', unambiguous: 'pass', verifiable: 'pass', consistent: 'pass', context: 'fail', risk: false, capacity: 'available' } },
        { id: 'uncertain', label: 'Uncertain Jev answer', note: 'An uncertain answer is not a pass, whatever the other scores are.', v: { access: true, dependency: 'resolved', present: true, jev: 'available', unambiguous: 'pass', verifiable: 'uncertain', consistent: 'pass', context: 'pass', risk: false, capacity: 'available' } },
        { id: 'capacity', label: 'No capacity', note: 'Capable model exists but slots are exhausted: wait, no human approval.', v: { access: true, dependency: 'resolved', present: true, jev: 'available', unambiguous: 'pass', verifiable: 'pass', consistent: 'pass', context: 'pass', risk: false, capacity: 'exhausted' } },
        { id: 'contract', label: 'Public widget contract change', note: 'Ready AC, but `public_contract_change` is positive → owner decision.', v: { access: true, dependency: 'resolved', present: true, jev: 'available', unambiguous: 'pass', verifiable: 'pass', consistent: 'pass', context: 'pass', risk: true, capacity: 'available' } },
      ],
    },
    review: {
      title: '05 · Review depth', fn: EV.review,
      fields: [
        ['context', 'review_context_sufficient', TRI], ['productDecision', 'product_decision_unresolved', YNU], ['specialist', 'specialist_decision_unresolved', YNU],
        ['businessLogic', 'business_logic_changed', YNU], ['behavior', 'behavior_verification_needed', YNU], ['crossComponent', 'cross_component_verification_needed', YNU],
        ['githubSufficient', 'static_review_sufficient', [['yes', 'Yes'], ['uncertain', 'Uncertain'], ['no', 'No']]],
        ['humanCheck', 'human_verification_required', YNU],
        ['repoRequiresBoth', 'Repo policy requires 06A + 06B', BOOL],
        ['repoRequiresIndependent', 'Repo/domain policy requires 06B', BOOL], ['qaReopen', 'Validated QA reopen', BOOL], ['coverageAccepted', 'GitHub coverage accepted by policy', BOOL],
      ],
      presets: [
        { id: 'web123', label: 'WEB-123', note: 'Runtime behavior (resize, instances) needs execution beyond a static review.', v: { context: 'pass', productDecision: 'no', specialist: 'no', humanCheck: 'no', repoRequiresBoth: false, businessLogic: 'no', behavior: 'yes', crossComponent: 'no', githubSufficient: 'no', repoRequiresIndependent: false, qaReopen: false, coverageAccepted: false } },
        { id: 'docs-example', label: 'Docs fix · example policy', note: 'Bounded documentation correction, but the committed example policy has `github_coverage_accepted: false`.', v: { context: 'pass', productDecision: 'no', specialist: 'no', humanCheck: 'no', repoRequiresBoth: false, businessLogic: 'no', behavior: 'no', crossComponent: 'no', githubSufficient: 'yes', repoRequiresIndependent: false, qaReopen: false, coverageAccepted: false } },
        { id: 'docs-configured', label: 'Docs fix · coverage accepted', note: 'Same change in a repository that accepted Codex coverage (hypothetical configuration).', v: { context: 'pass', productDecision: 'no', specialist: 'no', humanCheck: 'no', repoRequiresBoth: false, businessLogic: 'no', behavior: 'no', crossComponent: 'no', githubSufficient: 'yes', repoRequiresIndependent: false, qaReopen: false, coverageAccepted: true } },
        { id: 'price', label: 'Two-line price rule', note: 'Configured pricing policy requires 06B despite the small diff.', v: { context: 'pass', productDecision: 'no', specialist: 'no', humanCheck: 'no', repoRequiresBoth: false, businessLogic: 'yes', behavior: 'no', crossComponent: 'no', githubSufficient: 'yes', repoRequiresIndependent: true, qaReopen: false, coverageAccepted: true } },
        { id: 'conflict', label: 'Conflicting requirements', note: 'Route chosen and a product owner decision is required before advancing.', v: { context: 'pass', productDecision: 'yes', specialist: 'no', humanCheck: 'no', repoRequiresBoth: false, businessLogic: 'yes', behavior: 'no', crossComponent: 'no', githubSufficient: 'no', repoRequiresIndependent: false, qaReopen: false, coverageAccepted: true } },
      ],
    },
    staging: {
      title: '09 · Staging merge decision', fn: EV.staging,
      fields: [
        ...EV.STAGING_GATES.map(([k, label]) => [k, label.replace(/`/g, ''), BOOL]),
        ['humanDecision', 'Named human release decision pending', BOOL],
      ],
      presets: [
        { id: 'example-policy', label: 'Committed example policy', note: '`mode: shadow`, `merge: false`, completion lane uncalibrated. Every other gate passes.', quotes: ['policy-shadow', 'policy-merge-false', 'policy-completion-uncalibrated'], v: { qaDevelop: true, freshHead: true, ci: true, review: true, noFindings: true, branch: true, window: true, jevPass: true, grantMerge: false, policyActive: false, humanDecision: false } },
        { id: 'configured', label: 'Configured grant, all fresh', note: 'Hypothetical active policy with the merge grant, a calibrated completion lane and every gate fresh.', v: { qaDevelop: true, freshHead: true, ci: true, review: true, noFindings: true, branch: true, window: true, jevPass: true, grantMerge: true, policyActive: true, humanDecision: false } },
        { id: 'window', label: 'Release window pending', note: 'QA moved the ticket to Ready for Staging, window closed → wait under 08.', v: { qaDevelop: true, freshHead: true, ci: true, review: true, noFindings: true, branch: true, window: false, jevPass: true, grantMerge: true, policyActive: true, humanDecision: false } },
        { id: 'scope', label: 'Jev flags expanded scope', note: 'The delivery evidence shows behavior outside the accepted AC → wait, product decision.', v: { qaDevelop: true, freshHead: true, ci: true, review: true, noFindings: true, branch: true, window: true, jevPass: false, grantMerge: true, policyActive: true, humanDecision: false } },
        { id: 'stale', label: 'New commit during the wait', note: 'Candidate changed while waiting: stale evidence cannot be reused; the new head goes back to 05 for review.', v: { qaDevelop: true, freshHead: false, ci: true, review: false, noFindings: true, branch: true, window: true, jevPass: true, grantMerge: true, policyActive: true, humanDecision: false } },
        { id: 'human', label: 'Human decision pending', note: 'A named release decision is pending; it returns through WFRelease 08 and 09 re-runs.', v: { qaDevelop: true, freshHead: true, ci: true, review: true, noFindings: true, branch: true, window: true, jevPass: true, grantMerge: true, policyActive: true, humanDecision: true } },
        { id: 'no-qa', label: 'QA has not moved the ticket', note: '09 never runs before 07.', v: { qaDevelop: false, freshHead: true, ci: true, review: true, noFindings: true, branch: true, window: true, jevPass: true, grantMerge: true, policyActive: true, humanDecision: false } },
      ],
    },
    release: {
      title: '13 · Production release decision', fn: EV.release,
      fields: [
        ...EV.RELEASE_GATES.map(([k, label]) => [k, label.replace(/`/g, ''), BOOL]),
        ['riskHuman', 'Change class reserved for a human release decision', BOOL],
        ['humanDecision', 'Named human production decision pending', BOOL],
      ],
      presets: [
        { id: 'example-policy', label: 'Committed example policy', note: '`mode: shadow`, `deploy_production: false`, completion lane uncalibrated. Every other gate passes.', quotes: ['policy-shadow', 'policy-deploy-false', 'policy-completion-uncalibrated'], v: { qaStaging: true, freshArtifact: true, ci: true, review: true, batchClean: true, noIncident: true, rollout: true, branch: true, jevPass: true, grantDeploy: false, policyActive: false, riskHuman: false, humanDecision: false } },
        { id: 'configured', label: 'Configured grant, all fresh', note: 'Hypothetical active policy with the deploy_production grant, a calibrated completion lane and every gate fresh.', v: { qaStaging: true, freshArtifact: true, ci: true, review: true, batchClean: true, noIncident: true, rollout: true, branch: true, jevPass: true, grantDeploy: true, policyActive: true, riskHuman: false, humanDecision: false } },
        { id: 'incident', label: 'Incident or freeze active', note: 'QA Staging accepted, but an incident or freeze record is active → wait under 12 with the incident close or freeze end as wake-up.', v: { qaStaging: true, freshArtifact: true, ci: true, review: true, batchClean: true, noIncident: false, rollout: true, branch: true, jevPass: true, grantDeploy: true, policyActive: true, riskHuman: false, humanDecision: false } },
        { id: 'batch', label: 'Batch has an unknown change', note: 'The release batch lists a change without status: `release_batch_clean` is not positive → wait under 12.', v: { qaStaging: true, freshArtifact: true, ci: true, review: true, batchClean: false, noIncident: true, rollout: true, branch: true, jevPass: false, grantDeploy: true, policyActive: true, riskHuman: false, humanDecision: false } },
        { id: 'risk', label: 'Human-reserved risk class', note: 'Every gate passes, but the change is in a class the policy reserves for a human release decision → production release owner → WFRelease 12.', v: { qaStaging: true, freshArtifact: true, ci: true, review: true, batchClean: true, noIncident: true, rollout: true, branch: true, jevPass: true, grantDeploy: true, policyActive: true, riskHuman: true, humanDecision: false } },
        { id: 'stale', label: 'Artifact rebuilt during the wait', note: 'The artifact changed while waiting: stale QA cannot be inherited; renewed checks or 05 for a new head.', v: { qaStaging: true, freshArtifact: false, ci: true, review: true, batchClean: true, noIncident: true, rollout: true, branch: true, jevPass: true, grantDeploy: true, policyActive: true, riskHuman: false, humanDecision: false } },
        { id: 'no-qa', label: 'QA Staging has not accepted', note: '13 never runs before 11.', v: { qaStaging: false, freshArtifact: true, ci: true, review: true, batchClean: true, noIncident: true, rollout: true, branch: true, jevPass: true, grantDeploy: true, policyActive: true, riskHuman: false, humanDecision: false } },
      ],
    },
    qa: {
      title: '15 · QA report validation', fn: EV.qa,
      fields: [
        ['build', 'Tested build identified', BOOL], ['steps', 'Written reproduction steps', BOOL], ['expectedActual', 'Expected vs actual result', BOOL],
        ['video', 'Report includes a video', BOOL], ['screenshot', 'Relevant screenshot', BOOL], ['buildHasFix', 'Tested build contains the fix', BOOL],
        ['relation', 'qa_relation', [['original_failure', 'Original failure'], ['introduced_regression', 'Regression'], ['new_requirement', 'New requirement'], ['insufficient_evidence', 'Insufficient']]],
        ['ownerMatches', 'Owner matches evidence', BOOL], ['attempts', 'Failed attempts so far', [[0, '0'], [1, '1'], [2, '2']]],
      ],
      presets: [
        { id: 'video', label: 'Video only', note: 'Flicker during resize, video attached, nothing written.', v: { build: false, steps: false, expectedActual: false, video: true, screenshot: false, buildHasFix: true, relation: 'insufficient_evidence', ownerMatches: true, attempts: 0 } },
        { id: 'valid', label: 'Complete report', note: 'Screenshot, build, steps, expected/actual; original AC still fails.', v: { build: true, steps: true, expectedActual: true, video: true, screenshot: true, buildHasFix: true, relation: 'original_failure', ownerMatches: true, attempts: 0 } },
        { id: 'stale', label: 'Stale build', note: 'QA tested a build without the fix.', v: { build: true, steps: true, expectedActual: true, video: false, screenshot: true, buildHasFix: false, relation: 'original_failure', ownerMatches: true, attempts: 0 } },
        { id: 'scope', label: 'New behavior requested', note: 'QA asks for an animation no AC mentions.', v: { build: true, steps: true, expectedActual: true, video: false, screenshot: true, buildHasFix: true, relation: 'new_requirement', ownerMatches: true, attempts: 0 } },
        { id: 'budget', label: 'Retry budget reached', note: 'Two failed attempts already (example policy budget: 2).', v: { build: true, steps: true, expectedActual: true, video: false, screenshot: true, buildHasFix: true, relation: 'original_failure', ownerMatches: true, attempts: 2 } },
      ],
    },
    model: {
      title: 'Model / execution routing', fn: EV.model,
      fields: [
        ['registry', 'Model registry', [['example', 'Committed example'], ['configured', 'Hypothetical configured']]],
        ['complexity', 'task_complexity', [['bounded', 'bounded'], ['routine', 'routine'], ['multi_component', 'multi_component'], ['deep_diagnosis', 'deep_diagnosis'], ['unknown', 'unknown']]],
        ['quota', 'Quota telemetry', [['known', 'Known, capacity free'], ['unknown', 'Unknown'], ['exhausted', 'Exhausted']]],
      ],
      presets: [
        { id: 'example', label: 'Committed example registry', note: 'All runtime IDs null, capabilities unverified.', quotes: ['policy-models-unverified'], v: { registry: 'example', complexity: 'routine', quota: 'known' } },
        { id: 'routine', label: 'Routine (hypothetical)', note: 'Starter-lane proposal only.', v: { registry: 'configured', complexity: 'routine', quota: 'known' } },
        { id: 'deep', label: 'Deep diagnosis (hypothetical)', note: 'Starter-lane proposal only.', v: { registry: 'configured', complexity: 'deep_diagnosis', quota: 'known' } },
        { id: 'quota', label: 'Unknown quota', note: 'The example policy holds automatic launch.', v: { registry: 'configured', complexity: 'multi_component', quota: 'unknown' } },
      ],
    },
  };
  P.EVALS = EVALS;

  P.evaluator = function (A, kind, presetId) {
    const cfg = EVALS[kind];
    let preset = cfg.presets.find((p) => p.id === presetId) || cfg.presets[0];
    const values = { ...preset.v };
    const wrapEl = h('div', { class: 'evaluator', 'data-eval': kind });
    const presetRow = h('div', { class: 'preset-row', role: 'group', 'aria-label': 'Scenarios' });
    const note = h('p', { class: 'preset-note' });
    const fields = h('div', { class: 'eval-fields' });
    const result = h('div', { class: 'eval-result', 'aria-live': 'polite' });

    function renderFields() {
      put(fields, ...cfg.fields.map(([key, label, opts]) => h('div', { class: 'eval-field' },
        h('span', { class: 'eval-label' }, label),
        h('span', { class: 'seg', role: 'group', 'aria-label': label }, opts.map(([val, txt]) => h('button', {
          type: 'button', class: `seg-btn${values[key] === val ? ' on' : ''} v-${String(val)}`, 'aria-pressed': String(values[key] === val),
          onclick: () => { values[key] = val; update(); },
        }, txt))))));
    }
    function update() {
      renderFields();
      const r = cfg.fn(values);
      put(result, 
        h('div', { class: 'eval-head' }, h('span', { class: `verdict tone-${r.tone}` }, r.label), h('span', { class: 'eval-next' }, r.next)),
        r.attention && r.attention.length ? h('p', { class: 'eval-attn' }, `Human attention (separate field): ${r.attention.join('; ')}`) : null,
        h('ol', { class: 'eval-reasons' }, r.reasons.map((x) => h('li', {}, h('span', { html: fmt(x.text, A.wf) }), ' ',
          h('button', { type: 'button', class: 'rule-ref', 'data-open': `rule:${x.rule}`, title: A.rulesById[x.rule]?.title }, 'rule')))),
        h('p', { class: 'eval-foot' }, P.tag('doc'), ' This explains the documented gate order. Real decisions come from the controller + Jev under the active policy.'));
    }
    function choose(p) {
      preset = p;
      Object.assign(values, p.v);
      put(note, h('span', { html: fmt(p.note, A.wf) }));
      if (p.quote) note.append(h('div', {}, P.ruleCard(A, p.quote, { compact: true })));
      if (p.quotes) note.append(h('div', { class: 'rule-list' }, p.quotes.map((q) => P.ruleCard(A, q, { compact: true }))));
      for (const b of presetRow.children) b.setAttribute('aria-pressed', String(b.dataset.preset === p.id));
      update();
    }
    presetRow.append(...cfg.presets.map((p) => h('button', { type: 'button', class: 'preset', 'data-preset': p.id, onclick: () => choose(p) }, p.label)));
    wrapEl.append(h('div', { class: 'eval-title' }, cfg.title), presetRow, note, h('details', { class: 'eval-inputs', open: true }, h('summary', {}, 'Inputs'), fields), result);
    choose(preset);
    return wrapEl;
  };

  /* ── Jev decision drawer / card ─────────────────────────────────────────────── */
  P.jevDecisionBody = function (A, id, { withEvaluator = true } = {}) {
    const j = A.wf.jevDecisions.find((x) => x.id === id);
    const out = h('div', { class: 'd-body jev-card' });
    out.append(h('div', { class: 'chip-row' }, j.nodes.map((n) => P.nodeChip(A, n))));
    out.append(P.section('Question', 'doc', h('p', { class: 'jev-q' }, j.question)));
    out.append(P.section('Inputs', 'doc', list(j.inputs, A)));
    out.append(P.section('Jev questions used', null, h('div', { class: 'chip-row' }, j.questions.map((q) => h('code', { class: 'q-code' }, q))),
      h('p', { class: 'meta-muted' }, 'Typed questions from jev/questions/*.json. Presence, IDs, quotas, CI states and permissions are checked in code, not by Jev.')));
    out.append(P.section('Rules evaluated', 'rule', rulesBlock(A, j.rulesEvaluated)));
    out.append(P.section('Possible outcomes', 'diagram', h('table', { class: 'outcomes' }, h('tbody', {}, j.outcomes.map((o) => h('tr', {}, h('td', {}, o.result), h('td', {}, o.next)))))));
    if (withEvaluator && j.evaluator) out.append(P.section('Explain decision · result and next action', null, P.evaluator(A, j.evaluator)));
    if (!j.evaluator) out.append(P.section('Explain decision', 'unavailable', h('p', {}, j.explanation || 'No interactive evaluator: production release gates depend on configured release policies (`release.*` are null in the example policy).')));
    return out;
  };
  P.jev = (A, id) => ({ title: A.wf.jevDecisions.find((x) => x.id === id).title, kicker: 'Jev decision', body: P.jevDecisionBody(A, id), kind: 'jev' });

  /* ── AC trace (drawer) ──────────────────────────────────────────────────────── */
  P.trace = function (A, acId, stepIndex) {
    const ex = A.wf.example;
    const ac = ex.acceptanceCriteria.find((a) => a.id === acId);
    const steps = ex.trace[acId];
    const out = h('div', { class: 'd-body trace' });
    out.append(h('div', { class: 'ac-pick', role: 'group', 'aria-label': 'Choose an acceptance criterion' },
      ex.acceptanceCriteria.map((a) => h('button', { type: 'button', class: `ac-btn${a.id === acId ? ' on' : ''}`, 'aria-pressed': String(a.id === acId), 'data-open': `ac:${a.id}` },
        a.id, h('span', { class: `mini-verdict v-${a.rounds.at(-1)}` }, a.rounds.at(-1))))));
    out.append(h('blockquote', { class: 'ac-quote' }, h('strong', {}, `${ac.id} `), ac.text, h('div', {}, P.tag('example'), ' written by the (fictional) ticket owner in the tracker')));
    const ol = h('ol', { class: 'trace-steps' });
    steps.forEach((st, i) => {
      ol.append(h('li', { class: `trace-step${i === stepIndex ? ' current' : ''}${i < stepIndex ? ' done' : ''}` },
        h('button', { type: 'button', class: 'trace-go', 'data-open': `ac:${acId}:${i}` },
          h('span', { class: 'trace-n' }, String(i + 1)),
          h('span', { class: 'trace-t' }, st.title),
          st.verdict ? h('span', { class: `mini-verdict v-${st.verdict}` }, st.verdict) : null),
        h('div', { class: 'trace-body', html: fmt(st.text, A.wf) }),
        h('div', { class: 'trace-node' }, P.nodeChip(A, st.node))));
    });
    out.append(ol);
    out.append(h('div', { class: 'trace-nav' },
      h('button', { type: 'button', class: 'btn', 'data-open': `ac:${acId}:${Math.max(0, stepIndex - 1)}`, disabled: stepIndex <= 0 }, '← Previous'),
      h('span', { class: 'meta-muted' }, `${stepIndex + 1} / ${steps.length}`),
      h('button', { type: 'button', class: 'btn', 'data-open': `ac:${acId}:${Math.min(steps.length - 1, stepIndex + 1)}`, disabled: stepIndex >= steps.length - 1 }, 'Next →')));
    out.append(h('p', { class: 'meta-muted' }, 'Scenarios, tests and verdicts are part of the illustrative WEB-123 example; the workflow path is the approved diagram.'));
    return { title: `Trace ${acId}`, kicker: 'Trace Acceptance Criterion', body: out };
  };

  /* ── verification status (drawer) ───────────────────────────────────────────── */
  P.status = function (A, acId) {
    const ex = A.wf.example;
    const s = ex.status[acId];
    const ac = ex.acceptanceCriteria.find((a) => a.id === acId);
    const out = h('div', { class: 'd-body' });
    out.append(h('blockquote', { class: 'ac-quote' }, h('strong', {}, `${acId} `), ac.text));
    out.append(h('dl', { class: 'status-dl' },
      h('dt', {}, 'Required'), h('dd', { html: fmt(s.required, A.wf) }),
      h('dt', {}, 'Existing evidence'), h('dd', { html: fmt(s.evidence, A.wf) }),
      h('dt', {}, 'Problem'), h('dd', { html: fmt(s.problem, A.wf) }),
      h('dt', {}, 'Conclusion'), h('dd', {}, P.verdict(s.conclusion))));
    out.append(h('p', {}, P.tag('example'), ' Round 1 of the WEB-123 review.'));
    out.append(h('button', { type: 'button', class: 'btn', 'data-open': `ac:${acId}` }, `Trace ${acId} on the diagram →`));
    out.append(P.section('Why this classification', 'rule', rulesBlock(A, s.conclusion === 'VERIFIED' ? ['06b-verified'] : s.conclusion === 'FAILED' ? ['06b-challenge', '06b-record'] : ['06b-verified', '06b-vacuous'])));
    return { title: `${acId} · ${s.conclusion}`, kicker: 'Verification status', body: out, kind: `v-${s.conclusion}` };
  };

  /* ═════════════════════════════ EXPLORERS ══════════════════════════════════ */

  P.explorers = {};

  /* Rules & skills */
  P.explorers.rules = function (A) {
    const wrap = h('div', { class: 'ex-rules' });
    const agents = [['jev', 'Jev'], ['planner', 'Verification Planner'], ['coding', 'Coding Agent'], ['reviewer', 'Independent Reviewer']];
    wrap.append(h('p', { class: 'ex-intro' },
      'Each rule below is an ', P.tag('rule'), ' — a verbatim quote with its file and section, checked by the test suite. Summaries are marked ', P.tag('doc'), '. ',
      'Use ', h('strong', {}, 'Open rule'), ' to read it in context in the source viewer.'));
    const tree = h('div', { class: 'skill-tree' });
    for (const [aid, name] of agents) {
      const col = h('div', { class: `skill-col ag-${aid}` }, h('h3', {}, h('span', { class: 'dot' }), name));
      for (const sk of A.wf.skills.filter((x) => x.agent === aid)) {
        const det = h('details', { class: 'skill', id: `skill-${sk.id}` },
          h('summary', {}, h('span', { class: 'skill-title' }, sk.title), h('span', { class: 'skill-count' }, `${sk.rules.length} rules`)),
          h('p', { class: 'skill-explain' }, P.tag('doc'), ' ', sk.explain),
          h('p', { class: 'skill-files' }, sk.dedicated ? null : h('span', { class: 'meta-muted' }, 'No dedicated skill file. Sources: '),
            ...sk.files.map((f) => h('button', { type: 'button', class: 'chip-link', 'data-open': `source:${f}` }, h('code', {}, f.split('/').pop())))),
          h('div', { class: 'rule-list' }, sk.rules.map((r) => P.ruleCard(A, r, { compact: true }))));
        col.append(det);
      }
      tree.append(col);
    }
    wrap.append(tree);
    const other = A.wf.rules.filter((r) => ['grok', 'human', 'ci', 'all'].includes(r.agent));
    wrap.append(h('details', { class: 'skill other-rules' },
      h('summary', {}, h('span', { class: 'skill-title' }, 'Grok/Superset, CI, QA and shared rules'), h('span', { class: 'skill-count' }, `${other.length} rules`)),
      h('div', { class: 'rule-list' }, other.map((r) => P.ruleCard(A, r.id, { compact: true })))));
    return wrap;
  };

  /* Trace AC */
  P.explorers.trace = function (A) {
    const ex = A.wf.example;
    const wrap = h('div', { class: 'ex-trace' });
    wrap.append(h('p', { class: 'ex-intro' }, 'Pick an Acceptance Criterion of the illustrative ticket ', h('strong', {}, ex.ticket.id), ` “${ex.ticket.title}” and follow it from the tracker to the final verdict. The diagram highlights each stage it passes through.`));
    const grid = h('div', { class: 'ac-grid' });
    for (const ac of ex.acceptanceCriteria) {
      grid.append(h('button', { type: 'button', class: 'ac-card', 'data-open': `ac:${ac.id}` },
        h('span', { class: 'ac-id' }, ac.id),
        h('span', { class: 'ac-text' }, ac.text),
        h('span', { class: 'ac-rounds' }, ac.rounds.map((r, i) => h('span', { class: `mini-verdict v-${r}` }, `R${i + 1} ${r}`))),
        h('span', { class: 'ac-go' }, 'Trace on diagram →')));
    }
    wrap.append(grid);
    wrap.append(h('div', { class: 'wph' },
      h('div', { class: 'wph-col what' }, h('h4', {}, 'WHAT · Acceptance Criteria'), h('p', {}, 'Written in the tracker by the ticket owner. The only source of truth for acceptance.'), h('p', { class: 'wph-owner' }, 'Owner: human')),
      h('div', { class: 'wph-arrow', 'aria-hidden': 'true' }, '→'),
      h('div', { class: 'wph-col how' }, h('h4', {}, 'HOW · Verification Plan'), h('p', {}, 'Scenarios, boundaries and evidence that challenge an existing AC. Never new AC.'), h('p', { class: 'wph-owner' }, 'Owner: planner (04)')),
      h('div', { class: 'wph-arrow', 'aria-hidden': 'true' }, '→'),
      h('div', { class: 'wph-col proof' }, h('h4', {}, 'PROOF · Independent verification'), h('p', {}, 'Would the tests fail if the implementation violated the AC? Per-AC verdicts.'), h('p', { class: 'wph-owner' }, 'Owner: independent reviewer (06B)'))));
    return wrap;
  };

  /* Verification · 06B */
  P.explorers.verification = function (A) {
    const ex = A.wf.example;
    const wrap = h('div', { class: 'ex-verify' });
    let round = 0;
    let acSel = 'AC-3';

    /* 1 · contrast of questions */
    wrap.append(h('div', { class: 'vs' },
      h('div', { class: 'vs-col coding' }, h('span', { class: 'vs-who' }, 'Coding Agent · 04'), h('p', { class: 'vs-q' }, '“How do I satisfy the requirement?”'), h('p', {}, 'Builds, tests and fixes until the required checks are green. Its tests encode its own understanding.')),
      h('div', { class: 'vs-mid', 'aria-hidden': 'true' }, 'vs'),
      h('div', { class: 'vs-col verifier' }, h('span', { class: 'vs-who' }, 'Verification Agent · 06B'), h('p', { class: 'vs-q' }, '“How can I demonstrate that this implementation does NOT satisfy it?”'), h('p', {}, 'Separate session, started externally. Tries to falsify the claim and never confirms the coding agent’s reasoning by default.'))));

    /* 2 · ladder AC ↕ scenarios ↕ tests ↕ implementation */
    const ladder = h('div', { class: 'ladder-wrap' });
    const ladderCtl = h('div', { class: 'ladder-ctl' });
    function renderLadder() {
      const cov = ex.coverage[acSel];
      const ac = ex.acceptanceCriteria.find((a) => a.id === acSel);
      const testsIn = new Set(cov.scenarios.flatMap((s) => s.tests[round]));
      const verdict = ac.rounds[round];
      put(ladderCtl, 
        h('span', { class: 'seg', role: 'group', 'aria-label': 'Acceptance criterion' }, ex.acceptanceCriteria.map((a) => h('button', { type: 'button', class: `seg-btn${a.id === acSel ? ' on' : ''}`, 'aria-pressed': String(a.id === acSel), onclick: () => { acSel = a.id; renderLadder(); } }, a.id))),
        h('span', { class: 'seg', role: 'group', 'aria-label': 'Review round' }, [0, 1].map((r) => h('button', { type: 'button', class: `seg-btn${r === round ? ' on' : ''}`, 'aria-pressed': String(r === round), onclick: () => { round = r; renderLadder(); } }, r === 0 ? 'Round 1' : 'Round 2 (after rework)'))));
      put(ladder, 
        h('div', { class: 'rung rung-ac' }, h('span', { class: 'rung-k' }, 'Acceptance Criterion'), h('div', {}, h('strong', {}, `${ac.id} `), ac.text), h('span', { class: 'rung-own' }, 'Ticket · human')),
        h('div', { class: 'rung-link', 'aria-hidden': 'true' }, '↕'),
        h('div', { class: 'rung rung-sc' }, h('span', { class: 'rung-k' }, 'Verification scenarios'),
          h('ul', {}, cov.scenarios.map((s) => h('li', { class: s.tests[round].length ? 'ok' : 'gap' }, s.text, h('span', { class: 'rung-map' }, s.tests[round].length ? `→ ${s.tests[round].join(', ')}` : '→ no test (gap)')))),
          h('span', { class: 'rung-own' }, 'Verification Plan · 04')),
        h('div', { class: 'rung-link', 'aria-hidden': 'true' }, '↕'),
        h('div', { class: 'rung rung-t' }, h('span', { class: 'rung-k' }, 'Tests'),
          h('ul', {}, [...testsIn].map((t) => { const tt = ex.tests.find((x) => x.id === t); return h('li', { class: 'ok' }, h('code', {}, t), ` ${tt.name}`); }),
            (cov.unplanned ? cov.unplanned[round] : []).map((u) => h('li', { class: 'weak' }, u))),
          h('span', { class: 'rung-own' }, 'Coding agent · 04')),
        h('div', { class: 'rung-link', 'aria-hidden': 'true' }, '↕'),
        h('div', { class: 'rung rung-code' }, h('span', { class: 'rung-k' }, 'Implementation'), h('code', {}, cov.code[round]), h('span', { class: 'rung-own' }, 'PR head')),
        h('div', { class: 'rung-verdict' }, 'Verdict: ', P.verdict(verdict, { 'data-open': round === 0 ? `status:${acSel}` : `ac:${acSel}` })));
    }
    renderLadder();
    wrap.append(h('div', { class: 'v-block' }, h('h3', {}, 'AC ↔ scenarios ↔ tests ↔ code ', P.tag('example')), ladderCtl, ladder));

    /* 3 · status board */
    const board = h('div', { class: 'status-board' }, ex.acceptanceCriteria.map((a) => h('button', { type: 'button', class: `status-row v-${a.rounds[0]}`, 'data-open': `status:${a.id}` },
      h('span', { class: 'sr-id' }, a.id), h('span', { class: 'sr-text' }, a.text), P.verdict(a.rounds[0]))));
    wrap.append(h('div', { class: 'v-block' }, h('h3', {}, 'Verification status (round 1, CI green) ', P.tag('example')),
      h('p', { class: 'meta-muted' }, 'Select a status to see what was required, what evidence existed, and why.'), board));

    /* 4 · VERIFIED definition */
    const conds = [
      ['A verification scenario exists', true], ['Evidence exists (current head)', true], ['The test observes the behavior the AC requires', true],
      ['At least one meaningful violation would make the evidence fail', false], ['No discovered counterexample remains unexplained', true],
    ];
    const state = conds.map((c) => c[1]);
    let ce = false;
    const formula = h('div', { class: 'formula' });
    function renderFormula() {
      const all = state.every(Boolean);
      const v = ce ? 'FAILED' : all ? 'VERIFIED' : 'UNVERIFIED';
      put(formula, 
        h('div', { class: 'f-lines' }, h('code', {}, 'VERIFIED(AC) ='), ...conds.map(([label], i) => h('label', { class: `f-cond${state[i] ? ' on' : ''}` },
          h('input', { type: 'checkbox', checked: state[i] || null, onchange: (e) => { state[i] = e.target.checked; renderFormula(); } }),
          h('span', { class: 'f-and' }, i ? 'AND' : ''), ` ${label}`))),
        h('label', { class: `f-cond ce${ce ? ' on' : ''}` }, h('input', { type: 'checkbox', checked: ce || null, onchange: (e) => { ce = e.target.checked; renderFormula(); } }), ' A counterexample was reproduced'),
        h('div', { class: 'f-out' }, '→ ', P.verdict(v)));
    }
    renderFormula();
    wrap.append(h('div', { class: 'v-block' }, h('h3', {}, 'What ', P.verdict('VERIFIED'), ' means ', P.tag('doc')),
      h('p', { class: 'meta-muted' }, 'A conceptual definition to explain the rule below. It is engineering evidence, not a mathematical proof.'),
      formula, P.ruleCard(A, '06b-verified', { compact: true })));

    /* 5 · test-strength analyzer */
    const chosen = new Set(['T1', 'T4']);
    const matrix = h('div', { class: 'matrix-wrap' });
    function renderMatrix() {
      const tests = ['T1', 'T4', 'T8', 'T9'];
      const detected = new Set();
      for (const t of chosen) for (const v of ex.violations) if (ex.strength[t][v.id]) detected.add(v.id);
      const all = ex.violations.every((v) => detected.has(v.id));
      put(matrix, 
        h('div', { class: 'tsel', role: 'group', 'aria-label': 'Tests in the suite' }, tests.map((t) => {
          const tt = ex.tests.find((x) => x.id === t);
          return h('label', { class: `tchip${chosen.has(t) ? ' on' : ''}` }, h('input', { type: 'checkbox', checked: chosen.has(t) || null, onchange: (e) => { e.target.checked ? chosen.add(t) : chosen.delete(t); renderMatrix(); } }), h('code', {}, t), ` ${tt.name.split('›')[1] || tt.name}`);
        })),
        h('table', { class: 'matrix' },
          h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Meaningful violation of AC-3'), ...tests.filter((t) => chosen.has(t)).map((t) => h('th', { scope: 'col' }, t)), h('th', { scope: 'col' }, 'Suite'))),
          h('tbody', {}, ex.violations.map((v) => h('tr', {},
            h('th', { scope: 'row' }, v.text),
            ...tests.filter((t) => chosen.has(t)).map((t) => h('td', { class: ex.strength[t][v.id] ? 'fails' : 'passes' }, ex.strength[t][v.id] ? 'test fails ✓' : 'still passes ⚠')),
            h('td', { class: detected.has(v.id) ? 'fails' : 'passes' }, detected.has(v.id) ? 'detected' : 'NOT detected'))))),
        h('div', { class: 'why-list' }, [...chosen].map((t) => h('p', {}, h('code', {}, t), ` ${ex.strength[t].why}`))),
        h('p', { class: 'matrix-out' }, 'Test strength for AC-3: ', h('span', { class: `verdict v-${all ? 'VERIFIED' : 'UNVERIFIED'}` }, all ? 'sufficient' : 'insufficient → UNVERIFIED')));
    }
    renderMatrix();
    wrap.append(h('div', { class: 'v-block' }, h('h3', {}, 'Test-strength analysis ', P.tag('example')),
      h('p', { class: 'central-q' }, 'Would these tests fail if the implementation meaningfully violated the actual Acceptance Criterion?'),
      h('div', { class: 'bad-example' },
        h('pre', { class: 'code' }, "// AC-3: Widget layout depends on its container width, not the browser viewport width.\ntest('renders the widget', () => {\n  expect(component).toBeDefined();   // ✓ green\n});"),
        h('p', {}, h('strong', {}, 'Why this proves almost nothing: '), 'the component exists whether layout uses the container, the viewport or a hard-coded value. Swap container width for viewport width and the test stays green. It detects no meaningful violation of AC-3, so it is a finding, not evidence.')),
      P.ruleCard(A, '06b-tobedefined', { compact: true }), matrix));

    /* 6 · try to break it */
    const cx = h('div', { class: 'cx-grid' }, ex.counterexamples.map((c) => h('details', { class: `cx cx-${c.outcome}` },
      h('summary', {}, h('span', { class: 'cx-probe' }, c.probe), h('span', { class: `cx-badge o-${c.outcome}` }, { none: 'no counterexample', found: 'COUNTEREXAMPLE', gap: 'gap', na: 'not applicable' }[c.outcome])),
      h('p', {}, h('strong', {}, 'Tried: '), c.attempt, c.ac !== '—' ? h('span', { class: 'meta-muted' }, ` · ${c.ac}`) : null),
      h('p', { html: fmt(c.result, A.wf) })))) ;
    wrap.append(h('div', { class: 'v-block', id: 'try-to-break-it' }, h('h3', {}, 'Try to break it · ', h('button', { type: 'button', class: 'term', 'data-term': 'counterexample' }, 'counterexample'), ' search ', P.tag('example')),
      h('p', { class: 'meta-muted' }, 'The verifier deliberately looks for inputs and sequences the plan did not cover. It records what was tried, including “not applicable”, so a finite search is never presented as proof.'),
      cx, h('div', { class: 'rule-list two' }, P.ruleCard(A, '06b-challenge', { compact: true }), P.ruleCard(A, '06b-finite', { compact: true }))));
    return wrap;
  };

  /* CI & mutation */
  P.explorers.ci = function (A) {
    const wf = A.wf;
    const ex = wf.example;
    const wrap = h('div', { class: 'ex-ci' });
    let profile = 'layout';
    const table = h('div', {});
    function renderTable() {
      const p = wf.ciProfiles.find((x) => x.id === profile);
      put(table, 
        h('div', { class: 'preset-row' }, wf.ciProfiles.map((x) => h('button', { type: 'button', class: 'preset', 'aria-pressed': String(x.id === profile), onclick: () => { profile = x.id; renderTable(); } }, x.label))),
        h('table', { class: 'ci-table' },
          h('thead', {}, h('tr', {}, h('th', {}, 'Check'), h('th', {}, `Likely applicable · ${p.label}`), h('th', {}, 'Can show'), h('th', {}, 'Cannot show'), h('th', {}, 'Repository basis'))),
          h('tbody', {}, wf.ciChecks.map((c) => h('tr', { class: p.checks.includes(c.id) ? 'on' : 'off' },
            h('th', { scope: 'row' }, c.name, c.unavailable ? h('div', {}, P.tag('unavailable')) : null),
            h('td', {}, p.checks.includes(c.id) ? '●' : '○'),
            h('td', { html: fmt(c.proves, wf) }), h('td', { html: fmt(c.cannot, wf) }), h('td', { class: 'meta-muted' }, c.source))))));
    }
    renderTable();
    wrap.append(h('div', { class: 'v-block' }, h('h3', {}, 'CI verification · depth depends on risk ', P.tag('example')),
      h('p', {}, 'Not every check is mandatory for every ticket. The profiles are illustrative: the repository does not configure a required check set.'),
      h('div', { class: 'rule-list two' }, P.ruleCard(A, 'policy-checks-null', { compact: true }), P.ruleCard(A, 'ci-applicable', { compact: true })),
      table,
      h('p', { class: 'callout-green' }, h('strong', {}, 'Green CI ≠ business correctness. '), 'CI provides mechanical evidence that the checks ran and passed. Whether those checks observe the behavior the AC require is judged independently in 06B.')));

    /* mutation lab */
    let mutant = 'M1';
    let suite = 'round1';
    const lab = h('div', { class: 'mut-lab' });
    function renderLab() {
      const m = ex.mutation.mutants.find((x) => x.id === mutant);
      const s = ex.mutation.suites.find((x) => x.id === suite);
      const killers = m.killedBy.filter((t) => s.tests.includes(t));
      const killed = killers.length > 0;
      put(lab, 
        h('div', { class: 'mut-cols' },
          h('div', {}, h('h4', {}, 'Original'), h('pre', { class: 'code' }, ex.mutation.original)),
          h('div', {}, h('h4', {}, 'Mutation'), h('div', { class: 'preset-row' }, ex.mutation.mutants.map((x) => h('button', { type: 'button', class: 'preset', 'aria-pressed': String(x.id === mutant), onclick: () => { mutant = x.id; renderLab(); } }, `${x.id} · ${x.label}`))),
            h('pre', { class: 'code mut-diff' }, m.diff),
            h('h4', {}, 'Test suite'), h('div', { class: 'preset-row' }, ex.mutation.suites.map((x) => h('button', { type: 'button', class: 'preset', 'aria-pressed': String(x.id === suite), onclick: () => { suite = x.id; renderLab(); } }, x.label))))),
        h('div', { class: `mut-result ${killed ? 'killed' : 'survived'}`, 'aria-live': 'polite' },
          h('span', { class: 'mut-verdict' }, killed ? 'Tests fail → mutant killed ✓' : 'Tests pass → mutant survived ⚠'),
          h('p', {}, killed ? `Killed by ${killers.join(', ')}. ${m.note}` : `No test in this suite notices. ${m.note}`)));
    }
    renderLab();
    wrap.append(h('div', { class: 'v-block' }, h('h3', {}, h('button', { type: 'button', class: 'term', 'data-term': 'mutation' }, 'Mutation testing'), ' · 04 ', P.tag('example')),
      h('p', { class: 'central-q' }, 'Mutation testing checks whether the tests are sensitive to meaningful implementation changes.'),
      lab,
      h('div', { class: 'vs small' },
        h('div', { class: 'vs-col' }, h('span', { class: 'vs-who' }, '04 · Mutation testing'), h('p', {}, 'Do tests detect **implementation changes**?')),
        h('div', { class: 'vs-mid', 'aria-hidden': 'true' }, '≠'),
        h('div', { class: 'vs-col verifier' }, h('span', { class: 'vs-who' }, '06B · Semantic test strength'), h('p', {}, 'Do tests detect **violations of the actual AC**?'))),
      h('div', { class: 'rule-list two' }, P.ruleCard(A, 'mutation-vs-semantic', { compact: true }), P.ruleCard(A, 'mutation-targeted', { compact: true }))));
    wrap.querySelectorAll('.vs-col p').forEach((p) => { p.innerHTML = fmt(p.textContent, wf); });
    return wrap;
  };

  /* Jev decisions & routing */
  P.explorers.jev = function (A) {
    const wrap = h('div', { class: 'ex-jev' });
    wrap.append(h('p', { class: 'ex-intro' }, 'Jev answers narrow typed questions about text evidence. The Grok Bot controller runs deterministic checks, applies policy and writes explanations. Toggle ', h('strong', {}, 'Jev decisions'), ' in the toolbar to see every place Jev participates.'));
    wrap.append(h('div', { class: 'rule-list two' }, P.ruleCard(A, 'jev-narrow', { compact: true }), P.ruleCard(A, 'ac-sole-source', { compact: true })));
    const flow = h('div', { class: 'route-flow' },
      ['Task', 'Jev', 'complexity / risk / limits', 'model selection', 'execution host'].map((t, i) => [i ? h('span', { class: 'rf-arrow', 'aria-hidden': 'true' }, '→') : null, h('span', { class: 'rf-step' }, t)]).flat());
    wrap.append(h('div', { class: 'v-block' }, h('h3', {}, '01–02 pilot: independent evidence + reusable questions'),
      h('p', {}, 'Step 01 supplies the task dossier as JSON, Markdown or prose. Step 02 composes readiness, human-attention and model-selection questions from one library. Model recommendation needs no routing fields or candidate cards. Human involvement is decided from specific unresolved questions and existing authority.'),
      h('button', { type: 'button', class: 'btn-mini', 'data-open': 'source:jev/references/request-preparation.md' }, 'Open pilot guide ↗')));
    wrap.append(h('div', { class: 'v-block' }, h('h3', {}, 'Model / execution routing — legacy outside the 01–02 pilot'), flow,
      h('p', { html: fmt('Code filters eligible models by runtime, tools, repository access, quota and capacity. Jev then picks a relative choice **and** confirms an absolute fit for the chosen candidate. The committed registry has no verified model, so no automatic selection is possible yet.', A.wf) }),
      h('table', { class: 'lanes' }, h('caption', {}, 'Starter lanes from jev/references/model-routing.md: proposals to evaluate, not verified benchmarks'),
        h('tbody', {}, [['Grok', 'Small bounded changes with explicit steps and focused verification'], ['Claude Fable', 'Routine feature/bug implementation with a clear specification and established patterns'], ['ChatGPT Sol', 'General coding, multi-file implementation and regression-test work'], ['Claude Opus', 'Architecture-sensitive implementation, complex domain constraints and broad coherent changes'], ['ChatGPT Astra', 'Difficult diagnosis, cross-system reasoning and tasks requiring synthesis of conflicting technical evidence']].map(([a, b]) => h('tr', {}, h('th', { scope: 'row' }, a), h('td', {}, b))))),
      h('button', { type: 'button', class: 'btn-mini', 'data-open': `source:jev/references/model-routing.md#section:Starter preferences` }, 'Open source ↗'),
      P.evaluator(A, 'model')));
    for (const j of A.wf.jevDecisions) {
      wrap.append(h('details', { class: 'v-block jev-block', id: `jev-${j.id}` },
        h('summary', {}, h('span', { class: 'jev-badge' }, 'JEV'), h('strong', {}, j.title), h('span', { class: 'meta-muted' }, ` · ${j.nodes.map((n) => nodeLabel(A.wf, n).replace(/<[^>]+>/g, '')).join(', ')}`)),
        P.jevDecisionBody(A, j.id)));
    }
    return wrap;
  };

  /* Merge & promotion */
  P.explorers.promotion = function (A) {
    const wrap = h('div', { class: 'ex-promo' });
    wrap.append(h('div', { class: 'promo-eq' },
      ['Verification evidence', 'CI', 'Review result', 'QA Develop', 'Risk', 'Action grants'].map((t, i) => [i ? h('span', { class: 'pe-plus' }, '+') : null, h('span', { class: 'pe-in' }, t)]).flat(),
      h('span', { class: 'pe-arrow' }, '→'),
      h('span', { class: 'pe-out' }, h('span', { class: 'pe-auto' }, 'AUTO MERGE → 10'), h('span', { class: 'pe-or' }, 'or'), h('span', { class: 'pe-wait' }, 'WAIT → 09 / human'))));
    wrap.append(h('p', { class: 'ex-intro', html: fmt('Automatic merge is **not** the default. It needs every gate re-fetched at decision time **and** an explicit `merge` grant in an active policy; when CI deploys on merge, that merge is the staging deployment. The committed example policy is in shadow mode with every grant disabled, so today every route is WAIT, recorded as a recommendation.', A.wf) }));
    wrap.append(h('div', { class: 'rule-list three' }, P.ruleCard(A, '09-automatic', { compact: true }), P.ruleCard(A, 'merge-grant', { compact: true }), P.ruleCard(A, 'policy-shadow', { compact: true })));
    wrap.append(h('div', { class: 'v-block' }, h('h3', {}, 'Inspect a ', h('button', { type: 'button', class: 'term', 'data-term': 'promotion' }, 'promotion'), ' route'), P.evaluator(A, 'staging')));

    const signals = [
      { s: 'Public widget API change', applies: true, why: '`public_contract_change` is positive → elevated change risk → the named owner decides (human_attention).', rule: 'elevated-risk' },
      { s: 'One AC UNVERIFIED in 06B', applies: true, why: 'An AC may be VERIFIED only without an evidence gap. The review cannot pass: findings → controller → 03.', rule: '06b-verified' },
      { s: 'Mutation score below threshold', applies: false, why: 'Not a configured signal: the repository defines no mutation-score threshold, and a global score is explicitly not accepted as proof.', rule: 'mutation-targeted' },
      { s: 'Complex change', applies: false, why: 'Complexity alone never requires a person’s approval.', rule: 'complexity-no-approval' },
    ];
    wrap.append(h('div', { class: 'v-block' }, h('h3', {}, 'Explain decision · “Why did this task require human review?” ', P.tag('example')),
      h('p', { class: 'meta-muted' }, 'Illustrative task: a web widget change that renames a public configuration option. Only signals backed by actual rules count.'),
      h('ul', { class: 'signals' }, signals.map((x) => h('li', { class: x.applies ? 'applies' : 'ignored' },
        h('span', { class: 'sig-mark', 'aria-hidden': 'true' }, x.applies ? '●' : '⊘'), h('strong', {}, x.s), h('span', { html: ` — ${fmt(x.why, A.wf)}` }), ' ',
        h('button', { type: 'button', class: 'rule-ref', 'data-open': `rule:${x.rule}` }, 'rule')))),
      h('p', { class: 'decision-line' }, 'Decision: ', h('span', { class: 'verdict tone-human' }, 'HUMAN DECISION REQUIRED'), ' (public contract) ', h('span', { class: 'verdict v-UNVERIFIED' }, 'REWORK'), ' (AC UNVERIFIED)')));
    wrap.append(h('div', { class: 'v-block' }, h('h3', {}, 'Production release decision · 13'), P.jevDecisionBody(A, 'jd-production', { withEvaluator: true })));
    return wrap;
  };

  /* Artifacts */
  P.explorers.artifacts = function (A) {
    const wrap = h('div', { class: 'ex-art' });
    wrap.append(h('p', { class: 'ex-intro' }, 'Artifacts are what actually crosses stage boundaries. Select one to see who produces and consumes it, and watch it travel along the diagram.'));
    wrap.append(h('div', { class: 'art-grid' }, A.wf.artifacts.map((a) => h('button', { type: 'button', class: 'art-card', 'data-open': `artifact:${a.id}` },
      h('span', { class: 'a-icon big' }, a.icon), h('span', { class: 'art-name' }, a.name), h('span', { class: 'art-purpose' }, a.purpose)))));
    return wrap;
  };

  /* Agents & humans */
  P.explorers.agents = function (A) {
    const wrap = h('div', { class: 'ex-agents' });
    wrap.append(h('div', { class: 'agent-grid' }, A.wf.agents.map((ag) => h('button', { type: 'button', class: `agent-card ag-${ag.id}`, 'data-open': `agent:${ag.id}` },
      h('span', { class: 'dot' }), h('span', { class: 'ag-name' }, ag.name), h('span', { class: 'ag-long' }, ag.long), h('span', { class: 'ag-sum' }, ag.summary),
      h('span', { class: 'ag-count' }, `${A.nodesForAgent(ag.id).length} diagram elements`)))));
    wrap.append(h('div', { class: 'v-block human-block' }, h('h3', {}, 'Where human authority sits · ', h('button', { type: 'button', class: 'term', 'data-term': 'human-gate' }, 'human gates')),
      h('ul', { class: 'd-list' }, A.wf.humanCategories.map((c) => h('li', {}, h('strong', {}, c.label), ' ', ...c.nodes.map((n) => P.nodeChip(A, n))))),
      h('div', { class: 'rule-list two' }, P.ruleCard(A, 'human-return', { compact: true }), P.ruleCard(A, 'no-approval-for-running-job', { compact: true }))));
    return wrap;
  };

  P.escape = esc;
})(typeof window !== 'undefined' ? window : globalThis);

