---
name: codex-review
description: Use inside Grok Bot for step 06A only. Receive a pull request link, post the `@codex review` trigger on that PR once, then trigger the implementation bot to listen to the resulting review comments and fix or answer them. Nothing else.
---

# 06A: request Codex review, hand its comments to the implementation bot

Standalone Grok Bot skill. Do not install it into coding workers.
It performs the two actions below and nothing else. Review depth (05), the pass to
QA Develop (07) and every other transition belong to the
[orchestration skill](../orchestration/SKILL.md).

## Input

- Pull request URL (required).
- Tracker issue ID, when known; it is the Superset task name.

## Steps

1. **Request the review.** Post exactly `@codex review` as a comment on the PR, under the
   existing `request_github_review` grant. One request per PR head: if the current head
   already has a Codex request or review, do not post again.
2. **Trigger the implementation bot.** Under the existing `start_implementation` grant,
   ask WFCoder to start or resume the implementation session for this PR with the issue
   ID, the PR URL and these execution instructions only:

   ```text
   Codex review was requested on <PR URL>. Watch that PR for review comments from the
   configured Codex identity. For each comment: fix it and push to the PR branch, or
   reply on the comment thread explaining why no change is needed. Do not merge.

   WF-RUN
   issue: <ISSUE-ID>
   launch_attempt: <launch attempt ID>
   tracker_updates: <enabled | disabled>
   transitions: Code Review -> In Progress; In Progress -> Code Review
   ```

   No ticket title, description, AC or copied review text goes to the Superset host.
   Fill `WF-RUN` per [worker signals](../orchestration/references/worker-signals.md#launch-block);
   shadow mode always sends `tracker_updates: disabled`.

## Boundaries

- This skill does not read, judge or summarize the review; the implementation bot
  answers the external reviewer. That is not self-review, and the bot must not
  request or run a review of its own.
- Missing GitHub access, a missing grant or shadow mode: record both intended actions
  and stop. Nothing is posted or launched.
