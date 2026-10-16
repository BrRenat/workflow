# Decision gates

## Contents

- Intake and promotion
- Question-to-policy mapping
- QA returns
- Platform ownership
- Review routing
- Completion and delivery
- Additional decisions

These are the team's workflow rules, not universal Jev capabilities. Exact tracker
state IDs, repositories and authorized actions come from the bot's live configuration.

## Intake and promotion

For the 01–02 pilot use [request preparation](request-preparation.md) and
[step 02 policy](../policies/step-02.json). Step 01 supplies free-form sourced evidence;
02 selects independent library questions. The model recommendation does not require
a separate routing schema. Human decisions, risk policy and actual worker eligibility
remain separate checks. Steps 05 and 09 also use library presets; other later flows retain their existing contracts below.

Run gates in this order; keep all secondary reasons even when one sets the disposition.

| Gate | Evidence or condition | Disposition |
| --- | --- | --- |
| Required source inaccessible | WFTasks cannot read the tracker or another required intake source, or a worker reports required tracker/design access failure | `blocked_access`; stop and report; WFTasks does not call the design integration |
| Active incident/security event | Supplied evidence indicates urgent impact | `human_attention` to the configured incident owner immediately |
| Already handled | Same event/revision/action already applied | Return the recorded outcome; perform no duplicate action |
| Dependency unresolved | Blocking issue/service change is unfinished | `wait_dependency` |
| AC readiness failed | AC absent, ambiguous, unverifiable, contradictory, or insufficient context | `human_attention` with `NEEDS_CLARIFICATION`; human updates the ticket before launch |
| Incomplete bug evidence | Repro or actual result cannot be understood without a skipped video | `human_attention`; request images/written repro |
| Uncertain ownership | Repository/component cannot be supported by evidence | `human_attention`; propose a bounded diagnostic task |
| Wrong known owner | Evidence supports a different component/repository | `reroute_proposal`; preserve the report and explain evidence |
| Elevated change risk | Auth/permissions, secrets, money, destructive data changes, breaking public contracts or coordinated rollout | `human_attention` to the relevant owner |
| Jev failure/uncertainty | Invalid response, unavailable service or required judgment outside calibrated bands | `blocked_jev` or `human_attention` |
| No capable worker available | Capability fits but quota/queue/host capacity is exhausted | `wait_capacity`; do not silently use an unsuitable model |
| All required checks pass | Clear bounded scope, adequate evidence, no blockers, eligible worker | Recommend `autopromote` |

Run the [five-part readiness gate](../../orchestration/references/acceptance-and-verification.md#step-02-readiness-gate-before-implementation)
before implementation. All AC must already exist in the tracker, the sole source of truth.
Jev must never infer or create missing acceptance criteria. Return only gaps/questions,
not guessed AC; the human updates the ticket. Check non-empty explicit AC in code and
record `preflight.acceptance_criteria_present`. All semantic predicates must pass; no
weighted average can override a failed or uncertain gate. Clarification returns to WFTasks 01 to refetch before Jev 02; never directly to Jev.

"Autopromote" does not mean skipping planning, tests, CI or independent review.
A strong coding model cannot repair missing product intent. Complexity alone is
primarily a model-routing signal; high complexity with clear, low-risk scope can be
automated once that lane has been evaluated and authorized.

For a bug require: identifiable affected build/environment, triggering steps or a
deterministic failing test, expected result, actual result and relevant evidence.
For an enhancement require: intended behavior, scope boundaries and verifiable
acceptance criteria. Do not demand bug-only fields for a documentation task.

For semantic checks, translate a high Noul into a satisfied predicate only under the
active calibrated threshold. Values in the uncertainty band require attention.
Do not multiply independent-looking Noul values into a "probability of safe delivery":
the questions may be correlated.

## Question-to-policy mapping

Use the event's active thresholds, not the example numbers as a reliability claim.
A positive predicate passes at or above `noul_yes_min`; a negative predicate passes at
or below `noul_no_max`. The interval between them is uncertainty, not an implicit pass.

| Questions | Required interpretation |
| --- | --- |
| `task_kind` | A supported non-unknown kind; use Choice gates before applying kind-specific branches |
| `preflight.acceptance_criteria_present` | Factual hard gate: explicit non-empty ticket AC; never infer from title, code or tests |
| `expected_behavior_clear`, `acceptance_unambiguous`, `acceptance_verifiable`, `acceptance_consistent`, `implementation_context_sufficient` | Every predicate positive for intake/QA return; false or uncertain means `NEEDS_CLARIFICATION` |
| `actual_behavior_specific`, `repro_actionable` | Positive for bugs and QA returns; ignore for unrelated feature/maintenance branches |
| `scope_conflict`, `product_decision_needed` | Negative before automatic implementation |
| Security/data/contract/money/rollout questions | Negative for the ordinary automatic lane; positive or uncertain goes to the configured owner's policy, never an average score |
| `task_complexity` | Non-unknown Choice supplies the routing profile; it is not a safety approval |
| `likely_owner`, `ownership_evidence_sufficient` | Passing ownership Choice plus positive evidence predicate before an ownership proposal |
| `qa_relation` | Passing Choice selects original-failure/regression/new-scope/insufficient-evidence handling |
| Other `qa_*` questions | Positive before automatic return to implementation |
| `model_choice` and generated candidate-fit questions | Passing relative choice plus passing absolute fit; otherwise use only the documented tie-break or attention path |
| Review-routing questions | Apply the dedicated routing mapping below; these select a reviewer, never approve a change |
| Generated acceptance-item questions | Every actual criterion must pass positively on completion |
| `scope_expanded`, `manual_check_outstanding`, `delivery_coordination_needed` | Negative before automatic delivery |

A passing Choice meets the configured confidence, selected-option probability and
top-two margin gates, computed in code. `none`, `unknown` and `insufficient_evidence`
remain non-actionable even if selected with certainty. `multiple`/`shared_contract`
require the applicable ownership map and coordination policy, not an arbitrary single repo.
Do not gate on unused speculative questions from another task kind.

Known required approvals are checked directly. If a domain owner already authorized the
exact current scope/action, reuse that authorization under policy; do not ask them again.
Semantic risk flags cannot manufacture or broaden that authorization.

## QA returns

Read the original requirement, prior implementation/PR, latest QA message, tested
artifact, environment and new image evidence together. Keep QA feedback tied to the
exact build they tested.

Required facts:
- Tested build/version or artifact identity and environment/device/browser where relevant.
- Reproduction steps, expected result and actual result.
- At least one relevant, inspected screenshot accompanying any video report.
- For a visual defect, images showing the affected state; for a sequence/timing defect,
  written steps and timestamps/context that a static image cannot convey.
- Applicable flags, tenant/role/test data and frequency only when needed to reproduce.
- A supported relation between tested artifact and candidate fix, computed from release
  metadata or ancestry by code; do not ask Jev to compare commit hashes.

Use `qa-return.json` to classify the relation to the accepted requirement:
same unmet behavior, introduced regression, new requirement, or insufficient evidence.
This is classification of QA feedback, not code review. Human/QA updates return to
WFTasks 15, which refetches before Jev; a validated return goes 16 → 03 and later
requires fresh independent behavior and test-strength review.

| Result | Action |
| --- | --- |
| Missing build/repro/outcome/image requirement | `request_qa_details`; list only the missing facts |
| Tested artifact does not contain the fix | Request retest of the correct artifact; do not reopen code work based on stale QA |
| Same acceptance criterion still fails | `return_to_implementation` after routing checks |
| A regression attributable to the change is supported | Return to implementation with the regression evidence and focused reproduction |
| New behavior outside the accepted scope | `human_attention`; propose a linked ticket or explicit scope decision |
| Ownership now points elsewhere | `reroute_proposal`; do not bounce the ticket based on its label alone |
| Repeated failed attempts | Stop the loop at the configured budget; request a stronger diagnostic pass or human decision |

Do not discard a useful report because a non-applicable field is blank. Do not insist
on a video for any task. Ask for up to a few concrete missing items rather than sending
a generic template. For a video-only visual report, Grok Bot can write:
"Please add a screenshot of the failing state, the tested build/environment, and the
steps with expected and actual results. The implementation agent does not analyze video."
Omit any item already supplied. Draft this message; post only under existing bot permission.

## Platform ownership

Distinguish `reported_platform` (where the symptom was seen) from `likely_owner`
(the component supported by diagnostic evidence). When the operator-maintained
`ownership.component_map` is empty or ambiguous for a defect, keep that distinction
and do not treat the symptom platform as the diagnostic owner.

Use an operator-maintained map of components to repos/teams. Do not invent a repository
name or automatically move a tracker issue solely from a Jev classification.

**Platforms label map (operator-maintained):** A matching Platforms tracker label is
sufficient ownership evidence for the mapped repository. Do **not** ask a human to
confirm owning repo/component when the ticket already has one of these labels. The rows
below are the illustrative `ownership.component_map` from `policy.example.json`; replace
them with the team's own labels and repositories:

| Platforms label | Repository | Component |
| --- | --- | --- |
| Web | `example-org/web-app` | Web app |
| API | `example-org/api` | API |

Map hits establish repository ownership without human confirmation. Labels outside this
map still need other evidence (explicit component scope, diagnostics, or a human).

| Evidence | Supported next owner or investigation |
| --- | --- |
| Platforms label matches `ownership.component_map` (example rows above) | Mapped repository; sufficient ownership evidence |
| API response is correct, rendering/state is wrong in one browser | Frontend |
| Valid request reproduces a server failure outside the UI | Backend/service |
| Request violates the documented API contract | Caller or shared contract; establish who changed the contract |
| Similar UI failure on several clients with the same bad response | Backend hypothesis; confirm request/response evidence |
| Native lifecycle, permissions or platform-only behavior | Mobile (or the corresponding platform owner) |
| DNS, TLS, deployment or infrastructure failure corroborated by telemetry | DevOps |
| Both caller and service violate shared expectations | Multiple owners or shared contract |
| Only an error screenshot or HTTP 500 with no request context | Unknown; request minimal diagnostic evidence |

A 500 status alone does not prove the implementation fix belongs on the server.
Do not ask Jev to discover a root cause from the ticket label. Let a diagnostic worker
collect a minimal request, response, contract and trace when this requires investigation.
Preserve both a backend correction and frontend error-handling work if both are justified.

Require a high-confidence ownership choice AND a supporting-evidence judgment before
proposing reassignment. A Platforms map hit counts as supporting evidence for the mapped
repo. If two owners remain plausible and the map is empty/ambiguous, keep `unknown` or
`multiple`; never force a single team just to allow promotion.

## Review routing

Use the `step-05` preset with [free-form review evidence](review-preparation.md).
Apply [step 05 policy](../policies/step-05.json) and the
[orchestration review flow](../../orchestration/references/review-routing.md).
Use active calibrated review-routing thresholds for live actions; the example policy ships
shadow/disabled, and uncalibrated outcomes are never eligible for automatic launch. No score proves implementation correctness or artifact identity.

1. A positive `review_context_sufficient` is required; false/uncertain means `collect_context` with the exact missing scope or intent.
   Collect authorized evidence first; human involvement requires a specific owner decision
   or access/setup obstacle. Missing tests/runtime checks are review work when their scope
   is clear. Missing final-head independent review does not block entering review.
2. Supported product, specialist or human-only verification needs require a concrete owner request; uncertain answers require investigation, not automatic escalation.
   Reuse existing scoped decisions. Preserve all unresolved human items and block dependent
   progress even when another gate controls the route. Humans return through WFTasks 05.
3. Set `independent_verification` when repo/domain policy requires it, a validated QA reopen exists, or `behavior_verification_needed` or `cross_component_verification_needed` is positive or uncertain.
   Post-QA re-review (operator cost rule, checked before the rule above): when the ticket already completed a 06B on an earlier head, then went to QA and was returned by QA, and is back at 05 after the rework, select `github_codex` (06A), not 06B. This overrides the repo independent-review requirement, the QA-reopen trigger, the verification predicates and the coverage condition. Context and CI gates and human-attention items still apply. It does not cover 06B change-request loops before QA.
   `business_logic_changed` informs domain policy rather than universally forcing 06B.
   If repository policy explicitly requires both routes, select both after context checks.
4. Select `github_codex` only when both verification-needed predicates are negative, `static_review_sufficient` is positive and configured integration coverage satisfies policy.
   Evidence relied on for this route must have verified current-head provenance. Otherwise
   collect provenance or select deeper verification under policy; never invent correlation.
   If context is sufficient but static sufficiency is not established, choose 06B.
5. Never substitute a shallower route because quota, setup or reviewer access is missing.
   Reconcile the session, required CI, head, applicable decisions, permissions, calibration
   and duplicate review requests before launch. A recommendation does not bypass a blocker.

Human attention is separate from route. An authorized external session may gather evidence
while an unrelated decision is pending, but dependent progress waits. CI and reviews stay
bound to exact head/scope/policy. After an actual qualifying review pass, go to 07, not 08.

## Completion and delivery

Delivery classification consumes existing external review and verification evidence.
It must not trigger a Jev review of the implementation or a review/fix loop.

First identify the requested action: `handoff_to_qa_develop`, `merge`,
`handoff_to_qa_staging`, `promote_to_release`, `deploy_production` or `mark_done`. Never interpret "finished" as permission for all.
In Progress → Code Review is an implementation handoff, not completion/delivery;
independent review is required to exit review, not to submit work for review.

Always require:
1. Current issue scope and concrete PR/head/artifact.
2. Each existing ticket AC mapped to meaningful current verification evidence. For 06B,
   include independent test-strength findings, counterexamples and gaps, not just links.
3. Required checks resolved; failing, pending, missing and skipped are distinct. Any
   policy-approved inapplicability needs a reason.
4. Required independent review tied to the current head. Implementer self-review or a
   child reviewer is insufficient. Review is externally controlled.
5. No unresolved blocking findings, conflicting QA or undisclosed scope changes.
6. Fresh evidence and configured authority for the exact action/environment.

Jev flags semantic mismatches, unsupported AC, scope, manual checks and coordination.
It cannot independently establish code correctness or test strength; external reviewers
provide that evidence. No score replaces a factual gate or permission.

| Target / step | Additional evidence and outcome |
| --- | --- |
| `handoff_to_qa_develop` / 06 → 07 | Independent review pass, current checks and runnable reviewed develop build; QA Develop not yet required. No staging merge decision |
| Staging decision / 09 | WFRelease 08 refreshed evidence after QA moved the ticket to Ready for Staging; `step-09` preset ([staging preparation](staging-preparation.md)), stage requirements and the `merge` grant. Automatic merge → 10; otherwise wait under 08 with blockers, owner and wake-up |
| `merge` / 10 | Passing 09 on the current head and the `merge` grant; when CI deploys on merge, the merge is the staging deployment. Reconcile the merge and verify resulting artifact provenance |
| `handoff_to_qa_staging` / 10 → 11 | Successful verified staging deployment/version/health and exact-build test context; QA Staging not yet required |
| `promote_to_release` / 11 → 12 | Explicit QA Staging pass on exact artifact, resolved blocking defects/manual checks and release inclusion |
| Production release decision / 13 | WFRelease 12 refreshed evidence after QA Staging accepted the exact staged artifact; `step-13` preset ([release preparation](release-preparation.md)), stricter than 09: four positive and seven negative predicates, narrower bands, batch, rollout/recovery, incident, freeze and human-reserved risk classes. Automatic release → 14; incident/freeze/pending → wait under 12; human-reserved class or named decision → production release owner → 12 → 13 |
| `deploy_production` / 14 | Passing 13 on the current artifact and the `deploy_production` grant; when CI deploys on merge, the merge to the production branch is the production deployment. Reconcile the merge and verify the delivered version and health |
| `mark_done` / 14 | Observed delivery/health and configured real post-release state; merge alone is insufficient. Then the ticket moves to Done |

At 09, all current gates, the completion result and the `merge` grant go **directly to
10**; otherwise the ticket waits under WFRelease **08** and 09 runs again after resolution.
Never perform 09 before QA Develop (07). Do not reuse a decision after candidate/evidence/permission changes.
At 13, all current gates, the stricter completion result and the `deploy_production` grant go
directly to 14; otherwise the ticket waits under WFRelease **12** or the production release
owner decides, and 13 runs again after resolution. Never perform 13 before QA Staging (11).
Human responses return through WFTasks: 01 for intake, 05 for review, 08 for staging,
12 for production (then 13), 15 for QA reports. The bot refetches before Jev; humans never hand
an approval directly to Jev.

Apply `manual_check_outstanding` only to checks due before the named action under
`delivery.stage_requirements`. QA Develop is mandatory before staging merge/deploy;
QA Staging follows verified staging deployment and is mandatory before release entry.
Missing stage requirements block automation; an earlier positive result cannot authorize
a later action. Changed code/AC invalidates affected review, QA and planning evidence.

If a mandatory result is pending, use `wait_result` with the source and next wake-up;
do not call the task delivered. Missing/failed results need their exact blocker or fix.
If automation is disabled or a product,
release or risk decision is needed, return `human_attention` with the concrete decision.

The delivery threshold is separate from intake. Never average a missing review, failed
check or unresolved regression into a passing aggregate score.

## Additional decisions to add

| Decision | Benefit | Implementation boundary |
| --- | --- | --- |
| Duplicate / overlapping work | Avoid two workers solving the same bug | Retrieve candidates first; Jev compares candidates, code locks active work |
| Dependencies and sequencing | Avoid launching work blocked by another repo | Read ticket relations; use explicit dependency completion, not guessed dates |
| Requirement drift | Detect changed scope after a session started | Code compares issue revisions; Jev compares meaning only when text changed |
| Retry and escalation | Avoid repeated ineffective attempts | Code caps attempts; Jev classifies new evidence or a different failure mode |
| Resource scheduling | Keep builds off overloaded hosts | Jev labels workload from evidence; code checks memory, slots, quotas and reservations |
| Rollout coordination | Surface cross-repo compatibility and migration order | Human/release policy approves sequence; Jev flags the need |
| Outcome feedback | Improve model choice and automation precision | Log overrides, reopens, latency and usage by task category, not a single global score |

Add these incrementally after the five requested decision points work on real tickets.
Do not expand a worker's ticket scope merely because an optional recommendation exists.

