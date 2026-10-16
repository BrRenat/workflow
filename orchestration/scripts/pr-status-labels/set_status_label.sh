#!/usr/bin/env bash
# Usage: set_status_label.sh <repo> <pr_number> "<ticket status name>"
#   e.g. GH_OWNER=example-org set_status_label.sh web-app 101 "QA Develop"
# Ensures exactly one `status: <status>` label on $GH_OWNER/<repo>#<pr>.
# Env: GH_OWNER (GitHub org/user that owns the repos). Requires a logged-in `gh`.
# Only touches labels whose name starts with "status: ". Uses gh REST (per-label add/remove)
# so stand labels (stagingN) and others are never overwritten.
set -euo pipefail
OWNER="${GH_OWNER:?set GH_OWNER (GitHub org/user that owns the repos)}"
REPO="$1"; PR="$2"; STATUS="$3"
DIR="$(cd "$(dirname "$0")" && pwd)"
LABEL="status: $STATUS"
COLOR=$(awk -F'\t' -v s="$STATUS" '$1==s{print $2}' "$DIR/palette.tsv")
[ -n "$COLOR" ] || { echo "unknown status '$STATUS' (add it to palette.tsv)" >&2; exit 2; }
enc() { jq -rn --arg s "$1" '$s|@uri'; }

# skip closed/merged PRs
STATE=$(gh api "repos/$OWNER/$REPO/pulls/$PR" --jq .state)
[ "$STATE" = "open" ] || { echo "skip $REPO#$PR: state=$STATE"; exit 0; }

# ensure label exists in repo (create, or fix color)
if gh api "repos/$OWNER/$REPO/labels/$(enc "$LABEL")" >/dev/null 2>&1; then
  gh api -X PATCH "repos/$OWNER/$REPO/labels/$(enc "$LABEL")" -f color="$COLOR" >/dev/null
else
  gh api -X POST "repos/$OWNER/$REPO/labels" -f name="$LABEL" -f color="$COLOR" \
     -f description="Ticket status of the linked tracker issue (auto-synced)" >/dev/null
fi

# remove other status:* labels
CUR=$(gh api "repos/$OWNER/$REPO/issues/$PR/labels" --jq '.[].name')
while IFS= read -r l; do
  [ -z "$l" ] && continue
  if [[ "$l" == "status: "* && "$l" != "$LABEL" ]]; then
    gh api -X DELETE "repos/$OWNER/$REPO/issues/$PR/labels/$(enc "$l")" >/dev/null
    echo "removed '$l' from $REPO#$PR"
  fi
done <<< "$CUR"

# add target label (idempotent)
if ! grep -qxF "$LABEL" <<< "$CUR"; then
  gh api -X POST "repos/$OWNER/$REPO/issues/$PR/labels" -f "labels[]=$LABEL" >/dev/null
  echo "added '$LABEL' to $REPO#$PR"
else
  echo "ok '$LABEL' already on $REPO#$PR"
fi
gh api "repos/$OWNER/$REPO/issues/$PR/labels" --jq '"labels now: " + ([.[].name]|join(", "))'
