# Choose an implementation worker or independent reviewer

## Steps 01–02 pilot exception

For 01–02 only, use the `model-selection` preset from the reusable question library
and [pilot contract](request-preparation.md). It recommends from task evidence and
the starter preferences below without mandatory model cards or a previous response.
This is a shadow recommendation, not verified capability or a launch decision.
The rest of this document remains the legacy candidate-based selection contract for
other steps, including QA rework and independent reviewer selection.

Treat the user's five names as configured aliases:
`grok`, `claude_opus`, `claude_fable`, `chatgpt_sol`, `chatgpt_astra`.
Map them to exact available runtime/model IDs in Grok Bot/Superset's live registry.
Do not guess versions, rename Fable to another family, or assume an OpenAI API ID from
a ChatGPT label.

## Starter preferences

These are proposed team routing preferences to evaluate, **not verified comparative
model benchmarks**. Replace them with observed results on your repositories.

| Alias | Proposed initial task lane |
| --- | --- |
| Grok | Small bounded changes with explicit steps and focused verification |
| Claude Fable | Routine feature/bug implementation with a clear specification and established patterns |
| ChatGPT Sol | General coding, multi-file implementation and regression-test work |
| Claude Opus | Architecture-sensitive implementation, complex domain constraints and broad coherent changes |
| ChatGPT Astra | Difficult diagnosis, cross-system reasoning and tasks requiring synthesis of conflicting technical evidence |

Opus and Astra remain candidates for implementation or diagnosis; selecting them never
starts a self-review. Independent reviewer selection belongs to the external process.

The [orchestration skill](../../orchestration/SKILL.md) can reuse this router for a fresh
external reviewer with `routing.task_profile.role = independent_reviewer`. Filter by
approved review lanes, behavior-verification tools and environment access; implementation
success alone does not certify review capability. Do not reuse the implementation session
or its child agents. GitHub Codex review uses the configured integration, not an assumed
ability to set its model through this registry.

## Prepare a separate request

For legacy flows outside the 01–02 pilot, after the relevant classification result,
WFTasks prepares `routing.task_profile` (role, lane, required capabilities and
source refs), `routing.intake_result_ref`, `routing.eligible_models`, `routing.mode` and
`routing.tie_break_order`. Use [request preparation](request-preparation.md) and
`scripts/prepare-request.mjs`; never pair these questions with the intake-only state.
The builder prunes aliases and expands `candidate_fit` for every supplied card. Missing
profiles/cards or an empty candidate set stop before inference with preparation errors.
The controller resolves missing registry setup vs capacity waits; neither is evidence
that all model families lack capability.

A card supplies capabilities, approved lanes and source references. In `production`,
it also needs verified capability evidence, evaluation refs and the exact runtime ID.
In `recommendation`, explicitly operator-approved provisional cards may support a
recommendation without historical evaluations. Synthetic cards require a synthetic
recommendation event and cannot be relabeled as real capability evidence. Both questions
use the same evidence standard. No recommendation grants launch permission; existing
production calibration, source-access, quota and action gates remain mandatory.

## Registry and eligibility

For each candidate, store: alias, exact runtime ID, supported languages/frameworks/tools,
repository access, approved task lanes, supported modalities, operator preference,
relevant evaluation evidence, quota source/time/unit, queue/capacity and status.

The example registry has unresolved IDs. They must be populated from the actual runtime
before any automatic launch. A model name alone is not capability evidence.

Before Jev selection, code must:
1. Apply an explicit user model choice, if any. Never silently override it; report
   unavailable access/quota and propose alternatives.
2. Filter by available runtime, required tools/integrations, repository/environment
   access, context capacity, applicable data policy and operator-approved task lane.
3. Check quota and capacity from authoritative runtime/provider telemetry. Input-token
   counts do not reveal subscription allowance; do not invent "remaining percentage."
4. Preserve configured reserves and shared provider/account limits. Several aliases may
   share one quota pool. Do not compare incompatible quota units.
5. Precompute usable capacity, estimated cost/latency bands and tie-break ranks in code.
   Fresh numeric data, reset times and active-session counts are not Jev arithmetic.
6. Exclude unavailable candidates. If every capable worker is temporarily busy, return
   `wait_capacity`. If capability mapping is missing, return `human_attention`.

Unknown quota does not mean zero or unlimited. Use the operator's explicit unknown-quota
policy; the example holds automatic launch until telemetry or an approved bound exists.

## Jev selection

Pass the task profile, evidence and eligible model cards to `model-routing.json`.
Obtain one relative choice plus an absolute fit Noul for each eligible model.
The choice cannot establish that any candidate is adequate: the selected model's own
fit result must also pass its calibrated gate.

For an unambiguous passing choice, select that alias and resolve its runtime ID from
the registry. Reject any answer naming a pruned/ineligible candidate.

If the relative choice is uncertain:
- If several candidates have independently supported adequate fit, deterministic
  tie-breaks may choose among them under operator policy: relevant measured success,
  quota reserve, queue delay/cost, then stable preference.
- If none has supported adequate fit, use `human_attention` or bounded diagnostic
  escalation. Do not choose the cheapest available model merely to keep moving.
- Never use a low-confidence complex-task profile to justify downgrading to Grok.

Recheck capacity and reserve the slot immediately before launching. Retry selection
after a changed candidate set, not against the same stale availability snapshot.

## Learning and escalation

Track success on first attempt, QA returns, human corrections, time to accepted result,
tokens/cost in their original units, failure mode, and task category. Distinguish model
failure from missing requirements, broken tools, flaky CI and capacity exhaustion.

A QA return is not automatically evidence that the worker model was too weak.
Request missing evidence first. Escalate the worker only for a supported capability gap
or the configured repeated-failure budget. Keep new findings in the tracker for the worker
to fetch directly. The Superset host receives only issue ID, operational notes and
execution instructions, never a brief or copied evidence. Do not restart with the same
insufficient report. Ordinary CI code/test failures remain in the live coding session;
they do not trigger model reselection or another dispatch.

