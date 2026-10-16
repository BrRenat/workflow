# Prepare evidence and questions for step 13

Step 13 consumes the evidence WFRelease refreshed in step 12 while the ticket is held in
Ready for Release after QA Staging accepted the exact staged artifact. WFRelease collects
facts; Jev judges the semantic production-release questions; the controller applies
factual gates and the `deploy_production` grant. This contract extends the independent
library pilot to 13; other completion targets keep `completion.json`.

Step 13 is stricter than step 09 on purpose: the release is to production, the merge to
the production branch is the production deployment when CI deploys on merge, and after
verified delivery the ticket moves to Done (14). A wrong staging merge costs a staging
round; a wrong production release reaches customers.

## Evidence preparation

Resolve the exact issue and its AC, the staged artifact and its head, the QA Staging
acceptance (author, time, tested artifact), per-AC acceptance evidence with its source and
artifact association, independent review results and open threads, CI results, the staging
release result (version, health), release batch contents with the status of every batched
change, rollout, migration, flag and recovery notes, incident and freeze records, the
release calendar, approvals and applicable release policy excerpts. Any readable JSON,
Markdown or prose works; no `delivery.*` paths are required. Label implementer claims
separately from observed facts. Record unretrieved items as gaps. Do not add a release
recommendation, computed gate results or expected answers.

Factual gates stay in code: authorized QA Staging identity, unchanged artifact, CI, review
threads, production branch protection, incident, freeze and window records, batch status
and the `deploy_production` and `mark_done` grants. Jev is never asked to guess them.

## Questions and policy

Select the `step-13` preset from `questions/library.json`; the export is
`questions/step-13.json`. Apply [step 13 policy](../policies/step-13.json): four positive
predicates (`acceptance_evidence_sufficient`, `production_evidence_current`,
`rollout_plan_complete`, `release_batch_clean`) and seven negative predicates
(`scope_expanded`, `production_manual_check_outstanding`, `production_coordination_needed`,
`production_blocker_present`, `incident_or_freeze_active`, `risk_class_requires_human`,
`human_production_decision_required`). Example 0.90/0.10 thresholds are uncalibrated
shadow values, narrower than step 09. Do not average scores. A positive or uncertain
human-class, human-decision or incident answer goes to the production release owner or an
incident wait; any other failing or uncertain predicate waits under WFRelease 12, and a
predicate still uncertain after refreshed evidence goes to the release owner.

## Playground

Paste the evidence document into **State** and `questions/step-13.json` into **Questions**.
Do not put a `{state, questions}` envelope into State.

```sh
node jev/scripts/compose-questions.mjs --preset step-13
node jev/scripts/compose-questions.mjs --preset step-13 --state path/to/release-evidence.json
node jev/scripts/compose-questions.mjs --export
```

