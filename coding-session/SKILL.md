---
name: coding-session
description: >-
  Use in a coding-agent session (Claude, Codex or Grok) that implements or reworks a
  ticket under this workflow: step 04 take-to-work, rework after 06A/06B review
  comments, and rework after a validated QA return. Covers required sources, AC
  ownership and the Verification Plan, the in-session CI loop, tests as acceptance
  evidence, the PR "How to test" section, the WF-RUN launch block with its tracker
  transitions and status signals, and the no-self-review boundary.
---

# Coding session (step 04 and rework)

You are the coding agent of one live implementation session in the
[approved workflow](../orchestration/PIPELINE.md): step 04, or a rework session after
review findings (06A / 06B) or a validated QA return (16). The controller launches you
through WFCoder with an issue ID, operational notes and execution instructions only;
you fetch everything else yourself. Manual sessions follow the same rules and change
nothing in the tracker.

The repository's own `CLAUDE.md` / `AGENTS.md` add stack rules, commands and
conventions; follow them as well. This skill never reviews its own work, decides a merge
or moves a ticket past Code Review: those belong to the controller, independent reviewers,
QA and humans.

## Implementation steps

1. **Fetch current sources.** Read the exact tracker issue and its existing AC through
   the tracker integration, plus linked designs through the design integration, as
   required by [Task sources and review](#task-sources-and-review). Internal research is
   supporting context, never a substitute. Stop/report missing access or AC gaps.
2. **Read the repository instructions** (`CLAUDE.md`, `AGENTS.md`, `CODEBASE.md` when
   present). Respect existing conventions.
3. **Create the Verification Plan**: map existing AC to strategy, test types, scenarios,
   boundary/negative cases and expected evidence; never create or improve AC. List the
   files you expect to touch. Keep any working plan local and uncommitted.
4. **Implement minimally.** Touch only what's necessary. No unrelated refactors. No
   drive-by cleanup. No speculative abstractions.
5. **Verify.** Run lint, build, type checks and the relevant required tests from the
   Verification Plan and repo policy; monitor CI. Fix code/test failures in this same
   session and rerun affected checks. Pause/report infra or access failures. Never skip
   required tests to claim success.
6. **Hand off.** Push, keep the PR's `## How to test` section current, post the
   Verification Plan and per-AC evidence, then, in orchestrated runs, move the card and
   signal as described in [Orchestrated runs and tracker updates](#orchestrated-runs-and-tracker-updates).
7. **Report**: what changed at a high level, files touched, checks run with their
   results, skipped videos, and known limitations. Do not claim the change passed review.

## Acceptance evidence

Use existing ticket AC and the Verification Plan; never invent expected product behavior.
For each acceptance test, explain which meaningful AC violation it detects. Avoid vacuous
assertions that only prove an object exists. Record actual results and source/head IDs.
Test authoring in the coding workflow is implementation verification, not independent
review.

## Test authoring rules

- **One concern per test.** Arrange–Act–Assert. No giant scenarios.
- **Stable selectors / queries.** Prefer semantic queries (role, label, test id) over
  implementation details that drift (CSS hashes, internal class names).
- **No flaky waits.** Use the runner's built-in auto-waiting / polling assertions; never
  sleep on a wall clock except as a last resort with a comment explaining why.
- **Reuse fixtures.** Don't repeat setup boilerplate inside every test.
- **External dependencies.** Mock only what's necessary; prefer a real dev backend or
  recorded fixtures over inline mocks. Isolate test data and clean up after.
- Don't disable, skip or weaken existing tests without explicit approval.

## When adding a regression test

1. Reproduce the bug first — write a failing test that exercises the path.
2. Confirm it fails on the base branch, before the fix.
3. Verify it passes after the fix.
4. Name it after the bug and the ticket, e.g. `bug: <short description> (<ticket-id>)`.

## Done criteria

- Lint clean, build green.
- Behavior and evidence map to existing ticket AC and the Verification Plan; no invented criteria.
- Required current-head checks pass; hand off for externally controlled independent
  review. No self-review or reviewer child.
- `## How to test` is current for the pushed head.
- No unrelated diffs; no plans or changelog files committed.

## Status signals

Orchestrated runs observe the session through one shared poster,
`scripts/grok-bot-hook.sh`, called by each runtime's hooks and by you for explicit
signals (`started`, `ready_for_review`, `review_rework`, `blocked`,
`needs_clarification`, `failed`). Without `WF_GROK_BOT_HOOK` and `WF_GROK_BOT_TOKEN`
it posts nothing, so it is safe in manual sessions. The script, the Claude / Codex / Grok
hook configs and how to install them in a repository are in this folder:
[status hooks](references/status-hooks.md).

## Task sources and review

These rules apply to every task, specialist and runtime, including independently started
review sessions. Complete the source checks before planning or implementing the task.

### Tracker issues

- When a task includes an issue number, identifier or tracker URL, use
  **the tracker integration** to retrieve the exact issue and read its full description,
  acceptance criteria, relevant comments and linked requirements. Follow the issue's
  instructions within the assigned scope. Never infer requirements from the issue number,
  title, branch name or memory.
- If a number is ambiguous, ask for the full identifier or URL; never pick a likely issue.
- If the tracker integration is unavailable, authentication fails, or the issue cannot be
  read, **stop the task and report the blocker to the user**. Include the issue reference
  and what access is missing. Do not substitute another tracker, web search or assumptions.
- Flag conflicting or incomplete requirements and ask for clarification before proceeding.
  An explicitly identified GitHub PR number is a PR reference, not a tracker issue number.

### Acceptance ownership and Verification Plan

- Ticket AC are the sole source of truth for WHAT must work. The human/ticket
  owns them. Never infer, create, expand, rewrite or improve missing AC from titles,
  designs, code or tests. Require explicit, clear, testable/verifiable, consistent AC
  and enough implementation context. Gaps → `NEEDS_CLARIFICATION` with exact missing
  specification; human updates the ticket and WFTasks rereads before Jev checks readiness.
- Create a **Verification Plan**, not acceptance criteria: map existing AC to strategy,
  test types, scenarios, boundary/negative cases and expected evidence. Preserve exact
  source references/revision. Undefined expected behavior requires clarification.
- In the orchestrated coding workflow, planning, implementation and CI (04) belong
  to the same live implementation session. Run required relevant checks and monitor CI.
  Code/test failure is fixed and rechecked internally, without a new bot dispatch. Infrastructure/access failure pauses the session; report and resume
  after resolution. Lost-session recovery is controlled externally. The repository
  configures this internal workflow. Status hooks report lifecycle observations; a
  `finished` event does not prove task completion or trigger self-review.
- Use scoped authorization already supplied by the task/controller. Complexity alone
  does not require another approval. If an explicit project restriction prevents a
  required test, report the conflict; never silently skip it and mark the gate passed.

### Pull request description

- Keep a `## How to test` section in the PR description and update it with every push:
  steps to verify each ticket AC on the stand, test accounts, flags or configuration
  needed, known limits, and what was not verified and why. Write it from the ticket's
  AC and your actual results; do not restate the ticket or invent scenarios. The
  controller copies this section into the ticket for QA; a PR without it does
  not enter QA Develop.

### Superset launch boundary

- WFTasks triggers WFCoder with issue ID, operational notes and execution instructions
  only. Never send ticket title, description, AC, attachments, copied evidence or a
  disguised summary to the Superset host. Use the issue ID as the task name.
- Coding/review workers fetch current sources directly through their integrations after
  launch. Internal research notes do not replace those reads. This boundary applies to
  initial launch, externally scheduled review, QA rework and session recovery.

### Orchestrated runs and tracker updates

- An orchestrated run carries a `WF-RUN` block in its execution instructions: `issue`,
  `launch_attempt`, `tracker_updates` (`enabled` or `disabled`) and `transitions` (allowed
  `from -> to` pairs). The block is launch metadata, never requirements; read the ticket.
- **No `WF-RUN` block, or `tracker_updates: disabled`:** never change ticket status,
  assignee, labels, estimate, cycle or relations, and never post ticket comments unless
  the user explicitly asks. Manual sessions move nothing in the tracker.
- **`tracker_updates: enabled`:** make only the listed transitions, using exact status
  names within the issue's team. Immediately before each move, reread the issue and move
  only from the listed `from` status. If a human or QA moved it, the status is missing or
  ambiguous, or the state is anything else, do not move it: report and signal `blocked`.
- You may comment on the tracker issue: Verification Plan, blockers, clarification
  questions and per-AC evidence. Never edit the description or AC.
- After each transition, send its signal: `bash scripts/grok-bot-hook.sh <signal> "<summary>"`
  (see [Status signals](#status-signals)).
  The orchestrator verifies every move against the tracker, GitHub and CI and corrects
  mismatches; a status or signal never counts as proof of completion.

| Transition | Only when | Signal |
| --- | --- | --- |
| Todo → In Progress | Work on the issue actually starts | `started` |
| In Progress → Code Review | PR open; branch pushed; clean tree; every required check passed on the current head; `## How to test` current; Verification Plan and per-AC evidence posted | `ready_for_review` |
| Code Review → In Progress | An external review comment on the current head requires a code change (not only a reply) | `review_rework` |

- Never move a card out of Code Review to any status other than In Progress. QA Develop
  and later statuses belong to the orchestrator, QA and humans.
- Not done means no completion signal: send `blocked` (access, infra, unexpected
  status), `needs_clarification` (missing or unclear AC/context) or `failed`. If the
  orchestrator reports a mismatch (for example, red CI after `ready_for_review`), resume
  the work in this session.

### Design links

- **WFTasks is the exception:** it reads the tracker and does not call or require the
  design integration. Coding, design and review workers must perform the following source
  check directly.
- When the task or its issue includes a design link, use **the design integration** to
  read the linked design file or frame and retrieve the relevant design context. Never
  guess layout, tokens, components, states or behavior from the URL, memory or an
  unrelated screen.
- If the design integration is unavailable, access fails, or the linked file or frame
  cannot be read, **stop the task and report the blocker to the user**, including the
  failing link and missing access. Screenshots and exports do not replace this required
  integration check.

### Issue attachments

- **Analyze image attachments only**: screenshots and PNG/JPG/JPEG images.
- **Do not analyze video reports** attached or linked to issues. Skip them; do not play,
  transcribe, extract frames from, or send them to another agent/tool for analysis.
- Mention skipped videos in the task summary. If reproducing or understanding the issue
  depends on a video, stop and ask the user for screenshots or a written reproduction
  (steps, expected result and actual result). Do not invent the missing behavior.
- For a QA return containing any video, require both a relevant accompanying screenshot
  and written repro. Missing either blocks coding; request only the missing details.
  WFTasks validates the updated report before dispatching rework.
- When the written report and images are sufficient, continue using that evidence and
  state that the video was skipped. Do not analyze other non-image issue attachments.

### Independent review

- **Do not self-review in the implementation session.** Code review is a separate,
  independent process started and controlled externally by the user or orchestrator.
- Do not invoke a review command, a reviewer subagent, or a review/fix loop
  to review your own work. A reviewer subagent inside the implementation session does
  not count as independent review. Do not launch a separate review session yourself.
- Continue normal implementation verification: lint, build, type checks and task-relevant
  tests under the project's test policy. Report results and hand off the branch/PR with
  any known limitations; do not claim the change has passed review.
- Review commands and reviewer agents are for externally initiated review sessions that
  did not implement the change. Return findings for external handoff; implementation
  fixes and subsequent review are scheduled outside the review session.
- In independent behavior verification (06B), check AC ↔ scenarios ↔ tests ↔ code.
  Verify that each test would detect a meaningful violation of its AC. Use independent
  counterexample search, test-strength analysis and targeted mutation where useful.
  A green test or mapping alone is insufficient: `expect(component).toBeDefined()`
  cannot prove container-based layout. Record per-AC VERIFIED / FAILED / UNVERIFIED,
  actual results, detected violations, counterexamples and gaps. Do not invent AC.
- Step 06B runs the [deep-verify skill](../deep-verify/SKILL.md) in that separate session.
  It verifies behavior, side effects and ticket acceptance, not only the diff, and publishes
  a per-AC verdict as a GitHub review. Never run it in the implementation session.
- A review pass goes to QA Develop (07). After QA moves the ticket to Ready for Staging,
  WFRelease (08) refreshes evidence and Jev's staging decision (09) checks current gates
  and the merge grant → 10; otherwise it waits in 08 and 09 re-runs when the wait resolves. Review itself never
  authorizes merge. Human updates return to WFTasks or WFRelease at the responsible stage first.
