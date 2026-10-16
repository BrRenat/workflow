import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.trim().length > 0;
const strings = value => Array.isArray(value) && value.length > 0 && value.every(text);

// Builds a request, never calls Jev or authorizes execution.
export function prepareRequest(kind, state) {
  const missing = [];
  const require = (condition, path) => { if (!condition) missing.push(path); };
  require(object(state), 'state');
  if (!object(state)) return blocked('missing_input', missing);
  require(state.event?.kind === kind, `event.kind must be ${kind}`);
  if (kind === 'intake') {
    const allowed = new Set(['event', 'ticket', 'evidence', 'preflight', 'ownership', 'qa']);
    for (const key of Object.keys(state)) require(allowed.has(key), `unsupported intake field: ${key}`);
    require(text(state.event?.observed_at), 'event.observed_at');
    require(text(state.event?.source_revision), 'event.source_revision');
    for (const key of ['identifier', 'url', 'revision', 'description']) {
      require(text(state.ticket?.[key]), `ticket.${key}`);
    }
    const ac = state.ticket?.acceptance_criteria;
    require(Array.isArray(ac), 'ticket.acceptance_criteria (empty array is allowed when absent)');
    if (Array.isArray(ac)) {
      require(ac.every(x => object(x) && text(x.text) && text(x.source_ref)), 'AC text and source_ref');
      require(state.preflight?.acceptance_criteria_present === (ac.length > 0), 'preflight.acceptance_criteria_present must match AC presence');
    }
    require(object(state.evidence), 'evidence');
    require(Array.isArray(state.ticket?.relevant_comments) || text(state.ticket?.comments_excluded_reason), 'comments or explicit exclusion reason');
    const sources = state.preflight?.sources;
    require(Array.isArray(sources) && sources.length > 0, 'preflight.sources');
    if (Array.isArray(sources)) {
      require(sources.every(s => object(s) && text(s.id) && text(s.source) && typeof s.required_now === 'boolean' && ['readable', 'unreadable', 'not_checked', 'deferred_to_worker'].includes(s.access)), 'source identity, required_now and access');
      require(sources.some(s => s?.id === state.ticket?.identifier && s?.required_now === true), 'required exact tracker issue source');
    }
    if (missing.length) return blocked('missing_input', missing);
    const inaccessible = sources.filter(s => s.required_now && s.access !== 'readable').map(s => s.source);
    const questions = readQuestions('intake');
    return {
      preparation: { status: inaccessible.length ? 'blocked_access' : 'ready', missing_inputs: inaccessible },
      state: structuredClone(state), questions
    };
  }
  if (kind !== 'route_model') return blocked('missing_input', ['kind must be intake or route_model']);

  const routing = state.routing;
  require(object(routing), 'routing');
  require(['production', 'recommendation'].includes(routing?.mode), 'routing.mode');
  const profile = routing?.task_profile;
  require(object(profile), 'routing.task_profile');
  require(text(profile?.role), 'routing.task_profile.role');
  require(text(profile?.lane), 'routing.task_profile.lane');
  require(strings(profile?.required_capabilities), 'routing.task_profile.required_capabilities');
  require(strings(profile?.source_refs), 'routing.task_profile.source_refs');
  require(text(routing?.intake_result_ref), 'routing.intake_result_ref');
  const cards = routing?.eligible_models;
  require(object(cards) && Object.keys(cards).length > 0, 'routing.eligible_models must contain prepared candidate cards');
  const templates = readQuestions('model-routing');
  const aliases = object(cards) ? Object.keys(cards) : [];
  for (const alias of aliases) {
    require(alias !== 'none' && Object.hasOwn(templates.model_choice.criteria, alias), `unsupported model alias: ${alias}`);
    const card = cards[alias];
    require(object(card), `routing.eligible_models.${alias}`);
    require(strings(card?.capabilities), `${alias}.capabilities`);
    require(strings(card?.approved_lanes), `${alias}.approved_lanes`);
    require(strings(card?.source_refs), `${alias}.source_refs`);
    require(['verified', 'operator_provisional', 'synthetic'].includes(card?.evidence_basis), `${alias}.evidence_basis`);
    if (card?.evidence_basis === 'synthetic') require(state.event?.synthetic === true && routing?.mode === 'recommendation', `${alias}: synthetic cards require a synthetic recommendation event`);
    if (routing?.mode === 'production') {
      require(card?.evidence_basis === 'verified' && card?.capabilities_verified === true, `${alias}: production requires verified capabilities`);
      require(strings(card?.evaluation_refs), `${alias}.evaluation_refs`);
      require(text(card?.runtime_id), `${alias}.runtime_id`);
    }
  }
  const order = routing?.tie_break_order;
  require(Array.isArray(order) && order.length === aliases.length && new Set(order).size === aliases.length && aliases.every(a => order.includes(a)), 'routing.tie_break_order must list each eligible alias exactly once');
  if (missing.length) return blocked('missing_input', missing);
  const choice = structuredClone(templates.model_choice);
  choice.criteria = Object.fromEntries([...aliases, 'none'].map(a => [a, choice.criteria[a]]));
  const questions = { model_choice: choice };
  for (const alias of aliases) {
    const fit = structuredClone(templates.candidate_fit);
    fit.instructions = fit.instructions.replaceAll('routing.candidate', `routing.eligible_models.${alias}`);
    questions[`candidate_fit_${alias}`] = fit;
  }
  return { preparation: { status: 'ready', missing_inputs: [], execution_authorized: false }, state: structuredClone(state), questions };
}

function blocked(status, missing_inputs) { return { preparation: { status, missing_inputs }, state: null, questions: null }; }
function readQuestions(name) { return JSON.parse(readFileSync(resolve(root, 'questions', `${name}.json`), 'utf8')); }

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [kind, file] = process.argv.slice(2);
    if (!kind || !file) throw new Error('Usage: node jev/scripts/prepare-request.mjs <intake|route_model> <state.json>');
    const result = prepareRequest(kind, JSON.parse(readFileSync(file, 'utf8')));
    console.log(JSON.stringify(result, null, 2));
    if (result.preparation.status !== 'ready') process.exitCode = 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
