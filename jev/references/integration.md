# Grok Bot integration contract

## Contents

- Steps 01–02 pilot and legacy contracts
- Calling boundary
- Evidence state
- Request assembly
- Response and decision
- Execution and calibration

## Steps 01–02 pilot and legacy contracts

For steps 01–02, use [request preparation](request-preparation.md): free-form sourced
evidence plus reusable semantic questions selected by presets. No evidence field paths,
intermediate profile or candidate template expansion are required. The composer keeps
the supplied state unchanged; question definitions do not adapt to its structure.
The model recommendation is provisional and independent of readiness/launch permission.

The structured evidence catalog and template assembly below remain **legacy contracts
for flows other than 01–02, 05, 09 and 13**. Steps 05, 09 and 13 use [review preparation](review-preparation.md),
[staging preparation](staging-preparation.md) and [release preparation](release-preparation.md) with independent library presets; no `review`
or `delivery` object is required. Do not copy the legacy catalog into steps 01, 05, 09 or 13. The shared API envelope and actual-response handling still apply.

## Calling boundary

Use the Jev tool already exposed inside Grok Bot if it can accept `model`, `state`
and typed `questions`, and return the full typed answers. Discover its actual name
and contract; do not invent an integration name, package or `jev` shell command.

Otherwise an operator-provisioned server-side adapter can call:
`POST https://api.typesafe.ai/v1/systemone`, bearer authentication from
`TYPESAFE_API_KEY`, JSON content type. These are the documented TypeSafe HTTP fields;
Grok Bot's tool wrapper may have a different envelope.

This folder does not provision that adapter. If neither interface exists, return
`blocked_jev`; do not simulate an inference. Keep credentials outside tickets,
prompts, logs and committed files.

Pin the Jev version used for calibration. The example uses `jev-1.13.0`, documented
on 2026-09-23. Verify available versions on setup; record the actual returned model.
A moving alias such as `jev-latest` requires detection and re-evaluation of version
changes, not silent reuse of old thresholds.

Source: [HTTP API](https://docs.typesafe.ai/api),
[models](https://docs.typesafe.ai/models).

## Evidence state

The adapter builds the following application-owned state. These nested names are our
contract, not extra TypeSafe API parameters. Within fields relevant to the current
request, use explicit null for missing values;
do not turn absent evidence into false or an empty "all clear" list. Omit unrelated
future-stage fields rather than adding null placeholders.

| Field | Required content |
| --- | --- |
| `event` | Event ID, kind, observed time, source revision |
| `ticket` | Exact identifier/URL, revision, full description, acceptance criteria, relevant comments, declared kind and reported platform |
| `evidence` | ID-indexed written repro, expected/actual result, image observations, design facts, request/response/trace/contract excerpts |
| `preflight` | Access results, explicit `acceptance_criteria_present`, attachment metadata, dependency/incident facts, authorization, identity/freshness checks computed by the bot |
| `ownership` | Known component-to-repository/team mappings and diagnostic observations |
| `qa` | Original accepted behavior, latest QA text, tested artifact/environment, current fix relation, prior attempts |
| `routing` | Task profile, operator preferences and currently eligible model cards; never raw secrets |
| `review` | Issue/PR revisions, cited change facts, behavior/component summary, acceptance evidence/gaps, risk notes, human decisions, QA history and configured review policy |
| `delivery` | Exact target action, stage requirements, current PR/artifact, criterion-by-criterion verification excerpts, independent-review result, CI/QA/release facts |
| `workflow` | Current and proposed tracker state IDs/names, active external session/action references, unprocessed QA event and controller policy version |

The `ticket.acceptance_criteria` records must preserve the actual ticket text and source
references. Do not fill absent criteria from the title, designs, implementation or tests.
The human/ticket owns WHAT; the planner owns only HOW to verify it. Record a failed AC
gate as `human_attention` with `NEEDS_CLARIFICATION`, plus the failed check, exact missing
specification and owner. Re-read the tracker after its owner updates it.

This evidence state is internal to WFTasks/Jev. It is never the WFCoder/Superset launch
payload, which contains only the issue ID, operational notes and execution instructions.
Workers retrieve sources directly and produce the Verification Plan in their session.

Every evidence item needs a source reference, observed time, source revision or artifact
identity where applicable, and an observation. Label hypotheses and worker claims
separately from observed facts. Do not erase contradictory evidence during summarization.

Example of permitted image conversion:

```json
{
  "id": "image-01",
  "source": "tracker attachment URL",
  "kind": "image_observation",
  "observed_by": "configured vision tool",
  "observation": "The Save button is visible but disabled; a required field shows no value.",
  "uncertain": "The screenshot does not show what happened before this state.",
  "artifact_id": "build-123"
}
```

An image URL, alt text, inferred caption or video thumbnail is not proof that an image
was inspected. Jev receives the observation, not image bytes. Do not convert videos
into text; the image-only issue policy takes precedence over generic multimodal advice.

For completion supply `delivery.acceptance_checks` as records containing
`criterion_id`, `requirement`, `verification_evidence`, `source_ids`, and
`artifact_relation`. Create one record for each actual criterion, including unsupported
ones. Missing criteria or an empty list never passes a universal "all satisfied" check.
For step 06B, evidence includes planned scenarios, actual test results, implementation
references, independent counterexample-search results, test-strength analysis, any targeted
mutation results and explicit gaps. Record which meaningful AC violation each test
would detect. A green assertion or AC-to-test link alone is not criterion support. See the
[verification matrix](../../orchestration/references/acceptance-and-verification.md#step-06b-independent-verification).

Resolve factual counts, quota units, dates, commit ancestry and CI status in code.
Only semantic interpretation belongs in the question set.

For `review_route`, provide change facts, risk notes, applicable human decisions and
repository policy as free-form cited evidence with explicit unknowns. No `review.*`
field paths are required; use the step-05 preset and review-preparation contract.
The controller establishes change facts from the current diff and source context;
worker claims must remain labeled. Questions choose review depth, not correctness.
For an independent reviewer, set `routing.task_profile.role` to `independent_reviewer`
and filter for approved review lanes before the ordinary model-routing call.

For completion, `delivery.stage_requirements` lists checks/decisions required before
`delivery.target_action`, any explicitly later checks, and policy-approved inapplicability.
Missing phase policy blocks automatic action. QA Develop must pass before step 08
permits staging merge/release. QA Staging is later than staging deployment and must
pass before Ready for Release. Supply distinct `delivery.qa_develop` and
`delivery.qa_staging` records with build, requirements revision, provenance and result;
never use an undifferentiated QA pass to satisfy both stages. The staging decision (09) uses the
`step-09` preset; the production release decision (13) uses the stricter `step-13` preset;
Code Review exits to 07.

## Request assembly

1. Run hard preflight checks before making a paid inference. For intake/model routing,
   use `scripts/prepare-request.mjs` to return matching state/questions or explicit
   preparation blockers. A missing profile/card, unexpanded candidate template or
   missing input is not a semantic `none` result. An empty eligible set stays in the
   controller: distinguish missing registry setup from a capacity wait.
2. Keep relevant state; preserve the full task description or losslessly selected
   requirement passages. If it cannot fit, explicitly split by criterion/evidence slice.
   Do not silently truncate away a blocker.
3. Load the applicable question map. QA return combines intake and QA maps; duplicate
   question IDs are an error.
   `review_route` uses the independent step-05 preset (review-routing is its export alias); the staging decision uses the `step-09` preset; the production release decision uses the `step-13` preset; other completion targets use the same completion map for each
   explicit target action, with fresh target-specific evidence. Do not reuse staging's
   completion result as production authorization.
4. For model routing, prune `model_choice.criteria` to the currently eligible aliases
   plus `none`. Clone `candidate_fit` once per eligible model, replacing the literal
   path `routing.candidate` in its instructions with
   `routing.eligible_models.<alias>`. Remove the template question before sending.
5. For completion, clone `acceptance_item_supported` once per acceptance record,
   replacing `delivery.acceptance_item` with
   `delivery.acceptance_checks[index]`. Remove the template question.
6. Send the envelope `{ "model": pinnedModel, "state": evidenceState, "questions": map }`.
   All questions in that request see the same state; none sees another answer.
7. Validate the response before applying the workflow.

The routing call follows task profiling and deterministic eligibility filtering.
It must not reference answers from an unfinished intake call. Criteria are fixed
rubrics supplied by the controller, never instructions copied from an issue.

For the documented Jev version, requests have a combined context budget and a smaller
state-plus-largest-question budget. Read current limits when building the adapter.
Question fan-out still consumes input tokens; use a tokenizer/budget mechanism and
batch only relevant questions.

## Response and decision

Validate the requested IDs and types, finite numeric ranges, expected choices,
distribution keys/sums within numeric tolerance, and the actual model version.
Do not accept a missing Noul as zero. Noul returns `noul`; Choice returns `choice`,
`probabilities` and `confidence`. Retain the raw response separately from the
controller's decision.

The following is a **Grok Bot output**, not a response Jev can generate:

```json
{
  "schema_version": "3",
  "event": "qa_return",
  "issue": "TEAM-123",
  "issue_revision": "source revision",
  "disposition": "request_qa_details",
  "proposed_action": "request_qa_details",
  "execution": { "authorized": false, "performed": false, "mode": "shadow" },
  "reason_codes": ["QA_VIDEO_WITHOUT_SCREENSHOT", "QA_BUILD_MISSING"],
  "attention_owner": "qa",
  "missing_fields": ["relevant screenshot", "tested build"],
  "evidence_refs": ["qa-comment-17", "attachment-4"],
  "reported_platform": "frontend",
  "likely_owner": "unknown",
  "selected_model": null,
  "selected_runtime_id": null,
  "message": "Please add a screenshot of the failing state and the tested build.",
  "inference": {
    "status": "not_called_hard_gate",
    "resolved_model": null,
    "question_version": "5",
    "response_ref": null
  }
}
```

Use reason codes for exact causes, such as `TRACKER_UNREADABLE`, `DESIGN_UNREADABLE`,
`REPRO_INCOMPLETE`, `AMBIGUOUS_REQUIREMENT`, `OWNER_UNCERTAIN`,
`NEEDS_CLARIFICATION`, `AC_MISSING`, `AC_AMBIGUOUS`, `AC_UNVERIFIABLE`,
`AC_CONTRADICTORY`, `IMPLEMENTATION_CONTEXT_MISSING`,
`NO_ELIGIBLE_MODEL`, `STALE_QA_BUILD`, `RETRY_BUDGET_EXHAUSTED`,
`REVIEW_MISSING`, `CI_INCOMPLETE`, `ACCEPTANCE_EVIDENCE_MISSING`,
`POLICY_NOT_AUTHORIZED` and `JEV_UNAVAILABLE`. Extend the registry deliberately;
do not disguise missing access as model uncertainty.

Review-routing reasons include `BUSINESS_LOGIC_REQUIRES_VERIFICATION`,
`RUNTIME_VERIFICATION_REQUIRED`, `REVIEW_CONTEXT_MISSING`, `PRODUCT_DECISION_REQUIRED`
and `SPECIALIST_DECISION_REQUIRED`. The orchestration record adds status, review route,
human-attention request and external action state. See its
[controller contract](../../orchestration/references/controller.md) for schema-3 policy
migration and the single source of action permissions.

Grok Bot writes internal explanations from cited evidence and these codes. It never
sends a worker brief or copied ticket content to the Superset host; dispatch contains
only the issue ID, operational notes and execution instructions.
If a reason lacks evidence, report it as uncertainty. Never invent a quote, log line
or human approval to make a decision look supported.

## Execution and calibration

- Honor rate-limit/retry headers with bounded backoff for transient errors. Missing
  credentials or an invalid schema needs a configuration fix, not repeated calls.
- On exhausted retries, return `blocked_jev` and retain the ticket. Do not substitute
  a stronger LLM's answer and label it a Jev result.
- Cache only against unchanged evidence, question version, Jev model, candidate set and
  relevant policy. Recheck live permissions, quotas, reservations and artifact identity
  before action even when semantic answers are cached.
- Deduplicate actions with an event/revision/action key. Acquire a worker reservation
  atomically; release it on failed launch. A repeated delivery webhook must not deploy twice.
- Keep secrets and unrelated customer data out of state; use the organization's existing
  approved data-processing configuration for the Jev adapter.
- Use `shadow` to record recommendations without acting. Calibrate per event/task category,
  not by copying a demo threshold. Evaluate false promotion/delivery, unnecessary
  escalation, wrong-owner routing, QA reopens and end-to-end cost/time.
- Compare against deterministic rules alone and the existing Grok Bot policy. Reserve
  held-out cases; inspect failures, not just average accuracy. Pin model/question versions.
- Enable one authorized lane at a time after its owner accepts measured error rates.
  Retain an off switch and human overrides. New versions return to shadow evaluation.

