---
name: staging-decision
description: Use inside Grok Bot for steps 08 and 09 only. When QA moves a ticket to Ready for Staging, or a staging wait resolves, WFRelease refreshes the evidence on the reviewed PR head (08) and messages WFJev so Jev decides (09): merge to staging (10) or hold the ticket in Ready for Staging with blockers, owner and wake-up. Nothing else.
---

# 08 and 09: hold in Ready for Staging, then decide the staging merge

Standalone Grok Bot skill. Do not install it into coding workers.
It runs when an authorized QA identity moves the ticket to Ready for Staging, and again
whenever a recorded wait resolves. Deployment is not this skill's job: the merge to the
staging branch triggers the CI deployment, which posts the staging stand comment.

In the PRJ-* Grok fleet, **WFRelease** owns this skill (evidence refresh 08; step 09 via
messaging WFJev — not a direct TypeSafe call). See [bot roster](../orchestration/references/bot-roster.md).

## Input

- Tracker issue ID and the status-change event (author, time).
- PR URL and the head SHA that passed independent review and QA Develop.

## Step 08: WFRelease refreshes the evidence

1. The change to Ready for Staging was made by an identity listed in
   `qa.develop.authorized_qa_identities`, and the stand comment for the reviewed head
   exists. Otherwise this is not a pass: stop and report the unmatched change.
2. The PR head is unchanged since review and the stand comment. A new head is not a
   wait: return the ticket to 05 for fresh review.
3. Fetch current facts: required CI on that head; open review threads and changes-requested
   reviews from Codex, the verification session or a human; mergeability under branch
   protection; release freeze or window under `staging.release_window_policy_ref`; the
   `merge` grant. When CI deploys on merge, the merge is the staging deployment; no
   separate deploy grant applies.

## Step 09: Jev decides via WFJev

4. Message WFJev with the `step-09` preset (`jev/questions/step-09.json`) for the target `merge`,
   the refreshed evidence and the stage requirements (do not call TypeSafe Jev directly).
   WFJev runs Jev, which judges acceptance evidence, scope, manual checks, coordination,
   blockers and human release decisions; it never supplies permission and never sees a
   fact the code already decided. Consume WFJev's structured disposition.
5. Every fact from step 3 passes, Jev's answers pass and the `merge` grant is held → run
   step 10, merge and release to staging. Record `staging_decision` with `automatic_merge`,
   the checked gates and the head.
6. Otherwise the ticket stays in Ready for Staging under WFRelease 08. Record `wait` with the
   exact blockers, the responsible owner and the wake-up event: CI completion, thread
   resolution, approval, window opening or a human update. A named human decision goes to
   the release owner and returns through WFRelease 08. On the event, re-run from step 1.

## Boundaries

- No QA verdict and no deployment here; a decision is tied to the head it checked and is
  never reused after the head, evidence or grants change.
- Missing tracker or GitHub access, an absent Jev result, a missing grant or shadow mode:
  record the decision and stop. Nothing is merged.
