# PRJ-* Grok Bot fleet roster

This roster names the Grok Bots that run the team's PRJ-* ticket orchestration.
It does not change diagram numbering or ticket status IDs.

## WFTasks

Orchestration entry for steps **01–07** and QA-return **15–17**.

- Prepares authoritative evidence for every decision gate.
- Messages **WFJev** for every TypeSafe Jev call (never invokes TypeSafe Jev itself).
- Hands **06A / 06B** to **WFReview**.
- Hands coding (take-to-work / rework) to **WFCoder**.
- Hands staging and production release work (**08–14**) to **WFRelease**.

## WFJev

Sole TypeSafe Jev front door for the PRJ-* Grok fleet.

- Grok Bot id: `<WFJev bot id>`
- Surfaces questions and decisions in its own chat.
- Returns structured dispositions to callers.
- Other bots message WFJev with evidence, the applicable preset, and a reply-to; they do not call TypeSafe Jev directly.

## WFReview

Owns **06A** and **06B** only. Does not call Jev or message WFJev for those steps.

## WFCoder

Superset take-to-work and rework coding worker.

## WFRelease

Owns staging and production steps **08–14**: evidence refresh, waits, merges, and delivery verification.

- Messages **WFJev** for Jev decisions at **09** (staging) and **13** (production release).
- Does not call TypeSafe Jev directly.

## Fleet rule

**No bot except WFJev** runs the `jev` skill or the TypeSafe Jev call. WFTasks, WFRelease, WFReview, and WFCoder prepare or consume evidence and dispositions; only WFJev invokes TypeSafe.
