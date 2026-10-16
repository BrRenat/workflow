/*
 * The presentation re-draws the approved diagram from data/workflow.js.
 * These tests prove that the data matches orchestration/assets/workflow.svg:
 * same stages, numbering, wording, boxes, diamonds, connectors, arrows and labels,
 * and that no diagram text was silently dropped or added.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadData, parseDiagram } from './helpers.mjs';

const { wf } = loadData();
const d = parseDiagram();
const near = (a, b, tol = 0.6) => Math.abs(a - b) <= tol;
const findText = (text, pred = () => true) => d.texts.filter((t) => t.text === text && pred(t));
const hasRect = (b) => d.rects.some((r) => near(r.x, b.x) && near(r.y, b.y) && near(r.w, b.w) && near(r.h, b.h));

/** Reproduces the diagram's card row layout: first row at y+118, +34 per line, +48 between rows. */
function cardLines(stage) {
  const out = [];
  let y = stage.box.y + 118;
  for (const [key, label] of [['ready', 'Ready'], ['scope', 'Scope'], ['tools', 'Tools'], ['pass', 'Pass']]) {
    out.push({ text: label, x: stage.box.x + 27, y });
    stage.card[key].forEach((line, i) => out.push({ text: line, x: stage.box.x + 125, y: y + i * 34 }));
    y += (stage.card[key].length - 1) * 34 + 48;
  }
  return out;
}

test('every numbered stage exists in the diagram with the same box, number, title, owner and status', () => {
  const numbers = d.texts.filter((t) => t.fill === '#FFFFFF' && /^\d\d(?:[AB]|–\d\d)?$/.test(t.text)).map((t) => t.text).sort();
  assert.deepEqual(wf.stages.map((s) => s.num).sort(), numbers, 'stage numbers must match the diagram exactly');
  for (const s of wf.stages) {
    assert.ok(hasRect(s.box), `${s.num} box ${JSON.stringify(s.box)} not found`);
    assert.equal(findText(s.num, (t) => near(t.y, s.box.y + 34)).length, 1, `${s.num} number badge`);
    assert.equal(findText(s.title, (t) => near(t.x, s.box.x + (s.titleOffset || 88)) && near(t.y, s.box.y + 24)).length, 1, `${s.num} title`);
    assert.equal(findText(s.owner, (t) => near(t.x, s.box.x + 40) && near(t.y, s.box.y + 84)).length, 1, `${s.num} owner`);
    const statusTexts = d.texts.filter((t) => near(t.y, s.box.y + 84) && t.x > s.box.x + 300 && t.x < s.box.x + s.box.w);
    assert.deepEqual(statusTexts.map((t) => t.text), s.status ? [s.status] : [], `${s.num} status tag`);
  }
});

test('stage cards reproduce Ready / Scope / Tools / Pass verbatim with the same wrapping', () => {
  for (const s of wf.stages) {
    for (const line of cardLines(s)) {
      assert.equal(findText(line.text, (t) => near(t.x, line.x) && near(t.y, line.y)).length, 1, `${s.num}: "${line.text}" at ${line.x},${line.y}`);
    }
  }
});

test('stage order follows the diagram: QA Develop (07) precedes the staging decision (08) and 04 is one coding session', () => {
  const edgeIds = new Set(wf.edges.map((e) => `${e.from}>${e.to}`));
  assert.ok(edgeIds.has('s06a>s07') && edgeIds.has('s06b>s07'), 'review passes go to 07');
  assert.ok(edgeIds.has('s07>s08'), '07 → 08');
  assert.ok(!edgeIds.has('s06a>s08') && !edgeIds.has('s06b>s08'), 'no review → 08 shortcut');
  assert.deepEqual(wf.groups.find((g) => g.id === 'g-coding').title.text, 'AGENT IMPLEMENTATION SESSION · 04');
  assert.ok(edgeIds.has('s03>s04') && edgeIds.has('s04>s05'), 'one session between launch and completion routing');
  const coding = wf.groups.find((g) => g.id === 'g-coding').rect;
  const inside = wf.stages.filter((s) => s.box.x >= coding.x && s.box.y >= coding.y && s.box.x + s.box.w <= coding.x + coding.w && s.box.y + s.box.h <= coding.y + coding.h).map((s) => s.id);
  assert.deepEqual(inside, ['s04'], 'one implementation stage inside the session, no separate planning/CI stages');
  assert.ok(edgeIds.has('s04>ci-service') && edgeIds.has('ci-service>s04'), 'CI belongs to the same session');
});

test('human boxes, diamonds, connectors and the CI service match the diagram', () => {
  for (const h of wf.humans) {
    assert.ok(hasRect(h.box), `${h.id} box`);
    assert.equal(findText(h.title, (t) => near(t.x, h.box.x + 28) && near(t.y, h.box.y + 23)).length, 1, `${h.id} title`);
    h.lines.forEach((line, i) =>
      assert.equal(findText(line, (t) => near(t.x, h.box.x + 28) && near(t.y, h.box.y + 77 + i * 37)).length, 1, `${h.id} line ${i}`));
  }
  for (const dm of wf.decisions) {
    const expected = `${dm.cx},${dm.cy - dm.ry} ${dm.cx + dm.rx},${dm.cy} ${dm.cx},${dm.cy + dm.ry} ${dm.cx - dm.rx},${dm.cy}`;
    const found = d.polygons.some((p) => p.points.length === 4 &&
      p.points.every(([x, y], i) => { const [ex, ey] = expected.split(' ')[i].split(',').map(Number); return near(x, ex) && near(y, ey); }));
    assert.ok(found, `${dm.id} diamond`);
    for (const word of dm.label) assert.ok(findText(word).length >= 1, `${dm.id} label ${word}`);
  }
  assert.equal(wf.connectors.length, d.circles.length, 'connector count');
  for (const c of wf.connectors) {
    assert.ok(d.circles.some((ci) => near(ci.cx, c.cx) && near(ci.cy, c.cy)), `${c.id} circle`);
    assert.ok(findText(c.letter, (t) => Math.abs(t.x - c.cx) < 15 && Math.abs(t.y - c.cy) < 20).length === 1, `${c.id} letter`);
  }
  for (const s of wf.services) for (const l of s.lines) assert.equal(findText(l.text, (t) => near(t.x, l.x) && near(t.y, l.y)).length, 1, l.text);
});

test('every drawn arrow matches a diagram polyline end to end, with its colour and label', () => {
  const colour = { flow: '#465664', success: '#287743', fail: '#B34265', ci: '#596E7E' };
  const arrows = d.polylines.filter((p) => !p.dashed || p.stroke === '#B34265');
  const legendAndRule = d.polylines.filter((p) => p.stroke === '#D4DAD9');
  assert.equal(wf.edges.length, arrows.length - legendAndRule.length, 'arrow count');
  for (const e of wf.edges) {
    const [sx, sy] = e.points[0];
    const [ex, ey] = e.points[e.points.length - 1];
    const match = arrows.find((p) => {
      const a = p.points[0];
      const b = p.points[p.points.length - 1];
      return near(a[0], sx) && near(a[1], sy) && near(b[0], ex) && near(b[1], ey);
    });
    assert.ok(match, `${e.id} polyline`);
    assert.equal(match.stroke, colour[e.kind], `${e.id} colour`);
    assert.equal(!!e.dashed, match.dashed, `${e.id} dash`);
    // Interior corners are rounded in the diagram: the path must run along both legs of each corner.
    for (const [x, y] of e.points) {
      const vertical = match.points.some(([px, py]) => near(px, x, 1) && Math.abs(py - y) <= 40);
      const horizontal = match.points.some(([px, py]) => near(py, y, 1) && Math.abs(px - x) <= 40);
      assert.ok(vertical && horizontal, `${e.id} corner ${x},${y}`);
    }
    if (e.label) {
      assert.ok(hasRect(e.label.rect), `${e.id} label background`);
      assert.equal(findText(e.label.text, (t) => near(t.x, e.label.rect.x + 12) && near(t.y, e.label.rect.y + 6)).length, 1, `${e.id} label "${e.label.text}"`);
    }
  }
});

test('every text on the approved diagram is represented (nothing dropped, nothing invented)', () => {
  const known = new Set([
    wf.meta.eyebrow, wf.meta.title, wf.meta.subtitle, 'Dashed: physical app / machine boundary',
    'Ready', 'Scope', 'Tools', 'Pass', 'Yes',
    ...Object.values(wf.kinds).filter((k) => k.legend).map((k) => k.label),
  ]);
  for (const s of wf.stages) [s.num, s.title, s.owner, s.status, ...Object.values(s.card).flat()].forEach((t) => t && known.add(t));
  for (const h of wf.humans) [h.title, ...h.lines].forEach((t) => known.add(t));
  for (const dm of wf.decisions) dm.label.forEach((t) => known.add(t));
  for (const c of wf.connectors) known.add(c.letter);
  for (const g of wf.groups) [g.title?.text, g.subtitle?.text].forEach((t) => t && known.add(t));
  for (const s of wf.services) s.lines.forEach((l) => known.add(l.text));
  for (const n of wf.notes) n.lines.forEach((l) => known.add(l.text));
  for (const e of wf.edges) if (e.label) known.add(e.label.text);
  const missing = d.texts.filter((t) => !known.has(t.text)).map((t) => t.text);
  assert.deepEqual(missing, [], 'diagram texts without a data counterpart');
});

test('group boundaries match the diagram outlines', () => {
  for (const g of wf.groups) {
    if (g.rect) assert.ok(hasRect(g.rect), `${g.id} rect`);
    else assert.ok(d.polygons.some((p) => p.raw.trim() === g.points), `${g.id} outline`);
  }
});
