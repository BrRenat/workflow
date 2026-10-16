#!/bin/bash
# Hold implementation pushes while a 06B is bound to the head: wait until bound.json exists
# (written when the 06B review is published on the bound head; see bound.example.json).
# usage: bound-gate-poll.sh <owner/repo> <pr> <path/to/bound.json> [interval_s]
REPO=$1; PR=$2; BOUND=$3; INT=${4:-180}
while true; do
  h=$(gh api repos/$REPO/pulls/$PR --jq .head.sha 2>/dev/null)
  if [ -f "$BOUND" ]; then b=yes; else b=no; fi
  echo "$(date +%H:%M:%S) bound=$b head=$h"
  [ "$b" = yes ] && { echo BOUND_FOUND; cat "$BOUND"; break; }
  sleep "$INT"
done
