---
name: independent-review
description: Use inside Grok Bot for step 06B only. Receive a pull request link, start a NEW Superset verification session through WFCoder on ChatGPT Astra (high), then Claude Fable (high), then Grok (high) on usage or rate limits, that runs the deep-verify skill, then trigger the implementation bot to fix or answer the resulting review comments. Nothing else.
---

# 06B: start independent verification, hand its comments to the implementation bot

Standalone Grok Bot skill. Do not install it into coding workers.
It performs the two actions below and nothing else. Review depth (05), the pass to
QA Develop (07) and every other transition belong to the
[orchestration skill](../orchestration/SKILL.md). The verification method itself is the
[deep-verify skill](../deep-verify/SKILL.md).

## Input

- Pull request URL (required).
- Tracker issue ID, when known; it is the Superset task name and the `--issue` argument.
- Session IDs to exclude (the implementation session, its children, earlier verify sessions).

## Steps

1. **Start the verification session.** Under the existing `start_independent_review`
   grant, ask WFCoder to start a **new** Superset session. Never the implementation
   session, its child, or an earlier verify session for the ticket. Reviewer chain:
   1. ChatGPT Astra, high effort (`chatgpt_astra`, runtime `gpt-6-astra`);
   2. Claude Fable, high effort (`claude_fable`, runtime `claude-fable-5-1`) when Astra
      is unavailable or limited;
   3. the strongest available Grok at high effort when Claude or ChatGPT hits a usage or
      rate limit. Do not wait for a quota reset; low remaining Astra quota is not a reason
      to wait.

   If Superset rejects a named model, relaunch without a model (CLI default) rather than
   substituting another. Never accept a Codex "switch model" rate-limit menu; resume the
   same session in a new terminal. Resolve runtime IDs from the live registry; do not
   guess versions. Send the issue ID, the PR URL and exactly these execution
   instructions, with nothing added (no ticket text, AC, prior-review notes, hints or ops
   details):

   ```text
   Use the deep-verify skill on <PR URL> for issue <ISSUE-ID>. Read the tracker issue
   and any linked designs yourself. Publish the per-AC verdict, side effects and findings
   as a GitHub review on that PR. Do not edit committed code, push, or merge.
   ```

   If the deep-verify skill is not installed on the host, the session follows the repository's
   `CLAUDE.md` review procedure as the fallback, and its report says so.
2. **Trigger the implementation bot.** Under the existing `start_implementation` grant,
   ask WFCoder to start or resume the implementation session for this PR with the issue
   ID, the PR URL and these execution instructions only:

   ```text
   Independent verification was requested on <PR URL>. Watch that PR for review comments
   from the verification session's GitHub identity. For each comment: fix it and push to
   the PR branch, or reply on the comment thread explaining why no change is needed.
   Do not merge.

   WF-RUN
   issue: <ISSUE-ID>
   launch_attempt: <launch attempt ID>
   tracker_updates: <enabled | disabled>
   transitions: Code Review -> In Progress; In Progress -> Code Review
   ```

   Fill `WF-RUN` per [worker signals](../orchestration/references/worker-signals.md#launch-block).
   The watcher has **no login filter**: the verifier may post as the PR author identity,
   which GitHub shows as COMMENTED, so the verdict is read from the review body. It takes
   a fresh baseline of existing review IDs at start and **holds every push or rebase while
   a 06B is bound to the head**, until that review is published (`bound.json` gate, see
   [review-gate scripts](../orchestration/scripts/README.md#06b-review-gate)).

A new PR head means a new run of step 1: a verdict is tied to the head it reviewed. There
is **no automatic second 06B**: only WFTasks or WFReview hands over another 06B, on a new
head.

Report: model actually used, workspace and session/terminal IDs, whether the `CLAUDE.md`
fallback was used, then the review URL, findings with severity and the bound head.

## Boundaries

- This skill does not read, judge or summarize the verification.
- A usage or rate limit is never a HOLD and never a reason to downgrade to 06A; use the
  next model in the chain.
- Missing GitHub or Superset access or a missing grant: record both intended actions and
  stop. Nothing is launched.
