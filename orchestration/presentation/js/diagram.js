/*
 * Renders the approved workflow from data (WFWorkflow) as interactive SVG and owns the
 * viewport (pan / zoom / focus), level of detail, emphasis classes, overlays and
 * artifact tokens. It knows nothing about panels: it reports interactions via callbacks.
 */
(function (root) {
  const { s, prefersReducedMotion, put } = root.WFUtil;
  const COMPACT_BELOW = 0.42; // zoom level below which nodes switch to large, short labels

  const base = (top, size) => top + size * 0.82; // diagram texts use text-before-edge
  const txt = (content, x, top, size, attrs = {}) =>
    s('text', { x, y: base(top, size), 'font-size': size, ...attrs }, content);

  function wrap(text, maxChars) {
    const words = text.split(' ');
    const lines = [];
    let cur = '';
    for (const w of words) {
      if ((cur ? cur.length + 1 : 0) + w.length > maxChars && cur) { lines.push(cur); cur = w; }
      else cur = cur ? `${cur} ${w}` : w;
    }
    if (cur) lines.push(cur);
    return lines;
  }
  function fitLines(text, width, maxSize, maxLines = 3) {
    let size = maxSize;
    let lines;
    for (;;) {
      lines = wrap(text, Math.max(6, Math.floor(width / (size * 0.56))));
      if (lines.length <= maxLines || size <= 30) return { size, lines };
      size -= 4;
    }
  }
  function roundedPath(points, r = 24) {
    let d = `M ${points[0][0]} ${points[0][1]}`;
    for (let i = 1; i < points.length - 1; i++) {
      const [px, py] = points[i - 1];
      const [cx, cy] = points[i];
      const [nx, ny] = points[i + 1];
      const l1 = Math.hypot(cx - px, cy - py);
      const l2 = Math.hypot(nx - cx, ny - cy);
      const rr = Math.min(r, l1 / 2, l2 / 2);
      const ax = cx - ((cx - px) / l1) * rr;
      const ay = cy - ((cy - py) / l1) * rr;
      const bx = cx + ((nx - cx) / l2) * rr;
      const by = cy + ((ny - cy) / l2) * rr;
      d += ` L ${ax} ${ay} Q ${cx} ${cy} ${bx} ${by}`;
    }
    const last = points[points.length - 1];
    return `${d} L ${last[0]} ${last[1]}`;
  }
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  function create(svg, wf, cb) {
    const nodes = new Map();
    const edges = new Map();
    const vb = wf.meta.viewBox;
    svg.setAttribute('role', 'group');
    svg.setAttribute('aria-label', 'Interactive workflow diagram. Use Tab to move between stages and Enter to open details.');

    /* defs: one arrow marker per edge kind + highlight */
    const defs = s('defs');
    for (const k of ['flow', 'success', 'fail', 'ci', 'hl']) {
      defs.append(s('marker', { id: `arrow-${k}`, viewBox: '0 0 16 16', refX: 14, refY: 8, markerWidth: 16, markerHeight: 16, markerUnits: 'userSpaceOnUse', orient: 'auto-start-reverse' },
        s('path', { d: 'M0,0 L16,8 L0,16 z', class: `arrowhead ak-${k}` })));
    }
    svg.append(defs);

    const vp = s('g', { class: 'viewport' });
    const L = {};
    for (const name of ['groups', 'notes', 'edges', 'nodes', 'labels', 'overlay', 'tokens']) vp.append((L[name] = s('g', { class: `layer-${name}` })));
    svg.append(vp);
    vp.prepend(s('rect', { class: 'canvas-bg', x: vb.x - 4000, y: vb.y - 4000, width: vb.w + 8000, height: vb.h + 8000 }));

    /* groups (physical boundaries) */
    for (const g of wf.groups) {
      const el = s('g', { class: `group${g.solid ? ' solid' : ''}`, 'data-group': g.id });
      el.append(g.rect
        ? s('rect', { class: 'g-shape', x: g.rect.x, y: g.rect.y, width: g.rect.w, height: g.rect.h, rx: 18 })
        : s('polygon', { class: 'g-shape', points: g.points }));
      el.append(txt(g.title.text, g.title.x, g.title.y, g.title.size, { class: 'g-title lod-detail' }));
      el.append(txt(g.title.text, g.title.x, g.title.y - 4, Math.min(44, g.title.size + 12), { class: 'g-title lod-compact' }));
      if (g.subtitle) el.append(txt(g.subtitle.text, g.subtitle.x, g.subtitle.y, g.subtitle.size, { class: 'g-sub lod-detail' }));
      L.groups.append(el);
    }

    const interactive = (el, id, type, label) => {
      el.setAttribute('data-id', id);
      el.setAttribute('data-type', type);
      el.setAttribute('tabindex', '0');
      el.setAttribute('role', 'button');
      el.setAttribute('aria-label', label);
    };

    /* stages */
    for (const st of wf.stages) {
      const { x, y, w, h } = st.box;
      const fs = st.fontSize || 28;
      const g = s('g', { class: `node stage kind-${st.kind}${st.featured ? ' featured' : ''}` });
      interactive(g, st.id, 'stage', `Step ${st.num}: ${st.title}. Owner ${st.owner}.${st.status ? ` Status ${st.status}.` : ''}`);
      g.append(s('rect', { class: 'n-box', x, y, width: w, height: h, rx: 14 }));
      const det = s('g', { class: 'lod-detail' });
      det.append(s('rect', { class: 'n-badge', x: x + 22, y: y + 23, width: st.badgeW || 51, height: 43, rx: 8 }));
      det.append(txt(st.num, x + 22 + (st.badgeW || 51) / 2, y + 34, 21, { class: 'n-badge-text', 'text-anchor': 'middle' }));
      det.append(txt(st.title, x + (st.titleOffset || 88), y + 24, 31, { class: 'n-title' }));
      det.append(s('rect', { class: 'n-pill', x: x + 26, y: y + 78, width: st.pillW, height: 34, rx: 6 }));
      det.append(txt(st.owner, x + 40, y + 84, 20, { class: 'n-accent n-strong' }));
      if (st.status) det.append(txt(st.status, x + w - 39, y + 84, 20, { class: 'n-accent n-strong', 'text-anchor': 'end' }));
      let ry = y + 118;
      for (const [key, label] of [['ready', 'Ready'], ['scope', 'Scope'], ['tools', 'Tools'], ['pass', 'Pass']]) {
        det.append(txt(label, x + 27, ry, 21, { class: 'n-accent n-strong' }));
        st.card[key].forEach((line, i) => det.append(txt(line, x + 125, ry + i * 34, fs, { class: 'n-text' })));
        ry += (st.card[key].length - 1) * 34 + 48;
      }
      g.append(det);
      const cmp = s('g', { class: 'lod-compact' });
      const bw = st.num.length > 3 ? 245 : st.num.length > 2 ? 150 : 118;
      cmp.append(s('rect', { class: 'n-badge', x: x + 24, y: y + 24, width: bw, height: 84, rx: 12 }));
      cmp.append(txt(st.num, x + 24 + bw / 2, y + 36, 58, { class: 'n-badge-text', 'text-anchor': 'middle' }));
      const f = fitLines(st.title, w - 60, 70);
      f.lines.forEach((line, i) => cmp.append(txt(line, x + 30, y + 132 + i * f.size * 1.15, f.size, { class: 'n-title' })));
      cmp.append(txt(st.owner, x + 30, y + 132 + f.lines.length * f.size * 1.15 + 14, 40, { class: 'n-accent n-strong' }));
      if (st.status) cmp.append(txt(st.status, x + 30, y + 132 + f.lines.length * f.size * 1.15 + 70, 34, { class: 'n-muted n-strong' }));
      g.append(cmp);
      L.nodes.append(g);
      nodes.set(st.id, { id: st.id, type: 'stage', el: g, box: st.box, data: st });
    }

    /* human boxes */
    for (const hu of wf.humans) {
      const { x, y, w, h } = hu.box;
      const g = s('g', { class: 'node human kind-human' });
      interactive(g, hu.id, 'human', `${hu.title}. ${hu.lines.join(' ')}`);
      g.append(s('rect', { class: 'n-box', x, y, width: w, height: h, rx: 14 }));
      const det = s('g', { class: 'lod-detail' });
      det.append(txt(hu.title, x + 28, y + 23, 28, { class: 'n-accent n-strong' }));
      hu.lines.forEach((line, i) => det.append(txt(line, x + 28, y + 77 + i * 37, 27, { class: 'n-text' })));
      g.append(det);
      const cmp = s('g', { class: 'lod-compact' });
      cmp.append(txt('HUMAN', x + 28, y + 24, 40, { class: 'n-accent n-strong' }));
      const f = fitLines(hu.short, w - 56, 60, 2);
      f.lines.forEach((line, i) => cmp.append(txt(line, x + 28, y + 84 + i * f.size * 1.15, f.size, { class: 'n-title' })));
      g.append(cmp);
      L.nodes.append(g);
      nodes.set(hu.id, { id: hu.id, type: 'human', el: g, box: hu.box, data: hu });
    }

    /* CI service */
    for (const sv of wf.services) {
      const { x, y, w, h } = sv.box;
      const g = s('g', { class: 'node service kind-ci' });
      interactive(g, sv.id, 'service', 'CI service: external runner, when configured. Static, unit, integration, mutation, browser and visual checks as applicable.');
      g.append(s('rect', { class: 'n-box dashed', x, y, width: w, height: h }));
      const det = s('g', { class: 'lod-detail' });
      for (const l of sv.lines) det.append(txt(l.text, l.x, l.y, l.size, { class: l.muted ? 'n-muted' : 'n-text n-strong' }));
      g.append(det);
      const cmp = s('g', { class: 'lod-compact' });
      cmp.append(txt('CI SERVICE', x + 30, y + 40, 60, { class: 'n-title' }));
      cmp.append(txt('mechanical evidence', x + 30, y + 130, 40, { class: 'n-muted' }));
      g.append(cmp);
      L.nodes.append(g);
      nodes.set(sv.id, { id: sv.id, type: 'service', el: g, box: sv.box, data: sv });
    }

    /* decision diamonds */
    for (const dm of wf.decisions) {
      const g = s('g', { class: 'node decision' });
      interactive(g, dm.id, 'decision', `Decision: ${dm.label.join(' ')}`);
      g.append(s('polygon', { class: 'd-shape', points: `${dm.cx},${dm.cy - dm.ry} ${dm.cx + dm.rx},${dm.cy} ${dm.cx},${dm.cy + dm.ry} ${dm.cx - dm.rx},${dm.cy}` }));
      const top = dm.cy - (dm.label.length === 1 ? 12.5 : 25);
      dm.label.forEach((line, i) => g.append(txt(line, dm.cx, top + i * 25, 20, { class: 'd-text', 'text-anchor': 'middle' })));
      L.nodes.append(g);
      nodes.set(dm.id, { id: dm.id, type: 'decision', el: g, box: { x: dm.cx - dm.rx, y: dm.cy - dm.ry, w: dm.rx * 2, h: dm.ry * 2 }, data: dm });
    }

    /* off-page connectors */
    for (const c of wf.connectors) {
      const g = s('g', { class: `node connector conn-${c.letter}` });
      interactive(g, c.id, 'connector', `Connector ${c.letter}: ${c.letter === 'R' ? 'redispatch to 03' : 'QA failure to 15'}`);
      g.append(s('circle', { class: 'c-shape', cx: c.cx, cy: c.cy, r: 25 }));
      g.append(txt(c.letter, c.cx, c.cy - 13, 24, { class: 'c-text', 'text-anchor': 'middle' }));
      L.nodes.append(g);
      nodes.set(c.id, { id: c.id, type: 'connector', el: g, box: { x: c.cx - 25, y: c.cy - 25, w: 50, h: 50 }, data: c });
    }

    /* notes, banner, callout, footer */
    for (const n of wf.notes) {
      const g = s('g', { class: `note note-${n.kind || 'plain'}` });
      interactive(g, n.id, 'note', n.lines.map((l) => l.text).join(' '));
      let box;
      if (n.rect) {
        g.append(s('rect', { class: 'note-box', x: n.rect.x, y: n.rect.y, width: n.rect.w, height: n.rect.h, rx: 14 }));
        box = n.rect;
      }
      if (n.rule) g.append(s('line', { class: 'note-rule', x1: n.rule.x1, y1: n.rule.y1, x2: n.rule.x2, y2: n.rule.y2 }));
      const det = s('g', { class: 'lod-detail' });
      for (const l of n.lines) det.append(txt(l.text, l.x, l.y, l.size, { class: l.weight === 700 ? 'n-text n-strong' : 'n-muted' }));
      g.append(det);
      const first = n.lines[0];
      const width = n.rect ? n.rect.w - 56 : Math.max(...n.lines.map((l) => l.text.length)) * first.size * 0.56;
      const cmp = s('g', { class: 'lod-compact' });
      if (n.kind === 'banner' || n.kind === 'callout' || n.kind === 'heading' || n.kind === 'footer') {
        const f = fitLines(first.text, n.kind === 'heading' ? 3000 : width, n.kind === 'heading' ? 60 : 46, n.kind === 'callout' ? 3 : 1);
        f.lines.forEach((line, i) => cmp.append(txt(line, first.x, first.y - (n.kind === 'banner' ? 10 : 0) + i * f.size * 1.15, f.size, { class: 'n-text n-strong' })));
      }
      g.append(cmp);
      L.notes.append(g);
      if (!box) {
        const h = n.lines.length * n.lines[0].size * 1.4;
        box = { x: first.x, y: first.y, w: width, h };
      }
      nodes.set(n.id, { id: n.id, type: 'note', el: g, box, data: n });
    }

    /* edges */
    for (const e of wf.edges) {
      const d = roundedPath(e.points);
      const g = s('g', { class: `edge ek-${e.kind}${e.dashed ? ' dashed' : ''}` });
      interactive(g, e.id, 'edge', `Transition ${e.from} to ${e.to}${e.label ? `: ${e.label.text}` : ''}`);
      g.setAttribute('tabindex', '-1');
      const hit = s('path', { class: 'e-hit', d });
      const path = s('path', { class: 'e-path', d, 'marker-end': `url(#arrow-${e.kind})` });
      g.append(hit, path);
      L.edges.append(g);
      let label = null;
      if (e.label) {
        const r = e.label.rect;
        label = s('g', { class: `e-label tone-${e.label.tone}`, 'data-edge': e.id });
        label.append(s('rect', { x: r.x, y: r.y, width: r.w, height: r.h, rx: 6 }));
        label.append(txt(e.label.text, r.x + 12, r.y + 6, e.label.size));
        L.labels.append(label);
      }
      edges.set(e.id, { id: e.id, el: g, path, label, data: e });
    }

    /* ── viewport ─────────────────────────────────────────────────────────────── */
    const view = { k: 0.2, tx: 0, ty: 0 };
    let anim = null;
    const size = () => {
      const r = svg.getBoundingClientRect();
      return { W: Math.max(1, r.width), H: Math.max(1, r.height), left: r.left, top: r.top };
    };
    const minK = () => {
      const { W, H } = size();
      return Math.min(W / vb.w, H / vb.h) * 0.6;
    };
    function apply() {
      vp.setAttribute('transform', `translate(${view.tx} ${view.ty}) scale(${view.k})`);
      svg.classList.toggle('compact', view.k < COMPACT_BELOW);
      cb.onView && cb.onView(view);
    }
    function setView(k, tx, ty, animate) {
      k = Math.max(minK(), Math.min(3, k));
      if (anim) cancelAnimationFrame(anim);
      if (!animate || prefersReducedMotion()) { Object.assign(view, { k, tx, ty }); return apply(); }
      const from = { ...view };
      const t0 = performance.now();
      const step = (now) => {
        const t = Math.min(1, (now - t0) / 480);
        const e = ease(t);
        view.k = from.k + (k - from.k) * e;
        view.tx = from.tx + (tx - from.tx) * e;
        view.ty = from.ty + (ty - from.ty) * e;
        apply();
        if (t < 1) anim = requestAnimationFrame(step);
      };
      anim = requestAnimationFrame(step);
    }
    function fitBox(b, pad, maxK, animate) {
      const { W, H } = size();
      const k = Math.min((W - pad * 2) / b.w, (H - pad * 2) / b.h, maxK);
      setView(k, W / 2 - (b.x + b.w / 2) * k, H / 2 - (b.y + b.h / 2) * k, animate);
    }
    const api = {
      nodes, edges, view, layers: L,
      fit: (animate) => fitBox(vb, 16, 5, animate),
      fitWidth: (animate) => {
        const { W } = size();
        const k = (W - 24) / vb.w;
        setView(k, 12 - vb.x * k, 8 - vb.y * k, animate);
      },
      zoomBy(f, cx, cy) {
        const { W, H } = size();
        cx = cx ?? W / 2;
        cy = cy ?? H / 2;
        const k = Math.max(minK(), Math.min(3, view.k * f));
        const wx = (cx - view.tx) / view.k;
        const wy = (cy - view.ty) / view.k;
        setView(k, cx - wx * k, cy - wy * k, false);
      },
      zoomTo(k) { api.zoomBy(k / view.k); },
      panBy(dx, dy) { setView(view.k, view.tx + dx, view.ty + dy, false); },
      bboxOf(ids) {
        let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
        for (const id of ids) {
          const n = nodes.get(id);
          const e = edges.get(id);
          const boxes = n ? [n.box] : e ? [e.data.points.reduce((b, [px, py]) => ({ x1: Math.min(b.x1, px), y1: Math.min(b.y1, py), x2: Math.max(b.x2, px), y2: Math.max(b.y2, py) }), { x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity })].map((b) => ({ x: b.x1, y: b.y1, w: b.x2 - b.x1, h: b.y2 - b.y1 })) : [];
          for (const b of boxes) { x1 = Math.min(x1, b.x); y1 = Math.min(y1, b.y); x2 = Math.max(x2, b.x + b.w); y2 = Math.max(y2, b.y + b.h); }
        }
        return x1 === Infinity ? null : { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
      },
      /** Animate the view so all `ids` are visible. */
      focus(ids, { maxK = 0.75, pad = 40 } = {}) {
        const b = api.bboxOf(ids);
        if (b) fitBox({ x: b.x - 40, y: b.y - 40, w: b.w + 80, h: b.h + 80 }, pad, maxK, true);
      },
      /** Pan (without zooming) so a node is visible; used for click selection. */
      reveal(id) {
        const b = api.bboxOf([id]);
        if (!b) return;
        const { W, H } = size();
        const sx1 = b.x * view.k + view.tx, sy1 = b.y * view.k + view.ty;
        const sx2 = (b.x + b.w) * view.k + view.tx, sy2 = (b.y + b.h) * view.k + view.ty;
        if (sx1 >= 0 && sy1 >= 0 && sx2 <= W && sy2 <= H) return;
        setView(view.k, W / 2 - (b.x + b.w / 2) * view.k, H / 2 - (b.y + b.h / 2) * view.k, true);
      },
      resized() { apply(); },
    };

    /* ── pointer: mouse drag pans; touch and pen only tap to select ──────────────── */
    // Only a held mouse button moves the diagram. Touch, pen and plain wheel scrolling
    // scroll the page, so the explorer never traps scrolling on the landing page.
    let down = null;
    const targetOf = (el) => el && el.closest && el.closest('[data-id], [data-edge], [data-open]');
    const release = () => { down = null; svg.classList.remove('panning'); };
    svg.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (down) { down.moved = true; return; } // a second finger makes this a gesture, not a tap
      const mouse = e.pointerType === 'mouse';
      down = { id: e.pointerId, mouse, x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty, moved: false, target: targetOf(e.target) };
      if (mouse) svg.setPointerCapture(e.pointerId);
    });
    svg.addEventListener('pointermove', (e) => {
      if (!down || e.pointerId !== down.id) return;
      const dx = e.clientX - down.x;
      const dy = e.clientY - down.y;
      if (!down.moved && Math.hypot(dx, dy) > 5) { down.moved = true; if (down.mouse) svg.classList.add('panning'); }
      if (down.moved && down.mouse) setView(view.k, down.tx + dx, down.ty + dy, false);
    });
    svg.addEventListener('pointerup', (e) => {
      if (!down || e.pointerId !== down.id) return;
      const { moved, target } = down;
      release();
      if (!moved) cb.onActivate && cb.onActivate(target);
    });
    svg.addEventListener('pointercancel', (e) => { if (down && e.pointerId === down.id) release(); });
    svg.addEventListener('wheel', (e) => {
      if (!e.ctrlKey && !e.metaKey) return; // plain scrolling moves the page
      e.preventDefault();
      const { left, top } = size();
      api.zoomBy(Math.exp(-e.deltaY * 0.0022), e.clientX - left, e.clientY - top);
    }, { passive: false });
    svg.addEventListener('dblclick', (e) => {
      const t = targetOf(e.target);
      if (t && t.dataset.id && nodes.has(t.dataset.id)) api.focus([t.dataset.id], { maxK: 1 });
      else { const { left, top } = size(); api.zoomBy(1.6, e.clientX - left, e.clientY - top); }
    });
    svg.addEventListener('keydown', (e) => {
      const t = targetOf(e.target);
      if ((e.key === 'Enter' || e.key === ' ') && t) { e.preventDefault(); cb.onActivate && cb.onActivate(t); }
    });
    svg.addEventListener('focusin', (e) => {
      const t = targetOf(e.target);
      if (t && t.dataset.id && nodes.has(t.dataset.id) && e.target.matches(':focus-visible')) api.reveal(t.dataset.id);
    });
    svg.addEventListener('pointerover', (e) => { const t = targetOf(e.target); cb.onHover && cb.onHover(t); });
    svg.addEventListener('pointerleave', () => cb.onHover && cb.onHover(null));

    /* ── emphasis ─────────────────────────────────────────────────────────────── */
    api.setEmphasis = function ({ hl, strength, edgeHl, selected, current, searchHits }) {
      for (const [id, n] of nodes) {
        const inSet = hl ? hl.has(id) : false;
        n.el.classList.toggle('is-hl', inSet);
        n.el.classList.toggle('is-dim', !!hl && strength === 'strong' && !inSet);
        n.el.classList.toggle('is-soft', !!hl && strength === 'soft' && !inSet);
        n.el.classList.toggle('is-selected', selected === id);
        n.el.classList.toggle('is-current', !!current && current.has(id));
        n.el.classList.toggle('search-hit', !!searchHits && searchHits.has(id));
      }
      for (const [id, e] of edges) {
        const on = (edgeHl && edgeHl.has(id)) || selected === id;
        const dim = !!hl && !on && !(hl.has(e.data.from) && hl.has(e.data.to));
        e.el.classList.toggle('is-hl', !!on);
        e.el.classList.toggle('is-dim', dim && strength === 'strong');
        e.el.classList.toggle('is-soft', dim && strength === 'soft');
        e.path.setAttribute('marker-end', `url(#arrow-${on ? 'hl' : e.data.kind})`);
        if (e.label) {
          e.label.classList.toggle('is-hl', !!on);
          e.label.classList.toggle('is-dim', dim && strength === 'strong');
          e.label.classList.toggle('is-soft', dim && strength === 'soft');
        }
      }
      for (const g of L.groups.children) g.classList.toggle('is-soft', !!hl);
      for (const g of L.notes.children) g.classList.toggle('is-soft', !!hl && !hl.has(g.dataset.id));
    };

    /* ── overlays (badges added by toggles) ───────────────────────────────────── */
    api.clearOverlays = () => put(L.overlay);
    api.badge = function (id, text, cls, { corner = 'tr', offset = 0, open } = {}) {
      const b = api.bboxOf([id]);
      if (!b) return;
      const fs = 30;
      const w = text.length * fs * 0.68 + 36;
      const h = 48;
      let x = corner.endsWith('r') ? b.x + b.w - w + 10 : b.x - 10;
      let y = corner.startsWith('t') ? b.y - h / 2 - offset * (h + 8) : b.y + b.h - h / 2 + offset * (h + 8);
      const g = s('g', { class: `badge ${cls}`, 'data-open': open || `node:${id}` });
      g.append(s('rect', { x, y, width: w, height: h, rx: 24 }));
      g.append(s('text', { x: x + w / 2, y: y + h / 2 + fs * 0.35, 'font-size': fs, 'text-anchor': 'middle' }, text));
      L.overlay.append(g);
      return g;
    };
    api.halo = function (id, cls) {
      const n = nodes.get(id);
      if (!n) return;
      const b = n.box;
      const pad = n.type === 'connector' ? 14 : 18;
      L.overlay.prepend(s('rect', { class: `halo ${cls}`, x: b.x - pad, y: b.y - pad, width: b.w + pad * 2, height: b.h + pad * 2, rx: n.type === 'connector' ? 40 : 24 }));
    };
    api.edgeChip = function (edgeId, artifacts, onlyIds) {
      const e = edges.get(edgeId);
      if (!e) return;
      const len = e.path.getTotalLength();
      const p = e.path.getPointAtLength(len * 0.5);
      const list = artifacts.filter((a) => !onlyIds || onlyIds.includes(a.id));
      list.forEach((a, i) => {
        const w = Math.max(64, a.icon.length * 26 + 30);
        const x = p.x - (list.length * (w + 8)) / 2 + i * (w + 8);
        const g = s('g', { class: 'art-chip', 'data-open': `artifact:${a.id}` });
        g.append(s('title', {}, a.name));
        g.append(s('rect', { x, y: p.y - 26, width: w, height: 52, rx: 10 }));
        g.append(s('text', { x: x + w / 2, y: p.y + 10, 'font-size': 28, 'text-anchor': 'middle' }, a.icon));
        L.overlay.append(g);
      });
    };

    /* ── artifact token travelling along an edge ──────────────────────────────── */
    api.token = function (edgeId, artifact) {
      const e = edges.get(edgeId);
      if (!e) return Promise.resolve();
      const len = e.path.getTotalLength();
      const label = artifact ? artifact.icon : '•';
      const w = Math.max(70, label.length * 30 + 36);
      const g = s('g', { class: 'token', 'aria-hidden': 'true' });
      g.append(s('rect', { x: -w / 2, y: -30, width: w, height: 60, rx: 14 }));
      g.append(s('text', { x: 0, y: 11, 'font-size': 32, 'text-anchor': 'middle' }, label));
      L.tokens.append(g);
      const place = (t) => { const p = e.path.getPointAtLength(len * t); g.setAttribute('transform', `translate(${p.x} ${p.y})`); };
      return new Promise((resolve) => {
        if (prefersReducedMotion()) { place(0.5); setTimeout(() => { g.remove(); resolve(); }, 1600); return; }
        const dur = Math.min(2200, 700 + len * 0.35);
        const t0 = performance.now();
        const step = (now) => {
          const t = Math.min(1, (now - t0) / dur);
          place(ease(t));
          if (t < 1) requestAnimationFrame(step);
          else setTimeout(() => { g.remove(); resolve(); }, 350);
        };
        requestAnimationFrame(step);
      });
    };

    return api;
  }

  root.WFDiagram = { create, COMPACT_BELOW };
})(typeof window !== 'undefined' ? window : globalThis);
