/*
 * ILLUSTRATIVE WEB WIDGET EXAMPLE + PRESENTATION DECKS.
 *
 * WEB-123 is a made-up ticket used to demonstrate the workflow. Its AC are written as if by
 * the human ticket owner. The example never changes the workflow definition: every step
 * references existing node / edge ids from data/workflow.js (checked by tests).
 */
(function (root) {
  const WF = (root.WFWorkflow = root.WFWorkflow || {});

  WF.example = {
    ticket: {
      id: 'WEB-123',
      title: 'Make the widget responsive to its container rather than browser viewport',
      note: 'Illustrative example — not a real tracker issue. AC are written by the (fictional) ticket owner.',
    },

    /* WHAT — owned by the ticket owner. `rounds` = verdict of each independent review round. */
    acceptanceCriteria: [
      { id: 'AC-1', text: 'The widget renders inside its host container without horizontal overflow at any container width.', rounds: ['VERIFIED', 'VERIFIED'] },
      { id: 'AC-2', text: 'When the container is narrower than 480px the widget uses the compact layout; at 480px or wider, the regular layout.', rounds: ['VERIFIED', 'VERIFIED'] },
      { id: 'AC-3', text: 'Widget layout depends on its container width, not the browser viewport width.', rounds: ['UNVERIFIED', 'VERIFIED'] },
      { id: 'AC-4', text: 'Unmounting the widget releases its container observers; no errors occur after unmount.', rounds: ['FAILED', 'VERIFIED'] },
    ],

    /* HOW — planning inside 04. Scenarios challenge the AC; they are not new AC. */
    plan: {
      'AC-1': { strategy: 'Render in fixed-width containers and measure overflow.', types: ['browser'], scenarios: ['container 320 / 479 / 480 / 1200px → no horizontal overflow'], boundary: ['container at the AC-2 boundary (479 / 480)'], evidence: ['Playwright overflow assertions per width'] },
      'AC-2': { strategy: 'Exercise both sides of the boundary stated in AC-2.', types: ['browser', 'unit', 'visual'], scenarios: ['479px container → compact', '480px container → regular'], boundary: ['479 / 480px', 'fixed container while viewport varies (negative case)'], evidence: ['Playwright data-layout assertions', 'visual snapshots of both layouts'] },
      'AC-3': { strategy: 'Vary container and viewport independently.', types: ['browser', 'visual'], scenarios: ['narrow container / wide viewport', 'wide container / narrow viewport', 'runtime container resize', 'multiple widget instances with different widths'], boundary: ['vary viewport while container width stays fixed'], evidence: ['Playwright browser test', 'visual regression'] },
      'AC-4': { strategy: 'Observe errors and observers across the mount lifecycle.', types: ['browser'], scenarios: ['mount → unmount → resize container', 'repeated mount / unmount'], boundary: ['resize immediately after unmount'], evidence: ['Playwright with console-error capture'] },
    },

    tests: [
      { id: 'T1', round: 1, ac: 'AC-3', name: 'widget-mount.spec › renders the widget', code: 'expect(component).toBeDefined()', strength: 'vacuous' },
      { id: 'T2', round: 1, ac: 'AC-2', name: 'layout.spec › 479px container is compact', code: "mountWidget({ containerWidth: 479, viewport: 1440 });\nexpect(root).toHaveAttribute('data-layout', 'compact')" },
      { id: 'T3', round: 1, ac: 'AC-2', name: 'layout.spec › 480px container is regular', code: "mountWidget({ containerWidth: 480, viewport: 1440 });\nexpect(root).toHaveAttribute('data-layout', 'regular')" },
      { id: 'T4', round: 1, ac: 'AC-3', name: 'layout.spec › narrow container in wide viewport', code: "mountWidget({ containerWidth: 360, viewport: 1440 });\nexpect(root).toHaveAttribute('data-layout', 'compact')" },
      { id: 'T6', round: 1, ac: 'AC-1', name: 'overflow.spec › no horizontal overflow', code: 'for (const w of [320, 479, 480, 1200]) expect(scrollWidth(w)).toBeLessThanOrEqual(clientWidth(w))' },
      { id: 'T7', round: 1, ac: 'AC-4', name: 'unmount.spec › unmounts cleanly', code: 'unmount(); expect(container.children.length).toBe(0)' },
      { id: 'T8', round: 2, ac: 'AC-3', name: 'layout.spec › runtime resize 900 → 360px', code: "mountWidget({ containerWidth: 900, viewport: 1440 });\nawait setContainerWidth(360);\nawait expect(root).toHaveAttribute('data-layout', 'compact')" },
      { id: 'T9', round: 2, ac: 'AC-3', name: 'layout.spec › two instances 360px + 900px', code: "mountTwo({ widths: [360, 900], viewport: 1440 });\nexpect(a).toHaveAttribute('data-layout', 'compact');\nexpect(b).toHaveAttribute('data-layout', 'regular')" },
      { id: 'T10', round: 2, ac: 'AC-4', name: 'unmount.spec › resize after unmount has no errors', code: 'unmount(); await setContainerWidth(300);\nexpect(consoleErrors).toEqual([])' },
      { id: 'T11', round: 2, ac: 'AC-3', name: 'layout.spec › 900px container in 600px viewport', code: "mountWidget({ containerWidth: 900, viewport: 600 });\nexpect(root).toHaveAttribute('data-layout', 'regular')" },
    ],

    /* AC ↔ scenarios ↔ tests ↔ code, per review round (06B ladder). */
    coverage: {
      'AC-1': { scenarios: [{ text: 'container 320 / 479 / 480 / 1200px', tests: [['T6'], ['T6']] }], code: ['root: max-width 100%; min-width 0', 'root: max-width 100%; min-width 0'] },
      'AC-2': { scenarios: [{ text: '479px → compact', tests: [['T2'], ['T2']] }, { text: '480px → regular', tests: [['T3'], ['T3']] }], code: ["layoutFor: containerWidth < 480 ? 'compact' : 'regular'", "layoutFor: containerWidth < 480 ? 'compact' : 'regular'"] },
      'AC-3': {
        scenarios: [
          { text: 'narrow container / wide viewport', tests: [['T4'], ['T4', 'T9']] },
          { text: 'wide container / narrow viewport', tests: [[], ['T11']] },
          { text: 'runtime container resize', tests: [[], ['T8']] },
          { text: 'multiple widget instances with different widths', tests: [[], ['T9']] },
        ],
        unplanned: [['T1 · toBeDefined (mapped to AC-3, observes nothing)'], []],
        code: ['ResizeObserver(container) → layoutFor(entry.contentRect.width)', 'ResizeObserver(container) → layoutFor(entry.contentRect.width)'],
      },
      'AC-4': { scenarios: [{ text: 'mount → unmount → resize container', tests: [[], ['T10']] }, { text: 'repeated mount / unmount', tests: [['T7'], ['T7', 'T10']] }], code: ['no observer.disconnect() on unmount', 'effect cleanup → observer.disconnect()'] },
    },

    /* Test-strength matrix for AC-3: would the test FAIL under each meaningful AC violation? */
    violations: [
      { id: 'V1', text: 'Uses viewport width instead of container width (container → viewport substitution)' },
      { id: 'V2', text: 'Measures the container once at mount; ignores later resizes' },
      { id: 'V3', text: 'Shares one measured width across all widget instances' },
    ],
    strength: {
      T1: { V1: false, V2: false, V3: false, why: 'Passes whatever the layout does: it only proves an object exists.' },
      T4: { V1: true, V2: false, V3: false, why: 'Detects viewport substitution (360px container in a 1440px viewport), but only at initial render and with a single instance.' },
      T8: { V1: true, V2: true, V3: false, why: 'Changes the container after mount, so a one-time measurement is caught.' },
      T9: { V1: true, V2: false, V3: true, why: 'Two simultaneous widths expose a shared measurement.' },
    },

    /* Inside 04 — targeted mutation on the layout code. Keys are mutants, values list killing tests. */
    mutation: {
      original: "const layoutFor = (containerWidth) =>\n  containerWidth < 480 ? 'compact' : 'regular';\n\nnew ResizeObserver(([e]) => setLayout(layoutFor(e.contentRect.width)))\n  .observe(container);",
      mutants: [
        { id: 'M1', label: 'containerWidth < 600', diff: 'containerWidth < 480  →  containerWidth < 600', killedBy: ['T3'], note: 'T3 expects regular at 480px but gets compact.' },
        { id: 'M2', label: 'containerWidth <= 480', diff: '<  →  <=', killedBy: ['T3'], note: 'Off-by-one at the boundary AC-2 states.' },
        { id: 'M3', label: 'window.innerWidth', diff: 'e.contentRect.width  →  window.innerWidth', killedBy: ['T2', 'T4', 'T8', 'T9'], note: 'Every test with a narrow container in a wide viewport notices.' },
        { id: 'M4', label: 'measure once at mount', diff: 'ResizeObserver  →  layoutFor(container.clientWidth) once', killedBy: ['T8'], note: 'Only a test that resizes after mount can notice.' },
      ],
      suites: [
        { id: 'round1', label: 'Round 1 suite (T2, T3, T4)', tests: ['T2', 'T3', 'T4'] },
        { id: 'round2', label: 'Round 2 suite (+ T8, T9)', tests: ['T2', 'T3', 'T4', 'T8', 'T9'] },
      ],
    },

    /* 06B — "Try to break it". outcome: none | found | gap | na */
    counterexamples: [
      { id: 'size', probe: 'Unexpected container size', attempt: '0px, 1px and 10 000px containers', ac: 'AC-1', outcome: 'none', result: 'No overflow and no errors. Recorded as tried; a finite search is not proof.' },
      { id: 'boundary', probe: 'Boundary width', attempt: '479, 479.5, 480, 481px', ac: 'AC-2', outcome: 'none', result: '479.5px → compact, which matches “narrower than 480px”.' },
      { id: 'resize', probe: 'Runtime resize', attempt: 'Container 900 → 360px after mount', ac: 'AC-3', outcome: 'gap', result: 'No test changes container size after mount, so a planned scenario has no evidence → UNVERIFIED (round 1).' },
      { id: 'multi', probe: 'Multiple widget instances', attempt: 'Two instances at 360px and 900px on one page', ac: 'AC-3', outcome: 'gap', result: 'Planned scenario with no test → evidence gap (round 1).' },
      { id: 'unmount', probe: 'Mount / unmount', attempt: 'Unmount, then resize the container', ac: 'AC-4', outcome: 'found', result: 'The observer callback runs after unmount → `TypeError: Cannot read properties of null`. **AC-4 FAILED.**' },
      { id: 'ssr', probe: 'SSR', attempt: 'Import on the server (no window)', ac: '—', outcome: 'na', result: 'Not applicable unless the ticket or repository context says the widget supports SSR. The reviewer records “not applicable” and does not add a requirement.' },
      { id: 'reconnect', probe: 'Reconnect', attempt: 'Network reconnect during resize', ac: '—', outcome: 'na', result: 'No AC concerns connectivity; noted as out of scope rather than invented.' },
      { id: 'race', probe: 'Race conditions', attempt: 'Rapid resizes during first render', ac: 'AC-3', outcome: 'none', result: 'Final layout is correct after the burst. Recorded as limited coverage.' },
      { id: 'config', probe: 'Malformed configuration', attempt: 'Container with display:none (width 0)', ac: 'AC-1', outcome: 'none', result: 'Compact layout; no errors.' },
      { id: 'legacy', probe: 'Legacy browser behavior', attempt: 'Target without ResizeObserver (an older browser, if the repository lists one as supported)', ac: 'AC-3', outcome: 'gap', result: 'The environment was not available on the review machine, so it is recorded as a gap for that environment, **never a pass**.' },
    ],

    /* Verification status explorer: why each verdict (round 1). */
    status: {
      'AC-1': { required: 'No horizontal overflow at planned widths', evidence: 'T6 at 320 / 479 / 480 / 1200px, current head', problem: 'None. An overflowing layout would fail T6.', conclusion: 'VERIFIED' },
      'AC-2': { required: 'Compact below 480px, regular at 480px or more', evidence: 'T2 (479px) and T3 (480px); mutants M1 and M2 killed', problem: 'None. Both sides of the boundary are observed.', conclusion: 'VERIFIED' },
      'AC-3': { required: 'Runtime resize behavior; multiple instances; container independent of viewport', evidence: 'T1 (`toBeDefined`) and T4 (initial render only)', problem: 'The tests never change container dimensions after mount; the wide-container / narrow-viewport and multi-instance scenarios have no tests; T1 would pass even if layout used the viewport. Mutant M4 survived.', conclusion: 'UNVERIFIED' },
      'AC-4': { required: 'No errors after unmount', evidence: 'T7 checks only that the container is empty', problem: 'Counterexample reproduced: resizing after unmount throws a TypeError.', conclusion: 'FAILED' },
    },

    /* AC trace mode: each step references a node; `hl` optionally highlights edges. */
    trace: {
      'AC-3': [
        { node: 's01', title: 'Tracker', text: 'The ticket owner wrote AC-3: “Widget layout depends on its container width, not the browser viewport width.”' },
        { node: 's02', title: 'AC readiness', text: 'Present ✓ · unambiguous ✓ (container, not viewport) · verifiable ✓ · consistent with AC-2 ✓ · context ✓ → READY.', edges: ['e-02-start', 'e-start-03'] },
        { node: 's04', title: 'Verification Plan', text: 'Scenarios: narrow container / wide viewport · wide container / narrow viewport · runtime resize · multiple instances. Evidence: Playwright + visual regression. **Not new AC.**', edges: ['e-03-04'] },
        { node: 's04', title: 'Tests', text: 'Round 1 adds T1 `expect(component).toBeDefined()` and T4 (360px container in a 1440px viewport, initial render).' },
        { node: 's04', title: 'CI evidence', text: 'All green. Targeted mutation: M3 (viewport) killed, **M4 (measure once) survived**.', edges: ['e-session-ci', 'e-ci-session'] },
        { node: 's06b', title: 'Independent review', text: 'T1 would pass under every violation. T4 misses V2 and V3. The runtime-resize and multi-instance scenarios have no evidence → **UNVERIFIED**.', edges: ['e-session-05', 'e-05-review', 'e-review-06b'], verdict: 'UNVERIFIED' },
        { node: 'c-r-in', title: 'Findings → 03', text: 'Findings go to the controller, which redispatches via R. The reviewer does not fix anything.', edges: ['e-06b-r', 'e-r-03'] },
        { node: 's06b', title: 'Round 2 review', text: 'T8 (resize 900 → 360px), T9 (two instances) and T11 (900px container in a 600px viewport) are added. V1–V3 are all detected, M4 is killed, and no counterexample remains → **VERIFIED**.', verdict: 'VERIFIED' },
      ],
      'AC-4': [
        { node: 's01', title: 'Tracker', text: 'AC-4: “Unmounting the widget releases its container observers; no errors occur after unmount.”' },
        { node: 's04', title: 'Verification Plan', text: 'Scenarios: mount → unmount → resize; repeated mount / unmount. Evidence: Playwright with console-error capture.' },
        { node: 's04', title: 'Tests', text: 'Round 1 adds only T7: the container is empty after unmount.' },
        { node: 's04', title: 'CI evidence', text: 'T7 is green.' },
        { node: 's06b', title: 'Counterexample search', text: 'The reviewer resizes after unmount → TypeError. A counterexample is reproduced → **FAILED**.', verdict: 'FAILED', edges: ['e-review-06b'] },
        { node: 's06b', title: 'Round 2 review', text: 'The observer now disconnects on unmount. T10 captures no console errors → **VERIFIED**.', verdict: 'VERIFIED' },
      ],
      'AC-2': [
        { node: 's01', title: 'Tracker', text: 'AC-2 states the 480px boundary. The planner does not have to invent it.' },
        { node: 's04', title: 'Verification Plan', text: 'Boundary scenarios at 479 and 480px; negative case: the viewport varies while the container stays fixed.' },
        { node: 's04', title: 'Tests', text: 'T2 (479 → compact), T3 (480 → regular), both in a 1440px viewport.' },
        { node: 's04', title: 'CI + mutation', text: 'M1 (`< 600`) and M2 (`<= 480`) are killed by T3.' },
        { node: 's06b', title: 'Independent review', text: 'Both sides of the boundary are observed and the mutants are killed → **VERIFIED**.', verdict: 'VERIFIED' },
      ],
      'AC-1': [
        { node: 's01', title: 'Tracker', text: 'AC-1: no horizontal overflow at any container width.' },
        { node: 's04', title: 'Verification Plan', text: 'Widths 320 / 479 / 480 / 1200px; the reviewer later also tries 0px, 1px and 10 000px.' },
        { node: 's04', title: 'CI evidence', text: 'T6 is green at all planned widths.' },
        { node: 's06b', title: 'Independent review', text: 'Overflow would fail T6. Extreme sizes found no counterexample → **VERIFIED** (finite search recorded).', verdict: 'VERIFIED' },
      ],
    },
  };

  /* ── Presentation deck: the workflow itself, step by step ───────────────────── */
  WF.decks = {
    workflow: {
      title: 'Workflow tour',
      steps: [
        { focus: ['s01', 's02', 's04', 's06b'], title: 'WHAT → HOW → PROOF', text: 'Humans own **WHAT** (ticket AC). The Verification Planner defines **HOW** to prove it. Independent reviewers provide **PROOF** by challenging both the code and its tests.', fit: true },
        { focus: ['s01'], title: '01 · New ticket + source checks', text: 'WFTasks reads the exact tracker issue through the tracker integration and prepares sourced task evidence in any readable format. Step 02 independently selects reusable questions. Missing required access stops live submission.' },
        { focus: ['s02', 'd-start'], title: '02 · AC readiness + task routing', text: 'WFTasks messages WFJev, the fleet’s only Jev front door. Jev + controller check that the AC are present, clear, testable and consistent, with enough context. Owner, model, capacity and permission are checked too. **Jev never creates AC.**', edges: ['e-01-02', 'e-02-start'] },
        { focus: ['d-start', 'h-intake', 's01'], title: 'NEEDS_CLARIFICATION → human', text: 'Insufficient AC go back to the ticket owner. The updated ticket returns to WFTasks 01 and then Jev 02, never directly to Jev.', edges: ['e-start-human', 'e-human-01'], artifact: { edge: 'e-start-human', id: 'decision-record' } },
        { focus: ['s03', 's04'], title: '03 · Launch with a minimal payload', text: 'WFTasks triggers WFCoder with only the **issue ID + operational notes + execution instructions**. The worker fetches the ticket and linked designs itself.', edges: ['e-start-03', 'e-03-04'], artifact: { edge: 'e-03-04', id: 'launch-payload' } },
        { focus: ['s04', 'ci-service'], title: '04 · Agent implementation session', text: 'One repository-configured session plans HOW to prove existing AC, implements code and tests, follows CI and fixes failures. Hooks report activity and completion candidates; they do not prove success.', edges: ['e-session-ci', 'e-ci-session'] },
        { focus: ['s05', 'd-review'], title: '05 · Choose review depth', text: 'Bounded, fully covered change → 06A. Business logic, runtime behavior, integration, risk or a QA reopen → 06B. Diff size is never a shortcut. WFTasks hands the chosen route to WFReview.', edges: ['e-session-05', 'e-05-review'], artifact: { edge: 'e-session-05', id: 'ci-result' } },
        { focus: ['s06a'], title: '06A · GitHub review', text: 'Externally requested `@codex review` on the current head. An acknowledgement is not a result.', edges: ['e-review-06a'] },
        { focus: ['s06b', 'n-callout'], title: '06B · Behavior + test strength', text: 'A separate, externally started session asks: **“Would these tests fail if the implementation violated the actual AC?”** It records VERIFIED / FAILED / UNVERIFIED for each AC.', edges: ['e-review-06b'] },
        { focus: ['s06b', 'c-r-06b', 'c-r-in', 's03'], title: 'Findings → controller → 03', text: 'Reviewers report and never fix. Rework is scheduled externally and gets a fresh independent review.', edges: ['e-06b-r', 'e-r-03'], artifact: { edge: 'e-06b-r', id: 'review-result' } },
        { focus: ['s07'], title: '07 · QA Develop', text: 'An explicit QA pass on the reviewed develop build. QA Develop precedes the staging decision. No staging decision before this pass.', edges: ['e-06a-07', 'e-06b-07'], artifact: { edge: 'e-06b-07', id: 'review-result' } },
        { focus: ['s08'], title: '08 · Ready for Staging', text: 'QA moved the ticket to Ready for Staging. WFRelease refreshes head, CI, review threads, branch rules and the release window, then hands the evidence to 09. Every wait and human update comes back here.', edges: ['e-07-08', 'e-08-09'], artifact: { edge: 'e-07-08', id: 'qa-result' } },
        { focus: ['s09', 'd-auto', 'h-staging'], title: '09 · Staging merge decision', text: 'WFRelease messages WFJev; the Jev completion for the target `merge` plus deterministic gates **and** the explicit `merge` grant → 10 directly. Anything missing → wait under 08; a named human decision goes to the release owner and returns through WFRelease 08.', edges: ['e-08-09', 'e-09-auto', 'e-auto-08', 'e-08-human'] },
        { focus: ['s10'], title: '10 · Merge + release to staging', text: 'Merge once, deploy, confirm the actual version and health. Never advance on a dispatch acknowledgement.', edges: ['e-auto-10'], artifact: { edge: 'e-auto-10', id: 'merge-decision' } },
        { focus: ['s11'], title: '11 · QA Staging', text: 'Integrated acceptance on the exact staged artifact.', edges: ['e-10-11'], artifact: { edge: 'e-10-11', id: 'release-result' } },
        { focus: ['s12'], title: '12 · Hold in Ready for Release', text: 'WFRelease refreshes the exact staged artifact, QA Staging, batch, rollout and recovery notes, incidents, freeze and permissions. A new head goes back to 05.', edges: ['e-11-12', 'e-12-13'] },
        { focus: ['s13', 'd-release', 'h-prod'], title: '13 · Production release decision', text: 'Stricter than 09 and again through WFJev: four positive and seven negative predicates with narrower bands. All gates and the deploy_production grant → 14; a human-reserved class → release owner → WFRelease 12.', edges: ['e-13-release', 'e-release-human'] },
        { focus: ['s14'], title: '14 · Merge, release, move to Done', text: 'Merge once to the production branch; CI deploys it. Verify version and health, then mark_done. Failure or unknown → recovery; never claim done.', edges: ['e-release-14'] },
        { focus: ['c-q-07', 'c-q-11', 'c-q-in', 's15', 'd-report'], title: 'QA failure → 15', text: 'Every QA return is validated **before** another coding attempt: completeness, correct build, relation to the AC, ownership.', edges: ['e-07-q', 'e-11-q', 'e-q-15', 'e-15-report'] },
        { focus: ['s16', 's17', 'c-r-16'], title: '16 · Rework or 17 · Details', text: 'A valid report goes 16 → R → 03 (WFTasks triggers WFCoder again), and the new fix gets a fresh independent review. An incomplete report goes to 17 and returns to WFTasks 15.', edges: ['e-report-16', 'e-16-r', 'e-report-17'] },
      ],
    },

    /* Example walkthrough: WEB-123 end to end. Uses only existing nodes / edges. */
    example: {
      title: 'Walkthrough · WEB-123 (illustrative)',
      steps: [
        { focus: ['s01'], title: 'Tracker', text: '**WEB-123** “Make the widget responsive to its container rather than browser viewport.” The owner wrote AC-1 to AC-4 (no overflow, the 480px boundary, container not viewport, clean unmount).' },
        { focus: ['s02', 'd-start'], title: 'AC readiness', text: 'All five checks pass. Contrast: a ticket that only says “Fix responsive layout” would return NEEDS_CLARIFICATION, with the missing container behavior, boundaries and resize behavior listed and **no drafted AC**.', edges: ['e-01-02', 'e-02-start', 'e-start-03'] },
        { focus: ['s03', 's04'], title: 'Launch → agent implementation session', text: 'Task `WEB-123` launches with the ID and notes only. The planner maps AC-3 to four scenarios, including runtime resize and multiple instances.', edges: ['e-03-04'], artifact: { edge: 'e-03-04', id: 'launch-payload' } },
        { focus: ['s04'], title: 'Implementation', text: '`ResizeObserver` + `layoutFor(width)` with `< 480`. Tests T1–T7, including `expect(component).toBeDefined()` mapped to AC-3.' },
        { focus: ['s04', 'ci-service'], title: 'CI', text: 'Lint, types, unit, Playwright and visual are **all green**.', edges: ['e-session-ci', 'e-ci-session'], artifact: { edge: 'e-ci-session', id: 'ci-result' } },
        { focus: ['s04', 'ci-service'], title: 'Mutation / browser / visual evidence', text: 'Mutation: `< 600` killed, viewport substitution killed, **“measure once at mount” survived**. Visual snapshots cover initial renders only.' },
        { focus: ['s05', 'd-review'], title: 'Review depth', text: 'Runtime behavior is involved → `behavior_verification_needed` → **06B**.', edges: ['e-session-05', 'e-05-review', 'e-review-06b'] },
        { focus: ['s06b', 'n-callout'], title: 'Independent semantic verification', text: 'AC-1 ✓, AC-2 ✓, **AC-3 UNVERIFIED** (nothing resizes after mount; T1 is vacuous), **AC-4 FAILED** (resize after unmount throws). CI was green and the change is still not accepted.', verdict: true },
        { focus: ['c-r-06b', 'c-r-in', 's03'], title: 'Rework', text: 'Findings → controller → 03. The worker adds T8, T9 and T10 and fixes observer cleanup. A **fresh** 06B session verifies all four AC.', edges: ['e-06b-r', 'e-r-03'], artifact: { edge: 'e-06b-r', id: 'review-result' } },
        { focus: ['s07'], title: 'QA Develop', text: 'QA checks the develop build in 320px and 900px containers and passes it explicitly.', edges: ['e-06b-07'] },
        { focus: ['s08', 's09', 'd-auto'], title: 'Merge decision', text: 'Under the **committed example policy** (`mode: shadow`, `merge: false`) the decision is **WAIT → 08**, recorded as a recommendation. With configured grants and all gates fresh it would be AUTO MERGE → 10.', edges: ['e-07-08', 'e-08-09', 'e-09-auto', 'e-auto-08'], artifact: { edge: 'e-07-08', id: 'qa-result' } },
      ],
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);

