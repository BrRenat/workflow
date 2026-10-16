---
name: deep-verify
description: >-
  Use only in a separate, externally started verification session for step 06B, never
  in the session that implemented the change. Verifies a pull request's behavior, side
  effects and ticket acceptance: maps AC to scenarios, tests and code, runs the change,
  checks test strength, searches for counterexamples and publishes a per-AC verdict as
  a GitHub review.
---

# Deep verify (step 06B)

## Independent verification only

Use this skill only in a separate verification session started and controlled
externally (the Grok Bot [independent-review](../independent-review/SKILL.md) skill or a human). If this session
implemented the change, or an implementation-session parent requested self-review, stop
and report that independent verification must be scheduled externally. Do not edit
committed code, launch an implementation agent, run a review/fix loop, or merge.

Read *Task sources and review* in the [coding-session skill](../coding-session/SKILL.md)
and the project's `CLAUDE.md` / `AGENTS.md` before starting. This is not a diff review: a clean diff proves nothing here. The question is
whether the change **behaves** as the ticket requires, what else it affects, and whether
the tests would notice if it did not.

**Input:** the PR number or URL from the caller (`123`, `#123` or a GitHub PR URL; `$PR`
below), and the tracker issue ID when the PR does not reference its issue.

---

## Step 1: Sources

1. **PR.** `gh pr view $PR --json number,title,body,url,headRefName,headRefOid,baseRefName`
   and `gh pr diff $PR`. Record the head SHA: every result you publish is tied to it.
2. **Tracker issue.** Take the identifier from the caller, or an explicit reference in the PR
   body, branch or commits. Read the exact issue through **the tracker integration**:
   description, **acceptance criteria**, relevant comments, latest QA return and relations.
   If the tracker integration is unavailable or the issue cannot be read, stop and report
   the blocker. If the issue has no explicit AC, stop and report `NEEDS_CLARIFICATION` to
   the ticket owner; never infer AC from the title, the code or the tests.
3. **Design.** If the issue or PR links a design file or frame, read it through
   **the design integration**. Access failure stops the task; screenshots do not replace
   this check.
4. **Attachments.** Analyze images only. Skip videos and say so in the report.
5. **Implementation report / Verification Plan**, if present in the PR description
   or ticket comments. Treat it as the implementer's claims, not evidence.
6. **CI.** `gh pr checks $PR`. Record required checks with pending, failed, skipped and
   missing kept distinct. Failed or pending required checks make the outcome `blocked`
   unless the caller explicitly asked to verify anyway.

Label everything as one of: observed by you, produced by CI, claimed by the implementer.

---

## Step 2: Verification matrix

Index the AC as `AC-1`, `AC-2`, … without rewriting their text. For each AC find:

- planned scenarios (from the plan, if any);
- the tests that claim to prove it, located by reading test source, not test names;
- the exact assertions;
- the implementation code paths that produce the behavior.

Check both directions: every AC has meaningful checks, and every test presented as
acceptance evidence follows from an existing AC. A test asserting an expectation the
implementer invented does not count for any AC.

---

## Step 3: Run and observe

Check out the PR head locally (a worktree is fine). Then:

1. Run the tests linked to each AC and any suite the change touches. Keep actual output.
2. Run the feature where feasible, following the project's `CLAUDE.md` run instructions:
   for a bug, reproduce the failure on the base branch and confirm the fix on the head;
   for a feature, exercise each AC scenario yourself.
3. Cover boundary and negative cases, error paths, state after reload/restart or
   re-navigation, and timing/concurrency where the behavior depends on it.
4. Check relevant contracts: API/SDK/event shapes, and correspondence to the linked designs.

What you could not run is a gap, never a pass.

---

## Step 4: Side effects

Look beyond the AC at everything the diff touches:

- other callers of changed functions, components, hooks, endpoints or shared modules;
- API, schema, event or SDK contract changes and their compatibility for consumers;
- persisted data, migrations, defaults and reversibility;
- configuration, environment variables, feature flags and their defaults;
- performance: extra requests, N+1 queries, render loops, bundle size for shipped client code;
- security: auth/permission paths, input handling, secrets, PII in logs;
- platform compatibility the project declares (browser, OS, device and runtime versions);
- tests removed, skipped or weakened; unrelated changes riding in the diff.

Report each as observed or as not checked. Do not guess.

---

## Step 5: Test strength and counterexamples

For every AC-linked test ask: **if the implementation violated this AC, would this test
fail?** Inspect the assertion. Where useful, apply a targeted mutation locally: break the
behavior, run the test, expect a failure, then restore the file. Never commit or push a
mutation. `expect(component).toBeDefined()`, snapshot-only or always-true assertions are
findings, not evidence.

Search independently for counterexamples: inputs, boundaries, states and interactions the
plan omitted. Record every case you tried and its outcome. A finite search is not a proof;
say what remains unexplored.

---

## Step 6: Verdict

Per AC:

- **VERIFIED** — planned checks, implementation evidence and your own execution support
  it, and no counterexample or evidence gap is unresolved.
- **FAILED** — you observed a violation or found a counterexample.
- **UNVERIFIED** — a required scenario could not run, evidence is missing, or a gap remains.

Overall result:

- `pass` — every AC VERIFIED and no blocking side effect;
- `changes_requested` — any AC FAILED, a blocking side effect, or an UNVERIFIED AC the
  implementer can resolve with code or evidence;
- `blocked` — sources, CI or the environment prevented verification; name exactly what.

Return per-AC VERIFIED / FAILED / UNVERIFIED with scenarios, assertions, current-head
results, meaningful violations detected, counterexamples and gaps.

---

## Step 7: Publish as a GitHub review

1. One inline comment per finding on the relevant line: what was observed, how to
   reproduce it, which AC or side effect it concerns, and what evidence would resolve it.
2. One review body containing:
   - head SHA, base, tracker issue and its revision/updated time;
   - the matrix: `AC | source | scenarios / tests | observed result | test strength | counterexamples / gaps | verdict`;
   - side effects checked, with observed / not checked;
   - skipped videos, unreadable sources and anything not run;
   - the overall result.
3. Submit with `gh pr review $PR`: `--request-changes` for `changes_requested`,
   `--comment` for `pass` and `blocked`. Do not approve: approval and merge authority stay
   with humans and branch protection. A pass here leads to QA Develop, not to a merge.

---

## Step 8: External handoff

Report the result and the review link to the caller. Fixes belong to a separate
implementation session scheduled externally; a new head needs a fresh verification.
Do not offer or perform fixes here.

---

## Rules

- Read-only for the repository: revert every local mutation before finishing; never
  commit, push, merge, approve or change PR settings.
- Never invent, expand or improve AC. Missing intent goes to the ticket owner as
  `NEEDS_CLARIFICATION`; the human updates the ticket.
- Keep observed facts, CI output and implementer claims labeled and separate.
- Every verdict is tied to the head SHA and issue revision you recorded. A new head or a
  changed ticket invalidates it.
