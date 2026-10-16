# Controller helper scripts (PRJ-*)

Reference implementations used by WFTasks and WFCoder, deduplicated
and parameterized. No secrets: GitHub calls use the logged-in `gh`. Ticket, PR and path values are
arguments, env vars or a config file, never hard-coded.

Common environment: `GH_OWNER` (GitHub org for the label sync). Scripts stop with a
message when a required variable is missing.

| Folder | Purpose |
| --- | --- |
| `review-gate/` | 06B binding: wait for the 06B review on the bound head before any push. |
| `pr-status-labels/` | Keep exactly one `status: <Status>` label on each open PRJ-* PR. |

## e2e queue (shared-stand repo)

No queue runner ships here: triggering and reading e2e runs depends on the team's CI. A
shared-stand repo (e.g. web-app) runs e2e through its own CI-specific queue runner, which
must follow these rules:

- Run e2e one run at a time through **exactly one** queue runner. Never run e2e in
  parallel and never start a second runner.
- Never cancel a running run. Rerun stopped runs (bounded retries); a stopped run is not a failure.
- Start a PR's e2e only after push CI passed on the live PR head and the PR's stand serves
  that head.
- Re-queue a PR whose head moved; a result for an older head does not count.
- Report each green result immediately and individually, with per-test evidence bound to
  the head SHA for the PR body.

## 06B review gate

- `poll-06b-review.sh <owner/repo> <pr> <bound_head> <baseline_review_id> [dir] [timeout_s]`:
  wait for a new review whose `commit_id` is the bound head. No login filter: the verifier
  may post as the PR author identity (shown as COMMENTED; the verdict is in the body).
- `bound-gate-poll.sh <owner/repo> <pr> <bound.json>`: implementation watchers hold pushes until
  `bound.json` (head, review_url, review_id, review_state, ts) exists. See `bound.example.json`.

## PR status labels

`pr-status-labels/set_status_label.sh <repo> <pr> "<ticket status>"`; see its README.
Tracker state IDs go in `statuses.tsv` (placeholders; fill in your team's IDs). In the tracker
integration's update call, set the state by status **name** (e.g. "QA Develop") and the
assignee by display **name** (e.g. the QA engineer's display name).
