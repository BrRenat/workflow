# Ticket status → GitHub PR label sync (PRJ team)

Convention: each open PR linked to a PRJ-* ticket carries exactly ONE label `status: <ticket status name>`.
Only labels starting with `status: ` are ever added/removed. Stand labels (stagingN), `review`, etc. are never touched.

## Working method
- Tracker reads: the team's tracker integration.
  - Team id: `<tracker team id>` (the same value as `tracker_team_id` in the orchestration policy)
  - Read the ticket's status, attachments and description → current status + PR attachments.
- GitHub writes: the controller host's `gh` CLI (logged in as an account with label write access on the target repos) via REST:
  `GH_OWNER=<org> ./set_status_label.sh <repo> <pr> "<Status>"`  — idempotent; skips closed/merged PRs; creates/recolors label; removes other `status: *` labels; adds the target.
- Do NOT use:
  - `gh pr edit --add-label` → fails with GraphQL "Projects (classic) is being deprecated" error (no-op).
  - The GitHub integration's issue-write call → replaces the whole label set AND may only open an interactive user form (does not apply). Its label-create call does work, but isn't needed.
- Repos the `gh` account cannot see (404), e.g. a private `infrastructure` repo, cannot be labelled.

## Mapping issue → PRs (for a single-issue run)
1. PR attachments on the ticket with `github.com/<GH_OWNER>/<repo>/pull/<n>` URLs (closed PRs are skipped by the script).
2. Plus open PRs whose title/branch/body contains the PRJ id:
   `gh search prs --owner "$GH_OWNER" --state open "PRJ-NNN"` (or `gh pr list -R "$GH_OWNER/<repo>" --state open --search PRJ-NNN`).
3. PR whose body mentions several PRJ ids: use the one in title/branch (e.g. web-app#101 → PRJ-123).

## Status ids
See statuses.tsv (fill in your team's tracker state IDs). Palette: palette.tsv.

## Full re-scan
`gh repo list "$GH_OWNER" --no-archived` → `gh pr list --state open` per repo → extract PRJ- refs.
