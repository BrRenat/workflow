/*
 * Browser tests for the important interactions. Runs the static page from file:// in
 * headless Chromium via Playwright. Skips (with a message) when Playwright is unavailable.
 *
 *   npm test            (from orchestration/presentation, after `npm install`)
 *   node --test tests/  (uses a global Playwright if installed)
 */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { PRESENTATION_DIR, loadData } from './helpers.mjs';

function loadPlaywright() {
  const req = createRequire(import.meta.url);
  try { return req('playwright'); } catch { /* try global */ }
  try { return createRequire(`${execSync('npm root -g').toString().trim()}/`)('playwright'); } catch { return null; }
}
const pw = loadPlaywright();
const URL = pathToFileURL(resolve(PRESENTATION_DIR, 'index.html')).href;
const { wf } = loadData();
const skip = pw ? false : 'Playwright not installed';

let browser;
before(async () => {
  if (!pw) return;
  const opts = {};
  if (process.env.PLAYWRIGHT_CHROMIUM_PATH) opts.executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
  browser = await pw.chromium.launch(opts);
});
after(async () => { if (browser) await browser.close(); });

async function openPage(hash = '', opts = {}) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, ...opts });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(URL + hash);
  await page.waitForFunction(() => document.body.classList.contains('ready'));
  page.errors = errors;
  return page;
}
const drawerTitle = (page) => page.locator('#drawer-title').textContent();

test('loads without errors, renders every stage and arrow, works without a hash', { skip }, async () => {
  const page = await openPage();
  assert.equal(await page.locator('.node.stage').count(), wf.stages.length);
  assert.equal(await page.locator('.edge').count(), wf.edges.length);
  assert.equal(await page.locator('.node.decision').count(), wf.decisions.length);
  assert.equal(await page.locator('#drawer.open').count(), 0, 'no drawer without hash');
  assert.deepEqual(page.errors, []);
  await page.close();
});

test('clicking a stage opens the detail drawer with every section and updates the hash', { skip }, async () => {
  const page = await openPage();
  await page.evaluate(() => WFApp.diagram.fit(false));
  await page.locator('.node.stage[data-id="s06b"]').click();
  await page.waitForSelector('#drawer.open');
  assert.match(await drawerTitle(page), /Behavior \+ semantic test-strength review/);
  const headings = await page.locator('#drawer-body .d-h > span:first-child').allTextContents();
  for (const h of ['Diagram card', 'Responsibility', 'Must NOT do', 'Inputs', 'Outputs', 'Readiness criteria', 'Completion criteria', 'Rules', 'Skills', 'Tools', 'Verification', 'Failure paths', 'Web widget example']) {
    assert.ok(headings.includes(h), `section ${h}`);
  }
  assert.ok(page.url().endsWith('#step-06b'));
  assert.equal(await page.locator('.node[data-id="s06b"].is-selected').count(), 1, 'selected node highlighted');
  assert.equal(await page.locator('.node.is-dim').count(), 0, 'rest of the workflow stays visible');
  await page.close();
});

test('Verification Planner states it must not create, expand, reinterpret or improve AC', { skip }, async () => {
  const page = await openPage('#step-04');
  await page.waitForSelector('#drawer.open');
  assert.equal((await page.locator('.must-not-lead').textContent()).trim(), 'Must not create, expand, reinterpret, or improve Acceptance Criteria.');
  await page.close();
});

test('an edge explains what crosses the boundary (Superset handoff)', { skip }, async () => {
  const page = await openPage('#edge-03-04');
  await page.waitForSelector('#drawer.open');
  const text = await page.locator('#drawer-body').textContent();
  assert.match(text, /Issue ID \(also the task name\)/);
  assert.match(text, /Not transferred/);
  assert.match(text, /Ticket title/);
  assert.match(text, /Fetched directly by the receiving session/);
  await page.close();
});

test('deep links: skill, agent, AC trace and explorer', { skip }, async () => {
  let page = await openPage('#skill-counterexample-search');
  await page.waitForSelector('#drawer.open');
  assert.equal(await drawerTitle(page), 'Counterexample search');
  assert.equal(await page.locator('#skill-counterexample-search[open]').count(), 1, 'skill expanded in the explorer');
  await page.close();

  page = await openPage('#agent-jev');
  const jevNodes = [...wf.stages, ...wf.humans, ...wf.decisions, ...wf.services].filter((n) => n.agents.includes('jev')).length;
  assert.equal(await page.locator('.node.is-hl').count(), jevNodes, 'every Jev stage highlighted');
  await page.close();

  page = await openPage('#ac-3');
  await page.waitForSelector('#drawer.open');
  assert.equal(await drawerTitle(page), 'Trace AC-3');
  assert.equal(await page.locator('.node.is-current').count(), 1);
  await page.keyboard.press('ArrowRight');
  assert.ok(page.url().endsWith('#ac-3-step-2'));
  await page.close();

  page = await openPage('#explorer-verification');
  assert.equal(await page.locator('#tab-verification[aria-selected="true"]').count(), 1);
  await page.close();
});

test('presentation mode: next / previous / overview with the keyboard, not while typing', { skip }, async () => {
  const page = await openPage();
  await page.locator('[data-mode="present"]').click();
  await page.waitForSelector('#caption:not([hidden])');
  assert.match(await page.locator('.cap-kicker').textContent(), /1 \/ /);
  await page.keyboard.press('ArrowRight');
  assert.match(await page.locator('.cap-kicker').textContent(), /2 \/ /);
  assert.ok(await page.locator('.node[data-id="s01"].is-current').count(), 'step node emphasised');
  assert.ok(await page.locator('.node.is-dim').count() > 0, 'unrelated nodes dimmed');
  await page.keyboard.press('ArrowLeft');
  assert.match(await page.locator('.cap-kicker').textContent(), /1 \/ /);
  await page.locator('#search').focus();
  await page.keyboard.press('ArrowRight');
  assert.match(await page.locator('.cap-kicker').textContent(), /1 \/ /, 'arrow keys ignored in the search field');
  await page.locator('#search').blur();
  await page.keyboard.press('Escape');
  assert.match(await page.locator('.cap-kicker').textContent(), /overview/);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#caption').isHidden(), true, 'second Esc exits');
  assert.equal(await page.evaluate(() => WFApp.state.mode), 'explore');
  await page.close();
});

test('walkthrough uses the example without changing the workflow', { skip }, async () => {
  const page = await openPage('#walkthrough-8');
  await page.waitForSelector('#caption:not([hidden])');
  assert.match(await page.locator('.cap-title').textContent(), /Independent semantic verification/);
  assert.equal(await page.locator('.node.stage').count(), wf.stages.length);
  await page.close();
});

test('Jev decisions and human touchpoints overlays', { skip }, async () => {
  const page = await openPage();
  await page.locator('[data-toggle="jev"]').click();
  assert.equal(await page.locator('.badge.b-jev').count(), wf.jevDecisions.length);
  await page.locator('[data-toggle="humans"]').click();
  const touch = new Set(wf.humanCategories.flatMap((c) => c.nodes));
  assert.equal(await page.locator('.badge.b-human').count(), touch.size);
  await page.locator('.badge.b-jev').first().click();
  await page.waitForSelector('#drawer.open');
  assert.equal(await page.locator('#drawer-kicker').textContent(), 'Jev decision');
  await page.close();
});

test('local search finds and highlights mutation, Jev, Superset, auto merge, counterexample', { skip }, async () => {
  const page = await openPage();
  for (const q of ['mutation', 'Jev', 'AC', 'Superset', 'visual regression', 'auto merge', 'counterexample']) {
    await page.locator('#search').fill(q);
    const n = await page.locator('#search-results [role="option"]').count();
    assert.ok(n > 0, `results for ${q}`);
    assert.ok(await page.locator('.node.search-hit').count() > 0, `highlights for ${q}`);
  }
  await page.locator('#search').fill('auto merge');
  const first = await page.locator('#search-results [role="option"]').first().textContent();
  assert.match(first, /merge|Staging|Auto/i);
  await page.locator('#search').press('Enter');
  await page.waitForSelector('#drawer.open');
  await page.close();
});

test('decision evaluators follow the policy: example policy waits, configured grants auto-merge', { skip }, async () => {
  const page = await openPage('#explorer-promotion');
  const ev = page.locator('#panel-promotion .evaluator[data-eval="staging"]');
  assert.match(await ev.locator('.eval-head .verdict').textContent(), /^WAIT/);
  await ev.locator('[data-preset="configured"]').click();
  assert.equal(await ev.locator('.eval-head .verdict').textContent(), 'AUTO MERGE');
  await ev.locator('[data-preset="no-qa"]').click();
  assert.equal(await ev.locator('.eval-head .verdict').textContent(), 'NOT ELIGIBLE');
  await page.close();
});

test('mutation lab: killed vs survived, and 06B verification status is inspectable', { skip }, async () => {
  const page = await openPage('#explorer-ci');
  const lab = page.locator('.mut-lab');
  assert.match(await lab.locator('.mut-verdict').textContent(), /killed/);
  await lab.getByRole('button', { name: /M4/ }).click();
  assert.match(await lab.locator('.mut-verdict').textContent(), /survived/);
  await lab.getByRole('button', { name: /Round 2/ }).click();
  assert.match(await lab.locator('.mut-verdict').textContent(), /killed/);

  await page.evaluate(() => WFApp.open('explorer:verification'));
  await page.locator('.status-row.v-UNVERIFIED').click();
  await page.waitForSelector('#drawer.open');
  const text = await page.locator('#drawer-body').textContent();
  assert.match(text, /Required/);
  assert.match(text, /never change container dimensions after mount/);
  assert.match(text, /UNVERIFIED/);
  await page.close();
});

test('source viewer shows the actual rule in context and returns to the workflow', { skip }, async () => {
  const page = await openPage('#rule-06b-tobedefined');
  await page.waitForSelector('#drawer.open');
  await page.locator('#drawer-body .rule-card button', { hasText: 'Open rule' }).first().click();
  await page.waitForSelector('#source-dialog[open]');
  assert.equal(await page.locator('#source-path').textContent(), 'orchestration/references/acceptance-and-verification.md');
  assert.match(await page.locator('.src-line.hit').first().textContent(), /toBeDefined/);
  await page.locator('#source-back').click();
  assert.equal(await page.locator('#source-dialog[open]').count(), 0);
  await page.close();
});

test('zoom controls and legend highlighting', { skip }, async () => {
  const page = await openPage();
  const z0 = await page.locator('#zoom-level').textContent();
  await page.locator('#zoom-in').click();
  assert.notEqual(await page.locator('#zoom-level').textContent(), z0);
  await page.locator('#zoom-fit').click();
  await page.locator('.legend-item[data-legend="human"]').hover();
  const humanStages = wf.stages.filter((s) => s.kind === 'human').length + wf.humans.length;
  assert.equal(await page.locator('.node.is-hl').count(), humanStages);
  await page.close();
});

test('mobile: list view by default, bottom sheet, no page-level horizontal overflow', { skip }, async () => {
  const page = await openPage('', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  assert.equal(await page.locator('#list-view').isVisible(), true);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), 0);
  await page.locator('.lv-card[data-open="node:s06b"]').tap();
  await page.waitForSelector('#drawer.open');
  const box = await page.locator('#drawer').boundingBox();
  assert.ok(box.y > 100 && box.width <= 390, 'drawer is a bottom sheet');
  await page.locator('#list-view .seg-btn[data-view="diagram"]').tap();
  assert.equal(await page.locator('#diagram').isVisible(), true);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), 0);
  await page.close();
});
