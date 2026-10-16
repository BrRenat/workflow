/*
 * "Actual rule" means a verbatim quote from a repository file. These tests make it
 * impossible to display an invented operational rule as an actual one.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadData, readRepoFile, norm, REPO_ROOT, PRESENTATION_DIR } from './helpers.mjs';
import { renderSources } from '../scripts/build-sources.mjs';

const { wf, sources } = loadData({ sources: true });

/** Return the text of a Markdown section: from its heading to the next heading of the same or higher level. */
function markdownSection(text, heading) {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => /^#{1,6}\s/.test(l) && l.replace(/^#+\s*/, '').trim() === heading);
  if (start < 0) return null;
  const level = lines[start].match(/^#+/)[0].length;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,6})\s/);
    if (m && m[1].length <= level && !inFence(lines, i)) { end = i; break; }
  }
  return lines.slice(start, end).join('\n');
}
function inFence(lines, index) {
  let open = false;
  for (let i = 0; i < index; i++) if (/^```/.test(lines[i])) open = !open;
  return open;
}

test('every rule quote appears verbatim in the named file and section', () => {
  assert.ok(wf.rules.length > 50, 'rules loaded');
  const ids = new Set();
  for (const r of wf.rules) {
    assert.ok(!ids.has(r.id), `duplicate rule id ${r.id}`);
    ids.add(r.id);
    assert.ok(existsSync(resolve(REPO_ROOT, r.file)), `${r.id}: file ${r.file} exists`);
    const text = readRepoFile(r.file);
    if (r.file.endsWith('.json')) {
      const value = r.section.split('.').reduce((o, k) => (o == null ? o : o[k]), JSON.parse(text));
      assert.notEqual(value, undefined, `${r.id}: JSON path ${r.section}`);
      const scoped = JSON.stringify({ [r.section.split('.').pop()]: value }, null, 2);
      assert.ok(norm(scoped).includes(norm(r.quote)) || norm(text).includes(norm(r.quote)), `${r.id}: quote in ${r.file}`);
      if (typeof value !== 'object') assert.ok(norm(r.quote).includes(typeof value === 'string' ? value : JSON.stringify(value)), `${r.id}: quote shows the value at ${r.section}`);
    } else {
      const section = markdownSection(text, r.section);
      assert.ok(section, `${r.id}: heading "${r.section}" in ${r.file}`);
      assert.ok(norm(section).includes(norm(r.quote)), `${r.id}: quote not found in ${r.file} § ${r.section}\n  "${r.quote}"`);
    }
  }
});

test('skills reference existing rules and real files', () => {
  const ruleIds = new Set(wf.rules.map((r) => r.id));
  for (const s of wf.skills) {
    for (const id of s.rules) assert.ok(ruleIds.has(id), `skill ${s.id} → rule ${id}`);
    for (const f of s.files) assert.ok(existsSync(resolve(REPO_ROOT, f)), `skill ${s.id} → file ${f}`);
    assert.ok(s.explain, `skill ${s.id} has a UI explanation`);
  }
  const required = ['issue-readiness', 'task-routing', 'model-selection', 'review-depth', 'merge-promotion',
    'verification-planning', 'scenario-derivation', 'boundary-analysis', 'evidence-planning',
    'implementation-rules', 'testing-requirements', 'repository-instructions',
    'ac-verification', 'test-strength-analysis', 'counterexample-search', 'business-behavior-review'];
  assert.deepEqual(required.filter((id) => !wf.skills.some((s) => s.id === id)), []);
});

test('every file cited by a rule or skill is embedded for the source viewer', () => {
  const cited = new Set([...wf.rules.map((r) => r.file), ...wf.skills.flatMap((s) => s.files)]);
  for (const f of cited) assert.ok(wf.sourceFiles.includes(f), `${f} listed in sourceFiles`);
});

test('data/sources.js is an up-to-date verbatim copy (run scripts/build-sources.mjs)', () => {
  const current = readFileSync(resolve(PRESENTATION_DIR, 'data/sources.js'), 'utf8');
  assert.equal(current, renderSources(), 'data/sources.js is stale');
  for (const f of wf.sourceFiles) assert.equal(sources[f], readRepoFile(f), `${f} embedded verbatim`);
});
