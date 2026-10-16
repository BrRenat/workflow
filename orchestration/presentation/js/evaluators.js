/*
 * "Explain decision" evaluators — pure functions that mirror the documented gates.
 * Each returns { label, tone, next, reasons: [{ text, rule }] } where `rule` is an id
 * in data/rules.js. Unit-tested in tests/evaluators.test.mjs.
 *
 * These do not implement the production controller; they explain the documented order
 * of gates so a reader can see why a route is chosen. They never produce new policy.
 */
(function (root) {
  const E = (root.WFEvaluators = {});
  const bad = (v) => v !== 'pass';

  /* 02 · readiness + routing — order follows jev/references/workflow.md “Intake and promotion”. */
  E.readiness = function (i) {
    const reasons = [];
    const secondary = [];
    const out = (label, tone, next, disposition) => ({ label, tone, next, disposition, reasons, secondary });
    if (!i.access) {
      reasons.push({ text: 'tracker issue unreadable: stop and report.', rule: 'access-stops' });
      return out('BLOCKED_ACCESS', 'fail', 'Stop; report the missing access. No guessed requirements.', 'blocked_access');
    }
    if (i.dependency === 'pending') secondary.push({ text: 'Blocking dependency unresolved.', rule: 'wait-not-approval' });
    if (!i.present) secondary.push({ text: 'No explicit AC in the tracker (factual presence check in code).', rule: 'readiness-presence-code' });
    const semantic = [
      ['unambiguous', 'AC are ambiguous or leave competing outcomes.', 'q-unambiguous'],
      ['verifiable', 'AC are not observable / verifiable.', 'q-verifiable'],
      ['consistent', 'AC contradict each other or the ticket context.', 'q-consistent'],
      ['context', 'Implementation would require a guessed requirement.', 'q-context'],
    ];
    if (i.present && i.jev !== 'available') secondary.push({ text: 'Jev tool/API unavailable: no simulated answer.', rule: 'jev-blocked' });
    if (i.present && i.jev === 'available') {
      for (const [k, text, rule] of semantic) {
        if (i[k] === 'fail') secondary.push({ text, rule });
        if (i[k] === 'uncertain') secondary.push({ text: `${k}: uncertain; an uncertain answer is not a pass.`, rule: 'uncertainty-band' });
      }
    }
    if (i.risk) secondary.push({ text: 'Elevated change risk (auth, secrets, money, destructive data, public contract or rollout).', rule: 'elevated-risk' });
    if (i.capacity !== 'available') secondary.push({ text: i.capacity === 'unknown' ? 'Quota unknown: the example policy holds automatic launch.' : 'Capable workers busy.', rule: i.capacity === 'unknown' ? 'policy-quota-hold' : 'model-quota' });

    const acFailed = !i.present || (i.jev === 'available' && semantic.some(([k]) => bad(i[k])));
    reasons.push(...secondary);
    if (i.dependency === 'pending') return out('WAIT_DEPENDENCY', 'wait', 'Wait for the dependency event; no human approval needed.', 'wait_dependency');
    if (acFailed) return out('NEEDS_CLARIFICATION', 'fail', 'Return to the human ticket owner with the exact missing specification → updated ticket → WFTasks 01 → Jev 02. No drafted AC.', 'human_attention');
    if (i.jev !== 'available') return out('BLOCKED_JEV', 'fail', 'Leave the task unpromoted; report blocked_jev.', 'blocked_jev');
    if (i.risk) return out('HUMAN_ATTENTION', 'human', 'Named owner decides the elevated-risk question before the automatic lane.', 'human_attention');
    if (i.capacity !== 'available') return out('WAIT_CAPACITY', 'wait', 'Wait for capacity; do not silently use an unsuitable model.', 'wait_capacity');
    reasons.push({ text: 'All five AC readiness checks pass; owner, model, capacity and permission ready.', rule: 'readiness-five' });
    return out('READY', 'pass', '→ 03 launch. Autopromote is a recommendation; it acts only in an active, calibrated, authorized lane.', 'autopromote');
  };

  /* 05 · review depth — jev/references/workflow.md “Review routing”, steps 1–5. */
  E.review = function (i) {
    // Illustrative policy simulation only; no live Jev call, CI gate or action grant.
    const reasons = [];
    const attention = [];
    const investigations = [];
    for (const [key, request] of [
      ['productDecision', 'Product / domain owner: unresolved business intent'],
      ['specialist', 'Security / data / platform owner: unresolved specialist decision'],
      ['humanCheck', 'QA / design owner: specific human-only acceptance check'],
    ]) {
      if (i[key] === 'yes') attention.push(request);
      else if (i[key] !== 'no') investigations.push(`Investigate ${key}; uncertainty is not a human escalation or an all-clear.`);
    }
    if (attention.length || investigations.length) reasons.push({ text: 'Resolve concrete decisions and investigate uncertainty before dependent progress.', rule: 'route-human' });
    if (i.context !== 'pass') {
      reasons.push({ text: 'Missing scope or intent: collect context; absent runtime verification can be review work.', rule: 'route-context' });
      return { label: 'COLLECT_CONTEXT', tone: 'wait', route: null, next: 'Collect the exact missing scope/intent, then refresh 05.', reasons, attention, investigations };
    }
    const deep = [];
    if (i.repoRequiresIndependent) deep.push('repository/domain policy requires it');
    if (i.qaReopen) deep.push('validated QA reopen');
    for (const [key, label] of [['behavior', 'behavior_verification_needed'], ['crossComponent', 'cross_component_verification_needed']]) {
      if (i[key] !== 'no') deep.push(`${label} is positive or uncertain`);
    }
    let route;
    if (i.repoRequiresBoth) {
      route = 'github_codex_and_independent_verification';
      reasons.push({ text: 'Repository explicitly requires both routes.', rule: 'route-independent' });
    } else if (deep.length) {
      route = 'independent_verification';
      reasons.push({ text: `06B required: ${deep.join('; ')}.`, rule: 'route-independent' });
    } else if (i.githubSufficient === 'yes' && i.coverageAccepted) {
      route = 'github_codex';
      reasons.push({ text: 'Both verification-needed predicates negative, static review sufficient and configured coverage accepted.', rule: 'route-github' });
    } else {
      route = 'independent_verification';
      reasons.push({ text: '06A sufficiency or configured coverage is not established.', rule: 'route-github' });
    }
    const labels = { github_codex: '06A · github_codex', independent_verification: '06B · independent_verification', github_codex_and_independent_verification: '06A + 06B' };
    return {
      label: labels[route], tone: attention.length ? 'human' : investigations.length ? 'wait' : 'pass', route,
      next: `Recommendation: ${labels[route]}. Current-head evidence, policy and grants are checked separately before launch.` +
        (attention.length ? ' Resolve named human items through WFTasks 05 before dependent progress.' : '') +
        (investigations.length ? ` ${investigations.join(' ')}` : ''),
      reasons, attention, investigations,
    };
  };

  /* 09 · staging decision — status-flows.md “Ready for Staging”. WFRelease refreshes evidence in 08; WFJev runs the Jev completion for the target merge plus deterministic gates. Re-runs after every wait. */
  E.STAGING_GATES = [
    ['qaDevelop', 'QA moved the ticket to Ready for Staging on the reviewed head', '09-after-qa'],
    ['freshHead', 'Head / artifact re-fetched in 08 and unchanged since review and QA', '09-stale'],
    ['ci', 'Required CI passed on the current head', '09-gates'],
    ['review', 'Independent review passed for the current head', '09-gates'],
    ['noFindings', 'No unresolved review threads or findings', '09-gates'],
    ['branch', 'Branch rules / approvals satisfied', '09-gates'],
    ['window', 'Staging release readiness / window', '09-gates'],
    ['jevPass', 'Jev completion for the target `merge`: no expanded scope, outstanding manual check or coordination need', 'deliver-not-blanket'],
    ['grantMerge', '`merge` action authorized (when CI deploys on merge, the merge is the staging deploy)', 'merge-grant'],
    ['policyActive', 'Policies active (not shadow) and the completion lane calibrated', 'shadow-no-mutation'],
  ];
  E.staging = function (i) {
    if (!i.qaDevelop) {
      return { label: 'NOT ELIGIBLE', tone: 'fail', next: '09 never runs before QA Develop (07) passes.', reasons: [{ text: 'QA has not moved the ticket to Ready for Staging on this head.', rule: '09-after-qa' }], blockers: ['qaDevelop'] };
    }
    const blockers = E.STAGING_GATES.filter(([k]) => !i[k]);
    const reasons = blockers.map(([, text, rule]) => ({ text: `Missing: ${text.replace(/`/g, '')}`, rule }));
    if (!blockers.length && !i.humanDecision) {
      reasons.push({ text: 'All current gates, the Jev answers and the merge grant pass.', rule: '09-automatic' });
      return { label: 'AUTO MERGE', tone: 'pass', next: '→ 10 directly (automatic_merge; not yet an executed merge)', reasons, blockers: [] };
    }
    if (i.humanDecision) {
      reasons.push({ text: 'A named human release decision is pending.', rule: '08-human' });
      return { label: 'HUMAN DECISION NEEDED', tone: 'human', next: '→ release / domain owner → WFRelease 08 → 09 re-runs', reasons, blockers: blockers.map(([k]) => k) };
    }
    const onlyShadow = blockers.length === 1 && blockers[0][0] === 'policyActive';
    return {
      label: onlyShadow ? 'WAIT · recommendation only' : 'WAIT',
      tone: 'wait',
      next: '→ wait under WFRelease 08 (record blockers, owner, wake-up); 09 re-runs when the wait resolves',
      reasons,
      blockers: blockers.map(([k]) => k),
    };
  };

  /* 13 · production release decision — status-flows.md “Ready for Release”. WFRelease refreshes evidence in 12; WFJev runs the Jev step-13 completion (stricter than 09) plus deterministic gates and the deploy_production grant. Re-runs after every wait. */
  E.RELEASE_GATES = [
    ['qaStaging', 'QA Staging accepted the exact staged artifact (authorized QA identity)', '12-hold'],
    ['freshArtifact', 'Artifact / head re-fetched in 12 and unchanged since QA Staging', '12-new-head'],
    ['ci', 'Required CI passed on the current head', '12-hold'],
    ['review', 'Independent review passed for the current head, no open threads', '12-hold'],
    ['batchClean', 'Release batch contains no blocked or unknown-status change', '12-batch'],
    ['noIncident', 'No active incident, release freeze or closed production window', '13-automatic'],
    ['rollout', 'Rollout order, prerequisites and recovery path covered', '13-strict'],
    ['branch', 'Production branch rules / approvals satisfied', '12-hold'],
    ['jevPass', 'Jev step-13 completion: four positive and seven negative predicates inside the 0.9/0.1 bands', '13-strict'],
    ['grantDeploy', '`deploy_production` action authorized (when CI deploys on merge, the production merge is the deployment)', '14-merge'],
    ['policyActive', 'Policies active (not shadow) and the completion lane calibrated', 'shadow-no-mutation'],
  ];
  E.release = function (i) {
    if (!i.qaStaging) {
      return { label: 'NOT ELIGIBLE', tone: 'fail', next: '13 never runs before QA Staging (11) accepts the exact artifact.', reasons: [{ text: 'QA Staging has not accepted this artifact.', rule: '12-hold' }], blockers: ['qaStaging'] };
    }
    const blockers = E.RELEASE_GATES.filter(([k]) => !i[k]);
    const reasons = blockers.map(([, text, rule]) => ({ text: `Missing: ${text.replace(/`/g, '')}`, rule }));
    if (i.riskHuman || i.humanDecision) {
      reasons.push({ text: i.riskHuman ? 'The change is in a class the policy reserves for a human release decision.' : 'A named human production release decision is pending.', rule: '13-human' });
      return { label: 'HUMAN DECISION NEEDED', tone: 'human', next: '→ production release owner → WFRelease 12 → 13 re-runs', reasons, blockers: blockers.map(([k]) => k) };
    }
    if (!blockers.length) {
      reasons.push({ text: 'All current gates, the stricter Jev answers and the deploy_production grant pass.', rule: '13-automatic' });
      return { label: 'AUTO RELEASE', tone: 'pass', next: '→ 14 directly (automatic_release: merge to production, verify delivery, mark_done; not yet an executed merge)', reasons, blockers: [] };
    }
    const onlyShadow = blockers.length === 1 && blockers[0][0] === 'policyActive';
    return {
      label: onlyShadow ? 'WAIT · recommendation only' : 'WAIT',
      tone: 'wait',
      next: '→ wait under WFRelease 12 (record blockers, owner, wake-up); 13 re-runs when the wait resolves',
      reasons,
      blockers: blockers.map(([k]) => k),
    };
  };

  /* 15 · QA report validation — status-flows.md “QA return” table. */
  E.qa = function (i) {
    const reasons = [];
    if (!i.build || !i.steps || !i.expectedActual) reasons.push({ text: 'Missing tested build, reproduction steps or expected / actual result.', rule: '17-row' });
    if (i.video && !i.screenshot) reasons.push({ text: 'Video report without a relevant screenshot + written repro.', rule: '15-video' });
    if (i.build && !i.buildHasFix) reasons.push({ text: 'Tested build does not contain the fix → request a retest, not rework.', rule: '15-stale-build' });
    if (i.relation === 'new_requirement') reasons.push({ text: 'New behavior outside the accepted AC → scope decision / linked ticket.', rule: '15-new-scope' });
    if (i.relation === 'insufficient_evidence') reasons.push({ text: 'Relation to the accepted scope cannot be established.', rule: '17-row' });
    if (!i.ownerMatches) reasons.push({ text: 'Evidence supports a different owner → evidence-backed reroute proposal.', rule: '17-row' });
    if (i.attempts >= 2) reasons.push({ text: `Failed attempts (${i.attempts}) reached the example budget of 2 → request a diagnostic plan or decision.`, rule: 'policy-retry-budget' });
    if (reasons.length) return { label: 'INCOMPLETE → 17', tone: 'human', next: '→ 17: request only the missing facts / decision; the update returns to WFTasks 15. No coding.', reasons };
    reasons.push({ text: `Confirmed ${i.relation === 'introduced_regression' ? 'regression' : 'original failure'} on the correct build.`, rule: '16-row' });
    return { label: 'REPORT VALID → 16', tone: 'pass', next: '→ 16 → R → 03 (minimal payload); the new fix needs a fresh independent behavior review.', reasons };
  };

  /* 02 / 16 · model routing — jev/references/model-routing.md. */
  E.STARTER_LANES = {
    bounded: 'grok',
    routine: 'claude_fable',
    multi_component: 'claude_opus',
    deep_diagnosis: 'chatgpt_astra',
  };
  E.model = function (i) {
    const reasons = [];
    if (i.registry === 'example') {
      reasons.push({ text: 'Committed example registry: runtime_id null, capabilities_verified false, no approved lanes.', rule: 'policy-models-unverified' });
      reasons.push({ text: 'A model name alone is not capability evidence.', rule: 'model-name' });
      return { label: 'HUMAN_ATTENTION', tone: 'human', next: 'Capability mapping missing → set up the registry; no model is eligible.', reasons, model: null };
    }
    if (i.complexity === 'unknown') {
      reasons.push({ text: 'task_complexity is unknown, so it is non-actionable.', rule: 'model-no-downgrade' });
      return { label: 'HUMAN_ATTENTION', tone: 'human', next: 'Bounded diagnostic escalation or a human decision; never pick the cheapest model to keep moving.', reasons, model: null };
    }
    if (i.quota === 'unknown') {
      reasons.push({ text: 'Quota unknown: example policy `hold_automatic_launch`.', rule: 'policy-quota-hold' });
      return { label: 'WAIT_CAPACITY', tone: 'wait', next: 'Hold automatic launch until telemetry or an approved bound exists.', reasons, model: null };
    }
    if (i.quota === 'exhausted') {
      reasons.push({ text: 'Every capable worker is busy.', rule: 'model-quota' });
      return { label: 'WAIT_CAPACITY', tone: 'wait', next: 'Wait for capacity; no silent downgrade.', reasons, model: null };
    }
    const model = E.STARTER_LANES[i.complexity];
    reasons.push({ text: `Starter lane proposal for "${i.complexity}" → ${model}. Proposals, not verified benchmarks.`, rule: 'model-starter' });
    reasons.push({ text: 'Jev relative choice must also pass the selected candidate’s absolute fit.', rule: 'model-fit' });
    return { label: `SELECT ${model}`, tone: 'pass', next: 'Resolve the exact runtime ID, reserve the slot, then launch through 03.', reasons, model };
  };
})(typeof window !== 'undefined' ? window : globalThis);
