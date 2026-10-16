#!/bin/bash
# Poll for a new review bound to a specific head (06B result). Any reviewer login counts
# (no login filter: the verifier may post as the PR author identity, which GitHub shows as COMMENTED).
# usage: poll-06b-review.sh <owner/repo> <pr> <bound_head_sha> <baseline_review_id> [workdir] [timeout_s]
REPO=$1; PR=$2; BH=$3; BASE=${4:-0}; cd "${5:-.}"; end=$(( $(date +%s) + ${6:-7200} ))
while [ $(date +%s) -lt $end ]; do
  r=$(gh api repos/$REPO/pulls/$PR/reviews --paginate --jq ".[] | select(.id > $BASE and .commit_id == \"$BH\") | [.id,.user.login,.state,.commit_id,.submitted_at,(.body|length)] | @tsv" 2>/dev/null)
  h=$(gh api repos/$REPO/pulls/$PR --jq .head.sha 2>/dev/null)
  echo "$(date '+%H:%M:%S %Z') head=${h:0:9} new_reviews_on_bound_head:$(echo -n "$r" | grep -c .)" >> poll.log
  if [ -n "$h" ] && [ "$h" != "$BH" ]; then echo "$(date '+%H:%M:%S') HEAD_MOVED $h" >> poll.log; fi
  if [ -n "$r" ]; then echo "$(date '+%H:%M:%S') FOUND" >> poll.log; echo "$r" >> poll.log; echo "$r" > found.tsv; exit 0; fi
  sleep 180
done
echo "$(date '+%H:%M:%S') TIMEOUT" >> poll.log
