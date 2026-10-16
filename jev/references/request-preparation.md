# Prepare content for Jev decisions — 01–02 pilot

## Scope and independent parts

This document covers steps 01–02. The pilot also covers step 05 through
[review preparation](review-preparation.md) and step 09 through
[staging preparation](staging-preparation.md). QA return, completion, release and
reviewer model selection retain their existing contracts.
The existing `intake.json`, `model-routing.json` and `prepare-request.mjs` remain
legacy contracts for those other flows; do not use them for the 01–02 pilot.

| Part | Responsibility | Must not depend on |
| --- | --- | --- |
| Step 01 evidence | WFTasks reads authoritative task sources and reports facts/gaps | Jev question IDs, model cards or required JSON paths |
| Question library | Stable semantic questions and criteria | Step numbering, input layout or another answer in the same request |
| Presets | Select question IDs from the library | Ticket-specific rewriting of instructions or criteria |
| Step 02 policy | Interpret actual answers alongside factual gates and existing authority | A model recommendation as proof of readiness, capability or permission |

There is a semantic contract (what evidence means), not a mandatory evidence schema.
JSON, Markdown and clearly labeled prose are all acceptable. Preserve source identity,
revision, original AC and known gaps in whichever format is used. Changing layout or
field names must not require changing questions. Missing information stays missing.

## Step 01: WFTasks prepares evidence

Step 01 prepares content for Jev decision requests; it does not make those decisions.
WFTasks resolves the exact tracker issue and reads its current description, existing AC,
relations and QA history. It confirms that every required source is readable before any
decision is made. Use the tracker integration; inspect images as sourced text; skip
videos. WFTasks does not call or require the design integration; linked designs are read
by the worker later.

Include the exact ID/URL, observed status and revision, full description or losslessly
selected requirements, original AC, relevant comments, related requirements, dependency
states, image observations and known source-access gaps. Cite sources and observation
times. Include operator-maintained Platforms mappings from `ownership.component_map` when those labels are present (in the example config, Web → example-org/web-app, API → example-org/api); those map hits are ownership evidence and must be included. Labels outside that map still must not invent repositories.

Do not add `routing`, `review`, `delivery`, controller action records, selected models,
candidate-fit scores, promotion recommendations or semantic readiness verdicts to intake.
This forbids adding future decisions, not legitimate facts about current availability
or prior attempts. Do not reshape evidence into a model-card schema or pre-answer Jev.

Comments and QA history are read by default. If a user excludes them for a replay,
record the exclusion instead of claiming there were no comments or QA failures. Label
assumed statuses separately from observed statuses. Never invent a historical snapshot.

**Comments / QA-round contract:** see [comments-qa-round.md](comments-qa-round.md). WFTasks packs must include the full ticket comments plus `comments_summary` (QA Round remaining checklist, staging-ready, product owner/spec clarification threads, open product decisions). QA Round checklist bullets are authoritative remaining acceptance scope — do not claim AC unconfirmed solely because description AC is thin. WFJev replies must cite Comments/QA history; HOLD must not say AC unconfirmed when Round comments already enumerate remaining items.

An unreadable required source is an access blocker reported by WFTasks. Preserve the
partial dossier and exact source gap; stop live submission. Design access deferred to the
worker is not an intake access failure. Do not relabel an access failure as a semantic verdict.

When asked for step 01 output, provide this evidence. If the user also needs playground
questions, export the selected preset alongside it. The dossier and the question set
remain independent; neither is rewritten to fit the other.

## Step 02: select and ask stable questions

`questions/library.json` is the single authored question library for this pilot.
`questions/presets.json` lists reusable selections:

| Preset | Use |
| --- | --- |
| `step-02` | Full pilot: readiness, independent work areas, ownership evidence, human decisions/risk and model recommendation |
| `readiness` | Task, AC, context, independent work areas, ownership evidence and human/risk checks without model choice |
| `human-attention` | Inspect the specific human-decision and risk predicates |
| `model-selection` | Model recommendation using fixed, provisional routing preferences |
| `work-areas` | Eight independent questions about implementation, configuration and content work |

Combine presets by set union; the same question appears only once. Every selected
question sees the same supplied evidence and stands alone. A model recommendation can
be asked directly against the step 01 dossier; no intermediate task profile, model
cards or previous Jev response is required. A second request is necessary only when
there is new evidence, such as resolved ambiguity or an updated availability list.

The model criteria contain the documented starter preferences (Grok for bounded work,
Fable for routine work, Sol for general multi-file/regression work, Opus for complex
architecture/domain work, Astra for deep diagnosis). These are provisional operator
preferences, not verified comparative capability claims. Missing model cards must not
force `none`. Insufficient task evidence means `insufficient_context`; `none` means a
well-understood task is outside all listed preferences or explicit availability excludes
all suitable choices. Do not downgrade to an unsuitable available model.

Unknown availability is not proof of availability. The controller still checks runtime,
tools, access, quotas, capacity, evaluated capability and permission before any launch.
The pilot runs in shadow/recommendation mode. It does not enable production automation
or replace later stages' existing absolute-fit requirements.

## Independent work areas

In the 01–02 pilot, eight independent Noul questions replace `likely_owner`.
Frontend, backend, mobile, DevOps, data, platform configuration, content operations
and shared-contract work may all overlap. Explicit feature requirements count as
evidence; planned backend work does not require a failing request, and planned
DevOps work does not require telemetry.

Apply the active calibrated Noul thresholds separately to each actual answer.
The result consumer can collect supported areas in `work_areas`, while retaining
uncertain or missing areas separately with their raw answers and probabilities.
Do not normalize probabilities across areas or select a single winning area.
An empty list is not proof that no work is required. This describes interpretation;
the question composer does not evaluate answers or add decisions to State.

Work areas are not assigned people or verified repository mappings. Keep
`ownership_evidence_sufficient` and component-to-owner mappings separate.
Multiple areas, platform configuration and content operations do not by themselves
require a human. Use the human-decision question and actual authority checks.
The legacy `likely_owner` question, with the same owner areas, remains in use outside this pilot.

## Human involvement and outcome policy

Use [step 02 policy](../policies/step-02.json) with the active calibrated thresholds.
It is a declarative interpretation contract, not a deployed controller.
`human_decision_required` asks about a specific unresolved human-owned choice; detailed
AC/product/ownership/risk answers preserve why. It is not a blanket approval question.

| Evidence / answer | Controller interpretation |
| --- | --- |
| Required source unreadable | Report access blocker; no live decision call or launch |
| Actual Jev response absent/invalid | Report `blocked_jev`; never substitute an expected result |
| AC absent, unclear, untestable, contradictory or context insufficient | `NEEDS_CLARIFICATION` to the ticket owner with exact gaps; never write replacement AC. If QA Round comments already list remaining checks, cite them as remaining scope — do not treat description-only thin AC as "AC unconfirmed" without that citation |
| Unresolved product/design choice or disputed ownership | Ask the named responsible owner for that specific decision |
| Risk predicate positive or uncertain | Check the domain policy and existing scoped authorization; risk alone does not require another approval |
| Explicitly required approval missing | Human attention for that exact action/scope; unknown grants never authorize execution |
| Dependency pending / suitable workers busy | Wait; do not ask for generic approval or choose an unsuitable worker |
| Existing authorization resolves the requirement | Reuse it; do not ask again |
| No unresolved questions, current gates pass | Record eligible recommendation; pilot remains shadow and cannot launch |

Retain every independent reason. A favorable `human_decision_required` or model answer
cannot override an AC failure, source gap or missing grant. Uncertainty in a required
predicate is not a pass. Bug-only repro predicates do not block a feature or maintenance
task. Readiness and model results do not prove implementation correctness.
Human clarification returns through WFTasks 01 to reread authoritative sources before 02.

## Playground and composer

Copy the step 01 evidence into **State** (JSON or plain text). Copy a generated question
map into **Questions**. Do not put the whole `{state, questions}` packet inside State.

Ready-to-paste exports are `questions/step-02.json`, `step-02-readiness.json`,
`step-02-human-attention.json`, `step-02-model-selection.json` and
`step-02-work-areas.json`. They are generated;
edit the library/presets, then regenerate. Step 05 exports and its compatibility alias are documented in review preparation.

```sh
# Questions only; no task input required.
node jev/scripts/compose-questions.mjs --preset model-selection
# Independent work areas, without a mutually exclusive owner choice.
node jev/scripts/compose-questions.mjs --preset work-areas
# Combine selections without rewriting their questions.
node jev/scripts/compose-questions.mjs --preset readiness --preset model-selection
# Optional convenience packet: state is preserved, no field mapping.
node jev/scripts/compose-questions.mjs --preset step-02 --state path/to/step-01-evidence.md
node jev/scripts/compose-questions.mjs --export
node --test jev/tests/compose-questions.test.mjs
```

The composer validates preset IDs, not task completeness, access or authorization.
Examples show identical evidence in two formats; tests establish composition and
preservation, not Jev semantic accuracy. During playground debugging, record actual
responses for both formats, ambiguous/missing-AC tasks, unavailable-model cases and
resolved/unresolved human decisions. Do not claim an inference result without calling Jev.
