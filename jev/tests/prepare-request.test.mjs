import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareRequest } from '../scripts/prepare-request.mjs';

// Synthetic request-builder inputs; each test gets a fresh copy.
const FIXTURES = {
  intake: {
    "event": {
      "id": "synthetic-example-intake",
      "kind": "intake",
      "synthetic": true,
      "observed_at": "2026-09-25T10:00:00Z",
      "source_revision": "fixture-v1"
    },
    "ticket": {
      "identifier": "EXAMPLE-1",
      "url": "https://example.invalid/issues/EXAMPLE-1",
      "revision": "fixture-v1",
      "status": "Todo",
      "description": "Add a Help link to the browser sidebar. Reuse the existing link style. The destination is https://example.invalid/help. This is a synthetic task for request preparation.",
      "acceptance_criteria": [
        {
          "id": "AC-1",
          "source_ref": "EXAMPLE-1/AC/1",
          "text": "The sidebar displays a Help link that opens https://example.invalid/help in a new tab."
        }
      ],
      "relevant_comments": []
    },
    "evidence": {
      "issue": {
        "source": "https://example.invalid/issues/EXAMPLE-1",
        "source_revision": "fixture-v1",
        "observed_at": "2026-09-25T10:00:00Z",
        "observation": "Synthetic description and AC supplied in this fixture; no images or videos."
      }
    },
    "preflight": {
      "acceptance_criteria_present": true,
      "sources": [
        {
          "id": "EXAMPLE-1",
          "source": "https://example.invalid/issues/EXAMPLE-1",
          "required_now": true,
          "access": "readable"
        }
      ],
      "attachments": [],
      "dependencies": []
    },
    "ownership": null,
    "qa": {
      "history": [],
      "source": "synthetic fixture; no QA history"
    }
  },
  'model-routing': {
    "event": {
      "id": "synthetic-routing-example",
      "kind": "route_model",
      "synthetic": true
    },
    "routing": {
      "mode": "recommendation",
      "intake_result_ref": "synthetic-fixture-profile-v1 (not an actual Jev response)",
      "task_profile": {
        "role": "implementation_worker",
        "lane": "routine",
        "required_capabilities": [
          "React",
          "TypeScript",
          "browser interaction tests"
        ],
        "source_refs": [
          "synthetic-fixture-profile-v1"
        ]
      },
      "eligible_models": {
        "grok": {
          "evidence_basis": "synthetic",
          "capabilities": [
            "Markdown documentation"
          ],
          "approved_lanes": [
            "bounded documentation"
          ],
          "source_refs": [
            "synthetic-registry-v1"
          ]
        },
        "chatgpt_sol": {
          "evidence_basis": "synthetic",
          "capabilities": [
            "React",
            "TypeScript",
            "browser interaction tests"
          ],
          "approved_lanes": [
            "routine implementation_worker"
          ],
          "source_refs": [
            "synthetic-registry-v1"
          ]
        }
      },
      "tie_break_order": [
        "grok",
        "chatgpt_sol"
      ]
    }
  },
};
const fixture = name => structuredClone(FIXTURES[name]);

test('step 01 returns only intake content and intake questions without modifying AC', () => {
  const state = fixture('intake');
  const result = prepareRequest('intake', state);
  assert.equal(result.preparation.status, 'ready');
  assert.deepEqual(result.state, state);
  assert.ok(result.questions.acceptance_verifiable);
  assert.equal(result.questions.model_choice, undefined);
  for (const field of ['routing', 'review', 'delivery', 'workflow', 'selected_model']) assert.equal(result.state[field], undefined);
});

test('rejects the previous intake output with null future-stage fields', () => {
  const state = fixture('intake');
  state.routing = null;
  state.delivery = null;
  const result = prepareRequest('intake', state);
  assert.equal(result.preparation.status, 'missing_input');
  assert.equal(result.questions, null);
});

test('source access gap blocks live intake; worker design deferral does not', () => {
  const state = fixture('intake');
  state.preflight.sources.push({ id: 'design', source: 'https://example.invalid/design', required_now: false, access: 'deferred_to_worker' });
  assert.equal(prepareRequest('intake', state).preparation.status, 'ready');
  state.preflight.sources.push({ id: 'prd', source: 'https://example.invalid/prd', required_now: true, access: 'unreadable' });
  const result = prepareRequest('intake', state);
  assert.equal(result.preparation.status, 'blocked_access');
  assert.deepEqual(result.preparation.missing_inputs, ['https://example.invalid/prd']);
  assert.deepEqual(result.state.preflight.sources, state.preflight.sources);
});

test('absent AC remain absent, not synthesized; semantic readiness belongs to Jev/controller', () => {
  const state = fixture('intake');
  state.ticket.acceptance_criteria = [];
  state.preflight.acceptance_criteria_present = false;
  const result = prepareRequest('intake', state);
  assert.equal(result.preparation.status, 'ready');
  assert.deepEqual(result.state.ticket.acceptance_criteria, []);
  // Structurally ready does not mean the controller's AC-presence gate passes.
  assert.equal(result.state.preflight.acceptance_criteria_present, false);
});

test('comments excluded for replay are distinguished from an empty history', () => {
  const state = fixture('intake');
  state.ticket.relevant_comments = null;
  assert.equal(prepareRequest('intake', state).preparation.status, 'missing_input');
  state.ticket.comments_excluded_reason = 'User requested this replay without comments.';
  assert.equal(prepareRequest('intake', state).preparation.status, 'ready');
});

test('old intake-only routing input fails before inference, not as model_choice none', () => {
  const state = fixture('intake');
  state.routing = { task_profile: null, eligible_models: null };
  const result = prepareRequest('route_model', state);
  assert.equal(result.preparation.status, 'missing_input');
  assert.equal(result.questions, null);
  assert.ok(result.preparation.missing_inputs.includes('routing.task_profile'));
});

test('expands every candidate path and prunes unavailable choice options', () => {
  const state = fixture('model-routing');
  const result = prepareRequest('route_model', state);
  assert.equal(result.preparation.status, 'ready');
  assert.deepEqual(Object.keys(result.questions.model_choice.criteria), ['grok', 'chatgpt_sol', 'none']);
  assert.deepEqual(Object.keys(result.questions), ['model_choice', 'candidate_fit_grok', 'candidate_fit_chatgpt_sol']);
  for (const alias of ['grok', 'chatgpt_sol']) {
    assert.ok(result.questions[`candidate_fit_${alias}`].instructions.includes(`routing.eligible_models.${alias}`));
  }
  assert.equal(JSON.stringify(result.questions).includes('routing.candidate'), false);
  assert.deepEqual(result.state, state);
  assert.equal(result.preparation.execution_authorized, false);
});

test('empty, missing and malformed candidates cannot masquerade as unsuitable models', () => {
  for (const cards of [null, {}, { chatgpt_sol: {} }, { bogus: {} }]) {
    const state = fixture('model-routing');
    state.routing.eligible_models = cards;
    assert.equal(prepareRequest('route_model', state).preparation.status, 'missing_input');
  }
});

test('production rejects provisional cards; recommendation accepts declared assumptions', () => {
  const state = fixture('model-routing');
  state.event.synthetic = false;
  for (const card of Object.values(state.routing.eligible_models)) card.evidence_basis = 'operator_provisional';
  assert.equal(prepareRequest('route_model', state).preparation.status, 'ready');
  state.routing.mode = 'production';
  assert.equal(prepareRequest('route_model', state).preparation.status, 'missing_input');
  for (const card of Object.values(state.routing.eligible_models)) {
    Object.assign(card, { evidence_basis: 'verified', capabilities_verified: true, runtime_id: 'test-runtime-only', evaluation_refs: ['test-evaluation-only'] });
  }
  assert.equal(prepareRequest('route_model', state).preparation.status, 'ready');
});

test('synthetic cards require explicit synthetic event, and tie order must be complete', () => {
  const state = fixture('model-routing');
  delete state.event.synthetic;
  assert.equal(prepareRequest('route_model', state).preparation.status, 'missing_input');
  state.event.synthetic = true;
  state.routing.tie_break_order = ['grok', 'grok'];
  assert.equal(prepareRequest('route_model', state).preparation.status, 'missing_input');
});

test('a structurally valid but unsuitable set is sent to Jev; builder does not choose', () => {
  const state = fixture('model-routing');
  delete state.routing.eligible_models.chatgpt_sol;
  state.routing.tie_break_order = ['grok'];
  const result = prepareRequest('route_model', state);
  assert.equal(result.preparation.status, 'ready');
  assert.ok(result.questions.model_choice.criteria.none);
  assert.equal(result.answers, undefined);
  assert.equal(result.state.routing.selected_model, undefined);
});
