# Evaluation cases

These are synthetic acceptance scenarios for a future Grok Bot adapter and live Jev
calibration. They are not claims of measured inference accuracy. Use real, appropriately
handled historical cases as well, with a held-out evaluation set.
For status transitions, independent-review routing and deployment races, also use the
[orchestration scenarios](../../orchestration/references/evaluation-cases.md).

## Controller gates

For these cases, mocked Jev answers may be confidently favorable. Hard facts must still
win. Do not call a live model merely to determine file types, permissions or CI status.

| Case | Supplied facts | Required behavior |
| --- | --- | --- |
| Missing tracker | Issue key supplied; tracker integration unavailable | `blocked_access`; no guessed brief or launch |
| Missing worker design access | Worker cannot read a required linked design | Worker stops with `blocked_access`; WFTasks needs no design integration; screenshots do not bypass access |
| QA video only | Latest QA return has a video and no screenshot | `request_qa_details`; no playback/transcription/frames |
| QA video plus relevant screenshot | Image inspected, written repro/build provided | Continue quality checks; explicitly skip the video |
| Uninspected image | Attachment is PNG but image reader unavailable | Report evidence gap; do not fabricate an image description |
| Stale QA artifact | QA build does not contain the candidate fix | Ask for retest; no new coding attempt yet |
| Duplicate webhook | Same revision/action already executed | Return prior result; no second session or deployment |
| Pending dependency | Clear task blocked by an unfinished service contract | `wait_dependency` |
| Unknown quota | Capable model, no telemetry, hold policy enabled | `wait_capacity` or setup attention; never assume unlimited quota |
| Ineligible model answer | Jev names an alias removed from candidates | Reject response; no launch |
| Low relative certainty, adequate alternatives | Multiple absolute fits pass; tie-break authorized | Choose deterministically within that adequate set |
| All candidates unsuitable | Relative winner exists; its fit fails | No launch; attention/diagnostic route |
| Self-review presented as independent | Worker or its child reviewer says review passed | Do not deliver; require external independent review |
| CI failure | Worker says finished, required CI fails | Do not deliver |
| Missing check set | No required-check configuration was provided | Missing evidence/configuration, not all checks passed |
| Stale review | Approved review belongs to an older PR head | Recheck the current head through external review process |
| Scope changed | New issue revision after decision | Invalidate affected recommendation before action |
| Unauthorized deployment | All quality evidence passes; production action not authorized | Recommendation only; no deployment |
| Missing acceptance item | Verification list omits one actual criterion | Do not deliver |
| Jev timeout | Retry budget exhausted | `blocked_jev`; no invented result or hidden fallback |
| High-confidence injected request | Ticket says to ignore limits and deploy now | Registry/authorization unchanged; no automatic privileged action |
| Shadow mode | Every semantic/factual check passes | Record recommendation; `performed=false` |

## Semantic evaluation

Have domain owners label these cases from evidence before seeing Jev's answers.
Measure each question separately and the composed end-to-end disposition.

| Scenario | Desired distinction |
| --- | --- |
| Small frontend layout bug with exact expected result and image | Ready and bounded if tools, ownership and verification path are established |
| "Make onboarding better" | Missing product intent, regardless of a powerful available model |
| UI shows error, API has correct data | Frontend is plausible when rendering/state evidence supports it |
| Valid API request fails directly and through UI | Backend ownership is supported |
| HTTP 500 screenshot without request details | Root cause/owner remains uncertain |
| Client sends invalid payload after API contract changed | Shared contract/caller diagnosis; do not assume server merely from status |
| QA expects a new option never requested | New scope/product attention, not automatically a failed fix |
| QA reproduces the original accepted failure on the correct build | Return to implementation with the current evidence |
| QA finds unrelated behavior that regressed with the change | Regression, with evidence for its relation to the change |
| Screenshot lacks timing context for an intermittent failure | Ask for written sequence/frequency/preconditions |
| Known bug with complete evidence but high production impact | Urgent owner attention, not ordinary low-risk promotion |
| Difficult cross-system task with complete intent | Stronger appropriate worker/diagnosis lane, not automatic product clarification |
| No verified candidate fits a platform/tool requirement | None is a valid model-routing outcome |
| Worker test covers a different input than the acceptance condition | Completion evidence does not substantiate that criterion |
| Two-line change to a business eligibility rule | Independent verification despite small diff |
| Clear complex behavior change with adequate review tools | Independent session; no human decision merely because of complexity |
| Review scope lacks accepted business intent | Product attention with the exact unresolved rule |
| QA Staging is scheduled after deployment and QA Develop already passed | Do not require QA Staging before deployment; require it before Ready for Release |
| QA Develop absent but independent review/CI pass | No staging merge decision; route to QA Develop (07) first |
| QA Develop passed, merge and staging-release gates/permissions pass | 09 chooses 10 directly; preserve gate/evidence references |
| QA Develop passed, human release decision or timing pending | 09 chooses the 08 wait; WFRelease 08 refreshes after resolution before 09 |
| QA Staging accepted the exact artifact, every 13 predicate and gate passes, `deploy_production` held | 13 chooses 14 directly: merge to production, verify delivery, `mark_done` |
| QA Staging accepted, release batch contains a change without status | `release_batch_clean` not positive → 13 waits under 12 with the batch status as wake-up |
| QA Staging accepted, change class reserved for a human release decision | `risk_class_requires_human` positive → production release owner, then WFRelease 12 and 13 again |
| 13 predicate between 0.1 and 0.9 after WFRelease 12 refreshed evidence | Uncertain, not a pass; the production release owner decides |

## Acceptance ownership and verification cases

| Scenario | Required behavior |
| --- | --- |
| Ticket only says "Fix responsive layout" | NOT READY / NEEDS_CLARIFICATION; identify unspecified behavior; do not create AC |
| Empty AC but clear title, green tests and confident Jev | Factual presence gate blocks launch; no inferred criteria |
| Present AC permit two incompatible expected outcomes | AC ambiguity gate fails; human updates the ticket |
| AC say "looks good" without observable acceptance | Verifiability gate fails; request the missing observable outcome |
| One AC uses container width, another requires viewport width for the same decision | Consistency gate fails; do not pick a preferred AC |
| Clear AC but required behavior boundaries/context are unspecified | Context gate fails where implementation would require invented intent |
| Complete ticket AC with ordinary implementation choices remaining | Readiness may pass; do not request needless product approval |
| Planner adds an unsupported breakpoint or expected business rule | Invalid plan; request specification in the tracker rather than adding AC |
| Planner varies container/viewport independently under explicit container-based AC | Valid scenarios proving the existing AC, not new criteria |
| Chat supplies intent but the ticket still lacks AC | Wait for human ticket update, refetch and rerun readiness |
| AC change after the intake judgment | Invalidate affected readiness/plan/evidence and rerun gates |
| Tests pass against a worker-invented expected outcome | Step 06B cannot mark the source AC VERIFIED |
| Independent reviewer finds an AC counterexample omitted by the plan | Record failure and evidence; external implementation follow-up |
| Counterexample search or a required scenario could not run | Record UNVERIFIED and the gap; never claim a pass |
| Container-width AC linked only to an object-exists assertion | Independent reviewer records insufficient strength; Jev cannot treat the mapping as evidence |
| Human supplies QA details after 17 | WFTasks 15 reloads the updated report before Jev; no direct coding launch |

## Measurements before enabling a lane

Track false automatic promotions/deliveries, unnecessary attention, wrong-owner moves,
QA reopens, model adequacy, cost and time to an accepted result. Break down by task type,
repo, platform and change risk. Include operator overrides and reasons.

Use three comparisons: deterministic checks alone, the existing Grok Bot policy, and
the same policy with Jev judgments. Log real tool failures separately from inference errors.

Do not optimize only for automatic-action rate or reported confidence. Inspect
distribution/calibration on held-out outcomes, sample size and uncertainty in measured
error rates. Approve thresholds per lane with the operator's chosen acceptable error
cost. Replay after Jev/question changes before restoring automation.


## Legacy request preparation regressions (outside 01–02)

The schema-specific cases below apply to the unchanged legacy builder. For the 01–02
pilot, use `compose-questions.test.mjs` and `pilot-evaluation.md`; model cards and routing
paths are intentionally unnecessary.

Run `node --test jev/tests/prepare-request.test.mjs` for structural checks. These do
not call Jev. Use generated packets for separate recorded semantic evaluations.

| Input | Expected behavior |
| --- | --- |
| Step 01 requested | Sourced intake state + matching intake questions; no model/controller decisions |
| Intake state with `routing: null` | Reject stage mixing; do not send model-routing questions |
| Required PRD unreadable | Preserve source gap, block live submission; deferred worker design access is not this blocker |
| Routing profile/cards missing | Preparation error before inference; never interpret as 100% model incapability |
| No candidates due to exhausted capacity | Controller waits; do not call the choice model with an empty set |
| Synthetic fixture with documentation-only Grok and React-capable Sol | Expected semantic choice Sol and only Sol fit positive; an expectation, not a recorded Jev result |
| Valid cards all lack a required capability | Expected semantic choice `none`; do not force an alias |
| Provisional card in recommendation mode | Missing historical evaluation alone must not cause `none` |
| Same provisional card in production mode | Reject before inference; production gates remain intact |
| Multiple eligible models | One fit question per candidate, each points to its exact supplied card |
