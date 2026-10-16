# Status flows aligned with the approved diagram

Use the stable step numbers in [PIPELINE.md](../PIPELINE.md). Do not change the diagram
without an explicit request. Ticket AC are authoritative for acceptance; resolve state
IDs, pipelines, QA identities and permissions from active configuration, never names alone.

## Todo: readiness and launch (01–03)

The 01–02 pilot uses [independent evidence and question presets](../../jev/references/request-preparation.md).
Step 01 prepares sourced task evidence in any readable format. Step 02 selects stable
semantic questions and interprets actual answers using the active pilot policy
(uncalibrated, so never an automatic launch). Do not
require routing fields/model cards or put decisions into step 01 output. The production
transition/launch requirements below remain future execution gates, not pilot permissions.

1. WFTasks reads the current ticket through the tracker integration; it does not use the design integration.
   Step-01 evidence for WFJev must include a comments summary (all ticket comments plus
   QA Round/return remaining checklist, staging-ready, product owner/spec threads, open product
   decisions when present). WFJev step-02 replies must surface comment/QA-round findings;
   do not claim AC unconfirmed when Round comments already enumerate remaining checks.
   See also [comments-qa-round.md](../../jev/references/comments-qa-round.md).
   In step 02, run the [five AC readiness gates](acceptance-and-verification.md#step-02-readiness-gate-before-implementation).
   Missing/unclear/unverifiable/contradictory AC or insufficient context means
   `human_attention` / `NEEDS_CLARIFICATION`. Never invent or improve AC.
2. Human updates the ticket and returns to WFTasks 01, which rereads before Jev 02.
   Operator rules: a HOLD moves the ticket to **Blocked**, assigned to
   the product owner, with a short Jev comment (why blocked, numbered asks; no workflow chatter).
   Ready means a Jev comment, **Todo**, assigned to the operator. A design link is enough design
   evidence; the QA Round remaining checklist is the AC.
   Check ownership using diagnostic/contract evidence, not a frontend/backend label.
   Wait for dependencies or capacity without requesting unnecessary human approval.
3. Route eligible Grok, Claude Opus, Claude Fable, ChatGPT Sol or ChatGPT Astra using
   exact configured runtime IDs, verified capabilities, quotas and capacity. Honor existing
   scoped user choices. Reserve exclusive worker capacity before dispatch.
4. Under `promote_to_in_progress` and `start_implementation`, persist intent, transition
   and confirm launch. When the `WF-RUN` block delegates the move, dispatch first; the
   worker moves the card on start and signals `started`, and the controller verifies both. Reconcile partial failure without duplicate work. WFCoder sends
   only issue ID, operational notes and execution instructions; no ticket title/content.

## In Progress: one coding workflow (04)

1. Reconcile session, branch and checkpoint. Keep a healthy live worker and model.
   Initial launch, validated review/QA rework and lost-session recovery use controller
   dispatch 03; polling and ordinary CI failures do not.
2. The worker fetches the current ticket and linked designs directly through their integrations and loads
   repo/shared rules. Missing required access stops the session and is reported.
3. Inside the combined session, create only a Verification Plan against existing AC: strategy, test types,
   scenarios, boundary/negative cases and expected evidence. Unknown product intent
   returns through WFTasks to the owner for a ticket update, never guessed criteria.
4. Implement code and meaningful tests within the accepted scope, then run
   applicable local/CI static, unit, integration, mutation, browser and visual checks.
   The coding agent monitors CI and owns its correction loop even on external runners.
   Fix and recheck code/test failures in this same session. Infra/access failure → pause/report;
   resume when resolved. A lost worker needs bounded controller recovery.
5. Runtime hooks report activity, blockers and completion candidates. Reconcile Stop /
   SessionEnd against the launch/session and live PR/head evidence before 05; deduplicate
   delivery separately from review actions. A finished hook does not prove completion.
   Required checks must pass before 05. Pending, failing, skipped and missing checks
   are distinct; missing check configuration is setup attention. Report PR/head, plan,
   per-AC test evidence and known limits. Under `submit_for_review`, enter Code Review
   and release the implementation reservation. When delegated, the worker moves the card
   and signals `ready_for_review`; the controller reconciles and moves it back with the
   exact gap if the gates fail. Submission is not independent approval.

Never self-review, invoke a reviewer child, start your own review session, or run a
self-review/fix loop. Review/QA findings return through the external controller.

## Code Review: independent review, then QA Develop (05–06 → 07)

1. WFTasks refreshes PR/head, CI, ticket scope, change facts and acceptance evidence.
   Jev chooses [review depth](review-routing.md), not correctness: bounded sufficient
   coverage → `github_codex` (06A); unresolved behavior/integration verification, applicable
   repo/domain policy or validated QA reopen → `independent_verification` (06B).
   Exception (operator cost rule): a ticket that already completed a 06B, went to
   QA and came back from QA re-enters review through `github_codex` (06A), not 06B. Use the
   `step-05` library preset and per-case CI evidence. Collect missing review scope first;
   keep specific human decisions separate from the route.
2. Reuse a qualifying external result for the exact scope/head/policy. Otherwise request
   `@codex review` under `request_github_review`, or an externally controlled separate
   session under `start_independent_review`. Do not downgrade depth for lack of access.
3. 06B checks AC ↔ scenarios ↔ tests ↔ code and whether each test detects a meaningful
   AC violation. Require counterexample search, test-strength analysis and targeted
   mutation where useful, with per-AC VERIFIED / FAILED / UNVERIFIED evidence.
4. A comment, acknowledgement, silence, old-head result or implementer claim is not a
   review pass. Findings go through `return_to_implementation` and dispatch 03 for an
   externally scheduled fix, then new independent review. Reviewers never fix/merge.
   When delegated, the implementation bot moves the card to In Progress with
   `review_rework` before changing code, and back to Code Review with `ready_for_review`.
5. Human resolutions return to WFTasks 05, which refreshes context before review resumes.
   Once required independent review, current checks and acceptance evidence pass, evaluate
   `handoff_to_qa_develop`. Under that grant, enter QA Develop (07) and request testing
   of the reviewed develop build. No staging merge or merge-eligibility decision here.

## QA Develop: test, then QA moves the ticket to Ready for Staging (07 → 08)

Entering 07 is the [qa-develop skill](../../qa-develop/SKILL.md): wait for the
CI deployment's stand comment on the reviewed head with a 30-minute timeout, post the
QA notes from the PR's `## How to test` section, move the ticket and assign QA; nothing
else. The rest of this section describes the stage itself.

Resolve the develop environment, immutable reviewed build and current requirements.
If the build is not available, wait for the configured develop build process; do not
perform an early staging merge to manufacture QA evidence. QA may be a configured
human identity or explicitly allowed automated acceptance suite.

Require an explicit pass tied to the current build, AC and configuration. Silence or
deployment success is not acceptance. The pass signal is the ticket moved to **Ready for
Staging** by an authorized QA identity while the stand comment for the reviewed head is
present; a comment or label without that status change is not a pass. Failure goes to
WFTasks 15 before another worker. The status change triggers **08**.

Changed code/AC invalidates affected review/QA and readiness. Do not use the staging
wait as permission to release an unverified candidate; route required rework/verification
through the appropriate earlier stage.

## Ready for Staging: WFRelease refreshes, Jev decides (08 → 09)

Step 08 is WFRelease work and step 09 is a Jev completion call; together they are the
[staging-decision skill](../../staging-decision/SKILL.md). 08 runs when QA moves the
ticket to Ready for Staging and again every time a wait resolves; 09 follows each run.

- 08: Refresh head/artifact, required CI, independent review, QA Develop, unresolved findings,
  branch rules/approvals, staging release readiness/window and each action's permission.
  Check in code that the status change came from an authorized QA identity and that the
  PR head is unchanged since review and the stand comment. A changed head is not a wait:
  it returns to 05 for fresh review. Missing or stale evidence cannot be replaced with an
  old positive result.
- 09: Call Jev with the `step-09` preset for the target `merge`, the refreshed evidence and
  stage requirements; Jev flags scope, manual checks and coordination, never permission. All
  factual gates and Jev pass and the `merge` grant is held → **10 directly**. When
  CI deploys on merge, the merge to the staging branch is the staging deployment, so no
  separate deploy grant applies. Record eligibility separately from execution.
- Otherwise the ticket stays in Ready for Staging under WFRelease 08; preserve exact
  blockers and an owner or automatic wake-up event. Do not ask for approval already held.
  A required human release decision returns to WFRelease 08, never directly to Jev. When the
  wait resolves, including a human update, 08 refetches evidence and 09 runs again.

This status is not proof of merge/deployment or QA Staging acceptance. WFRelease tracks the
pending event and current sources without repeatedly dispatching work.

## Staging release: execute and verify (10 → 11)

This operation is entered from 09. Resolve the configured merge target branch, immutable
artifact and release batch. When CI deploys on merge, the `merge` grant is the staging
deployment authority; a model score, review pass or status never supplies permission.

Reconcile existing actions, merge once, and verify resulting artifact provenance and
required checks. A merge/batch that changes effective code/configuration invalidates
affected evidence and requires renewed review/QA before release. Deploy the approved
artifact, await success, confirm actual version and health/smoke results.
Timeout/unknown → reconcile, not duplicate dispatch. Failure → hold and configured
recovery; rollback also needs authority. Never advance on dispatch acknowledgement.

Only after verified staging release, `handoff_to_qa_staging` moves the card to QA Staging
and requests acceptance testing with exact build/environment and existing AC references.
Reconcile/reuse matching handoffs. Track pending handoff in the ledger if permission
or QA setup is missing; do not claim QA started from deployment success alone.

## QA Staging: integrated acceptance (11 → 12)

Await explicit acceptance by a configured QA identity or allowed suite on the exact
staged artifact/configuration. Verify acceptance, regression and cross-component
scenarios. Failure → 15; conflicting reports block advancement until resolved.
Old-artifact QA cannot qualify a new artifact. After pass, resolved blocking defects,
manual checks and release inclusion, evaluate `promote_to_release`; its grant permits
transition to Ready for Release (12).

## Ready for Release: WFRelease holds, Jev decides, release and Done (12–14)

1. **12 — WFRelease holds the ticket in Ready for Release.** On entry after QA Staging and
   after every wait, WFRelease resolves the exact staged artifact, the QA Staging acceptance
   by an authorized QA identity, current review/CI, the staging release result, the release
   batch and the status of every change in it, rollout/dependency/migration/flag order,
   environment, recovery plan, incident and freeze records, release timing, approvals and
   action permission. One ticket cannot authorize a batch containing blocked changes.
   Rebuilds/changes need provenance and renewed affected checks; do not inherit stale QA
   automatically. A new head returns to 05 for review; it is not a wait.
2. **13 — Jev decides the production release.** Jev/controller evaluate the `step-13`
   preset for the target `deploy_production` under stricter rules than 09: four positive
   predicates, seven negative predicates and narrower bands. Factual gates stay in code.
   Reuse existing scoped approvals.
3. All gates, the Jev answers and the `deploy_production` grant pass → 14. Pending timing,
   results, incident or freeze → wait under WFRelease 12 with blockers, owner and wake-up.
   A human-reserved risk class or a named unresolved decision → production release owner.
   Human response returns to **WFRelease 12** to
   refresh sources before Jev re-evaluates. Do not send approvals directly to Jev.
   13 runs again after every resolution; a decision is never reused after the artifact,
   evidence, batch or permissions change.
4. **14 — Merge, release, move to Done.** Merge once to the production branch; when
   CI deploys on merge, that merge is the production deployment. Verify deployment completion,
   actual version and health/smoke checks.
   Failure/unknown invokes reconciliation/recovery, never a delivered claim. Record the
   receipt; repeated polls do not redeploy. After verified delivery, move the ticket to the
   configured post-release state under `mark_done`; without that state or grant keep the
   actual status. Do not invent a Done status.

## QA return: validate before implementation (15–17)

An unprocessed return takes precedence in every status, even if QA moved the card to
In Progress. WFTasks reads original AC, latest QA message, tested artifact/environment,
failure evidence and prior attempt, then applies [Jev QA gates](../../jev/references/workflow.md#qa-returns).

Require actionable written steps, expected/actual result and relevant build/configuration.
Analyze image attachments only. Any video report requires a relevant inspected screenshot
**and written repro**; skip video without playback, transcription, frame extraction or
delegation. For nonvisual reports without video, do not require irrelevant screenshots.

| Finding at 15 | Route |
| --- | --- |
| Missing repro/build/outcome or required screenshot | 17: request only missing details; retain status, no worker |
| Tested build lacks the fix | 17: request correct-build retest; no failed implementation attempt |
| Confirmed original failure/regression on correct build | 16: recheck owner/model/capacity/authority; minimal dispatch through WFCoder → 03 |
| Evidence supports different platform/repo | 17: evidence-backed ownership proposal; reassignment needs `reassign_issue` |
| New requested product behavior | 17: human updates the ticket scope/AC or creates linked ticket; never infer AC |
| Conflicting QA or exhausted fix budget | 17: resolve discrepancy or request bounded diagnosis/specific intervention |
| Urgent production impact | Escalate via configured incident policy immediately; collect details alongside |

The human/QA update returns to **WFTasks 15**, which refetches before Jev. Validated
rework needs fresh independent behavior review after its new checks; no direct return
to merge/release. Invalidate affected review/QA/readiness, supersede queued delivery,
and reconcile in-flight actions. Do not assume a running deployment is cancellable or
silently roll back already delivered work; use incident/new-linked-ticket policy.
