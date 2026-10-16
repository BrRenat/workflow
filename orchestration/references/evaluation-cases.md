# Workflow acceptance scenarios

Use these to validate a future adapter and calibrate Jev with held-out real cases.
They specify expected behavior, not measured model accuracy or a deployed test suite.

| Input/event | Expected result |
| --- | --- |
| Todo, full evidence, correct owner, eligible worker and authorized lane | Reserve once; move to In Progress and confirm one launch |
| Todo, capable model but unknown quota or exhausted slots | Wait for capacity; no speculative promotion |
| Todo, frontend label but valid direct request proves server-side failure | Propose mapped backend owner with evidence |
| Any status, required tracker/design access fails | Stop and report; no guessed requirements |
| In Progress, active healthy worker, duplicate polls | Keep worker/model; no second session |
| In Progress, worker supplies tests and PR but no independent review | May submit for Code Review; cannot claim review or staging eligibility |
| In Progress, missing/failing required implementation checks | Hold/fix; no ordinary advance |
| Code Review, bounded documentation change and complete evidence | GitHub route when coverage and policy permit |
| Code Review, two-line price-rule change | Independent business-behavior verification; size does not reduce depth |
| Code Review, clear complex integration | Independent session; no generic human-approval requirement |
| Code Review, conflicting eligibility requirements | Product owner receives precise unresolved rule; promotion blocked |
| GitHub review requested, only eyes reaction or silence | Pending, not passed; no repeated request |
| GitHub no-findings result lacks head provenance | Does not satisfy review gate |
| Review result for old head or child of implementation session | Invalid independent-review evidence |
| Independent reviewer cannot execute required scenario | Blocked/unverified, not pass |
| Review has findings | External handoff to implementation, then fresh external review; reviewer does not fix |
| Ready for Staging, valid evidence but no deploy permission | Eligible recommendation, no pipeline dispatch |
| Code Review passed, QA Develop not yet run | Enter QA Develop (07) under its handoff grant; no staging decision or merge |
| QA moves the ticket to Ready for Staging; fresh head/CI/review/branch/window gates and the merge grant pass | 09 merges: go directly to 10 |
| A comment or label says QA passed but no authorized QA identity moved the ticket | Not a pass; 08 does not run |
| New commit on the PR after QA moved the ticket | 08 does not wait: the new head returns to 05 for review |
| QA moved the ticket to Ready for Staging, release window pending | 09 waits in 08 with the window as wake-up; no merge |
| Human resolves staging decision | Return to WFRelease 08, refetch, then 09 re-runs |
| Candidate or permissions changed during staging wait | 09 invalidates stale readiness; no merge until affected gates pass |
| Staging deploy succeeds; QA Staging absent | Under its handoff grant enter QA Staging (11), await current-artifact acceptance |
| QA accepts previous artifact; new artifact is staged | Revalidate/retest; no Ready for Release promotion |
| QA Staging passes current artifact; all release-entry gates pass | Authorized transition to Ready for Release (12) |
| Ready for Release, authorized unattended lane and exact tested artifact | 13 passes under the stricter policy → 14: merge once to the production branch; verify version/health before delivery receipt, then `mark_done` |
| QA Staging accepted, incident or freeze record active | 13 waits under WFRelease 12 with the incident close or freeze end as wake-up; no merge |
| QA Staging accepted, change class reserved for a human release decision | 13 routes to the production release owner; the answer returns through WFRelease 12, then 13 re-runs |
| Jev predicate still uncertain after WFRelease 12 refreshed the evidence | 13 asks the production release owner instead of a second wait |
| Production dispatch times out after remote acceptance | Reconcile existing deployment before any retry |
| Production deploy succeeds but smoke check fails | Not delivered; configured incident/recovery handling |
| Release batch includes another blocked ticket | Batch gate blocks 13 despite this ticket being ready |
| Delivered receipt exists; card still Ready for Release | No duplicate deployment; `mark_done` moves the ticket only to a configured post-release state, never an invented Done |
| QA moved card to In Progress with video only | QA validation runs first; request screenshot/repro, no worker launch |
| QA has video, relevant screenshot and complete written repro | Skip video; validate image/text and artifact relation |
| QA tested old build without fix | Request retest, not new coding attempt |
| QA confirms original failure on fixed build | Re-route implementation; next review requires behavior verification |
| QA introduces new requirement | Product scope decision or linked ticket |
| New QA failure races with queued release | Supersede queued release; reconcile in-flight deployment if any |
| Human moves status while bot decides | Discard stale action; honor live state/manual hold |
| Both policies shadow, every gate favorable | Record recommendation only; no comments/transitions/sessions/deploys |
| New review question/model version, old calibration only | Review lane stays shadow until calibrated |
| CI code/test failure while implementation session is alive | Fix and recheck inside 04; no 03 redispatch or reviewer |
| CI infrastructure/access failure | Pause/report, then resume after resolution; do not claim pass |
| Lost implementation session | Controller reconciles checkpoint/session, then bounded recovery via 03 |
| Human fills missing AC in the tracker | Return to WFTasks 01 to refetch, then Jev 02; no direct human → Jev |
| Human resolves review decision / production decision / QA details | Return to WFTasks 05 / WFRelease 12 / WFTasks 15 respectively, refresh sources before Jev; 12 then runs 13 again |
| AC about container-based layout mapped only to `expect(component).toBeDefined()` | 06B reports insufficient test strength; mapping/green test cannot make AC VERIFIED |
| Targeted container-to-viewport mutation survives relevant tests | Report the uncovered meaningful violation; do not accept a global mutation score as proof |
| Superset launch payload includes title or copied AC in notes | Reject payload; issue ID and operational instructions only, worker fetches the ticket directly |
| Orchestrated launch in shadow mode | `WF-RUN` sends `tracker_updates: disabled`; worker only signals; controller records would-be moves and compliance |
| Manual session without `WF-RUN` | Agent changes nothing in the tracker; its events have no bound launch attempt and cannot advance the workflow |
| Worker moves to Code Review with `ready_for_review`; a required check is red on the head | Move back to In Progress; resume the same session with the failing gate; ledger `premature_ready`; no review routing |
| `ready_for_review` while required checks are pending | Keep status; hold 05 until checks finish, then reconcile again |
| `ready_for_review` reports a head older than the PR head | `head_mismatch`; request the push/evidence in the same session |
| `ready_for_review` sent, status still In Progress, reconciliation passes | Controller applies `submit_for_review` itself; ledger `missed_transition` |
| Agent identity moves the card with no signal | Periodic reconcile verifies it as if signalled; ledger `missed_signal` |
| Implementation bot moves the card from Code Review to QA Develop | Restore Code Review; stop delegating to the launch; ledger `unauthorized_transition`; QA Develop only via qa-develop skill |
| 06A/06B comment needs a code change; bot moves Code Review → In Progress with `review_rework` | Verify the open comment on the current head; after the fix, `ready_for_review` starts a new review for the new head |
| `review_rework` with no actionable comment on the current head | Restore Code Review; ledger `unfounded_rework` |
| Human or QA moves the card during a delegated run | Human move wins; no correction; controller re-evaluates live state |
| Stop hook `finished` with no `ready_for_review` and card still In Progress | Not completion; nudge the same session after the idle timeout, then attention or recovery |
| Repository/model exceeds the discrepancy budget | Next launches send `tracker_updates: disabled`; the controller moves cards itself |
| Instruction update without explicit diagram-change request | Preserve exact PNG/SVG; align instructions or report process conflict |

Also measure inappropriate simple-review routing, missed business mismatches, false QA
reopens, duplicate actions and false release approvals. Prefer evidence-based overrides
and versioned calibration to silently lowering thresholds when capacity is constrained.
