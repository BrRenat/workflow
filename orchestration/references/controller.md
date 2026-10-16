# Controller contract

- [Configuration and authority](#configuration-and-authority)
- [Events, races and retries](#events-races-and-retries)
- [Session hooks and completion candidates](#session-hooks-and-completion-candidates)
- [Decision record](#decision-record)

## Configuration and authority

Load the operator's active versions of the orchestration and Jev policies. Example files
are inert templates. Jev policy owns semantic thresholds, calibration, model/owner registry
and action grants. Orchestration policy owns exact team-specific state IDs, pipeline/QA
bindings, review requirements and scheduler behavior. Do not duplicate grants in both.
Automation requires both policies in active mode, the relevant calibrated Jev lanes,
resolved mappings and authorization for each action. A shadow policy means no mutation.

Schema 3 adds distinct QA Develop and QA Staging state mappings and stage-specific
handoff grants. Resolve both real tracker IDs and separate develop/staging QA bindings.
Replace schema-2 `handoff_to_qa` deliberately with `handoff_to_qa_develop` and/or
`handoff_to_qa_staging` only where existing authority covers that exact action; do not
broaden an old grant automatically. `enter_ready_for_staging` is unused when QA moves the ticket to Ready for Staging
itself; it is never a Code Review exit. `promote_to_release` now comes from QA Staging.
Review policy 2 requires passed CI before review and semantic test-strength analysis in
06B; the old pending-CI exception is removed. Question version 4 strengthens completion
evidence semantics; recalibrate affected lanes in shadow mode before enabling them.
Earlier schema-1 `promote_to_ready` remains unsupported; migrate only after resolving
the intended destination and scope. Unknown schema/actions are setup blockers.

Jev dispositions such as `deliver` identify an eligible named handoff/action, never
blanket merge/release permission. Existing explicit permissions remain valid for their
exact scope; do not repeatedly ask for authorization already granted.

| Action grant in Jev policy | Effect under this workflow |
| --- | --- |
| `promote_to_in_progress` + `start_implementation` | Todo to In Progress and confirmed worker launch (03) |
| `start_implementation` | Start/resume reconciled work; ordinary CI failures stay in the same session (04) |
| `submit_for_review` | In Progress to Code Review after required checks pass |
| `request_github_review` | One external GitHub review request (06A) |
| `start_independent_review` | Externally controlled separate verification session (06B) |
| `handoff_to_qa_develop` | Code Review to QA Develop (07), requesting tests of the reviewed develop build; no merge |
| `enter_ready_for_staging` | Unused when QA moves the ticket to Ready for Staging itself; kept only for a bot-driven entry |
| `merge` | Staging merge in 10 after the 09 decision; when CI deploys on merge, the merge is also the staging deployment |
| `deploy_staging` | Unused when CI deploys on merge; kept for repositories that deploy staging by a separate action |
| `handoff_to_qa_staging` | After verified staging deployment, enter QA Staging and request exact-build QA (11) |
| `promote_to_release` | QA Staging to Ready for Release (12) after QA pass |
| `deploy_production` | Production merge in 14 after the 13 decision; when CI deploys on merge, the merge is also the production deployment |
| `mark_done` | Move the ticket to the configured post-release state after verified delivery in 14 |
| `request_qa_details` | Focused missing-details/retest request (17); response returns to WFTasks 15 |
| `return_to_implementation` | Failed review / validated QA return to In Progress; launch also requires `start_implementation` |
| `reassign_issue` | Evidence-backed repo/team ownership correction |

`promote_to_in_progress`, `submit_for_review` and `return_to_implementation` (for review
rework only) can be delegated. When the grant is active, the controller may list the move
in a launch's `WF-RUN` block and the implementation worker performs it. Delegation creates
no new grant, and verification stays with the controller. Follow
[worker signals](worker-signals.md) for the block, verification and corrections. No other
action is delegable; QA Develop entry stays with the qa-develop skill.

The 09 automatic route goes straight to 10. If 09 cannot proceed, the ticket stays in
Ready for Staging under WFRelease 08 with exact reasons, owner and wake-up; after any wait,
08 refreshes and 09 repeats the current gates before 10. Status and action permissions
stay separate.

Role names in outputs are not invented user accounts. Resolve actual configured identities
before posting, assigning or recognizing an approval. A missing binding is setup attention.

## Events, races and retries

1. Normalize source event ID, issue/team, observed status/revision, PR head, artifact,
   source comment/review/deployment IDs and time. Persist the raw reference.
2. Fetch live tracker state and linked systems. The webhook is a notification, not proof
   that its status is still current. Reconcile missed events through periodic reads.
3. Deduplicate the source event and inspect the durable ledger. Acquire a per-issue lease
   with expiry/renewal; prevent competing sessions and ownership changes. Deployment also
   needs a release/environment/artifact lock across tickets.
4. Detect unprocessed QA returns by actual QA event/comment identity, not just status
   changes or word matching. Record handled feedback IDs so an old QA failure does not
   reopen a newly fixed task forever. Unresolved QA evidence blocks downstream delivery.
5. Build current evidence, apply hard gates, then Jev. Preserve unknowns. Cache semantic
   results only for matching evidence/model/question/policy versions and candidate set.
6. Before a side effect, re-read status/revision, PR head, relevant approvals, permissions
   and reservation. A changed snapshot invalidates the affected decision. Honor manual
   holds and external status changes; do not automatically reverse a user's action.
7. Persist action intent before dispatch, with a stable semantic key: issue + action +
   source revision + head/artifact + target. Do not use webhook ID alone: polling, webhooks
   and retries can describe the same action. Prefer a remote idempotency token if supported.
8. Track `not_requested`, `requested`, `running`, `succeeded`, `failed`, `unknown` or
   `superseded` per action. Record remote IDs and reconcile before retrying. A timeout
   after a write is `unknown`, not permission to repeat a merge, comment or deployment.
9. Transition-plus-launch is not a cross-system transaction. Reserve first, record intent,
   transition, dispatch and confirm. Release unused reservations on definite launch failure;
   retain the failure/checkpoint and reconcile before an authorized retry. Do not move a
   manually changed card back as compensation. An ambiguous launch must be located first.
10. Release leases after persisting results. Bound API retries, worker attempts and review
    rounds; do not run an endless fix/review loop. A new independent review still counts
    against the configured review budget for that implementation cycle.

CI code/test failures are fixed and rechecked inside the 04 session;
source/CI infrastructure blockers pause it. External dispatch 03 is for first launch,
validated review/QA rework or reconciled lost-session recovery. Failed checks/findings
are actionable implementation work. Pending checks/review/QA,
dependencies, capacity and release windows are waits; identify the responsible system
and wake-up event. Do not ask a human for approval merely because an automatic job is
still running. A timeout exceeding policy requires the relevant owner to resolve the
named failed/unavailable service.

## Session hooks and completion candidates

Stage 04 is one agent session configured by the repository. Superset
starts/resumes it; runtime hooks installed from the coding-session skill
([status hooks](../../coding-session/references/status-hooks.md)) call the shared status
poster. Planning, code changes, local checks and the CI correction loop stay inside it.
The following is a receiver contract, not a deployed webhook service.

At dispatch, record the expected runtime, host terminal, launch attempt and the native
agent session ID when known. Inject `WF_HOOK_EXPECTED_RUNTIME`, `WF_HOOK_TERMINAL_ID`
and `WF_HOOK_LAUNCH_ATTEMPT_ID` as operational environment settings, not copied ticket
content. Native hook payloads supply `sessionId`; `WF_HOOK_SESSION_ID` is a fallback.
Use `WF_HOOK_EXPECTED_SESSION_ID` only for a known native agent session ID, never a
Superset host ID. Bind a newly observed native session only through confirmed host
session data; a webhook alone must not claim a new binding.

The v2 poster retains the existing ticket/repo/branch/status/message/optional PR fields
and adds original event type, normalized event type, runtime, session/terminal/launch
identity, event IDs, observation time and head SHA. Every event has
`completionVerified: false`. Sender metadata is evidence to reconcile, not authority.

| Observation | Receiver action |
| --- | --- |
| `session_started` or `prompt_submitted` | Mark activity on the correlated existing session; never launch another worker. A new prompt can resume work and invalidate pending completion. |
| `notification` or `permission_requested` | Inspect the reason; a notification is not necessarily a task blocker or a human-approval requirement. |
| Manual `blocked`, `stuck` or `failed` | Inspect current session evidence; report, wait or recover under policy. |
| `turn_stopped` or `session_ended`, legacy status `finished` | Schedule one completion reconciliation; no direct review or status promotion. |
| Tool events / subagent stops | Dropped by the poster. If a host path sends them, use only as optional activity observations; never parent completion. |
| Foreign runtime, wrong terminal or session, missing/unbound identity | Quarantine as an observation; reconcile with the host. No workflow transition. |

Deduplicate delivery by sender `eventId`. When available, also deduplicate a native
`sourceEventId` scoped to runtime/session/launch identity. The generated event ID is
unique per poster invocation; it does not make two separate Stop/SessionEnd invocations
identical. Preserve `rawEventType` even when a host normalizes both events to Stop.

Separately coalesce completion reconciliation for the same launch/session. Under the
per-issue lease, reread current host activity, issue revision, PR head, required checks
and completion evidence. A delayed Stop must not override a resumed worker. Receive
order and `observedAt` alone cannot establish native event order. Missing identity,
ambiguous host activity or an unreadable result keeps the outcome unknown.

Manual `started`, `ready_for_review`, `review_rework` and `needs_clarification` signals
from runs with delegated tracker transitions follow [worker signals](worker-signals.md).
A `ready_for_review` signal triggers this same reconciliation; it is not stronger evidence.

Only a reconciled completion candidate with sufficient current evidence enters 05.
Pending CI waits; failed checks return to the same implementation session. New work or
a changed head invalidates affected pending completion/review decisions. Deduplicate
review actions by issue, launch attempt, PR/head and review-policy version; Stop and
SessionEnd for the same result must not request review twice. This supplements the
existing durable action-intent ledger; it does not replace it.

Transport is bounded and best effort. Missing credentials produce no post. Failed
posts, missing hooks and crashes are recovered by periodic host/PR reconciliation,
not by assuming success or launching a duplicate worker. Legacy v1 events without
identity can request inspection only; they cannot advance the workflow on their own.
If both host `notify.sh` and the Grok poster deliver observations, apply the same
correlation and semantic action deduplication to both paths. This repository does not
contain or modify the external host's `notify.sh` implementation.

## Human return routing

Human updates return to the responsible WFTasks or WFRelease stage, which rereads authoritative
sources before invoking Jev: intake clarification → 01 → 02; review decision → 05;
staging release decision → 08 → 09; production decision → 12 → 13; QA details/retest → 15.
Never model a human response as a direct Jev call or use a chat reply instead of a
required ticket AC update. Preserve the current issue revision and affected head/artifact.

## Decision record

Extend the existing Jev/Grok Bot envelope rather than pretending Jev generated narrative
or actions. This is an illustrative controller result:

```json
{
  "schema_version": "3",
  "event": "review_route",
  "issue": "TEAM-123",
  "issue_revision": "current source revision",
  "current_status": "Code Review",
  "proposed_status": "Code Review",
  "disposition": "request_review",
  "proposed_action": "start_independent_review",
  "review_route": "independent_verification",
  "reason_codes": ["BUSINESS_LOGIC_REQUIRES_VERIFICATION"],
  "evidence_refs": ["criterion-2", "change-summary-7"],
  "attention": { "required": false, "owner": null, "request": null },
  "selected_model": null,
  "selected_runtime_id": null,
  "execution": {
    "authorized": false,
    "performed": false,
    "mode": "shadow",
    "state": "not_requested",
    "remote_id": null
  },
  "next_wakeup": "policy and reviewer routing configured"
}
```

Fill actual IDs/revisions at runtime. Attach the raw Jev result reference and pinned
question/model/policy versions when inference was called; record `not_called_hard_gate`
when it was not. Dispositions use the Jev enum, including `wait_result` for an active
external operation and `request_review` for a review proposal. Successful implementation
submission is a controller transition, not a fabricated Jev completion result.

For attention, include the exact missing evidence/decision, its source, configured role,
requested action and condition to resume. Keep all blocker reasons even if one takes
precedence. `authorized` does not imply `performed`, and `performed` does not imply
success: posting a request is different from the requested job completing. Delivery
needs a successful observed deployment and applicable health/QA evidence.

For step 09, on entry and after every wait, include `staging_decision` with
`qa_status_change_ref`, `candidate_head`, `artifact_id`, `decision` (`automatic_merge` or
`wait`), `next_step` (`10` or `08`), checked gates and attention/wake-up. `automatic_merge`
requires fresh passing evidence plus the merge grant; it is not an executed merge.
Do not emit this decision before QA Develop passes. Code Review reports only review
findings, evidence gaps and human decisions; its passing next step is 07.

For step 13, on entry and after every wait, include `release_decision` with
`qa_staging_acceptance_ref`, `artifact_id`, `candidate_head`, `release_batch_ref`, `decision`
(`automatic_release`, `wait` or `human_decision`), `next_step` (`14` or `12`), checked
gates and attention/wake-up. `automatic_release` requires fresh passing evidence under the
stricter step-13 policy plus the `deploy_production` grant; it is not an executed merge.
Do not emit this decision before QA Staging accepts the exact staged artifact.

Record model choice and rationale, attempts, overrides, state/action changes, review/QA
outcomes, artifact receipts, latency and usage. Never log credentials. These records
support recovery and calibration; they are not extra ticket statuses.
