/*
 * Hero example: loops one illustrative ticket through a simplified flow. Steps, captions
 * and motion come from the `.flow-captions` items in index.html (data-at, data-via,
 * data-wire, data-mark, data-ms). This is a sketch for newcomers, not the approved diagram.
 */
(function () {
  const flow = document.getElementById('demo-flow');
  if (!flow) return;
  const card = flow.closest('.demo-preview');
  const $ = (sel, ctx = card) => ctx.querySelector(sel);
  const token = $('.flow-token', flow);
  const rail = $('.flow-rail', flow);
  const fill = $('.flow-fill', flow);
  const grad = $('#flow-grad', flow);
  const wires = { human: $('[data-wire="human"]', flow), rework: $('[data-wire="rework"]', flow) };
  const nodes = Object.fromEntries(Array.from(flow.querySelectorAll('[data-node]'), (el) => [el.dataset.node, el]));
  const MAIN = ['tasks', 'jev1', 'coder', 'jev2', 'review', 'qa', 'jev3', 'release'];
  const words = (v) => (v || '').split(' ').filter(Boolean);

  const captions = Array.from(card.querySelectorAll('.flow-captions > li'));
  const steps = captions.map((li) => ({
    at: li.dataset.at,
    via: words(li.dataset.via),
    wire: li.dataset.wire || '',
    marks: words(li.dataset.mark).map((m) => m.split(':')),
    ms: Number(li.dataset.ms) || 1200,
    text: li.textContent.trim(),
  }));
  const bars = steps.map(() => $('.flow-progress').appendChild(document.createElement('i')));
  const count = $('.flow-count');
  const live = $('[data-flow="live"]');
  const playBtn = $('[data-flow="play"]');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const pad = (n) => String(n).padStart(2, '0');

  let index = 0;
  let playing = !reduce.matches;
  let onScreen = true;
  let timer = 0;
  let motion = null;
  let settle = 0;
  let pos = {};
  let gutterX = 0;
  let here = null;

  /* ── geometry ───────────────────────────────────────────────────────────────── */
  function centre(el, box) {
    const r = el.querySelector('.flow-icon').getBoundingClientRect();
    return { x: r.left - box.left + r.width / 2, y: r.top - box.top + r.height / 2 };
  }

  function layout() {
    let box = flow.getBoundingClientRect();
    const jev = centre(nodes.jev1, box);
    nodes.human.style.top = `${jev.y}px`;
    box = flow.getBoundingClientRect();
    pos = Object.fromEntries(Object.entries(nodes).map(([k, el]) => [k, centre(el, box)]));
    const top = pos.tasks;
    const end = pos.release;
    const x = top.x;
    gutterX = x - 30;
    rail.setAttribute('d', `M${x} ${top.y}V${end.y}`);
    fill.setAttribute('d', `M${x} ${top.y}V${end.y}`);
    fill.style.strokeDasharray = `${end.y - top.y}`;
    for (const [k, v] of [['x1', x], ['x2', x], ['y1', top.y], ['y2', end.y]]) grad.setAttribute(k, v);
    wires.human.setAttribute('d', `M${x - 13} ${pos.jev1.y}H${pos.human.x + 13}`);
    const { coder, review } = pos;
    const r = 8;
    wires.rework.setAttribute('d', `M${x - 15} ${review.y}H${gutterX + r}Q${gutterX} ${review.y} ${gutterX} ${review.y - r}`
      + `V${coder.y + r}Q${gutterX} ${coder.y} ${gutterX + r} ${coder.y}H${x - 15}`);
    render(index, 'jump');
  }

  const point = (name) => (name === 'rework'
    ? [{ x: gutterX, y: pos.review.y }, { x: gutterX, y: pos.coder.y }]
    : [{ ...pos[name], hold: true }]);

  /* ── token motion ───────────────────────────────────────────────────────────── */
  const place = (p) => `translate(${p.x}px, ${p.y}px)`;

  function move(points, how, done) {
    if (motion) motion.cancel();
    clearTimeout(settle);
    const end = points[points.length - 1];
    if (how === 'reset') {
      token.classList.add('is-hidden');
      settle = setTimeout(() => { token.style.transform = place(end); token.classList.remove('is-hidden'); done(); }, 320);
    } else {
      token.style.transform = place(end);
      if (how === 'jump' || reduce.matches || points.length < 2) { done(); } else {
        // Travel at an even speed and pause briefly on each node the ticket passes.
        const legs = [];
        let total = 0;
        points.forEach((p, i) => {
          if (i) { const d = Math.hypot(p.x - points[i - 1].x, p.y - points[i - 1].y); total += Math.max(240, d * 3.2); }
          legs.push({ p, t: total });
          if (p.hold && i && i < points.length - 1) { total += 380; legs.push({ p, t: total }); }
        });
        motion = token.animate(legs.map(({ p, t }) => ({ transform: place(p), offset: t / total, easing: 'ease-in-out' })), { duration: total });
        motion.finished.then(done, () => {});
      }
    }
    here = end;
  }

  /* ── rendering ──────────────────────────────────────────────────────────────── */
  function render(i, how) {
    const step = steps[i];
    index = i;
    captions.forEach((li, k) => li.classList.toggle('is-active', k === i));
    bars.forEach((b, k) => b.classList.toggle('is-on', k <= i));
    count.textContent = `${pad(i + 1)} / ${pad(steps.length)}`;
    wires.human.classList.toggle('is-on', step.wire === 'ask' || step.wire === 'answer');
    wires.human.classList.toggle('is-back', step.wire === 'answer');
    wires.rework.classList.toggle('is-on', step.wire === 'rework');

    const reached = steps.slice(0, i + 1).flatMap((s) => [...s.via, s.at]);
    const far = Math.max(0, ...reached.map((n) => MAIN.indexOf(n)));
    const railY = pos[MAIN[far]] ? pos[MAIN[far]].y - pos.tasks.y : 0;
    if (how === 'reset' || how === 'jump') fill.style.transition = 'none';
    fill.style.strokeDashoffset = `${(pos.release ? pos.release.y - pos.tasks.y : 0) - railY}`;
    if (how === 'reset' || how === 'jump') { fill.getBoundingClientRect(); fill.style.transition = ''; }

    const from = here || pos[step.at];
    const path = how === 'step' ? [from, ...step.via.flatMap(point), pos[step.at]] : [pos[step.at]];
    if (!pos[step.at]) return;
    move(path, how, () => settleNodes(i));
  }

  // Node states and marks change when the ticket arrives, not when it sets off.
  function settleNodes(i) {
    if (i !== index) return;
    const step = steps[i];
    const seen = new Set(steps.slice(0, i).flatMap((s) => [...s.via, s.at]).concat(step.via));
    const marks = Object.fromEntries(steps.slice(0, i + 1).flatMap((s) => s.marks));
    for (const [name, el] of Object.entries(nodes)) {
      el.classList.toggle('is-active', name === step.at);
      el.classList.toggle('is-done', seen.has(name) && name !== step.at);
      const mark = el.querySelector('.flow-mark');
      const glyph = marks[name] || '';
      if (mark.textContent !== glyph) {
        mark.textContent = glyph;
        mark.dataset.tone = glyph === '✓' ? 'ok' : 'ask';
      }
    }
  }

  /* ── playback ───────────────────────────────────────────────────────────────── */
  function schedule() {
    clearTimeout(timer);
    if (playing && onScreen && !document.hidden) timer = setTimeout(() => { go(index + 1); schedule(); }, steps[index].ms);
  }

  function go(i, announce) {
    const next = (i + steps.length) % steps.length;
    const how = next === 0 && index === steps.length - 1 ? 'reset' : next === index + 1 ? 'step' : 'jump';
    render(next, how);
    if (announce) live.textContent = `Step ${next + 1} of ${steps.length}. ${steps[next].text}`;
  }

  function setPlaying(on) {
    playing = on;
    playBtn.textContent = on ? '❚❚' : '▶';
    playBtn.setAttribute('aria-label', on ? 'Pause animation' : 'Play animation');
    schedule();
  }

  playBtn.addEventListener('click', () => setPlaying(!playing));
  $('[data-flow="prev"]').addEventListener('click', () => { setPlaying(false); go(index - 1, true); });
  $('[data-flow="next"]').addEventListener('click', () => { setPlaying(false); go(index + 1, true); });
  document.addEventListener('visibilitychange', schedule);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; schedule(); }).observe(card);
  }
  new ResizeObserver(layout).observe(flow);

  setPlaying(playing);
  layout();
})();
