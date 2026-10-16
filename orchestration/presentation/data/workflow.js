/*
 * Workflow topology for the interactive presentation.
 *
 * SOURCE OF TRUTH: orchestration/assets/workflow.svg (approved diagram).
 * Every coordinate, label and card line below is copied from that file and is checked by
 * tests/diagram-fidelity.test.mjs. Do not "improve" wording here: change the approved
 * diagram first (only on an explicit request), then mirror it.
 *
 * Coordinates use the diagram's own 5200 × 7280 coordinate space.
 * Card lines are arrays because the diagram wraps them; keep the same wrapping.
 */
(function (root) {
  const WF = (root.WFWorkflow = root.WFWorkflow || {});

  WF.meta = {
    eyebrow: 'WORKFLOW  /  TASK ORCHESTRATION',
    title: 'From ticket to verified release',
    subtitle:
      'Jev decides readiness. Workers implement. Independent reviewers challenge both the code and its tests.',
    diagram: 'orchestration/assets/workflow.svg',
    pipelineDoc: 'orchestration/PIPELINE.md',
    viewBox: { x: 40, y: 370, w: 5160, h: 6880 },
    whatHowProof: [
      { key: 'WHAT', text: 'ticket AC / human owner', term: 'ac' },
      { key: 'HOW', text: 'Verification Plan / planner', term: 'verification-plan' },
      { key: 'PROOF', text: 'independent review of code AND test strength.', term: 'proof' },
    ],
  };

  /* Diagram node colour families (legend of the approved diagram). */
  WF.kinds = {
    grok: { label: 'Grok bots', legend: true },
    jev: { label: 'Jev decisions', legend: true },
    agent: { label: 'Coding / review agents', legend: true },
    ci: { label: 'CI / release runners', legend: true },
    human: { label: 'Human / QA', legend: true },
    release: { label: 'Delivered outcome', legend: false },
  };

  /*
   * Agents used by "Show agents" and the filter chips. Participation is derived from
   * each node's `agents` array, so adding a stage never requires UI changes.
   */
  WF.agents = [
    {
      id: 'human',
      name: 'Human',
      long: 'Human · ticket owner, QA, product / security / design, release owners',
      filter: 'Human',
      summary:
        'Owns WHAT (ticket AC), supplies missing facts, performs required acceptance and makes decisions automation is not authorized to make.',
    },
    {
      id: 'jev',
      name: 'Jev / Issue Agent',
      long: 'WFJev (the fleet’s only Jev front door) + controller, inside the Grok bot app',
      filter: 'Jev',
      summary:
        'Only WFJev invokes TypeSafe Jev; callers message it with evidence, preset and reply-to and consume the structured disposition. Jev answers narrow typed questions about supplied evidence; the calling Grok Bot controller applies deterministic policy. Readiness, routing, review depth, staging and release decisions, QA report validation.',
    },
    {
      id: 'grok',
      name: 'Grok/Superset Bot',
      long: 'Grok bot app · WFTasks, WFRelease, WFReview, WFCoder (bot fleet)',
      filter: 'Grok/Superset',
      summary:
        'WFTasks reads the tracker, refreshes evidence and tracks waits for 01–07 and 15–17; WFRelease does the same for 08–14. WFReview owns 06A / 06B. WFCoder is the Superset coding worker started with the minimal launch payload. None of them calls Jev directly: they message WFJev.',
    },
    {
      id: 'planner',
      name: 'Verification Planner',
      long: 'Planning inside the 04 agent session',
      filter: 'Coding',
      summary:
        'Plans HOW existing AC will be proven. Never creates, expands, reinterprets or improves AC.',
    },
    {
      id: 'coding',
      name: 'Coding Agent',
      long: 'WFCoder coding agent · 04, one live session',
      filter: 'Coding',
      summary:
        'Implements code and meaningful tests, runs checks, owns the CI correction loop. No self-review.',
    },
    {
      id: 'reviewer',
      name: 'Independent Reviewer',
      long: 'WFReview → external Codex review (06A) · separate verification session (06B)',
      filter: 'Verification',
      summary:
        'Externally started. Tries to falsify the claimed behavior: AC ↔ scenarios ↔ tests ↔ code, test strength, counterexamples.',
    },
    {
      id: 'ci',
      name: 'CI / automation',
      long: 'CI service · release runners (WFRelease drives 10 and 14)',
      filter: 'CI',
      summary:
        'Produces mechanical evidence and executes authorized release actions. Green CI is not business correctness.',
    },
  ];

  /* Filter chips (spec: All, Human, Jev, Grok/Superset, Coding, Verification, CI). */
  WF.filters = [
    { id: 'all', label: 'All' },
    { id: 'human', label: 'Human', agents: ['human'] },
    { id: 'jev', label: 'Jev', agents: ['jev'] },
    { id: 'grok', label: 'Grok/Superset', agents: ['grok'] },
    { id: 'coding', label: 'Coding', agents: ['planner', 'coding'] },
    { id: 'verification', label: 'Verification', verification: true },
    { id: 'ci', label: 'CI', agents: ['ci'] },
  ];

  /* Dashed physical app / machine boundaries and the solid coding-workflow container. */
  WF.groups = [
    {
      id: 'g-grok-intake',
      points: '80,500 2250,500 2250,1970 1210,1970 1210,1140 80,1140',
      title: { text: 'GROK BOT APP · WFTasks + WFJev + WFCoder', x: 120, y: 530, size: 29 },
      boundary: 'Grok bot app',
    },
    {
      id: 'g-coding',
      rect: { x: 2440, y: 500, w: 2680, h: 1240 },
      solid: true,
      title: { text: 'AGENT IMPLEMENTATION SESSION · 04', x: 2480, y: 524, size: 33 },
      boundary: 'One live coding session',
    },
    {
      id: 'g-impl',
      points: '2490,600 4230,600 4230,1290 2490,1290',
      title: { text: 'IMPLEMENTATION MACHINE · Superset', x: 2520, y: 624, size: 29 },
      subtitle: {
        text: 'Coding agent owns planning, implementation and the CI correction loop.',
        x: 2520,
        y: 667,
        size: 25,
      },
      boundary: 'Implementation machine',
    },
    {
      id: 'g-grok-review',
      points: '4050,2490 5120,2490 5120,3140 4050,3140',
      title: { text: 'GROK BOT APP · same app', x: 4080, y: 2517, size: 29 },
      subtitle: { text: 'WFJev + WFTasks; WFReview owns 06A / 06B', x: 4080, y: 2560, size: 25 },
      boundary: 'Grok bot app',
    },
    {
      id: 'g-github',
      points: '2630,2430 3740,2430 3740,2890 2630,2890',
      title: { text: 'GITHUB · independent review', x: 2660, y: 2457, size: 29 },
      boundary: 'GitHub',
    },
    {
      id: 'g-review-machine',
      points: '2030,3050 3760,3050 3760,4020 2030,4020',
      title: { text: 'REVIEW MACHINE · separate Superset session', x: 2060, y: 3077, size: 29 },
      subtitle: {
        text: 'Externally started; never the implementation session or its child reviewer.',
        x: 2060,
        y: 3120,
        size: 25,
      },
      boundary: 'Review machine',
    },
    {
      id: 'g-grok-08',
      points: '100,3560 1260,3560 1260,4280 100,4280',
      title: { text: 'GROK BOT APP · same app', x: 130, y: 3587, size: 29 },
      subtitle: { text: 'WFRelease holds the candidate and refreshes evidence.', x: 130, y: 3630, size: 25 },
      boundary: 'Grok bot app',
    },
    {
      id: 'g-grok-09',
      points: '1370,4190 2520,4190 2520,4810 1370,4810',
      title: { text: 'GROK BOT APP · WFJev + WFRelease', x: 1410, y: 4220, size: 29 },
      boundary: 'Grok bot app',
    },
    {
      id: 'g-runner-10',
      points: '4070,4190 5110,4190 5110,4840 4070,4840',
      title: { text: 'RELEASE RUNNER', x: 4100, y: 4217, size: 29 },
      boundary: 'Release runner',
    },
    {
      id: 'g-grok-12',
      points: '1500,5420 3820,5420 3820,6080 1500,6080',
      title: { text: 'GROK BOT APP · same app', x: 1530, y: 5447, size: 29 },
      subtitle: { text: 'WFRelease + WFJev', x: 1530, y: 5490, size: 25 },
      boundary: 'Grok bot app',
    },
    {
      id: 'g-runner-14',
      points: '100,5230 1310,5230 1310,5880 100,5880',
      title: { text: 'RELEASE RUNNER', x: 130, y: 5257, size: 29 },
      boundary: 'Release runner',
    },
    {
      id: 'g-qa-return',
      points: '70,6450 3340,6450 3340,7000 70,7000',
      title: {
        text: 'GROK BOT APP · WFTasks + WFJev; WFCoder takes validated rework',
        x: 100,
        y: 6477,
        size: 29,
      },
      boundary: 'Grok bot app',
    },
  ];

  /*
   * Numbered stages. `card` holds the diagram's Ready / Scope / Tools / Pass lines verbatim.
   * `short` is only used for the zoomed-out label and the mobile list.
   */
  WF.stages = [
    {
      id: 's01', num: '01', kind: 'grok', short: 'New ticket',
      title: 'New ticket + source checks', owner: 'WFTasks', status: 'TODO',
      box: { x: 160, y: 625, w: 900, h: 435 }, pillW: 113.515625,
      card: {
        ready: ['A new tracker issue ID is available.'],
        scope: ['Read description, existing ticket AC, relations and', 'QA history.'],
        tools: ['Tracker integration; ticket text and image inspection.'],
        pass: ['Intent and evidence understood. Missing source', 'access stops work.'],
      },
      agents: ['grok'], group: 'g-grok-intake', ticketStatus: 'Todo',
    },
    {
      id: 's02', num: '02', kind: 'jev', short: 'AC readiness + routing',
      title: 'AC readiness + task routing', owner: 'WFJev + WFTasks',
      box: { x: 1290, y: 820, w: 900, h: 450 }, pillW: 205.38,
      card: {
        ready: ['Ticket description and explicit AC are loaded.'],
        scope: ['AC present, clear, testable, consistent; enough', 'context.'],
        tools: ['Jev checks + source facts. Never infer or create AC.'],
        pass: ['All AC gates pass; owner, model, capacity and', 'permission ready.'],
      },
      agents: ['jev', 'grok'], group: 'g-grok-intake', ticketStatus: 'Todo',
      decision: 'jd-readiness', decisionPoint: true,
    },
    {
      id: 's03', num: '03', kind: 'grok', short: 'Launch coding workflow',
      title: 'Launch the coding workflow', owner: 'WFTasks → WFCoder',
      box: { x: 1290, y: 1480, w: 900, h: 435 }, pillW: 237.5,
      card: {
        ready: ['Task approved for work; capacity reserved.'],
        scope: ['Start or resume one Superset session.'],
        tools: ['Ticket ID, operational notes and execution', 'instructions only.'],
        pass: ['Session confirmed. Task name uses the issue ID; no', 'ticket title.'],
      },
      agents: ['grok'], group: 'g-grok-intake', ticketStatus: 'Todo → In Progress',
    },
    {
      "id": "s04",
      "num": "04",
      "kind": "agent",
      "short": "Agent implementation session",
      "title": "Agent implementation session",
      "owner": "WFCoder · coding agent in Superset",
      "status": "IN PROGRESS",
      "box": {
        "x": 2560,
        "y": 750,
        "w": 1610,
        "h": 466
      },
      "pillW": 426.73,
      "card": {
        "ready": [
          "Current ticket AC and repository instructions are loaded by the worker."
        ],
        "scope": [
          "Plan HOW to prove existing AC; implement code and meaningful tests.",
          "Run checks, follow CI and fix code/test failures within this same session.",
          "Never create, expand or improve AC. Independent review stays external."
        ],
        "tools": [
          "Repository-configured agent workflow, local checks and CI.",
          "Grok status hooks report activity, blockers and completion candidates."
        ],
        "pass": [
          "Completion candidate → controller reconciles session, PR head and evidence → 05.",
          "A Stop / SessionEnd hook alone does not prove task completion."
        ]
      },
      "agents": [
        "planner",
        "coding",
        "ci"
      ],
      "group": "g-impl",
      "ticketStatus": "In Progress",
      "verification": true
    },
    {
      id: 's05', num: '05', kind: 'jev', short: 'Review depth',
      title: 'Choose review depth', owner: 'WFJev + WFTasks', status: 'CODE REVIEW',
      box: { x: 4140, y: 2610, w: 900, h: 466 }, pillW: 205.38,
      card: {
        ready: ['Completion reconciled; required CI passes.', 'Current PR and acceptance evidence are available.'],
        scope: ['Choose a bounded review or deeper behavior', 'verification.'],
        tools: ['Assess business logic, integrations, risk and QA', 'reopens.'],
        pass: ['External review route selected; required human', 'decisions identified.'],
      },
      agents: ['jev', 'grok'], group: 'g-grok-review', ticketStatus: 'Code Review',
      decision: 'jd-review-depth', decisionPoint: true,
    },
    {
      id: 's06a', num: '06A', kind: 'agent', short: 'GitHub review',
      title: 'GitHub review', owner: 'WFReview → external Codex review',
      box: { x: 2690, y: 2510, w: 990, h: 345 }, pillW: 419.26,
      card: {
        ready: ['Bounded change; configured review coverage is sufficient.'],
        scope: ['Inspect the current change independently.'],
        tools: ['Externally requested @codex review.'],
        pass: ['Current-head result; no blocking findings.'],
      },
      agents: ['reviewer', 'grok'], group: 'g-github', ticketStatus: 'Code Review', verification: true,
    },
    {
      id: 's06b', num: '06B', kind: 'agent', short: 'Behavior + test strength',
      title: 'Behavior + semantic test-strength review', owner: 'WFReview → independent verification agent',
      status: 'CODE REVIEW', fontSize: 29,
      box: { x: 2090, y: 3170, w: 1610, h: 540 }, pillW: 516.5,
      card: {
        ready: ['Current ticket AC, Verification Plan, candidate head and actual test results.'],
        scope: [
          'Check AC ↔ scenarios ↔ tests ↔ code. Verify that each test would detect a meaningful violation of',
          'its AC.',
        ],
        tools: ['Independent counterexample search; test-strength analysis; targeted mutation where useful.'],
        pass: [
          'Per-AC VERIFIED, FAILED or UNVERIFIED, with test-strength evidence, counterexamples and explicit',
          'gaps.',
        ],
      },
      agents: ['reviewer', 'grok'], group: 'g-review-machine', ticketStatus: 'Code Review', verification: true,
      featured: true,
    },
    {
      id: 's07', num: '07', kind: 'human', short: 'QA Develop',
      title: 'QA Develop', owner: 'QA owner / allowed suite', status: 'QA DEVELOP',
      box: { x: 780, y: 2860, w: 1040, h: 450 }, pillW: 308.96875,
      card: {
        ready: ['Reviewed build is available in develop.'],
        scope: ['Validate the accepted feature or bug fix.'],
        tools: ['Acceptance scenarios, regression checks and screenshots.'],
        pass: ['Explicit QA pass tied to this build and the requirements.'],
      },
      agents: ['human'], ticketStatus: 'QA Develop', verification: true,
      human: { role: 'QA owner or explicitly allowed automated acceptance suite', why: 'Performs required acceptance on the reviewed develop build.' },
    },
    {
      id: 's08', num: '08', kind: 'grok', short: 'Ready for Staging (hold)',
      title: 'Hold in Ready for Staging', owner: 'WFRelease', status: 'READY FOR STAGING',
      box: { x: 160, y: 3680, w: 1020, h: 466 }, pillW: 143.5,
      card: {
        ready: ['QA moved the ticket to Ready for Staging on the reviewed head;', 'the stand comment matches that head.'],
        scope: ['Refresh head, CI, review, approvals and release window; hold the', 'candidate while a blocker or human decision is pending.'],
        tools: ['WFRelease tracks release timing, approvals and updated', 'source evidence; no dispatch while waiting.'],
        pass: ['Evidence refreshed → 09. Wait resolved or human update →', 'refresh and request 09 again.'],
      },
      agents: ['grok'], group: 'g-grok-08', ticketStatus: 'Ready for Staging',
    },
    {
      id: 's09', num: '09', kind: 'jev', short: 'Staging merge decision',
      title: 'Decide staging merge', owner: 'WFJev + WFRelease', status: 'READY FOR STAGING',
      box: { x: 1440, y: 4340, w: 1000, h: 435 }, pillW: 235.37,
      card: {
        ready: ['WFRelease refreshed evidence in 08; required checks pass.'],
        scope: ['Jev completion: automatic staging merge now, or wait for a', 'human release decision.'],
        tools: ['Fresh gates, branch rules, release window and the merge', 'grant; Jev flags scope, manual checks, coordination.'],
        pass: ['All gates and the merge grant → 10. Otherwise → 08 with', 'reasons, owner and wake-up.'],
      },
      agents: ['jev', 'grok'], group: 'g-grok-09', ticketStatus: 'Ready for Staging',
      decision: 'jd-staging', decisionPoint: true,
    },
    {
      id: 's10', num: '10', kind: 'ci', short: 'Merge + staging release',
      title: 'Merge + release to staging', owner: 'WFRelease → release automation', status: 'STAGING RELEASE',
      box: { x: 4140, y: 4310, w: 900, h: 450 }, pillW: 393.72,
      card: {
        ready: ['Merge and deployment actions are authorized.'],
        scope: ['Deliver the approved candidate to staging.'],
        tools: ['Merge once; reconcile existing actions; deploy and', 'smoke-test.'],
        pass: ['Release succeeds; deployed version and health are', 'confirmed.'],
      },
      agents: ['ci', 'grok'], group: 'g-runner-10', ticketStatus: 'Ready for Staging → QA Staging',
    },
    {
      id: 's11', num: '11', kind: 'human', short: 'QA Staging',
      title: 'QA Staging', owner: 'QA owner / allowed suite', status: 'QA STAGING',
      box: { x: 4140, y: 5180, w: 900, h: 435 }, pillW: 308.96875,
      card: {
        ready: ['Staging release succeeded; exact build is known.'],
        scope: ['Verify integrated behavior and regressions.'],
        tools: ['Acceptance, regression and cross-component', 'scenarios.'],
        pass: ['Explicit QA pass on the staged artifact; blocking', 'defects resolved.'],
      },
      agents: ['human'], ticketStatus: 'QA Staging', verification: true,
      human: { role: 'QA owner or explicitly allowed automated acceptance suite', why: 'Performs required integrated acceptance on the exact staged artifact.' },
    },
    {
      id: 's12', num: '12', kind: 'grok', short: 'Ready for Release (hold)',
      title: 'Hold in Ready for Release', owner: 'WFRelease', status: 'READY FOR RELEASE',
      box: { x: 2710, y: 5540, w: 1050, h: 435 }, pillW: 143.5,
      card: {
        ready: ['QA Staging passed on the exact staged artifact.'],
        scope: ['Refresh artifact, CI, QA Staging, incidents, freeze,', 'batch, permissions; hold while a decision is pending.'],
        tools: ['WFRelease tracks release timing, approvals and evidence.'],
        pass: ['Evidence refreshed → 13. Human update → refresh and', 'request 13 again.'],
      },
      agents: ['grok'], group: 'g-grok-12', ticketStatus: 'Ready for Release',
    },
    {
      id: 's13', num: '13', kind: 'jev', short: 'Production release decision',
      title: 'Decide production release', owner: 'WFJev + WFRelease', status: 'READY FOR RELEASE',
      box: { x: 1560, y: 5540, w: 1000, h: 466 }, pillW: 235.37,
      card: {
        ready: ['WFRelease refreshed evidence in 12; QA Staging passed', 'on the exact artifact.'],
        scope: ['Stricter Jev completion for production release: no', 'risk class, incident, freeze or batch blocker.'],
        tools: ['Fresh gates, rollout and recovery plan, batch,', 'freeze, approvals and the production grant.'],
        pass: ['All gates and the grant → 14. Otherwise → human', 'release owner; back through WFRelease 12, then 13.'],
      },
      agents: ['jev', 'grok'], group: 'g-grok-12', ticketStatus: 'Ready for Release',
      decision: 'jd-production', decisionPoint: true,
    },
    {
      id: 's14', num: '14', kind: 'release', short: 'Release + Done',
      title: 'Merge, release, move to Done', owner: 'WFRelease → release automation', status: 'DONE',
      box: { x: 160, y: 5350, w: 1090, h: 435 }, pillW: 393.72,
      card: {
        ready: ['Production gates and the release grant pass.'],
        scope: ['Merge to the production branch; CI deploys it.'],
        tools: ['Deployment, actual version and health / smoke checks.'],
        pass: ['Verified delivery → ticket moved to Done. Failure →', 'recovery; never claim done.'],
      },
      agents: ['ci', 'grok'], group: 'g-runner-14', ticketStatus: 'Done (configured post-release state)',
    },
    {
      id: 's15', num: '15', kind: 'jev', short: 'Validate QA report',
      title: 'Validate the QA report', owner: 'WFTasks + WFJev', status: 'QA RETURN',
      box: { x: 140, y: 6540, w: 1260, h: 364 }, pillW: 205.38,
      card: {
        ready: ['New QA feedback is retrieved from the tracker.'],
        scope: ['Check completeness, tested build, failure relation and ownership.'],
        tools: ['Expected / actual result, steps, environment and image evidence.'],
        pass: [
          'Confirmed failure or regression on the correct build. Skip videos; video reports',
          'require a screenshot + written repro.',
        ],
      },
      agents: ['jev', 'grok'], group: 'g-qa-return', ticketStatus: 'any (QA return takes precedence)',
      decision: 'jd-qa-report', decisionPoint: true,
    },
    {
      id: 's16', num: '16', kind: 'grok', short: 'Return to implementation',
      title: 'Return to implementation', owner: 'WFTasks → WFCoder', status: 'REWORK',
      box: { x: 2070, y: 6540, w: 1190, h: 330 }, pillW: 237.5,
      card: {
        ready: ['Failure confirmed; owner and worker eligibility checked.'],
        scope: ['Start the next bounded implementation attempt.'],
        tools: ['Ticket ID + operational notes only; worker reads QA itself.'],
        pass: ['New fix evidence, then fresh independent behavior review.'],
      },
      agents: ['grok'], group: 'g-qa-return', ticketStatus: 'In Progress',
    },
    {
      id: 's17', num: '17', kind: 'human', short: 'Details or decision',
      title: 'Ask for details or a decision', owner: 'QA / product / platform owner', status: 'HOLD',
      box: { x: 3780, y: 6540, w: 1280, h: 330 }, pillW: 365.09375,
      card: {
        ready: ['Report incomplete, tested build stale, or new scope / owner needed.'],
        scope: ['Resolve only the missing evidence or named decision.'],
        tools: ['Screenshots + written repro; correct-build retest; scope clarification.'],
        pass: ['Updated report → step 15. Do not launch coding while the report is insufficient.'],
      },
      agents: ['human'], ticketStatus: 'retained (hold)',
      human: { role: 'QA / product / platform owner', why: 'Supplies missing evidence, retests the correct build, or decides scope / ownership.' },
    },
  ];

  /* Un-numbered HUMAN boxes (pink) — intervention points. Text is verbatim. */
  WF.humans = [
    {
      id: 'h-intake', kind: 'human', short: 'Ticket / product owner',
      title: 'HUMAN · ticket / product owner',
      box: { x: 160, y: 1360, w: 900, h: 260 },
      lines: [
        'Update the ticket and return it to WFTasks (01). WFTasks',
        'rereads the current ticket, then asks Jev (02). Never guess',
        'missing AC.',
      ],
      agents: ['human'], group: 'g-grok-intake', returnsTo: 's01',
      human: { role: 'Ticket / product owner', why: 'Owns product requirements; fixes insufficient AC in the tracker.' },
    },
    {
      id: 'h-review', kind: 'human', short: 'Product / security / design',
      title: 'HUMAN · product / security / design',
      box: { x: 4140, y: 3320, w: 900, h: 235 },
      lines: [
        'Resolve the named decision. Return the update to WFTasks',
        '(05), which refreshes context before review resumes.',
      ],
      agents: ['human'], returnsTo: 's05',
      human: { role: 'Product / security / design owner', why: 'Makes named decisions automation is not authorized to make (business intent, specialist risk).' },
    },
    {
      id: 'h-staging', kind: 'human', short: 'Release / domain owner',
      title: 'HUMAN · release / domain owner',
      box: { x: 2780, y: 5010, w: 1120, h: 220 },
      lines: [
        'Resolve or approve the named release action. Return the update to',
        'WFRelease (08); it reloads current evidence before step 09.',
      ],
      agents: ['human'], returnsTo: 's08',
      human: { role: 'Release / domain owner', why: 'Approves exceptional release actions or resolves a named release blocker.' },
    },
    {
      id: 'h-prod', kind: 'human', short: 'Production release owner',
      title: 'HUMAN · production release owner, when required',
      box: { x: 1500, y: 6140, w: 1170, h: 200 },
      lines: [
        'Return the release decision to WFRelease (12). It refreshes evidence before',
        'WFJev re-evaluates. A model score never grants deployment permission.',
      ],
      agents: ['human'], returnsTo: 's12',
      human: { role: 'Production release owner (when required)', why: 'Decides production release where policy requires a human.' },
    },
  ];

  /* Decision diamonds. Points and text are verbatim from the diagram. */
  WF.decisions = [
    { id: 'd-start', label: ['Start?'], cx: 1740, cy: 1380, rx: 65, ry: 60, owner: 's02', decision: 'jd-readiness', agents: ['jev'] },
    { id: 'd-review', label: ['Review', 'depth'], cx: 3890, cy: 2827, rx: 65, ry: 60, owner: 's05', decision: 'jd-review-depth', agents: ['jev'] },
    { id: 'd-auto', label: ['Auto', 'merge?'], cx: 2600, cy: 4557, rx: 65, ry: 60, owner: 's09', decision: 'jd-staging', agents: ['jev'] },
    { id: 'd-release', label: ['Release', 'now?'], cx: 1405, cy: 5757, rx: 65, ry: 60, owner: 's13', decision: 'jd-production', agents: ['jev'] },
    { id: 'd-report', label: ['Report', 'valid?'], cx: 1740, cy: 6710, rx: 75, ry: 65, owner: 's15', decision: 'jd-qa-report', agents: ['jev'] },
  ];

  /* Off-page connectors. R = redispatch into 03, Q = QA failure into 15. */
  WF.connectors = [
    { id: 'c-r-in', letter: 'R', cx: 2240, cy: 2150, role: 'in', target: 's03' },
    { id: 'c-r-06b', letter: 'R', cx: 3890, cy: 3770, role: 'out', source: 's06b' },
    { id: 'c-r-16', letter: 'R', cx: 3420, cy: 6710, role: 'out', source: 's16' },
    { id: 'c-q-07', letter: 'Q', cx: 1650, cy: 3410, role: 'out', source: 's07' },
    { id: 'c-q-11', letter: 'Q', cx: 4910, cy: 5730, role: 'out', source: 's11' },
    { id: 'c-q-in', letter: 'Q', cx: 95, cy: 6330, role: 'in', target: 's15' },
  ];

  /* Service box inside the coding workflow (dashed in the diagram). */
  WF.services = [
    {
      id: 'ci-service', short: 'CI service', kind: 'ci',
      box: { x: 4310, y: 750, w: 760, h: 340 },
      lines: [
        { text: 'CI SERVICE', x: 4340, y: 777, size: 29, weight: 700 },
        { text: 'External runner, when configured', x: 4340, y: 820, size: 25, muted: true },
        { text: 'Static, unit, integration, mutation, browser and', x: 4340, y: 855, size: 27, muted: true },
        { text: 'visual checks as applicable.', x: 4340, y: 892, size: 27, muted: true },
        { text: 'Mutation: can tests detect implementation', x: 4340, y: 970, size: 27, weight: 700 },
        { text: 'changes?', x: 4340, y: 1007, size: 27, weight: 700 },
      ],
      agents: ['ci'], group: 'g-coding', verification: true,
    },
  ];

  /* Free text on the diagram: banner, notes, callout and footer. Clicking opens `opens`. */
  WF.notes = [
    { id: 'n-session-hooks', lines: [
      { text: 'One session, configured per repository.', x: 2560, y: 1400, size: 30, weight: 700 },
      { text: 'Activity → keep running. Blocked / stuck → inspect or wait.', x: 2560, y: 1460, size: 26 },
      { text: 'Stop / end → reconcile once before step 05.', x: 2560, y: 1510, size: 26 },
      { text: 'Tool and child events do not complete the parent task.', x: 2560, y: 1560, size: 26 },
    ], opens: { type: 'stage', id: 's04' } },

    {
      id: 'n-handoff', kind: 'banner', rect: { x: 100, y: 387, w: 5020, h: 65 },
      lines: [{ text: 'SUPERSET HANDOFF: ticket ID + operational notes + execution instructions only. Never the title or copied ticket content.', x: 128, y: 407, size: 28, weight: 700 }],
      opens: { type: 'edge', id: 'e-03-04' },
    },
    {
      id: 'n-deps', lines: [
        { text: 'Dependencies / capacity pending? Wait for the event; no', x: 180, y: 1730, size: 28 },
        { text: 'unnecessary human approval.', x: 180, y: 1769, size: 28 },
      ],
      opens: { type: 'decision', id: 'jd-readiness' },
    },
    {
      id: 'n-models', lines: [{ text: 'Models: Grok · Claude Opus · Claude Fable · ChatGPT Sol · ChatGPT Astra', x: 1280, y: 2015, size: 26 }],
      opens: { type: 'decision', id: 'jd-model' },
    },
    {
      id: 'n-ci-blocked', lines: [{ text: 'CI access / infrastructure blocked → pause. A lost session needs controller recovery.', x: 2560, y: 1660, size: 26 }],
      opens: { type: 'stage', id: 's04' },
    },
    {
      id: 'n-04-06b', lines: [
        { text: 'Session checks challenge code changes. 06B challenges', x: 4150, y: 3630, size: 29 },
        { text: 'violations of the real acceptance criteria.', x: 4150, y: 3672, size: 29 },
      ],
      opens: { type: 'explorer', id: 'ci' },
    },
    {
      id: 'n-callout', kind: 'callout', rect: { x: 2090, y: 3760, w: 1610, h: 210 },
      lines: [
        { text: 'Would these tests fail if the implementation violated the actual AC?', x: 2118, y: 3783, size: 29, weight: 700 },
        { text: 'expect(component).toBeDefined() does not prove container-based layout. Try a container → viewport substitution:', x: 2118, y: 3839, size: 27, muted: true },
        { text: 'would the test fail? Record which meaningful AC violation each test detects.', x: 2118, y: 3876, size: 27, muted: true },
      ],
      opens: { type: 'explorer', id: 'verification' },
    },
    {
      id: 'n-deploy', lines: [
        { text: 'Deployment failed or outcome unknown? Hold the stage, reconcile or recover, then', x: 140, y: 5960, size: 28 },
        { text: 'recheck. Never advance on dispatch alone.', x: 140, y: 6000, size: 28 },
      ],
      opens: { type: 'stage', id: 's14' },
    },
    {
      id: 'n-qa-return', kind: 'heading', lines: [{ text: 'QA RETURN · validate the report before another coding attempt', x: 120, y: 6380, size: 34, weight: 700, dark: true }],
      opens: { type: 'stage', id: 's15' },
    },
    {
      id: 'n-sources', lines: [{ text: 'Sources: WFTasks reads the tracker; workers read the tracker + linked designs • image attachments only • stop on missing access • no self-review • only WFJev invokes Jev.', x: 100, y: 7130, size: 25 }],
      opens: { type: 'explorer', id: 'rules' },
    },
    {
      id: 'n-footer', kind: 'footer', rule: { x1: 100, y1: 7170, x2: 5120, y2: 7170 },
      lines: [{ text: 'WHAT: ticket AC / human owner • HOW: Verification Plan / planner • PROOF: independent review of code AND test strength.', x: 100, y: 7205, size: 27, weight: 700, dark: true }],
      opens: { type: 'explorer', id: 'trace' },
    },
  ];

  /*
   * Drawn arrows. `points` are the corner points of the diagram's polylines (the diagram
   * rounds corners; the renderer does too). `kind`: flow | success | fail | ci.
   * `label.rect` is the label background rectangle from the diagram.
   * Transfer details live in data/content.js (WFWorkflow.edgeDetails) keyed by edge id.
   */
  const L = (text, x, y, w, h, size, tone) => ({ text, rect: { x, y, w, h }, size, tone });
  WF.edges = [
    { id: 'e-01-02', from: 's01', to: 's02', kind: 'flow', points: [[1060, 842], [1170, 842], [1170, 1045], [1280, 1045]] },
    { id: 'e-02-start', from: 's02', to: 'd-start', kind: 'flow', points: [[1740, 1280], [1740, 1320]] },
    { id: 'e-start-03', from: 'd-start', to: 's03', kind: 'success', points: [[1740, 1440], [1740, 1470]], label: L('Yes', 1795.125, 1424, 69.75, 42, 24, 'success') },
    { id: 'e-start-human', from: 'd-start', to: 'h-intake', kind: 'fail', points: [[1675, 1380], [1130, 1380], [1130, 1490], [1070, 1490]], label: L('NEEDS_CLARIFICATION', 1221.18359375, 1334, 317.6328125, 41, 23, 'fail') },
    { id: 'e-human-01', from: 'h-intake', to: 's01', kind: 'fail', dashed: true, points: [[610, 1360], [610, 1070]], label: L('Updated ticket → WFTasks (01)', 624.68359375, 1204, 424.320312, 41, 23, 'fail') },
    { id: 'e-r-03', from: 'c-r-in', to: 's03', kind: 'fail', points: [[2240, 2125], [2240, 1730], [2200, 1730]], label: L('Authorized redispatch → 03', 1812.609375, 2186, 394.78125, 42, 24, 'fail') },
    { id: 'e-03-04', from: 's03', to: 's04', kind: 'flow', points: [[2190, 1600], [2360, 1600], [2360, 920], [2550, 920]], label: L('Launch', 2299.51171875, 1124, 120.9765625, 42, 24, 'muted') },
    { id: 'e-session-ci', from: 's04', to: 'ci-service', kind: 'ci', points: [[4170, 900], [4310, 900]], label: L('Checks', 4177, 846, 125, 41, 23, 'muted') },
    { id: 'e-ci-session', from: 'ci-service', to: 's04', kind: 'ci', points: [[4310, 1000], [4170, 1000]] },
    { id: 'e-session-05', from: 's04', to: 's05', kind: 'success', points: [[3900, 1216], [3900, 2350], [5160, 2350], [5160, 2800], [5050, 2800]], label: L('Completion candidate → 05', 4461.8125, 2304, 516.375, 43, 25, 'success') },
    { id: 'e-05-review', from: 's05', to: 'd-review', kind: 'flow', points: [[4140, 2827], [3955, 2827]] },
    { id: 'e-review-06a', from: 'd-review', to: 's06a', kind: 'flow', points: [[3890, 2767], [3890, 2690], [3690, 2690]], label: L('Simple', 3801.89453125, 2634, 116.2109375, 42, 24, 'muted') },
    { id: 'e-review-06b', from: 'd-review', to: 's06b', kind: 'flow', points: [[3890, 2887], [3890, 3410], [3710, 3410]], label: L('Deeper', 3849.109375, 3284, 121.78125, 42, 24, 'muted') },
    { id: 'e-06a-07', from: 's06a', to: 's07', kind: 'flow', points: [[2690, 2690], [1940, 2690], [1940, 3085], [1830, 3085]], label: L('Review passed → QA Develop (07)', 2093.203125, 2636, 463.59375, 41, 23, 'success') },
    { id: 'e-06b-07', from: 's06b', to: 's07', kind: 'flow', points: [[2090, 3440], [1940, 3440], [1940, 3085], [1830, 3085]], label: L('Review passed → 07', 1778.12109375, 3504, 283.7578125, 41, 23, 'success') },
    { id: 'e-06b-r', from: 's06b', to: 'c-r-06b', kind: 'fail', points: [[3700, 3630], [3890, 3630], [3890, 3740]], label: L('Findings → controller → 03', 4020.54296875, 3804, 378.9140625, 42, 24, 'fail') },
    { id: 'e-07-08', from: 's07', to: 's08', kind: 'flow', points: [[780, 3190], [60, 3190], [60, 3900], [150, 3900]], label: L('QA Develop passed → 08', 422.30859375, 3424, 355.3828125, 42, 24, 'success') },
    { id: 'e-08-09', from: 's08', to: 's09', kind: 'flow', points: [[1180, 3950], [1300, 3950], [1300, 4557], [1430, 4557]], label: L('Refreshed evidence → 09', 990, 4314, 300, 42, 24, 'muted') },
    { id: 'e-09-auto', from: 's09', to: 'd-auto', kind: 'flow', points: [[2440, 4557], [2535, 4557]] },
    { id: 'e-auto-10', from: 'd-auto', to: 's10', kind: 'success', points: [[2665, 4557], [2760, 4557], [2760, 4100], [4590, 4100], [4590, 4300]], label: L('09 → 10 · automatic merge authorized; all current gates pass', 2800, 4064, 886.2578125, 43, 25, 'success') },
    { id: 'e-auto-08', from: 'd-auto', to: 's08', kind: 'flow', points: [[2600, 4617], [2600, 4935], [670, 4935], [670, 4146]], label: L('Wait → 08', 1200, 4894, 155.7578125, 42, 24, 'muted') },
    { id: 'e-08-human', from: 's08', to: 'h-staging', kind: 'fail', points: [[400, 4146], [400, 5120], [2770, 5120]], label: L('Human decision needed', 420, 5060, 348.4765625, 42, 24, 'fail') },
    { id: 'e-07-q', from: 's07', to: 'c-q-07', kind: 'fail', points: [[1650, 3320], [1650, 3380]], label: L('QA failed → Q', 1547.43359375, 3454, 205.1328125, 42, 24, 'fail') },
    { id: 'e-10-11', from: 's10', to: 's11', kind: 'flow', points: [[4590, 4770], [4590, 5170]] },
    { id: 'e-11-12', from: 's11', to: 's12', kind: 'flow', points: [[4140, 5397], [3980, 5397], [3980, 5757], [3770, 5757]] },
    { id: 'e-12-13', from: 's12', to: 's13', kind: 'flow', points: [[2710, 5757], [2570, 5757]] },
    { id: 'e-13-release', from: 's13', to: 'd-release', kind: 'flow', points: [[1560, 5757], [1470, 5757]] },
    { id: 'e-release-14', from: 'd-release', to: 's14', kind: 'success', points: [[1340, 5757], [1260, 5757]], label: L('Yes', 1265, 5710, 69.75, 42, 24, 'success') },
    { id: 'e-release-human', from: 'd-release', to: 'h-prod', kind: 'fail', points: [[1405, 5817], [1405, 6240], [1490, 6240]], label: L('Human decision needed', 1045, 6190, 348.4765625, 42, 24, 'fail') },
    { id: 'e-11-q', from: 's11', to: 'c-q-11', kind: 'fail', points: [[4910, 5625], [4910, 5700]], label: L('QA failed → Q', 4607.43359375, 5774, 205.1328125, 42, 24, 'fail') },
    { id: 'e-q-15', from: 'c-q-in', to: 's15', kind: 'fail', points: [[95, 6355], [95, 6720], [130, 6720]] },
    { id: 'e-15-report', from: 's15', to: 'd-report', kind: 'flow', points: [[1400, 6710], [1655, 6710]] },
    { id: 'e-report-16', from: 'd-report', to: 's16', kind: 'success', points: [[1815, 6710], [2060, 6710]], label: L('Yes', 1900.125, 6654, 69.75, 42, 24, 'success') },
    { id: 'e-16-r', from: 's16', to: 'c-r-16', kind: 'fail', points: [[3260, 6710], [3390, 6710]], label: L('→ 03', 3467.0625, 6754, 85.875, 42, 24, 'fail') },
    { id: 'e-report-17', from: 'd-report', to: 's17', kind: 'fail', points: [[1740, 6775], [1740, 7080], [4420, 7080], [4420, 6880]], label: L('Incomplete → human supplies details', 3657.0859375, 7094, 525.828125, 42, 24, 'fail') },
  ];

  /*
   * Transitions that the approved diagram describes in text (inside a box, via an
   * off-page connector, or in PIPELINE.md) but does NOT draw as an arrow.
   * They are never rendered as arrows; they appear only in the detail drawer.
   */
  WF.implicitEdges = [
    { id: 'i-r-link', from: 'c-r-06b', to: 'c-r-in', via: 'Connector R', text: 'Off-page connector R: 06B findings (and 16 rework) re-enter at 03 through the controller.' },
    { id: 'i-r16-link', from: 'c-r-16', to: 'c-r-in', via: 'Connector R', text: 'Off-page connector R: validated rework from 16 re-enters at 03.' },
    { id: 'i-q-link', from: 'c-q-07', to: 'c-q-in', via: 'Connector Q', text: 'Off-page connector Q: a QA Develop failure enters QA RETURN at 15.' },
    { id: 'i-q11-link', from: 'c-q-11', to: 'c-q-in', via: 'Connector Q', text: 'Off-page connector Q: a QA Staging failure enters QA RETURN at 15.' },
    { id: 'i-review-human', from: 's05', to: 'h-review', via: 'Box text + PIPELINE 05', text: 'Required human decisions identified in 05 go to the named product / security / design owner.' },
    { id: 'i-human-05', from: 'h-review', to: 's05', via: 'Box text', text: 'Return the update to WFTasks (05), which refreshes context before review resumes.' },
    { id: 'i-human-08', from: 'h-staging', to: 's08', via: 'Box text', text: 'Return the update to WFRelease (08); it reloads current evidence before step 09.' },
    { id: 'i-human-12', from: 'h-prod', to: 's12', via: 'Box text', text: 'Return the release decision to WFRelease (12). It refreshes evidence before WFJev re-evaluates.' },
    { id: 'i-17-15', from: 's17', to: 's15', via: 'Box text (17 Pass)', text: 'Updated report → step 15. Do not launch coding while the report is insufficient.' },
    { id: 'i-06a-r', from: 's06a', to: 'c-r-in', via: 'PIPELINE.md 06A row', text: '06A findings → controller → 03 (described in PIPELINE.md; not drawn as an arrow).' },
    { id: 'i-session-03', from: 's04', to: 's03', via: 'Diagram note', text: 'A lost session needs controller recovery (bounded recovery through 03).' },
  ];

  /* Stable legend of edge styles. */
  WF.edgeKinds = {
    flow: { label: 'Normal flow' },
    success: { label: 'Pass / automatic progression' },
    fail: { label: 'Failure, rework or human path' },
    ci: { label: 'CI dispatch / results' },
  };
})(typeof window !== 'undefined' ? window : globalThis);
