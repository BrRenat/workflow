# Comments / QA-round contract (01–02)

Canonical detail lives in [request-preparation.md](request-preparation.md) and `policies/step-02.json`.

## Step 01 (WFTasks)
- Full ticket comment dump **plus** `comments_summary` (`comments.md` + `comments_summary.md`, or labeled section in `evidence.md`).
- Call out when present: QA Round N / QA return / remaining checklist; staging ready / ready for testing; product owner/spec clarification threads; open product decisions in comments.
- If a QA Round comment lists remaining failures/checklist bullets, those are **authoritative remaining acceptance scope** (cite comment id/author/date). Do not claim "no AC" solely because description AC is thin.

## Step 02 (WFJev)
- Replies (`step02-reply_message.md` / `product-owner-comment-concise.md`) must include **Comments / QA history** citing latest Round/return or "none found".
- HOLD must not say AC unconfirmed when Round comments already enumerate remaining items — ask the product owner only for true gaps.
- `ready_for_develop` should note comment-derived constraints when relevant.
