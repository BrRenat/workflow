# Prepare evidence and questions for step 05

Step 05 consumes the completion candidate from the single 04 implementation session.
The preparer collects facts; Jev assesses review needs; the controller applies policy.
This contract extends the independent library pilot to 05; step 09 has [its own](staging-preparation.md). Independent-reviewer
model selection, QA returns and delivery retain their existing contracts.

## Evidence preparation

Resolve the exact issue and existing AC, issue revision, PR/base/head, actual changes,
implementation report, QA history, applicable decisions, CI results and repo policy.
Preserve references, collection times and exclusions. Do not infer new AC from tests.
Any readable JSON, Markdown or prose works; no `review.*` or other paths are required.
Do not add model choices, human-attention verdicts, routing answers or selected routes.

Completion hooks wake reconciliation. The controller checks current session activity,
head, required CI and duplicate requests. Pending CI waits; failing CI returns to the
same implementation session. A finished hook is not completion proof.

Distinguish missing intent/change scope from missing verification. A reviewer can
investigate an explicit test/runtime gap when requirements and affected code are known.
Do not require a completed independent review to decide to start that review. Required
source access failures remain factual blockers; shadow replay may retain labeled gaps.

## CI evidence

Repository-specific adapters retrieve existing artifacts; the questions never depend
on a CI vendor, artifact layout, or field names. The following is the adapter contract,
not a deployed CI integration:

1. Resolve the candidate head and provider workflow/pipeline/job/attempt from current
   status metadata. Download artifacts for that exact execution; timestamps alone do
   not prove association. Preserve provider source URLs and artifact identity.
2. Parse relevant individual results and aggregate counts. Preserve full suite/test
   identity, source location, expected outcome, actual attempts, retries, flaky status,
   skip annotations, errors and diagnostic attachment references. Inspect run-level
   errors too; `ok` or an expected-failure classification is not an unconditional pass.
3. Relate existing AC to the assertions actually exercised. Test names and a high
   coverage percentage do not establish assertion quality. Distinguish observed test
   source, execution results and implementer claims. No invented acceptance criteria.
4. Report missing/expired/partial uploads separately from skipped, failed or passing
   tests. Green CI does not prove upload success. Preserve local skips as a separate
   run when CI later executes the same cases successfully.
5. Add a concise evidence excerpt to State with sources and limitations. Update stale
   'not retrieved' claims when evidence arrives. Do not paste credentials or whole
   diagnostic bundles into Jev. Keep raw artifacts available for the reviewer.

For example, in `example-org/web-app` the inspected configuration at `1111111` uploads
workflow-level CI artifacts `e2e-modules/<pipeline-id>/<module>/results.json` and
`gate-summary.json`. Job-level artifacts `playwright-report/` and `coverage-e2e/` and those
workflow uploads use 14-day retention. JUnit publishing and pipeline merging feed the CI
provider's test summaries. Use the per-case Playwright JSON as primary execution evidence;
PR/chat notification counts are summaries.
Uploads/reporting are best-effort and can be absent despite green CI. Recheck the repo's
configuration at the tested commit, rather than assuming this layout forever.

At that inspected revision, Scheduled coverage is disabled; Builder coverage scopes
`views/**`, not the export code under `exports/**`, and both modules have zero thresholds.
Absent coverage is not a failing test, and these coverage gates cannot prove this fix.
The repo's own docs note that organization-level reads from the CI provider may be
disabled: use an authorized provider adapter/CLI or explicitly labeled uploaded reports;
never pretend the GitHub connector has downloaded private CI artifacts.

## Questions and policy

Author questions once in `questions/library.json`; select `step-05`, or combine
`review-depth` and `review-human-attention`. The generated `review-routing.json` is a
compatibility alias for `step-05.json`, not a second authored question set.
Apply [step 05 policy](../policies/step-05.json) to actual Jev answers plus factual gates.
Example 0.80/0.20 thresholds are uncalibrated shadow values, not reliability guarantees.
Do not average scores. Human attention is separate from review depth; uncertainty means
investigate, not automatic human escalation. Reuse scoped decisions already supplied.

## Playground

Paste the entire evidence document into **State** and `questions/step-05.json` into
**Questions**. Do not put a `{state, questions}` envelope into State. Replace the whole
State after incorporating newly retrieved CI evidence, so stale gaps do not compete
with current facts. Keep the same Questions when the evidence layout changes.

```sh
node jev/scripts/compose-questions.mjs --preset step-05
node jev/scripts/compose-questions.mjs --preset review-depth --preset review-human-attention
node jev/scripts/compose-questions.mjs --preset step-05 --state path/to/review-evidence.json
node jev/scripts/compose-questions.mjs --export
```

