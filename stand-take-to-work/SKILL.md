---
name: stand-take-to-work
description: >-
  Use when taking a ticket to work on a project that has a fixed pool of stands
  (any size) identified by open PR head branches prefixed stagingN/ (or
  standN/), including queueing when all stands are busy, draining the queue when
  a stand frees, and moving off-stand PRs onto free stands.
---
# Stand-pool take-to-work (PR-prefix stands)

Use when a project has a fixed pool of QA/test stands, each identified by an open PR whose head branch is prefixed `standN/` (e.g. `staging1/TICKET-123`), and new coding work must not exceed that pool. The pool size comes from memory / the caller.

## Example pool configuration

The real pool and its rules come from memory / the caller; this example shows the shape for one shared-stand repo and one per-branch-stand repo.

- `example-org/web-app` (shared stands): **K stands**, `staging1` … `stagingK` (branch `stagingN/<PRJ-ID>`). Each stand deploys to `stand-N.example.com`, which serves `stagingN_<branch>-<sha7>`; confirm it after every push or rebase.
- `example-org/api` (per-branch stands): no pool. Every branch gets its own preview stand at `https://preview.example.com/<sha7>/`; never queue or HOLD on stands there.
- PRJ-* handoffs from WFTasks under the standing autonomy (the live grants) authorize direct launch onto the lowest free stand; no extra confirm.
- Updating a stand PR: rebase onto staging and push with `--force-with-lease` after its 06B and before QA or merge. **Never merge staging in.** Never push or rebase while a 06B is bound to the head. After the rebase: push CI, then e2e through the single queue; report the new head and a `git range-diff`.
- Moving a PR to a stand: new PR from `stagingN/<ID>` at the same head with the stand label, close the old PR with a link to the new one, and add a comment on the ticket naming the new stand and PR (comment only, no status change).

## Stands

1. Take the stand list from memory / the caller (e.g. `staging1` … `stagingK`). Do not assume a size; if unknown, ask.
2. A stand is **busy** if there is at least one **open** PR on the project repo whose `headRefName` starts with that stand’s prefix plus `/` (e.g. `staging1/`).
3. A stand is **free** when no open PR uses that prefix. Old branches with that prefix and no open PR do not make it busy.
4. Never run more concurrent take-to-work sessions for that project than there are stands.

## On a new ticket

1. List open PRs on the project repo; compute busy vs free stands.
2. Read the ticket title/description via the tracker integration (enough to classify; do not paste the full description or images into chat).
3. Choose the agent/model per the project's current launch rules (from memory / the handoff).
4. If any stand is free: pick the **lowest-numbered** free stand. Propose branch `standN/<TICKET-ID>` (exact casing from project convention), show the usual short brief, and **wait for confirm** before launch unless memory/handoff authorizes direct launch.
5. If all stands are busy: **do not launch**. Append the ticket to the project’s stand queue (id, notes, requested-at). Tell the user (and any ticket bot on the handoff path) that it is queued and which stands are occupied.

## Moving an off-stand PR onto a stand

GitHub cannot change an open PR's head branch, and renaming a branch that is a PR head **closes** that PR. So a move always yields a new PR; approvals, review threads and bot review comments stay on the old one, and CI / stand deploys re-run.

1. Audit read-only first: list open PRs without a stand prefix, decide which are ticket PRs that belong on a stand (skip release/sync, dependabot, infra/CI PRs), and propose oldest-first → lowest-free-stand mapping. Show the user and get a go-ahead (moves close PRs).
2. Prefer the **copy** method: create `standN/<ID>` at the exact current head SHA (verify it matches), open a new PR to the same base with the same title/draft state and the old body plus a top note `Moved to stand standN from #<old> (same head <sha>)`, add the stand label plus the old non-stand labels, then comment on the old PR with a link to the new one and close it. Keep the old branch.
3. Re-check the stand is still free immediately before each move.
4. Report old → new PR numbers and head SHAs to the user and to any ticket/review bots that track PR numbers.

## Queue drain

When a stand may have freed (PR merged/closed, or a manual “check stands” ask):

1. Recompute free stands from open PRs.
2. If the queue is non-empty and a stand is free: dequeue the oldest ticket, assign that free stand, show the brief, wait for confirm (unless authorized), then launch.
3. If still full or queue empty: say so briefly; stay quiet on scheduled/listener runs when nothing changed if the saved prompt says so.

## Launch

Follow the project’s existing take-to-work rules (workspace, base branch, agent/model, tracker integration, no dumping ticket assets into chat). After launch, record stand + ticket + PR link when the PR exists. Tracker state/comment updates follow the project's rules (some pipelines only allow tracker writes the handoff explicitly grants).

## PR stand label

When the stand PR exists (opened by the coding agent, or recreated after a move):

1. Ensure the PR has a label matching the stand name exactly (stand `staging1` → label `staging1`). Create missing stand labels in the same style as existing ones when the pool grows.
2. Add that label; do not remove unrelated labels.
3. If the PR moves to a different stand, keep only the current stand's label among the stand pool labels.
4. Branch prefix remains the source of truth for busy/free; the label is for humans/QA visibility. If label write fails (permissions), note it and continue.

## Do not

- Use a stand number outside the configured pool, or reuse a busy stand’s prefix.
- Auto-launch from the queue without confirmation unless memory explicitly authorizes it.
- Treat a closed/merged PR as still occupying a stand.
- Treat a missing stand label as the stand being free if an open PR still uses that branch prefix.
- Rename a PR head branch without warning that it closes the PR.
