/*
 * Referential integrity of the presentation data and the mandatory semantic constraints.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from './helpers.mjs';

const { wf } = loadData();
const nodeIds = new Set([
  ...wf.stages, ...wf.humans, ...wf.decisions, ...wf.connectors, ...wf.services, ...wf.notes,
].map((n) => n.id));
const edgeIds = new Set(wf.edges.map((e) => e.id));
const ruleIds = new Set(wf.rules.map((r) => r.id));
const skillIds = new Set(wf.skills.map((s) => s.id));
const artifactIds = new Set(wf.artifacts.map((a) => a.id));
const agentIds = new Set(wf.agents.map((a) => a.id));
const termIds = new Set(Object.keys(wf.glossary));

test('ids are unique across nodes and edges', () => {
  const all = [...wf.stages, ...wf.humans, ...wf.decisions, ...wf.connectors, ...wf.services, ...wf.notes].map((n) => n.id);
  assert.equal(new Set(all).size, all.length);
  assert.equal(edgeIds.size, wf.edges.length);
});

test('edges and implicit transitions connect existing nodes', () => {
  for (const e of [...wf.edges, ...wf.implicitEdges]) {
    assert.ok(nodeIds.has(e.from), `${e.id} from ${e.from}`);
    assert.ok(nodeIds.has(e.to), `${e.id} to ${e.to}`);
  }
});

test('every stage, human, decision and connector has details; stages cover all drawer fields', () => {
  const fields = ['responsibility', 'mustNot', 'inputs', 'outputs', 'readiness', 'completion', 'rules', 'skills', 'tools', 'verification', 'failures', 'example'];
  for (const s of wf.stages) {
    const d = wf.details[s.id];
    assert.ok(d, `details for ${s.id}`);
    for (const f of fields) assert.ok(d[f] !== undefined, `${s.id}.${f}`);
    assert.ok(d.basis, `${s.id} cites its documentation basis`);
  }
  for (const n of [...wf.humans, ...wf.decisions, ...wf.connectors, ...wf.services]) assert.ok(wf.details[n.id], `details for ${n.id}`);
});

test('all rule, skill, artifact, agent and node references resolve', () => {
  for (const [id, d] of Object.entries(wf.details)) {
    assert.ok(nodeIds.has(id), `details key ${id}`);
    for (const r of d.rules || []) assert.ok(ruleIds.has(r), `${id} rule ${r}`);
    for (const s of d.skills || []) assert.ok(skillIds.has(s), `${id} skill ${s}`);
    for (const f of d.failures || []) {
      if (f.edge) assert.ok(edgeIds.has(f.edge), `${id} failure edge ${f.edge}`);
      if (f.implicit) assert.ok(wf.implicitEdges.some((e) => e.id === f.implicit), `${id} implicit ${f.implicit}`);
    }
  }
  for (const [id, d] of Object.entries(wf.edgeDetails)) {
    assert.ok(edgeIds.has(id), `edgeDetails key ${id}`);
    for (const a of d.artifacts || []) assert.ok(artifactIds.has(a), `${id} artifact ${a}`);
    for (const r of d.rules || []) assert.ok(ruleIds.has(r), `${id} rule ${r}`);
    assert.ok(d.transfers.length > 0, `${id} states what is transferred`);
  }
  for (const e of wf.edges) assert.ok(wf.edgeDetails[e.id], `edge ${e.id} explains what crosses it`);
  for (const a of wf.artifacts) {
    for (const n of [...a.producedBy, ...a.consumedBy]) assert.ok(nodeIds.has(n), `${a.id} → ${n}`);
    for (const r of a.rules) assert.ok(ruleIds.has(r), `${a.id} rule ${r}`);
  }
  for (const n of [...wf.stages, ...wf.humans, ...wf.decisions, ...wf.services]) for (const a of n.agents) assert.ok(agentIds.has(a), `${n.id} agent ${a}`);
  for (const j of wf.jevDecisions) {
    for (const n of j.nodes) assert.ok(nodeIds.has(n), `${j.id} node ${n}`);
    for (const r of j.rulesEvaluated) assert.ok(ruleIds.has(r), `${j.id} rule ${r}`);
  }
  for (const s of [...wf.stages, ...wf.decisions]) if (s.decision) assert.ok(wf.jevDecisions.some((j) => j.id === s.decision), `${s.id} decision`);
  for (const n of wf.notes) {
    if (n.opens.type === 'stage') assert.ok(nodeIds.has(n.opens.id));
    if (n.opens.type === 'edge') assert.ok(edgeIds.has(n.opens.id));
    if (n.opens.type === 'decision') assert.ok(wf.jevDecisions.some((j) => j.id === n.opens.id));
  }
});

test('inline links in explanatory text point at real nodes, artifacts and glossary terms', () => {
  const walk = (v, path) => {
    if (typeof v === 'string') {
      for (const m of v.matchAll(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g)) {
        const key = m[1];
        if (key.startsWith('#')) assert.ok(nodeIds.has(key.slice(1)), `${path}: ${key}`);
        else if (key.startsWith('@')) assert.ok(artifactIds.has(key.slice(1)), `${path}: ${key}`);
        else assert.ok(termIds.has(key), `${path}: term ${key}`);
      }
    } else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, `${path}.${k}`);
  };
  walk(wf.details, 'details');
  walk(wf.edgeDetails, 'edgeDetails');
  walk(wf.artifacts, 'artifacts');
  walk(wf.example, 'example');
  walk(wf.decks, 'decks');
});

test('presentation decks and AC traces only reference existing workflow elements', () => {
  for (const [deckId, deck] of Object.entries(wf.decks)) {
    assert.ok(deck.steps.length > 5, `${deckId} has steps`);
    for (const [i, st] of deck.steps.entries()) {
      for (const n of st.focus) assert.ok(nodeIds.has(n), `${deckId}[${i}] focus ${n}`);
      for (const e of st.edges || []) assert.ok(edgeIds.has(e), `${deckId}[${i}] edge ${e}`);
      if (st.artifact) {
        assert.ok(edgeIds.has(st.artifact.edge), `${deckId}[${i}] artifact edge`);
        assert.ok(artifactIds.has(st.artifact.id), `${deckId}[${i}] artifact id`);
      }
    }
  }
  const acIds = wf.example.acceptanceCriteria.map((a) => a.id);
  for (const [ac, steps] of Object.entries(wf.example.trace)) {
    assert.ok(acIds.includes(ac));
    for (const st of steps) {
      assert.ok(nodeIds.has(st.node), `${ac} trace node ${st.node}`);
      for (const e of st.edges || []) assert.ok(edgeIds.has(e), `${ac} trace edge ${e}`);
    }
    const final = steps.filter((s) => s.verdict).pop();
    const expected = wf.example.acceptanceCriteria.find((a) => a.id === ac).rounds.at(-1);
    assert.equal(final.verdict, expected, `${ac} trace ends with its final verdict`);
  }
  const testIds = new Set(wf.example.tests.map((t) => t.id));
  for (const m of wf.example.mutation.mutants) for (const t of m.killedBy) assert.ok(testIds.has(t), `${m.id} killer ${t}`);
  for (const s of wf.example.mutation.suites) for (const t of s.tests) assert.ok(testIds.has(t));
  for (const t of Object.keys(wf.example.strength)) assert.ok(testIds.has(t));
});

test('the workflow tour visits every numbered stage', () => {
  const visited = new Set(wf.decks.workflow.steps.flatMap((s) => s.focus));
  for (const s of wf.stages) assert.ok(visited.has(s.id), `tour visits ${s.num}`);
});

test('list-view phases contain every stage, human box and decision exactly once', () => {
  const listed = wf.phases.flatMap((p) => p.nodes);
  assert.equal(new Set(listed).size, listed.length, 'no duplicates');
  for (const n of [...wf.stages, ...wf.humans, ...wf.decisions]) assert.ok(listed.includes(n.id), `${n.id} in a phase`);
  for (const id of listed) assert.ok(nodeIds.has(id), `phase node ${id}`);
});

/* ── Mandatory semantic constraints ─────────────────────────────────────────── */

test('Acceptance Criteria are only ever produced by humans', () => {
  const ac = wf.artifacts.find((a) => a.id === 'acceptance-criteria');
  const humanNodes = new Set([...wf.humans.map((h) => h.id), ...wf.stages.filter((s) => s.agents.every((a) => a === 'human')).map((s) => s.id)]);
  assert.ok(ac.producedBy.length > 0);
  for (const p of ac.producedBy) assert.ok(humanNodes.has(p), `AC producer ${p} must be human`);
  for (const a of wf.artifacts) if (a.id !== 'acceptance-criteria') assert.ok(!/^AC-\d/m.test(a.name), 'no agent artifact named as AC');
});

test('the Verification Planner explicitly must not create, expand, reinterpret or improve AC', () => {
  assert.equal(wf.details.s04.mustNotLead, 'Must not create, expand, reinterpret, or improve Acceptance Criteria.');
  assert.ok(wf.details.s04.rules.includes('plan-not-new-ac'));
});

test('the Superset launch boundary never forwards ticket content', () => {
  const launch = wf.edgeDetails['e-03-04'];
  assert.deepEqual(launch.transfers.map((t) => t.split(' ')[0]), ['Issue', 'Operational', 'Execution']);
  for (const item of ['Ticket title', 'Acceptance Criteria', 'Description']) assert.ok(launch.notTransferred.includes(item), `not transferred: ${item}`);
  assert.ok(wf.edgeDetails['e-review-06b'].notTransferred.length > 0, 'reviewer launch is minimal too');
});

test('green CI is never the last word and 06B classifies every AC', () => {
  assert.match(wf.details.s04.verification, /Green CI does not imply business correctness/);
  const verdicts = new Set(['VERIFIED', 'FAILED', 'UNVERIFIED']);
  for (const ac of wf.example.acceptanceCriteria) for (const r of ac.rounds) assert.ok(verdicts.has(r));
  assert.ok(wf.example.acceptanceCriteria.some((a) => a.rounds[0] !== 'VERIFIED'), 'example shows green CI with non-VERIFIED AC');
});

test('human touchpoints include every pink node and each return goes through WFTasks or WFRelease', () => {
  const touch = new Set(wf.humanCategories.flatMap((c) => c.nodes));
  for (const h of wf.humans) {
    assert.ok(touch.has(h.id), `${h.id} is a touchpoint`);
    assert.ok(['s01', 's05', 's08', 's12'].includes(h.returnsTo), `${h.id} returns to a WFTasks / WFRelease stage`);
  }
  for (const s of wf.stages.filter((x) => x.kind === 'human')) assert.ok(touch.has(s.id), `${s.id} is a touchpoint`);
});

test('diagram data names the Grok bot fleet from the bot roster', () => {
  const owner = (id) => wf.stages.find((s) => s.id === id).owner;
  assert.equal(owner('s03'), 'WFTasks → WFCoder');
  assert.equal(owner('s16'), 'WFTasks → WFCoder');
  for (const id of ['s08', 's12']) assert.equal(owner(id), 'WFRelease', `${id} is held by WFRelease`);
  for (const id of ['s02', 's05', 's09', 's13', 's15']) assert.match(owner(id), /WFJev/, `${id} names WFJev as the Jev front door`);
  for (const id of ['s06a', 's06b']) assert.match(owner(id), /^WFReview → /, `${id} is dispatched by WFReview`);
  for (const key of ['wfjev', 'wfrelease', 'wfreview', 'wfcoder']) assert.ok(wf.glossary[key], `glossary entry ${key}`);
  assert.ok(wf.rules.some((r) => r.id === 'fleet-only-wfjev' && r.file.endsWith('bot-roster.md')), 'fleet rule quoted from the bot roster');
});
