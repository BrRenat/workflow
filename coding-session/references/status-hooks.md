# Grok bot status hooks

One shared script posts lifecycle observations from Claude, Codex and Grok to the
Grok Bot webhook. Superset runs the agent; the repository configures its internal
planning, implementation and verification workflow (step 04).

## Configuration

Set `WF_GROK_BOT_HOOK` (POST URL) and `WF_GROK_BOT_TOKEN` (bearer token) in the session
environment. Neither belongs in Git. If either is absent, the script exits silently.
Node is preferred; Python 3 is the JSON-safe fallback for native repositories. With
neither available, the script reports a diagnostic and posts nothing.

Runtime configs set `WF_HOOK_RUNTIME` to claude, codex or grok. Dispatch supplies:

- `WF_HOOK_EXPECTED_RUNTIME`: runtime recorded for this launch.
- `WF_HOOK_TERMINAL_ID`: Superset host terminal identity.
- `WF_HOOK_LAUNCH_ATTEMPT_ID`: durable controller launch attempt.
- `WF_HOOK_SESSION_ID`: optional native agent session fallback, if known.
- `WF_HOOK_EXPECTED_SESSION_ID`: optional known native agent identity to enforce.

Host terminal IDs and native agent session IDs are different identities. Do not put
one in the other's field. Unknown identities stay null; bind them through confirmed
host session data. Sender-side mismatch filtering is defense in depth: the receiver
must compare the full binding to its launch record, including nested/foreign harnesses.

## Payload v2

```json
{
  "schemaVersion": 2,
  "ticket": "PRJ-123",
  "repo": "{{REPO_NAME}}",
  "repoFullName": "{{REPO_SLUG}}",
  "branch": "feat/prj-123-thing",
  "status": "finished",
  "message": "short observation, at most 500 characters",
  "pr": "https://github.com/{{REPO_SLUG}}/pull/1",
  "eventId": "unique-poster-invocation-id",
  "sourceEventId": null,
  "rawEventType": "Stop",
  "eventType": "turn_stopped",
  "runtime": "claude",
  "sessionId": "native-agent-session",
  "terminalId": "host-terminal",
  "launchAttemptId": "controller-launch-attempt",
  "observedAt": "2026-09-25T13:00:00.000Z",
  "headSha": "candidate-commit-sha",
  "completionVerified": false
}
```

The original status fields remain compatible. `finished` means completion candidate,
never verified completion. `pr` is optional; missing ticket detection produces an
empty string. The receiver must not infer an issue or grant from an empty field.
Ticket detection uses branch first, then last commit subject, and skips tokens like
utf-8 or node-20. Both serializers preserve JSON escaping and the same field meanings.

## Events

| Raw event | Event type | Legacy status |
| --- | --- | --- |
| SessionStart | session_started | working |
| UserPromptSubmit | prompt_submitted | working |
| Notification | notification | blocked |
| PermissionRequest (Codex config) | permission_requested | blocked |
| Stop | turn_stopped | finished |
| SessionEnd | session_ended | finished |
| PreToolUse / PostToolUse / PostToolUseFailure | dropped | no post |
| SubagentStop | dropped | no post |

The runtime's original `rawEventType` takes precedence over a normalized host event.
Unknown events, malformed JSON, mismatched runtime/session/terminal identities and
invalid manual statuses produce no post. Tool and child hooks are not installed.

Manual reports do not read stdin or hang waiting for terminal input:

```bash
bash scripts/grok-bot-hook.sh blocked "ticket unreadable"
bash scripts/grok-bot-hook.sh failed "tests red"
bash scripts/grok-bot-hook.sh stuck "waiting on CI infrastructure"
```

Orchestrated runs whose `WF-RUN` block enables tracker updates add one signal per
delegated transition (see the coding-session skill → `Orchestrated runs and tracker updates`):

```bash
bash scripts/grok-bot-hook.sh started "moved to In Progress"
bash scripts/grok-bot-hook.sh ready_for_review "checks green, evidence posted"
bash scripts/grok-bot-hook.sh review_rework "fixing 2 review comments"
bash scripts/grok-bot-hook.sh needs_clarification "AC 3 has no expected result"
```

They post as `eventType: manual_status` with `completionVerified: false`, like every
other event. `ready_for_review` has a local gate: a clean tree, `HEAD` equal to the pushed
upstream and, when `gh` is installed, an open PR. A failed gate prints the reason to
stderr, exits 2 and posts nothing. The receiver still verifies required checks and
evidence on the reported head before accepting the move.

## Receiver responsibilities

Deduplicate redelivery by eventId and native sourceEventId scoped to session/runtime/
launch when present. Different Start or Stop event types remain distinct observations.
Coalesce them at the workflow level: never launch twice or request review twice for
the same implementation result. Tool activity never advances the workflow.

On Stop/SessionEnd, reconcile host activity, issue, current PR/head, required CI and
completion evidence before step 05. A newer prompt or commit invalidates stale
completion. Notifications require inspection, not automatic human approval. Missing
identity, ambiguous ordering and foreign harness events cannot advance the task.

Calls have bounded timeouts and delivery is best effort. The controller must reconcile
missed events through host/PR reads. The poster does not implement a durable receiver,
CI verification or workflow transitions. The same receiver contract applies to host
notify.sh events; this repository does not own that external script.

## Install in a repository

Files in this skill folder, and where they go in the project:

| Skill file | Project file |
| --- | --- |
| `scripts/grok-bot-hook.sh` | `scripts/grok-bot-hook.sh` (copy verbatim, `chmod +x`): the only HTTP writer |
| `hooks/claude-settings-hooks.json` | merge its `hooks` block into `.claude/settings.json` |
| `hooks/codex-hooks.json` | `.codex/hooks.json` (merge if it exists) |
| `hooks/grok-hooks.json` | `.grok/hooks/grok-bot.json` (merge if it exists) |

- The script takes no project-specific substitutions: ticket, repo and branch are read
  at run time.
- When merging, preserve every existing setting and unrelated hook. If an event already
  calls `scripts/grok-bot-hook.sh`, update that entry instead of adding a duplicate.
  Install only the events listed above; never tool or subagent hooks.
- For Claude Code, allow `Bash(scripts/grok-bot-hook.sh:*)` and
  `Bash(bash scripts/grok-bot-hook.sh:*)` in `permissions.allow`.
- Check it: `bash -n scripts/grok-bot-hook.sh`, then confirm it is a silent no-op without
  credentials:

  ```bash
  echo '{"hook_event_name":"SessionStart"}' | WF_GROK_BOT_HOOK= WF_GROK_BOT_TOKEN= bash scripts/grok-bot-hook.sh
  ```

- Set `WF_GROK_BOT_HOOK` and `WF_GROK_BOT_TOKEN` in the session environment or a secret
  store, never in Git.

Do not duplicate this contract in `CLAUDE.md`; hooks fire from runtime configuration.
`tests/grok-bot-hook.test.mjs` covers the script and the three hook configs.
