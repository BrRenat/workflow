---
name: release-decision
description: Use inside Grok Bot for steps 12, 13 and 14 only. When QA Staging accepts the exact staged artifact, or a release wait resolves, WFRelease refreshes the evidence in Ready for Release (12), messages WFJev so Jev decides the production release under stricter rules than staging (13), and on a pass the release runner merges to the production branch, verifies delivery and moves the ticket to Done (14). Otherwise hold with blockers, owner and wake-up, or ask the production release owner. Nothing else.
---

# 12, 13 and 14: hold in Ready for Release, decide, then release and move to Done

Standalone Grok Bot skill. Do not install it into coding workers.
It runs when an authorized QA identity accepts the staged artifact in QA Staging and the
ticket enters Ready for Release, and again whenever a recorded wait resolves. When CI
deploys on merge, the merge to the production branch is the production deployment, and
the CI deployment posts the production stand comment.

In the PRJ-* Grok fleet, **WFRelease** owns this skill (evidence refresh 12; step 13 via
messaging WFJev — not a direct TypeSafe call). See [bot roster](../orchestration/references/bot-roster.md).

## Input

- Tracker issue ID and the QA Staging acceptance event (author, time, tested artifact).
- PR URL, the head SHA that passed independent review and both QA stages, and the staging
  release result (version, health) for that head.

## Step 12: WFRelease holds the ticket and refreshes the evidence

1. The QA Staging acceptance was made by an identity listed in
   `qa.develop.authorized_qa_identities` and names the exact staged artifact. Otherwise
   this is not a pass: stop and report the unmatched acceptance.
2. The artifact, its head and its configuration are unchanged since QA Staging. A new head
   is not a wait: return the ticket to 05 for fresh review. A rebuilt artifact needs
   provenance and renewed affected checks before step 13.
3. Fetch current facts: required CI on that head; open review threads and changes-requested
   reviews; the staging release result; the release batch and the status of every change
   in it; rollout, migration, flag and recovery notes; incident and freeze records and the
   production window under `release.release_window_policy_ref`; approvals under
   `release.approval_policy_ref`; the `deploy_production` and `mark_done` grants. One
   ticket cannot authorize a batch containing blocked changes.

## Step 13: Jev decides via WFJev under stricter rules than 09

4. Message WFJev with the `step-13` preset (`jev/questions/step-13.json`) for the target
   `deploy_production`, the refreshed evidence, the batch, the rollout notes and the release
   policy excerpts (do not call TypeSafe Jev directly). Apply `jev/policies/step-13.json`:
   four positive predicates, seven negative predicates and 0.90/0.10 bands. Jev never
   supplies permission and never sees a fact the code already decided. Consume WFJev's
   structured disposition.
5. Every fact from step 3 passes, every Jev predicate passes and the `deploy_production`
   grant is held → run step 14. Record `release_decision` with `automatic_release`, the
   checked gates, the artifact and the head.
6. A positive or uncertain `risk_class_requires_human` or
   `human_production_decision_required` → ask the named production release owner for the
   exact decision; the answer returns through WFRelease 12 and 13 re-runs.
7. Otherwise the ticket stays in Ready for Release under WFRelease 12. Record `wait` with the
   exact blockers, the responsible owner and the wake-up event: incident close, freeze end,
   window opening, batch change, CI completion, thread resolution or approval. On the
   event, re-run from step 1. A predicate still uncertain after the refresh goes to the
   release owner, not to a second wait.

## Step 14: merge, release, move to Done

8. Merge once to the production branch; CI deploys on merge. A timeout or unknown
   outcome is reconciled, never repeated.
9. Verify the deployed version and the configured health / smoke checks. Failure or unknown
   → configured recovery; never claim delivered.
10. After verified delivery, move the ticket to the configured post-release state under the
    `mark_done` grant and record the receipt. Without that state or grant, keep the actual
    status and report delivery; do not invent a Done status.

## Boundaries

- No QA verdict and no staging work here; a decision is tied to the artifact it checked
  and is never reused after the artifact, evidence, batch or grants change.
- Missing tracker, GitHub or release access, an absent Jev result, a missing grant or shadow
  mode: record the decision and stop. Nothing is merged, deployed or moved to Done.
