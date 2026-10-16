# Prepare evidence and questions for step 09

Step 09 consumes the evidence WFRelease refreshed in step 08 after QA moved the ticket to
Ready for Staging. WFRelease collects facts; Jev judges the semantic staging-merge questions;
the controller applies factual gates and the `merge` grant. This contract extends the
independent library pilot to 09; other completion targets keep `completion.json`.

## Evidence preparation

Resolve the exact issue and its AC, the reviewed PR head, the Ready for Staging status
change (author, time, matching stand comment), per-AC acceptance evidence with its source
and head association, independent review results and open threads, CI results, QA Develop
record, stage requirements, rollout notes, release notes and approvals. Any readable JSON,
Markdown or prose works; no `delivery.*` paths are required. Label implementer claims
separately from observed facts. Record unretrieved items as gaps. Do not add a merge
recommendation, computed gate results or expected answers.

Factual gates stay in code: authorized QA identity, unchanged head, CI, review threads,
branch protection, release window and the `merge` grant. Jev is never asked to guess them.

## Questions and policy

Select the `step-09` preset from `questions/library.json`; the export is
`questions/step-09.json`. Apply [step 09 policy](../policies/step-09.json): one positive
predicate (`acceptance_evidence_sufficient`) and five negative predicates (`scope_expanded`,
`manual_check_outstanding`, `delivery_coordination_needed`, `merge_blocker_present`,
`human_release_decision_required`). Example 0.80/0.20 thresholds are uncalibrated shadow
values. Do not average scores; uncertainty means wait and investigate.

## Playground

Paste the evidence document into **State** and `questions/step-09.json` into **Questions**.
Do not put a `{state, questions}` envelope into State.

```sh
node jev/scripts/compose-questions.mjs --preset step-09
node jev/scripts/compose-questions.mjs --preset step-09 --state path/to/staging-evidence.json
node jev/scripts/compose-questions.mjs --export
```

