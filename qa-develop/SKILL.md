---
name: qa-develop
description: Use inside Grok Bot to enter step 07 only. After an independent review pass, wait for the CI deployment's stand comment on the ticket for the reviewed PR head (30-minute timeout; on timeout post verified stand links yourself), post plain-language QA notes built from the PR's `## How to test` section, then move the ticket to QA Develop and assign the configured QA. Nothing else.
---

# 07: hand the reviewed build to QA Develop

Standalone Grok Bot skill. Do not install it into coding workers.
It performs the three actions below under the existing `handoff_to_qa_develop` grant and
nothing else. The QA verdict, the staging decision (09) and QA returns (15) belong to the
[orchestration skill](../orchestration/SKILL.md).

Deployment is not this skill's job. CI deploys the branch to its stand and posts a
comment on the ticket with the stand links, branch and head SHA.

## Input

- Tracker issue ID (required).
- PR URL and the head SHA that passed independent review (required).
- Review probes that were not executed, and pending product decisions, when known.

## Steps

1. **Wait for the stand comment.** Read the ticket comments through the tracker
   integration. Find the deploy pipeline's comment by the configured marker
   (`qa.develop.stand_comment_marker`) whose head SHA equals the reviewed head. A comment
   for an older head is stale, not a match. Found → step 2. Not found → `wait_result`;
   re-check on new comment events.
   Still absent after `qa.develop.stand_comment_timeout_seconds` (example policy: 1800):
   verify the stand yourself and continue (the release-report job only comments on
   tickets whose ID is in the branch name). Check it with the project's stand pattern, for
   example: a shared stand `stand-N.example.com` serves `stagingN_<branch>-<sha7>`;
   a per-branch preview
   `https://preview.example.com/<sha7>/` returns 200. Use those verified links in step 2. Only when the
   stand cannot be verified, raise `human_attention` to the repo/tool owner naming the
   issue, PR and head, and do not move the ticket.
2. **Post the QA notes.** Take the `## How to test` section from the PR description
   (`gh pr view <PR> --json body`) and rewrite it into plain, numbered steps the QA
   engineer can follow without reading code: where to go, what to do, what to expect.
   Keep every check it contains; do not add new acceptance criteria. Post one ticket
   comment with:
   - PR link, head SHA and the verified stand links;
   - a short CI and e2e summary for that head;
   - the plain test steps;
   - review probes the 06B did not execute, as extra checks for QA;
   - pending product decisions that sign-off waits on, with their owners.

   A PR without a `## How to test` section cannot enter QA Develop: trigger the
   implementation bot to add it, as in the [codex-review skill](../codex-review/SKILL.md)
   step 2, and repeat this step after the PR description changes. After a rebase or new
   build on a ticket already in QA, post an updated stand note ("earlier QA notes still
   apply" when no source changed) instead of a new handoff.
3. **Move and assign.** Set the QA Develop state and assign the configured QA identity
   (`qa.develop.assignee_identity`, for example the QA engineer). Update the issue through
   the tracker integration, setting the status by its exact name (`"QA Develop"`) and the
   assignee by name, never by a guessed internal ID. An unmapped state or identity is a
   setup blocker, never a guess.

## Boundaries

- No staging merge, no deployment, no QA verdict here. QA moving the ticket to Ready for
  Staging on this head triggers 08; a failure leads to 15.
- Missing tracker or GitHub access or a missing grant: record the intended actions and
  stop. Nothing is posted, moved or assigned.
