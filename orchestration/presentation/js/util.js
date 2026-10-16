/* Small DOM + formatting helpers shared by the presentation scripts. */
(function (root) {
  const U = (root.WFUtil = {});

  U.$ = (sel, ctx = document) => ctx.querySelector(sel);
  U.$$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  U.esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  /** Create an HTML element: h('div', { class: 'x', onclick }, child, 'text'). */
  U.h = function (tag, attrs, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const c of children.flat()) if (c != null && c !== false) el.append(c instanceof Node ? c : document.createTextNode(c));
    return el;
  };

  /** replaceChildren that ignores null / false entries (they would render as text). */
  U.put = (el, ...kids) => el.replaceChildren(...kids.flat(Infinity).filter((k) => k != null && k !== false));

  const SVGNS = 'http://www.w3.org/2000/svg';
  U.s = function (tag, attrs, ...children) {
    const el = document.createElementNS(SVGNS, tag);
    for (const [k, v] of Object.entries(attrs || {})) if (v != null && v !== false) el.setAttribute(k, v);
    for (const c of children.flat()) if (c != null) el.append(c instanceof Node ? c : document.createTextNode(c));
    return el;
  };

  /**
   * Inline formatter for data strings (see data/content.js header):
   * [[#node|label]] node link · [[@artifact]] artifact link · [[term|label]] glossary · **b** · `code`
   */
  U.fmt = function (text, wf) {
    let s = U.esc(text);
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g, (m, key, label) => {
      if (key.startsWith('#')) {
        const id = key.slice(1);
        return `<button type="button" class="chip-link node-link" data-open="node:${id}">${label || U.nodeLabel(wf, id)}</button>`;
      }
      if (key.startsWith('@')) {
        const a = wf.artifacts.find((x) => x.id === key.slice(1));
        return `<button type="button" class="chip-link artifact-link" data-open="artifact:${a.id}"><span class="a-icon">${U.esc(a.icon)}</span>${label || U.esc(a.name)}</button>`;
      }
      const g = wf.glossary[key];
      return `<button type="button" class="term" data-term="${key}">${label || U.esc(g.term)}</button>`;
    });
    return s;
  };

  U.nodeLabel = function (wf, id) {
    const st = wf.stages.find((x) => x.id === id);
    if (st) return `${st.num} ${U.esc(st.title)}`;
    const hu = wf.humans.find((x) => x.id === id);
    if (hu) return U.esc(hu.title);
    const d = wf.decisions.find((x) => x.id === id);
    if (d) return `◆ ${U.esc(d.label.join(' '))}`;
    const c = wf.connectors.find((x) => x.id === id);
    if (c) return `Connector ${c.letter}`;
    const sv = wf.services.find((x) => x.id === id);
    if (sv) return 'CI service';
    const n = wf.notes.find((x) => x.id === id);
    if (n) return 'Diagram note';
    return id;
  };

  U.prefersReducedMotion = () => root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;

  U.store = {
    get(k, d) { try { const v = localStorage.getItem(`wf:${k}`); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(`wf:${k}`, JSON.stringify(v)); } catch { /* storage unavailable */ } },
  };

  /** True when keyboard shortcuts must not fire (typing in a field). */
  U.isTyping = (e) => {
    const t = e.target;
    return !!(t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)));
  };

  /* ── Source viewer highlighting ─────────────────────────────────────────────── */
  const norm = (s) => s.replace(/\s+/g, ' ').trim();

  /** Line range [start, end] (0-based, inclusive) that contains `quote` (whitespace-insensitive). */
  U.findQuoteLines = function (text, quote) {
    if (!quote) return null;
    const target = norm(quote);
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      let acc = '';
      for (let j = i; j < Math.min(lines.length, i + 30); j++) {
        acc = norm(`${acc} ${lines[j]}`);
        if (acc.includes(target)) {
          // shrink start while still containing the quote
          let s = i;
          while (s < j && norm(lines.slice(s + 1, j + 1).join(' ')).includes(target)) s++;
          return [s, j];
        }
        if (acc.length > target.length * 4 + 400) break;
      }
    }
    return null;
  };

  /** Heading line index for a Markdown section title, or the key line for a JSON path. */
  U.findSectionLine = function (text, section, isJson) {
    const lines = text.split('\n');
    if (!section) return -1;
    if (isJson) {
      let from = 0;
      for (const key of section.split('.')) {
        const i = lines.findIndex((l, idx) => idx >= from && l.includes(`"${key}"`));
        if (i < 0) return -1;
        from = i;
      }
      return from;
    }
    return lines.findIndex((l) => /^#{1,6}\s/.test(l) && l.replace(/^#+\s*/, '').trim() === section);
  };

  function hlMarkdownLine(line, state) {
    if (/^```/.test(line)) { state.fence = !state.fence; return `<span class="tk-fence">${U.esc(line)}</span>`; }
    if (state.fence) return `<span class="tk-codeblock">${U.esc(line)}</span>`;
    if (/^#{1,6}\s/.test(line)) return `<span class="tk-heading">${U.esc(line)}</span>`;
    let s = U.esc(line);
    s = s.replace(/`([^`]+)`/g, '<span class="tk-code">`$1`</span>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<span class="tk-bold">**$1**</span>');
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<span class="tk-link">[$1]</span><span class="tk-url">($2)</span>');
    if (/^\s*\|/.test(line)) s = `<span class="tk-table">${s}</span>`;
    s = s.replace(/^(\s*)([-*]|\d+\.)\s/, '$1<span class="tk-bullet">$2</span> ');
    return s;
  }
  function hlJsonLine(line) {
    return U.esc(line)
      .replace(/(&quot;(?:[^&]|&(?!quot;))*?&quot;)(\s*:)/g, '<span class="tk-key">$1</span>$2')
      .replace(/:\s*(&quot;(?:[^&]|&(?!quot;))*?&quot;)/g, ': <span class="tk-str">$1</span>')
      .replace(/\b(true|false|null)\b/g, '<span class="tk-bool">$1</span>')
      .replace(/(:\s*)(-?\d+(?:\.\d+)?)/g, '$1<span class="tk-num">$2</span>');
  }

  /** Render file text as numbered, highlighted lines; `hit` = [start, end] line range to mark. */
  U.highlightSource = function (text, path, hit, sectionLine) {
    const isJson = path.endsWith('.json');
    const state = { fence: false };
    return text.split('\n').map((line, i) => {
      const cls = ['src-line'];
      if (hit && i >= hit[0] && i <= hit[1]) cls.push('hit');
      if (i === sectionLine) cls.push('section');
      const body = isJson ? hlJsonLine(line) : hlMarkdownLine(line, state);
      return `<span class="${cls.join(' ')}" data-line="${i + 1}"><span class="ln" aria-hidden="true">${i + 1}</span><span class="lc">${body || ' '}</span></span>`;
    }).join('');
  };
})(typeof window !== 'undefined' ? window : globalThis);
