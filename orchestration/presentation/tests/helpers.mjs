import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

export const PRESENTATION_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const REPO_ROOT = resolve(PRESENTATION_DIR, '../..');

/** Load the browser data files in a sandbox and return window.WFWorkflow / WFSources. */
export function loadData({ sources = false } = {}) {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  const files = ['data/workflow.js', 'data/rules.js', 'data/content.js', 'data/example.js'];
  if (sources) files.push('data/sources.js');
  for (const file of files) {
    vm.runInContext(readFileSync(resolve(PRESENTATION_DIR, file), 'utf8'), sandbox, { filename: file });
  }
  // Data files are plain JSON-compatible objects; round-trip to drop the sandbox realm.
  const plain = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
  return { wf: plain(sandbox.window.WFWorkflow), sources: plain(sandbox.window.WFSources) };
}

export function readRepoFile(path) {
  return readFileSync(resolve(REPO_ROOT, path), 'utf8');
}

const decode = (s) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

/** Minimal parser for the flat approved SVG (no nesting beyond <svg>). */
export function parseDiagram() {
  const svg = readRepoFile('orchestration/assets/workflow.svg');
  const attrs = (s) => Object.fromEntries([...s.matchAll(/([\w-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
  const texts = [...svg.matchAll(/<text([^>]*)>([^<]*)<\/text>/g)].map((m) => {
    const a = attrs(m[1]);
    return { x: +a.x, y: +a.y, size: +a['font-size'], weight: +a['font-weight'], fill: a.fill, text: decode(m[2]) };
  });
  const rects = [...svg.matchAll(/<rect([^>]*)\/>/g)].map((m) => {
    const a = attrs(m[1]);
    return { x: +(a.x ?? 0), y: +(a.y ?? 0), w: +a.width, h: +a.height, fill: a.fill, stroke: a.stroke };
  });
  const pts = (s) => s.trim().split(/\s+/).map((p) => p.split(',').map(Number));
  const polylines = [...svg.matchAll(/<polyline([^>]*)\/>/g)].map((m) => {
    const a = attrs(m[1]);
    return { raw: a.points, points: pts(a.points), stroke: a.stroke, dashed: !!a['stroke-dasharray'] };
  });
  const polygons = [...svg.matchAll(/<polygon([^>]*)\/>/g)].map((m) => {
    const a = attrs(m[1]);
    return { raw: a.points, points: pts(a.points), fill: a.fill };
  });
  const circles = [...svg.matchAll(/<circle([^>]*)\/>/g)].map((m) => {
    const a = attrs(m[1]);
    return { cx: +a.cx, cy: +a.cy, r: +a.r };
  });
  return { svg, texts, rects, polylines, polygons, circles };
}

/** Collapse whitespace so wrapped Markdown paragraphs compare equal to one-line quotes. */
export const norm = (s) => s.replace(/\s+/g, ' ').trim();
