# Selecting independent review

## Inputs and decision

Collect issue/design requirements, current PR head/base, changed components and behavior
summary, acceptance evidence, tests/checks, risks, QA history and repo review policy.
Preserve source references and uncertainty. Worker descriptions are not independent
proof of scope or correctness.

Prepare [independent review evidence and per-case CI results](../../jev/references/review-preparation.md).
Call the `step-05` preset ([questions](../../jev/questions/step-05.json)) with the same
free-form state; apply [step 05 policy](../../jev/policies/step-05.json).
Jev judges required review depth; it performs neither code review nor runtime checks.
Apply the [Jev mapping](../../jev/references/workflow.md#review-routing) and these
deterministic requirements. No diff-size or model-brand shortcut is allowed.

| Route | Eligible when | Required outcome |
| --- | --- | --- |
| `github_codex` | Post-QA re-review: ticket already completed a 06B, went to QA and was returned by QA (operator cost rule; overrides the other 06B triggers). Otherwise: bounded understood scope; acceptance evidence covers effects; no unresolved runtime, business-rule, integration or specialist question; repo permits the configured Codex coverage | Completed independent GitHub review for current head, no unresolved blocking findings; required CI/approvals still pass |
| `independent_verification` | Unresolved behavior or cross-component verification needs, supported QA reopen, uncertain static-review sufficiency, or explicit repo/domain requirement | Fresh externally controlled session checks the diff and applicable behavior against original requirements, producing findings and an evidence matrix |

A verified documentation correction can use GitHub review. For a two-line change to price
eligibility or authorization, apply the configured domain policy and remaining behavior
questions; a business-logic flag alone does not universally require 06B. A large generated diff is not
automatically complex, but its origin, behavior and checks still need evidence.

Human attention is a separate field and can accompany either route:

| Reason | Role and precise request |
| --- | --- |
| Conflicting/missing business intent | Product/domain owner: decide expected rule for the cited case |
| Unresolved specialist risk | Security/data/platform owner: resolve the named boundary or migration question |
| Manual-only acceptance check | QA/design owner: verify the interaction/state on the specified build |
| Reviewer/environment unavailable | Repo/tool owner: restore named access or approve a supported arrangement |
| Reopen/retry budget exceeded | Technical owner: select a diagnostic plan or revise scope |

Reuse existing scoped decisions; complexity alone does not need generic approval.
Authorized evidence collection can continue while an unrelated human decision is pending,
but promotion waits for every blocking decision.

## GitHub Codex route

Step 06A is executed by the [codex-review skill](../../codex-review/SKILL.md): post the
trigger once, start the implementation bot that fixes or answers the comments, nothing
else. The rest of this section describes how the controller reads the outcome.

Confirm the repository's Codex cloud/code-review setup and authenticated GitHub access.
Reuse an existing matching request/automatic review. With `request_github_review` permission
and no qualifying request, post the exact trigger, optionally adding a focused concern:

```text
@codex review
```

Record request ID, PR head, issue revision and review-policy version. Do not post repeated
comments on every poll or implicitly change repository review settings.

Observe completion from the configured Codex identity and correlate it to the head.
The eyes reaction acknowledges work; no result means pending. A documented no-findings
signal counts only when the adapter can prove its origin and reviewed head. A reaction
without that provenance cannot satisfy the gate. Branch protection and mandatory human
approvals remain separate requirements.

Official documentation checked on 2026-09-23 describes reviews focused on serious issues
(currently P0/P1). A clean result does not establish every acceptance condition or runtime
path. Verify coverage during setup; use independent verification if policy needs broader
coverage. Do not substitute an arbitrary `@codex` task or fix command for review.

Source: [OpenAI: Review GitHub pull requests with Codex](https://learn.chatgpt.com/docs/third-party/github).
Route eligibility in this folder is team policy, not an OpenAI guarantee.

## Separate behavior-verification session

Step 06B is executed by the [independent-review skill](../../independent-review/SKILL.md):
start a separate session on ChatGPT Astra (high), then Claude Fable (high), then Grok (high)
on usage or rate limits, that runs the
[deep-verify skill](../../deep-verify/SKILL.md), then the
implementation bot that fixes or answers its review, nothing else. The rest of this
section describes what that verification must establish.

The external controller, never the implementer, starts a fresh session under
`start_independent_review`. Use Jev model routing with
`routing.task_profile.role = independent_reviewer` and models whose verified tools and
approved review lanes cover the task. A different model brand is optional; a separate
session that did not implement the change is mandatory.

Launch with only the issue ID, operational notes and execution instructions. Do not
forward ticket title, AC or copied evidence through WFCoder to the Superset host.
The reviewer retrieves the following context directly after launch:

- Tracker issue/revision, design links, screenshots and skipped videos.
- Repo, PR, base and candidate head/artifact; project and review instructions.
- Accepted business rules and per-criterion evidence, including unsupported criteria.
- Original QA reproduction/configuration for returned tasks.
- Behaviors, edge cases and integrations to verify, permitted environment/operations,
  and outstanding domain-owner decisions.

The reviewer fetches authoritative sources, reads the diff and surrounding code, and
checks business outcomes against the issue instead of adopting the worker's interpretation.
It runs meaningful checks in the permitted environment: reproduce the original bug where
feasible, exercise the fix, cover implicated boundary/error/state cases, and verify relevant
API/UI contracts and design correspondence. Tests asserting the wrong business rule do not
satisfy acceptance.

Apply the [step 06B verification matrix](acceptance-and-verification.md#step-06b-independent-verification):
map each exact ticket AC to planned scenarios, actual test results and implementation
evidence. Verify that each test would detect a meaningful violation of its AC; inspect
the assertion strength rather than accepting a mapping or green result alone. Use
independent counterexample search, test-strength analysis and targeted mutation where
useful. Search independently for counterexamples, including cases omitted from the
implementation plan. Record attempted cases, outcomes and limits. Mark a criterion
`VERIFIED` only with sufficient current evidence and no unresolved counterexample or
gap; otherwise record `FAILED` or `UNVERIFIED`. Do not infer new AC or change expected
behavior to fit the code/tests. Missing intent means `NEEDS_CLARIFICATION` and a human
ticket update. A finite counterexample search is not a proof of all possible behavior.

Do not make implementation edits or merge/deploy in review. Temporary diagnostic checks
are allowed; return suggested tests/fixes as findings for implementation. If verification
cannot run, record the gap and unverified cases, never a pass. A tracker/design failure stops
review. Return `pass`, `changes_requested` or `blocked`, reviewer/session identity, exact
head and issue revision, actual check results, per-criterion evidence and human decisions.

The controller validates provenance/completeness; Jev does not invent a review result.
Fixes and subsequent review are scheduled externally. If repo policy requires both
GitHub review and behavior verification, require both. Do not repeat sufficient review
merely because the status was polled again. A qualifying review pass goes to QA Develop
(07), not staging merge. The staging decision (09) follows QA Develop after WFRelease
08 refreshes evidence. Human review resolutions return to WFTasks 05 to refresh context first.
