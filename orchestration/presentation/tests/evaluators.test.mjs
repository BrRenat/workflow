/*
 * The "Explain decision" evaluators must follow the documented gates and cite real rules.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { loadData, PRESENTATION_DIR } from './helpers.mjs';

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(readFileSync(resolve(PRESENTATION_DIR, 'js/evaluators.js'), 'utf8'), sandbox);
const E = sandbox.window.WFEvaluators;
const plain = (v) => JSON.parse(JSON.stringify(v));
const ruleIds = new Set(loadData().wf.rules.map((r) => r.id));
const citesRealRules = (r) => r.reasons.forEach((x) => assert.ok(ruleIds.has(x.rule), `unknown rule ${x.rule}`));

const ready = { access: true, dependency: 'resolved', present: true, jev: 'available', unambiguous: 'pass', verifiable: 'pass', consistent: 'pass', context: 'pass', risk: false, capacity: 'available' };

test('readiness: all five gates pass → READY', () => {
  const r = plain(E.readiness(ready));
  assert.equal(r.label, 'READY');
  citesRealRules(r);
});

test('readiness: missing or uncertain AC → NEEDS_CLARIFICATION, never a pass', () => {
  for (const change of [{ present: false }, { unambiguous: 'fail' }, { verifiable: 'uncertain' }, { consistent: 'fail' }, { context: 'uncertain' }]) {
    const r = plain(E.readiness({ ...ready, ...change }));
    assert.equal(r.label, 'NEEDS_CLARIFICATION', JSON.stringify(change));
    assert.equal(r.disposition, 'human_attention');
    assert.match(r.next, /No drafted AC/);
    citesRealRules(r);
  }
});

test('readiness: waits do not ask humans; Jev unavailable is blocked_jev', () => {
  assert.equal(E.readiness({ ...ready, dependency: 'pending' }).label, 'WAIT_DEPENDENCY');
  assert.equal(E.readiness({ ...ready, capacity: 'exhausted' }).label, 'WAIT_CAPACITY');
  assert.equal(E.readiness({ ...ready, capacity: 'unknown' }).label, 'WAIT_CAPACITY');
  assert.equal(E.readiness({ ...ready, jev: 'unavailable' }).label, 'BLOCKED_JEV');
  assert.equal(E.readiness({ ...ready, access: false }).label, 'BLOCKED_ACCESS');
  assert.equal(E.readiness({ ...ready, risk: true }).label, 'HUMAN_ATTENTION');
});

const bounded = { humanCheck: 'no', repoRequiresBoth: false, context: 'pass', productDecision: 'no', specialist: 'no', businessLogic: 'no', behavior: 'no', crossComponent: 'no', githubSufficient: 'yes', repoRequiresIndependent: false, qaReopen: false, coverageAccepted: true };

test('review routing: 06A requires covered behavior and configured static coverage', () => {
  assert.equal(E.review(bounded).route, 'github_codex');
  assert.equal(E.review({ ...bounded, coverageAccepted: false }).route, 'independent_verification');
  assert.equal(E.review({ ...bounded, githubSufficient: 'uncertain' }).route, 'independent_verification');
  for (const k of ['behavior', 'crossComponent']) {
    assert.equal(E.review({ ...bounded, [k]: 'uncertain' }).route, 'independent_verification', `${k} uncertain`);
  }
  assert.equal(E.review({ ...bounded, qaReopen: true }).route, 'independent_verification');
  citesRealRules(plain(E.review(bounded)));
});

test('review routing: human attention is a separate field and does not replace the route', () => {
  const r = plain(E.review({ ...bounded, behavior: 'yes', productDecision: 'yes' }));
  assert.equal(r.route, 'independent_verification');
  assert.equal(r.attention.length, 1);
  assert.equal(E.review({ ...bounded, context: 'uncertain' }).route, null);
});

const allGates = { qaDevelop: true, freshHead: true, ci: true, review: true, noFindings: true, branch: true, window: true, jevPass: true, grantMerge: true, policyActive: true, humanDecision: false };

test('staging: automatic merge only with every gate and the merge grant', () => {
  assert.equal(E.staging(allGates).label, 'AUTO MERGE');
  for (const [k] of E.STAGING_GATES.filter(([k]) => k !== 'qaDevelop')) {
    assert.match(E.staging({ ...allGates, [k]: false }).label, /^WAIT/, `${k} missing must wait`);
  }
  assert.equal(E.staging({ ...allGates, qaDevelop: false }).label, 'NOT ELIGIBLE');
});

test('staging: committed example policy (shadow, no grants) always waits', () => {
  const r = plain(E.staging({ ...allGates, grantMerge: false, policyActive: false }));
  assert.equal(r.label, 'WAIT');
  assert.match(r.next, /08/);
  citesRealRules(r);
});

test('staging: a pending human decision routes to the release owner and back to 08', () => {
  const r = plain(E.staging({ ...allGates, humanDecision: true }));
  assert.equal(r.label, 'HUMAN DECISION NEEDED');
  assert.match(r.next, /08/);
});

const allRelease = { qaStaging: true, freshArtifact: true, ci: true, review: true, batchClean: true, noIncident: true, rollout: true, branch: true, jevPass: true, grantDeploy: true, policyActive: true, riskHuman: false, humanDecision: false };

test('release: automatic release only with every stricter gate and the deploy_production grant', () => {
  assert.equal(E.release(allRelease).label, 'AUTO RELEASE');
  assert.match(E.release(allRelease).next, /14/);
  for (const [k] of E.RELEASE_GATES.filter(([k]) => k !== 'qaStaging')) {
    assert.match(E.release({ ...allRelease, [k]: false }).label, /^WAIT/, `${k} missing must wait`);
  }
  assert.equal(E.release({ ...allRelease, qaStaging: false }).label, 'NOT ELIGIBLE');
  assert.ok(E.RELEASE_GATES.length > E.STAGING_GATES.length, '13 checks more gates than 09');
});

test('release: committed example policy (shadow, no grants) always waits under 12', () => {
  const r = plain(E.release({ ...allRelease, grantDeploy: false, policyActive: false }));
  assert.equal(r.label, 'WAIT');
  assert.match(r.next, /12/);
  citesRealRules(r);
});

test('release: a human-reserved risk class or named decision goes to the release owner and back to 12', () => {
  for (const change of [{ riskHuman: true }, { humanDecision: true }, { riskHuman: true, noIncident: false }]) {
    const r = plain(E.release({ ...allRelease, ...change }));
    assert.equal(r.label, 'HUMAN DECISION NEEDED', JSON.stringify(change));
    assert.match(r.next, /12/);
    citesRealRules(r);
  }
});

const validQa = { build: true, steps: true, expectedActual: true, video: false, screenshot: true, buildHasFix: true, relation: 'original_failure', ownerMatches: true, attempts: 0 };

test('QA validation: only a complete, current-build report reaches 16', () => {
  assert.match(E.qa(validQa).label, /16/);
  for (const change of [{ steps: false }, { video: true, screenshot: false }, { buildHasFix: false }, { relation: 'new_requirement' }, { ownerMatches: false }, { attempts: 2 }]) {
    assert.match(E.qa({ ...validQa, ...change }).label, /17/, JSON.stringify(change));
  }
  citesRealRules(plain(E.qa({ ...validQa, video: true, screenshot: false })));
});

test('model routing: committed example registry selects no model', () => {
  const r = plain(E.model({ registry: 'example', complexity: 'routine', quota: 'known' }));
  assert.equal(r.model, null);
  assert.equal(E.model({ registry: 'configured', complexity: 'unknown', quota: 'known' }).model, null);
  assert.equal(E.model({ registry: 'configured', complexity: 'routine', quota: 'unknown' }).label, 'WAIT_CAPACITY');
  citesRealRules(r);
});


test('review routing: domain policy, both routes and human uncertainty stay independent', () => {
  assert.equal(E.review({ ...bounded, businessLogic: 'yes' }).route, 'github_codex');
  assert.equal(E.review({ ...bounded, businessLogic: 'yes', repoRequiresIndependent: true }).route, 'independent_verification');
  assert.equal(E.review({ ...bounded, repoRequiresBoth: true }).route, 'github_codex_and_independent_verification');
  const uncertain = E.review({ ...bounded, humanCheck: 'uncertain' });
  assert.equal(uncertain.attention.length, 0);
  assert.equal(uncertain.investigations.length, 1);
  const missing = E.review({ ...bounded, context: 'uncertain', productDecision: 'yes' });
  assert.equal(missing.label, 'COLLECT_CONTEXT');
  assert.equal(missing.route, null);
  assert.equal(missing.attention.length, 1);
  assert.equal(E.review({ ...bounded, humanCheck: 'yes' }).attention.length, 1);
});
