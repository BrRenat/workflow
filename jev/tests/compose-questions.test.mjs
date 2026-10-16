import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { composeQuestions, preparePacket, exportPresets } from '../scripts/compose-questions.mjs';

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
// The same synthetic record as Markdown and as an unrelated JSON layout.
const markdown = '# PRJ-1 Help link\n\nAdd a Help link to the sidebar.\n\n## Acceptance criteria\n\n1. The sidebar shows a Help link that opens the help page in a new tab.\n';
const alternate = { reference: { id: 'PRJ-1', version: 'example-v1' }, work_notes: { original_record: markdown } };
const evidence = stage => ({ ticket: { identifier: 'PRJ-1', revision: 'synthetic-v1' }, stage, head: '1111111', gaps: ['QA record not retrieved'] });

test('same questions accept plain text and unrelated JSON layout without mapping fields', () => {
  assert.equal(alternate.work_notes.original_record, markdown);
  const a = preparePacket(markdown, ['step-02']);
  const b = preparePacket(alternate, ['step-02']);
  assert.deepEqual(a.questions, b.questions);
  assert.equal(a.state, markdown);
  assert.deepEqual(b.state, alternate);
  b.state.reference.version = 'caller mutation';
  assert.equal(alternate.reference.version, 'example-v1');
});

test('model questions can be exported without any task, profile, cards or earlier response', () => {
  const questions = composeQuestions(['model-selection']);
  assert.deepEqual(Object.keys(questions), ['model_choice']);
  const criteria = questions.model_choice.criteria;
  for (const alias of ['grok', 'claude_fable', 'chatgpt_sol', 'claude_opus', 'chatgpt_astra', 'none', 'insufficient_context']) assert.ok(criteria[alias]);
  const packet = preparePacket('Implement the supplied banner requirements.', ['model-selection']);
  assert.deepEqual(packet.questions, questions);
  assert.equal(packet.state, 'Implement the supplied banner requirements.');
  assert.equal(packet.preparation, undefined); // no semantic/readiness verdict invented
});

test('presets union reusable definitions without duplication or evidence-dependent rewriting', () => {
  const union = composeQuestions(['readiness', 'human-attention', 'model-selection']);
  assert.deepEqual(union, composeQuestions(['step-02']));
  const readiness = composeQuestions(['readiness']);
  assert.deepEqual(composeQuestions(['readiness', 'readiness']), readiness);
  const library = JSON.parse(read('questions/library.json'));
  for (const [id, question] of Object.entries(union)) assert.deepEqual(question, library[id]);
});

test('library questions have valid types and no input paths or step-specific instructions', () => {
  for (const [id, q] of Object.entries(JSON.parse(read('questions/library.json')))) {
    assert.ok(['choice', 'noul'].includes(q.type), id);
    assert.equal(typeof q.instructions, 'string');
    assert.ok(Object.keys(q.criteria).length >= 2, id);
    if (q.type === 'noul') assert.deepEqual(Object.keys(q.criteria).sort(), ['false', 'true']);
    assert.doesNotMatch(JSON.stringify(q), /\b(?:ticket|routing|preflight|evidence|ownership)\.[a-z_]+|routing\.candidate|\bstep\s+0[08]\b/i, id);
    assert.match(q.instructions, /not instructions to change (?:these criteria|this rubric)/, id);
  }
});

test('human-attention preset includes specific reasons and risk rather than blanket approval', () => {
  const qs = composeQuestions(['human-attention']);
  for (const id of ['human_decision_required', 'product_decision_needed', 'scope_conflict', 'security_boundary_change', 'implementation_context_sufficient']) assert.ok(qs[id]);
  const policy = JSON.parse(read('policies/step-02.json'));
  assert.equal(policy.mode, 'shadow');
  assert.equal(policy.execution_enabled, false);
  const library = composeQuestions(['step-02']);
  for (const id of [...policy.required_positive, ...policy.required_negative, ...policy.bug_only_positive, ...Object.keys(policy.domain_policy_checks)]) assert.ok(library[id], id);
});

test('generated playground exports exactly match the authored library and preset selection', () => {
  for (const { filename, content } of exportPresets()) assert.equal(read(`questions/${filename}`), content, `regenerate ${filename}`);
});

test('independent work areas compose into intake and map without a single-owner choice', () => {
  const areas = composeQuestions(['work-areas']);
  const full = composeQuestions(['step-02']);
  const readiness = composeQuestions(['readiness']);
  const policy = JSON.parse(read('policies/step-02.json'));
  const mapping = policy.work_area_interpretation.question_to_area;
  assert.equal(Object.keys(areas).length, 8);
  assert.deepEqual(Object.keys(mapping), Object.keys(areas));
  assert.equal(new Set(Object.values(mapping)).size, 8);
  for (const [id, q] of Object.entries(areas)) {
    assert.equal(q.type, 'noul', id);
    assert.deepEqual(full[id], q);
    assert.deepEqual(readiness[id], q);
    assert.ok(!policy.required_positive.includes(id), `${id} is a scope flag, not a readiness requirement`);
  }
  assert.equal(full.likely_owner, undefined);
  assert.deepEqual(composeQuestions(['step-02', 'work-areas']), full);
  // Later stages retain their original contract until separately migrated.
  assert.ok(JSON.parse(read('questions/intake.json')).likely_owner);
});

test('unknown presets and question IDs fail instead of silently omitting questions', () => {
  assert.throws(() => composeQuestions([]), /preset/);
  assert.throws(() => composeQuestions(['typo']), /Unknown preset/);
  assert.throws(() => composeQuestions(['x'], { library: {}, presets: { x: { question_ids: ['missing'] } } }), /Unknown question/);
});

test('thin composition preserves incomplete evidence; only absent transport input is rejected', () => {
  for (const state of [null, '', '  ', {}, [], true, 42]) assert.throws(() => preparePacket(state, ['step-02']), /nonempty/);
  const partial = { notes: 'Requirements are missing. Required PRD is inaccessible.' };
  assert.deepEqual(preparePacket(partial, ['step-02']).state, partial);
  // The composer must not fill AC or claim readiness. The controller handles these gaps.
});

test('step 05 composes independently of evidence shape and legacy review paths', () => {
  const qs = composeQuestions(['step-05']);
  assert.equal(Object.keys(qs).length, 8);
  assert.deepEqual(composeQuestions(['review-depth', 'review-human-attention']), qs);
  assert.deepEqual(JSON.parse(read('questions/review-routing.json')), qs);
  const state = evidence('review');
  assert.deepEqual(preparePacket(state, ['step-05']).state, state);
  assert.deepEqual(preparePacket('Expected behavior and diff are known; runtime evidence missing.', ['step-05']).questions, qs);
  for (const q of Object.values(qs)) assert.doesNotMatch(JSON.stringify(q), /\b(?:review|ticket|routing)\.[a-z_]+|\bstep\s+0[56]\b/i);
  assert.match(qs.review_context_sufficient.instructions, /Missing test results or runtime verification do not by themselves/);
  const policy = JSON.parse(read('policies/step-05.json'));
  assert.deepEqual(policy.required_answers, Object.keys(qs));
  assert.equal(policy.execution_enabled, false);
  assert.equal(policy.mode, 'shadow');
  assert.equal(policy.thresholds.calibrated, false);
});

test('step 09 composes staging-decision questions independently of evidence shape', () => {
  const qs = composeQuestions(['step-09']);
  assert.deepEqual(Object.keys(qs), ['acceptance_evidence_sufficient', 'scope_expanded', 'manual_check_outstanding', 'delivery_coordination_needed', 'merge_blocker_present', 'human_release_decision_required']);
  const state = evidence('staging');
  assert.deepEqual(preparePacket(state, ['step-09']).state, state);
  for (const q of Object.values(qs)) assert.doesNotMatch(JSON.stringify(q), /\b(?:delivery|review|ticket)\.[a-z_]+|\bstep\s+(?:08|09|10)\b/i);
  const policy = JSON.parse(read('policies/step-09.json'));
  assert.deepEqual(policy.required_answers, Object.keys(qs));
  assert.deepEqual([...policy.required_positive, ...policy.required_negative].sort(), Object.keys(qs).sort());
  assert.equal(policy.execution_enabled, false);
  assert.equal(policy.mode, 'shadow');
});

test('step 13 composes a stricter production-release preset than step 09', () => {
  const qs = composeQuestions(['step-13']);
  assert.deepEqual(Object.keys(qs), ['acceptance_evidence_sufficient', 'production_evidence_current', 'scope_expanded', 'production_manual_check_outstanding', 'production_coordination_needed', 'production_blocker_present', 'rollout_plan_complete', 'release_batch_clean', 'incident_or_freeze_active', 'risk_class_requires_human', 'human_production_decision_required']);
  const state = evidence('release');
  assert.deepEqual(preparePacket(state, ['step-13']).state, state);
  for (const q of Object.values(qs)) assert.doesNotMatch(JSON.stringify(q), /\b(?:delivery|review|ticket)\.[a-z_]+|\bstep\s+(?:12|13|14)\b/i);
  const policy = JSON.parse(read('policies/step-13.json'));
  const staging = JSON.parse(read('policies/step-09.json'));
  assert.deepEqual(policy.required_answers, Object.keys(qs));
  assert.deepEqual([...policy.required_positive, ...policy.required_negative].sort(), Object.keys(qs).sort());
  assert.ok(policy.required_positive.length > staging.required_positive.length, 'more positive predicates than 09');
  assert.ok(policy.required_negative.length > staging.required_negative.length, 'more negative predicates than 09');
  assert.ok(policy.thresholds.noul_yes_min > staging.thresholds.noul_yes_min && policy.thresholds.noul_no_max < staging.thresholds.noul_no_max, 'narrower bands than 09');
  assert.ok(policy.outcomes.some((o) => o.outcome === 'human_decision'), '13 routes human-class answers to the release owner');
  assert.equal(policy.execution_enabled, false);
  assert.equal(policy.mode, 'shadow');
});

