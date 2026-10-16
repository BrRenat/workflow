# Repository instructions

## Approved workflow diagram

The approved workflow is documented in [orchestration/PIPELINE.md](orchestration/PIPELINE.md)
and preserved in `orchestration/assets/workflow.svg` and `.png`.

**Do not change the diagram unless the user explicitly asks to change the diagram.**
This includes its wording, numbering, arrows, grouping, layout, colors and dimensions,
and regeneration, redraws, replacement or conversion that changes the committed files.
An instruction to edit code, documentation, skills or workflow policy does not implicitly
authorize a diagram change. Do not silently change it to match another instruction.
If a requested workflow change conflicts with it, identify the discrepancy and leave
the diagram intact until the user explicitly requests a diagram update.

Keep Jev, orchestration, the agent skills (`coding-session/`, `deep-verify/`) and the
presentation consistent with the approved workflow. Ticket AC remain the sole source of
truth for product acceptance; the workflow diagram defines process, not ticket requirements.

Keep controller skills (`jev/`, `orchestration/` and the step skills) out of coding agents;
coding and review sessions load only `coding-session/` and `deep-verify/`. Preserve shadow
mode and disabled action grants in example policies; documentation changes do not enable
live automation. Implementation verification is allowed; independent code review must
be started and controlled externally, never by the implementation session or its child.

Keep this repository project-agnostic: no company, product, people, internal hosts,
real ticket data or credentials. Use placeholders such as `example-org`, `PRJ-*` and
`example.com`, and roles (workflow owner, product owner, QA engineer) instead of names.

## Grok Bot fleet

Fleet roles (WFTasks, WFJev, WFReview, WFCoder, WFRelease) are documented in
[orchestration/references/bot-roster.md](orchestration/references/bot-roster.md).
**Only WFJev** runs the `jev` skill / TypeSafe Jev call; other bots message WFJev with
evidence, preset and reply-to, and consume the structured disposition.

## Checks

- `node --test jev/tests/*.test.mjs`
- `node --test coding-session/tests/*.test.mjs`
- `cd orchestration/presentation && npm test` (or `npm run test:data` without a browser)

After editing any file listed in `orchestration/presentation/data/rules.js`
(`sourceFiles`), regenerate the embedded copies with
`node orchestration/presentation/scripts/build-sources.mjs`.
