# Worker signals and delegated tracker transitions

- [Model](#model)
- [What can be delegated](#what-can-be-delegated)
- [Launch block](#launch-block)
- [Handling signals](#handling-signals)
- [Verification and correction](#verification-and-correction)
- [Self-correction ledger](#self-correction-ledger)
- [Setup](#setup)

## Model

The controller decides **whether** the implementation worker may move a card. The worker
moves it when its work actually changes stage and sends a signal. The controller then
**verifies** the move against the tracker, GitHub and CI and corrects any mismatch. Authority
stays with the controller: a worker moves a card only when its `WF-RUN` launch block
lists that exact transition, and only when the matching Jev action grant is active.

Signals and worker-made status changes are claims, like every hook event
(`completionVerified: false`). They wake the controller; they never prove that checks,
evidence or review passed. The approved [diagram](../PIPELINE.md) is unchanged: steps,
decision owners and gates stay the same. Only the actor that sets these statuses changes.

Manual sessions carry no `WF-RUN` block. Their agents change nothing in the tracker, and their
events have no bound launch attempt, so they cannot advance the workflow.

## What can be delegated

| Transition | Delegate only under this Jev grant | Controller verification |
| --- | --- | --- |
| Todo → In Progress (03 → 04) | `promote_to_in_progress` + `start_implementation` | Launch confirmed; reservation, launch attempt and branch match; no competing session |
| In Progress → Code Review (04 → 05) | `submit_for_review` | The [completion-candidate reconciliation](controller.md#session-hooks-and-completion-candidates): PR open, reported head equals PR head, every required check passed on it, `## How to test` present, Verification Plan and per-AC evidence present |
| Code Review → In Progress (06A/06B findings) | `return_to_implementation` | An external review comment on the current head is open and needs a code change; the session was started by the [codex-review](../../codex-review/SKILL.md) or [independent-review](../../independent-review/SKILL.md) skill |

- Never delegate QA Develop (07): the [qa-develop skill](../../qa-develop/SKILL.md) enters
  it only after the stand comment for the reviewed head exists and the QA notes are
  posted. Never delegate later statuses, merges, deployments, `mark_done`,
  `reassign_issue` or any QA-owned move.
- 06A and 06B review sessions never change the tracker. They publish GitHub reviews only.
- The controller may always narrow delegation for a repository, model or launch. It never
  widens delegation beyond the active grants.

## Launch block

WFTasks/WFCoder adds this block to the execution instructions of every orchestrated
implementation launch: initial launch, review rework from 06A/06B, validated QA rework
and recovery. It is launch metadata only. It must not contain the ticket title,
description, AC or copied evidence; the
[launch boundary](../PIPELINE.md#physical-and-trust-boundaries) still applies.

```text
WF-RUN
issue: PRJ-123
launch_attempt: launch-2026-09-28-7f3a
tracker_updates: enabled
transitions: Todo -> In Progress; In Progress -> Code Review
```

- `launch_attempt` equals the injected `WF_HOOK_LAUNCH_ATTEMPT_ID`, so every hook event
  from the session is bound to the run.
- `tracker_updates` is `enabled` only if both policies are active, the lane is calibrated,
  `worker_signals.delegate_tracker_transitions` is true, and every listed transition's
  grant is active. Otherwise send `disabled` with an empty `transitions` value; the worker
  still sends signals. **Shadow mode always sends `disabled`.**
- List only the transitions for this stage:
  - Initial launch from Todo: `Todo -> In Progress; In Progress -> Code Review`.
  - Review rework (06A/06B step 2): `Code Review -> In Progress; In Progress -> Code Review`.
  - QA rework or recovery with the card already In Progress: `In Progress -> Code Review`.
- Status names are shared across teams, but tracker state IDs are team-scoped. Before
  launch, confirm that each listed name resolves to exactly one configured state in the
  issue's team. If a name does not resolve, that is a setup blocker: do not delegate that transition.

Worker rules are in the [coding-session skill](../../coding-session/SKILL.md). The
payload is the v2 hook contract in [status hooks](../../coding-session/references/status-hooks.md).

## Handling signals

Apply the [session hooks receiver contract](controller.md#session-hooks-and-completion-candidates)
first: identity binding, `eventId` deduplication and quarantine of unbound or foreign
events. Then handle the manual signals:

| Signal | Controller action |
| --- | --- |
| `started` | Verify Todo → In Progress (or that In Progress was kept for rework); mark the run active |
| `ready_for_review` | Run completion-candidate reconciliation for the reported head; on pass, verify Code Review and route review (05) |
| `review_rework` | Verify Code Review → In Progress against open review comments on the current head |
| `needs_clarification` | Route to the owner through WFTasks 01; the human updates ticket AC; no coding meanwhile |
| `blocked`, `stuck`, `failed` | As in the receiver contract: inspect, report, wait or recover under policy |

`finished` from Stop/SessionEnd stays a completion candidate. When a run has delegated
transitions, reconcile it together with the card's status. A Stop without a preceding
`ready_for_review` on a card still In Progress is not completion: after `idle_nudge_seconds`,
resume the same session with the expected next step.

Also reconcile periodically. A status change made by the agent identity without a signal
is verified as if it had been signalled.

## Verification and correction

A correction of a delegated move is covered by the grant that allowed delegating it.
A move made by a human or QA identity is never reversed; it overrides the run.

| Mismatch | Correction | Ledger code |
| --- | --- | --- |
| Code Review, but a required check failed or is missing on the head | Move back to In Progress; resume the same session with the failing gate | `premature_ready` |
| Code Review, required checks still pending | Keep the status; hold 05 until checks finish, then verify again | `ready_before_checks` |
| Reported head differs from the PR head, or `## How to test`/evidence missing | Move back to In Progress; request the push or evidence in the same session | `head_mismatch` / `missing_evidence` |
| `ready_for_review` sent but status still In Progress | If reconciliation passes, the controller applies `submit_for_review` itself | `missed_transition` |
| Status moved by the agent identity, no signal | Verify as if signalled | `missed_signal` |
| Transition not listed in the launch block (for example Code Review → QA Develop) | Restore the previous status, tell the session, stop delegating to this launch | `unauthorized_transition` |
| `review_rework` with no open actionable comment on the current head | Restore Code Review; tell the session | `unfounded_rework` |
| Stop/idle with no final signal after the nudge budget | Attention for the run owner, or lost-session recovery through 03 | `idle_without_signal` |

Before each correction, re-read the status and record intent (see
[controller rules](controller.md#events-races-and-retries)). If the card has moved again,
evaluate the new state instead of applying the stale correction. Nudges and corrections
count toward the attempt and review budgets.

## Self-correction ledger

Record every mismatch with issue, launch attempt, repository, model runtime ID,
coding-session skill version, observed facts and correction. Use it to:

- Narrow delegation automatically. If a repository/model pair exceeds
  `max_discrepancies_before_undelegating` within `discrepancy_window_days`, send
  `tracker_updates: disabled` for it; the controller performs those transitions itself
  until an operator re-enables delegation. Narrowing needs no approval; re-enabling does.
- Feed model-routing evaluation references with real rule-compliance data.
- Show the owners which task rules agents misread, with proposed wording. Never rewrite
  shared rules automatically.

In shadow mode, launches send `tracker_updates: disabled`, but the controller still
verifies the signals and records the transitions it would have delegated. This measures
agent compliance before any lane is enabled.

## Setup

- Give the worker a tracker identity distinct from humans and from the controller
  (`worker_signals.agent_tracker_identity`). Issue history must show who moved a card.
  Without that, agent moves cannot be told apart from human overrides, so delegation stays disabled.
- Scope that identity to issue read, comment and status update. It needs no permission
  to edit descriptions, AC, assignees or team settings.
- Disable the tracker's own Git automations that move cards on branch, PR or merge events for
  these teams, or map them to no-ops, so they do not race with delegated moves.
