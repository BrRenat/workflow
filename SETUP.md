# Set up the workflow

This repository contains versioned skills, decision policies, question sets, helper scripts
and a static presentation. Install the full orchestration in an existing Grok Bot controller,
then either verify the workflow step by step or run it autonomously once it is ready.

## Explore without installing anything

Open `orchestration/presentation/index.html` in your browser. The walkthrough uses the
fictional WEB-123 ticket; it does not execute agents, call Jev or change any external system.
It works from `file://` and needs no API keys or build step.

## Install the full orchestration

### Bring the required services

| Component | Required setup |
| --- | --- |
| [Grok Bot](https://x.ai/bot) | An existing controller deployment with bot messaging, read access to this repository and access to the tracker, GitHub, Superset and worker events. Its application, hosting and installation are external to this repository. |
| [Superset](https://superset.sh/) | A working host, the target project, and at least one configured coding agent. Verify that your controller can launch and observe a session. |
| Tracker and GitHub | Authorized integrations, exact team/status/repository IDs and access to issues, PR heads, reviews and CI results. |
| [TypeSafe Jev](https://docs.typesafe.ai/) | API access for WFJev. Supply `TYPESAFE_API_KEY` through its environment or secret store. |
| QA and delivery | Named QA/release owners, required checks, and mappings to the actual build, stand, staging and production artifacts. |

There is no all-in-one runtime installer in this repository. The controller must implement
the [controller contract](orchestration/references/controller.md) and
[worker signal handling](orchestration/references/worker-signals.md). The hook sender alone
does not supply a durable receiver, scheduler or verified workflow transitions.

### Scaffold the Grok Bot fleet

Open the Grok Bot **general chat** and define this repository as the workflow source:
`https://github.com/BrRenat/workflow`, or your fork or pinned branch. Give it the whole
repository, not individual skill files, so relative references resolve. Then send:

```text
Scaffold workflow, create required bots and assign roles.
```

Grok Bot scaffolds the workflow from the repository, creates the fleet bots and assigns
their roles:

| Bot | Responsibility and source |
| --- | --- |
| WFTasks | Intake, source evidence and coordination: [orchestration](orchestration/SKILL.md). |
| WFJev | The only bot that loads [jev](jev/SKILL.md) and invokes TypeSafe Jev. |
| WFReview | External review dispatch: [codex-review](codex-review/SKILL.md) and [independent-review](independent-review/SKILL.md). |
| WFCoder | Launches implementation/rework in Superset; the coding session loads [coding-session](coding-session/SKILL.md). |
| WFRelease | Staging and production evidence and actions: [staging-decision](staging-decision/SKILL.md) and [release-decision](release-decision/SKILL.md). |

Use [qa-develop](qa-develop/SKILL.md) for the reviewed-build QA handoff and
[stand-take-to-work](stand-take-to-work/SKILL.md) when your project uses a fixed QA-stand pool.
See the [bot roster](orchestration/references/bot-roster.md) for ownership boundaries.
Only the separate verification session loads `deep-verify`.

Before continuing, check the result in Grok Bot: exactly these five bots exist, only WFJev
has the `jev` skill, and no controller bot loads `coding-session` or `deep-verify`. Then
configure the local policy copies below and keep every action disabled for the pilot.

### Configure local policy copies

From the workflow repository root, create the following copies **only if they do not
already exist**:

```sh
test -e orchestration/policy.json || cp orchestration/policy.example.json orchestration/policy.json
test -e jev/policy.json || cp jev/policy.example.json jev/policy.json
```

These local files are ignored by Git. Keep credentials in the environment or a secret store.

In `orchestration/policy.json`, set `decision_policy_path` to `../jev/policy.json`.
In `jev/policy.json`, set `workflow_policy_path` to `../orchestration/policy.json`.
Point the controller at these local files; do not silently load the committed examples
as an active configuration.

Fill in your actual environment mappings:

- Tracker team, state IDs, issue scope and product/QA/release identities.
- Label-to-repository ownership map.
- Verified model runtime IDs, capabilities, quotas and available worker capacity.
- Required CI checks, review identities and the review route you support.
- QA handoff, stand/build identification, staging and release pipeline/artifact mappings.

Keep `mode: "shadow"`, calibration approvals false and action grants disabled for the first
pilot. The committed per-step policies in `jev/policies/` also remain unchanged. A live
integration must explicitly resolve the policy for each step and validate its permissions
and calibration; changing a single mode flag is not a complete setup.

### Install worker skills and status hooks

Superset worker sessions load only the two agent skills. In each target project, install
the `coding-session/` and `deep-verify/` folders in the coding runtime's documented skills
directory; Claude Code uses `.claude/skills/<name>/`. Preserve existing skills and settings
when installing or updating. Copying the two folders does not copy sibling controller
documentation, so keep the workflow repository available for linked process references.
Keep controller skills out of coding agents. Implementation sessions load `coding-session`;
only the separate 06B verification session loads `deep-verify`.

The exact event mapping and receiver contract are in
[coding-session/references/status-hooks.md](coding-session/references/status-hooks.md).

| Source in this repository | Destination in the target project |
| --- | --- |
| `coding-session/scripts/grok-bot-hook.sh` | `scripts/grok-bot-hook.sh` |
| `coding-session/hooks/claude-settings-hooks.json` | Merge its `hooks` block into `.claude/settings.json`. |
| `coding-session/hooks/codex-hooks.json` | Merge into `.codex/hooks.json`. |
| `coding-session/hooks/grok-hooks.json` | Merge into `.grok/hooks/grok-bot.json`. |

Install only the runtime configs you use. Preserve unrelated settings and hooks; avoid
duplicate entries. Make the script executable and perform the syntax/no-credentials checks
from the linked guide.

Configure `WF_GROK_BOT_HOOK` (your receiver's POST URL) and `WF_GROK_BOT_TOKEN` in worker
session environments. The controller supplies the launch/runtime/terminal identity bindings
documented in the hook guide. Without either credential, the sender posts nothing.

Worker completion events are candidates for inspection. The controller must reconcile
them against the current session, PR head, CI and evidence before advancing the task.

### Run one shadow pilot

1. Select a small ticket with explicit, testable, human-owned acceptance criteria.
2. Confirm WFTasks can read the ticket and prepare sourced evidence.
3. Confirm WFJev returns a real structured decision and a specific reason for any hold.
4. Inspect the proposed route and worker eligibility. Shadow mode must not launch work,
   move the issue, merge or deploy automatically.
5. Resolve missing mappings or integrations. Calibrate against the documented
   [evaluation cases](jev/references/evaluation-cases.md) before enabling any live action.

## Choose how it runs

Both modes start from a passing shadow pilot and change only your local `policy.json`
copies. The committed example policies stay in shadow mode with every grant disabled.
Automation requires both live policies in active mode, the calibrated Jev lane for the
step, resolved mappings and the grant for each action
([controller contract](orchestration/references/controller.md#configuration-and-authority)).

### Step by step

Enable one step at a time. Approve the calibration for the Jev lane it uses, grant only
that step's actions in `authorized_actions` (for example `promote_to_in_progress` and
`start_implementation` for 03) and keep the rest disabled. Check each decision, action and
observed side effect against its evidence on real tickets before enabling the next step.
Steps without a grant stay recommendations that a person carries out.

### Full autonomy

When every lane is calibrated and each step has passed verification, grant every action,
including `merge`, `deploy_production` and `mark_done`. The controller then runs a ticket
from intake to verified production delivery without asking. People are involved only
where the workflow names them:

- the ticket owner, when acceptance criteria are missing, unclear or not verifiable (02);
- human decisions identified during review routing (05);
- QA on the reviewed build (07, QA Develop) and on the staged build (11, QA Staging);
- the production release owner, for a human-reserved risk class or a named decision (13);
- QA, product or platform owners, when a QA return lacks details or needs a decision (17).

Every gate still applies: Jev decisions, required CI, the routed review (06A/06B), the
staging and production release decisions (09, 13) and the grant for each action. A
favorable score is never a permission. Withdraw a grant, or return a policy to shadow
mode, to hand a step back to people.

The controller's [standing operator rules](orchestration/SKILL.md#live-configuration-and-standing-rules)
follow the same grants: it runs every granted step without asking and stops at an
ungranted one with a recommendation and its owner.

## Check the repository

```sh
node --test jev/tests/*.test.mjs
node --test coding-session/tests/*.test.mjs
cd orchestration/presentation
npm run test:data
```

For the existing browser interaction suite, install the presentation's development
dependencies and an available Playwright Chromium runtime, then run `npm test`.
See [presentation setup](orchestration/presentation/README.md).

## Share the presentation

Host `orchestration/presentation/` as static files. The landing page and walkthrough need
no backend. Before announcing it, merge the intended version, make the repository accessible
to your audience, and configure the social metadata for the final public page URL using
the [publishing instructions](orchestration/presentation/README.md#social-preview-and-publishing).

For a short demo, use the WEB-123 walkthrough: readiness → implementation → green CI →
independent findings → rework → QA. Label recordings of this example as illustrative.
