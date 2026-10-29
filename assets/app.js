(() => {
  'use strict';

  const NOTES_DIR = 'notes/';
  const SITE = '🪴 Digital Garden';
  const $ = (s, r = document) => r.querySelector(s);
  const collator = new Intl.Collator('de', { numeric: true, sensitivity: 'base' });
  const mobile = window.matchMedia('(max-width: 900px)');

  const ICONS = {
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    chevron: '<path d="m9 6 6 6-6 6"/>',
    folder: '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2h7.5A2.5 2.5 0 0 1 21 9.5v8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"/>',
    doc: '<path d="M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M14 3v5h5"/>',
    download: '<path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14"/>',
    clear: '<circle cx="12" cy="12" r="9" class="bgc"/><path d="m9 9 6 6m0-6-6 6" stroke="var(--bg)"/>',
  };
  const svg = (name, cls = '') =>
    `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const label = (name) => name.replace(/^\d+[-_.\s]+/, '');
  const norm = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const encPath = (p) => p.split('/').map(encodeURIComponent).join('/');
  const routeFor = (id, folder = false) => '#/' + encPath(id) + (folder ? '/' : '');
  const plural = (n) => `${n} ${n === 1 ? 'Eintrag' : 'Einträge'}`;
  const fmtDate = (d) => new Date(d + 'T00:00:00').toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
  const fmtSize = (b) => (b < 1024 ? `${b} B` : b < 1048576 ? `${Math.round(b / 1024)} KB` : `${(b / 1048576).toLocaleString('de-DE', { maximumFractionDigits: 1 })} MB`);
  const pathLabel = (n) => n.folder.map(label).join(' › ');

  const sidebar = $('#sidebar');
  const treeEl = $('#tree');
  const resultsEl = $('#results');
  const searchEl = $('#search');
  const clearEl = $('#search-clear');
  const mainEl = $('#main');
  const barTitle = $('#bar-title');
  const menuBtn = $('#menu-btn');

  document.querySelectorAll('[data-icon]').forEach((el) => (el.innerHTML = svg(el.dataset.icon)));
  const style = document.createElement('style');
  style.textContent = '.icon .bgc{fill:currentColor;stroke:none;opacity:.35}';
  document.head.appendChild(style);

  const state = { notes: [], byId: new Map(), root: null, folders: new Map(), open: new Set() };
  const mdCache = new Map();
  let navToken = 0;

  /* ---------- Daten ---------- */
  function setup(notes) {
    state.notes = notes;
    for (const n of notes) {
      n._t = norm(n.title);
      n._g = norm(n.tags.join(' '));
      n._f = norm(n.folder.map(label).join(' '));
      n._x = norm(n.text);
      state.byId.set(n.id, n);
    }
    const root = { name: '', id: '', folders: new Map(), notes: [], count: 0 };
    state.folders.set('', root);
    for (const n of notes) {
      let node = root;
      const acc = [];
      node.count++;
      for (const seg of n.folder) {
        acc.push(seg);
        let child = node.folders.get(seg);
        if (!child) {
          child = { name: seg, id: acc.join('/'), folders: new Map(), notes: [], count: 0 };
          node.folders.set(seg, child);
          state.folders.set(child.id, child);
        }
        node = child;
        node.count++;
      }
      node.notes.push(n);
    }
    state.root = root;
    renderTree();
  }

  const sortedFolders = (node) => [...node.folders.values()].sort((a, b) => collator.compare(a.name, b.name));
  const sortedNotes = (node) => [...node.notes].sort((a, b) => collator.compare(a.id.split('/').pop(), b.id.split('/').pop()));

  /* ---------- Seitenleiste ---------- */
  function treeHTML(node, depth) {
    let h = '';
    for (const f of sortedFolders(node)) {
      const open = state.open.has(f.id);
      h += `<li><button class="row folder-row" type="button" style="--d:${depth}" data-folder="${esc(f.id)}" aria-expanded="${open}">${svg('chevron', 'chev')}${svg('folder', 'solid')}<span>${esc(label(f.name))}</span></button><ul ${open ? '' : 'hidden'}>${treeHTML(f, depth + 1)}</ul></li>`;
    }
    for (const n of sortedNotes(node)) {
      h += `<li><a class="row note" style="--d:${depth}" href="${routeFor(n.id)}" data-id="${esc(n.id)}">${svg('doc')}<span>${esc(n.title)}</span></a></li>`;
    }
    return h;
  }

  function renderTree() {
    treeEl.innerHTML = treeHTML(state.root, 0);
    markActive();
  }

  treeEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-folder]');
    if (!btn) return;
    const id = btn.dataset.folder;
    const open = btn.getAttribute('aria-expanded') !== 'true';
    open ? state.open.add(id) : state.open.delete(id);
    btn.setAttribute('aria-expanded', open);
    btn.nextElementSibling.hidden = !open;
  });

  function markActive() {
    const r = parseRoute();
    treeEl.querySelectorAll('.note').forEach((a) => {
      if (r.type === 'note' && a.dataset.id === r.id) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }

  function revealRoute(r) {
    let segs = [];
    if (r.type === 'note') segs = state.byId.get(r.id)?.folder || [];
    else if (r.type === 'folder') segs = r.id.split('/');
    let changed = false;
    segs.forEach((_, i) => {
      const id = segs.slice(0, i + 1).join('/');
      if (!state.open.has(id)) {
        state.open.add(id);
        changed = true;
      }
    });
    if (changed) renderTree();
    else markActive();
    const active = treeEl.querySelector('[aria-current="page"]');
    if (active && !searchEl.value) active.scrollIntoView({ block: 'nearest' });
  }

  function setNav(open) {
    document.body.classList.toggle('nav-open', open);
    menuBtn.setAttribute('aria-expanded', open);
  }
  menuBtn.addEventListener('click', () => setNav(!document.body.classList.contains('nav-open')));
  $('#scrim').addEventListener('click', () => setNav(false));
  mobile.addEventListener('change', () => setNav(false));

  /* ---------- Suche ---------- */
  function ranges(textNorm, toks) {
    const out = [];
    for (const t of toks) {
      let i = textNorm.indexOf(t);
      while (i !== -1) {
        out.push([i, i + t.length]);
        i = textNorm.indexOf(t, i + t.length);
      }
    }
    out.sort((a, b) => a[0] - b[0]);
    const merged = [];
    for (const r of out) {
      const last = merged[merged.length - 1];
      if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
      else merged.push([...r]);
    }
    return merged;
  }

  function highlight(orig, toks) {
    const n = norm(orig);
    const src = n.length === orig.length ? orig : n;
    let out = '';
    let pos = 0;
    for (const [a, b] of ranges(n, toks)) {
      out += esc(src.slice(pos, a)) + '<mark>' + esc(src.slice(a, b)) + '</mark>';
      pos = b;
    }
    return out + esc(src.slice(pos));
  }

  function snippet(note, toks) {
    let idx = -1;
    for (const t of toks) {
      idx = note._x.indexOf(t);
      if (idx !== -1) break;
    }
    if (idx === -1) return note.summary ? esc(note.summary) : '';
    const text = note.text.length === note._x.length ? note.text : note._x;
    const start = Math.max(0, idx - 45);
    const end = Math.min(text.length, idx + 130);
    const part = text.slice(start, end);
    return (start > 0 ? '…' : '') + highlight(part, toks) + (end < text.length ? '…' : '');
  }

  function search(query) {
    const toks = norm(query).split(/\s+/).filter(Boolean);
    if (!toks.length) return { toks, hits: [] };
    const hits = [];
    for (const n of state.notes) {
      let score = 0;
      let ok = true;
      for (const t of toks) {
        let s = 0;
        if (n._t.includes(t)) s += n._t.startsWith(t) ? 14 : 10;
        if (n._g.includes(t)) s += 6;
        if (n._f.includes(t)) s += 3;
        if (n._x.includes(t)) s += 2 + Math.min(4, n._x.split(t).length - 2);
        if (!s) {
          ok = false;
          break;
        }
        score += s;
      }
      if (ok) hits.push({ n, score });
    }
    hits.sort((a, b) => b.score - a.score || collator.compare(a.n.title, b.n.title));
    return { toks, hits };
  }

  function onSearch() {
    const q = searchEl.value.trim();
    clearEl.hidden = !searchEl.value;
    if (!q) {
      resultsEl.hidden = true;
      treeEl.hidden = false;
      return;
    }
    const { toks, hits } = search(q);
    treeEl.hidden = true;
    resultsEl.hidden = false;
    const head = `<p class="results-count" role="status">${hits.length ? (hits.length === 1 ? '1 Treffer' : `${hits.length} Treffer`) : `Keine Treffer für „${esc(q)}“`}</p>`;
    resultsEl.innerHTML =
      head +
      hits
        .map(
          ({ n }) =>
            `<a class="result" href="${routeFor(n.id)}"><strong>${highlight(n.title, toks)}</strong>${n.folder.length ? `<span class="path">${esc(pathLabel(n))}</span>` : ''}<span class="snip">${snippet(n, toks)}</span></a>`
        )
        .join('');
  }

  function clearSearch() {
    searchEl.value = '';
    onSearch();
    searchEl.focus();
  }

  function focusSearch(text) {
    if (mobile.matches) setNav(true);
    if (typeof text === 'string') {
      searchEl.value = text;
      onSearch();
    }
    searchEl.focus();
    searchEl.select();
  }

  searchEl.addEventListener('input', onSearch);
  clearEl.addEventListener('click', clearSearch);
  $('#search-btn').addEventListener('click', () => focusSearch());
  searchEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('.result', resultsEl)?.click();
    else if (e.key === 'ArrowDown') {
      $('.result', resultsEl)?.focus();
      e.preventDefault();
    } else if (e.key === 'Escape') {
      if (searchEl.value) clearSearch();
      else {
        searchEl.blur();
        setNav(false);
      }
    }
  });
  resultsEl.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const items = [...resultsEl.querySelectorAll('.result')];
    const i = items.indexOf(document.activeElement);
    const next = e.key === 'ArrowDown' ? items[i + 1] : i <= 0 ? searchEl : items[i - 1];
    next?.focus();
    e.preventDefault();
  });
  document.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName);
    if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
      e.preventDefault();
      focusSearch();
    } else if (e.key === 'Escape') setNav(false);
  });

  /* ---------- Routing ---------- */
  function parseRoute() {
    const raw = location.hash.replace(/^#\/?/, '');
    if (!raw) return { type: 'home' };
    try {
      const id = raw.split('/').filter(Boolean).map(decodeURIComponent).join('/');
      return { type: raw.endsWith('/') ? 'folder' : 'note', id };
    } catch {
      return { type: 'home' };
    }
  }

  async function route() {
    const token = ++navToken;
    const r = parseRoute();
    window.scrollTo(0, 0);
    setNav(false);
    revealRoute(r);
    if (r.type === 'folder' && state.folders.has(r.id)) showFolder(state.folders.get(r.id));
    else if (r.type === 'note' && state.byId.has(r.id)) await showNote(state.byId.get(r.id), token);
    else if (r.type === 'home') showHome();
    else showMissing();
  }
  window.addEventListener('hashchange', route);

  /* ---------- Ansichten ---------- */
  function setTitle(t) {
    document.title = t ? `${t} – ${SITE}` : SITE;
    barTitle.textContent = t || SITE;
  }

  function item({ href, kind, icon, title, sub, end, attrs = '' }) {
    return `<li><a class="item" href="${href}" ${attrs}><span class="item-ic ${kind}">${svg(icon, kind === 'folder' ? 'solid' : '')}</span><span class="item-text"><span class="item-title">${esc(title)}</span>${sub ? `<span class="item-sub">${esc(sub)}</span>` : ''}</span><span class="item-end ${end === 'download' ? 'dl' : ''}">${svg(end || 'chevron')}</span></a></li>`;
  }
  const folderItem = (f) => item({ href: routeFor(f.id, true), kind: 'folder', icon: 'folder', title: label(f.name), sub: plural(f.count) });
  const noteItem = (n, withPath) => item({ href: routeFor(n.id), kind: 'doc', icon: 'doc', title: n.title, sub: withPath && n.folder.length ? pathLabel(n) : fmtDate(n.date) });

  function crumbs(segs) {
    const links = segs.map((s, i) => `<a href="${routeFor(segs.slice(0, i + 1).join('/'), true)}">${esc(label(s))}</a>`);
    return `<nav class="crumbs" aria-label="Pfad"><a href="#/">Start</a>${links.map((l) => `<span aria-hidden="true">›</span>${l}`).join('')}</nav>`;
  }

  function showHome() {
    setTitle('');
    const root = state.root;
    const recent = [...state.notes].sort((a, b) => b.date.localeCompare(a.date) || collator.compare(a.title, b.title)).slice(0, 6);
    let h = `<div class="page"><h1>${SITE}</h1><p class="lead">${plural(state.notes.length)}</p>`;
    if (root.folders.size) h += `<h2 class="section-title">Ordner</h2><ul class="group">${sortedFolders(root).map(folderItem).join('')}</ul>`;
    if (root.notes.length) h += `<h2 class="section-title">Einträge</h2><ul class="group">${sortedNotes(root).map((n) => noteItem(n)).join('')}</ul>`;
    if (recent.length) h += `<h2 class="section-title">Zuletzt aktualisiert</h2><ul class="group">${recent.map((n) => noteItem(n, true)).join('')}</ul>`;
    mainEl.innerHTML = h + '</div>';
  }

  function showFolder(node) {
    setTitle(label(node.name));
    const parents = node.id.split('/').slice(0, -1);
    mainEl.innerHTML = `<div class="page">${crumbs(parents)}<h1>${esc(label(node.name))}</h1><p class="lead">${plural(node.count)}</p><ul class="group" style="margin-top:28px">${sortedFolders(node).map(folderItem).join('')}${sortedNotes(node).map((n) => noteItem(n)).join('')}</ul></div>`;
  }

  function showMissing() {
    setTitle('Nicht gefunden');
    mainEl.innerHTML = `<div class="page"><h1>Nicht gefunden</h1><p class="lead">Diesen Eintrag gibt es nicht. <a href="#/">Zur Startseite</a></p></div>`;
  }

  function downloadsHTML(note) {
    if (!note.downloads.length) return '';
    const rows = note.downloads
      .map((d) => {
        const ext = (d.name.split('.').pop() || '').toUpperCase();
        return item({ href: encPath(d.path), kind: 'file', icon: 'doc', title: d.name, sub: `${ext}, ${fmtSize(d.size)}`, end: 'download', attrs: `download="${esc(d.name)}"` });
      })
      .join('');
    return `<section class="downloads" aria-label="Materialien"><h2 class="section-title">Materialien</h2><ul class="group">${rows}</ul></section>`;
  }

  async function getMarkdown(note) {
    if (mdCache.has(note.id)) return mdCache.get(note.id);
    const res = await fetch(NOTES_DIR + encPath(note.id) + '.md', { cache: 'no-cache' });
    if (!res.ok) throw new Error(res.status);
    const md = await res.text();
    mdCache.set(note.id, md);
    return md;
  }

  function prepare(md, note) {
    md = md.replace(/^\uFEFF/, '').replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
    const h1 = md.match(/^\s*#[ \t]+(.+?)[ \t]*(?:\r?\n|$)/);
    if (h1 && h1[1] === note.title) md = md.slice(h1[0].length);
    return md;
  }

  function resolvePath(note, href) {
    const base = note.id.includes('/') ? note.id.slice(0, note.id.lastIndexOf('/') + 1) : '';
    let rel = href.split(/[?#]/)[0];
    try {
      rel = decodeURIComponent(rel);
    } catch {}
    const out = [];
    for (const p of (rel.startsWith('/') ? rel.slice(1) : base + rel).split('/')) {
      if (p === '..') out.pop();
      else if (p && p !== '.') out.push(p);
    }
    return out.join('/');
  }

  function fixLinks(root, note) {
    root.querySelectorAll('a[href]').forEach((a) => {
      const href = a.getAttribute('href');
      if (href.startsWith('#')) return;
      if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//')) {
        if (/^https?:/i.test(href)) {
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
        }
        return;
      }
      const target = resolvePath(note, href);
      if (/\.md$/i.test(target)) {
        const id = target.replace(/\.md$/i, '');
        if (state.byId.has(id)) a.setAttribute('href', routeFor(id));
      } else {
        a.setAttribute('href', NOTES_DIR + encPath(target));
        a.setAttribute('download', '');
        a.classList.add('file');
      }
    });
    root.querySelectorAll('img[src]').forEach((img) => {
      const src = img.getAttribute('src');
      img.loading = 'lazy';
      if (/^([a-z][a-z0-9+.-]*:|\/\/)/i.test(src)) return;
      img.setAttribute('src', NOTES_DIR + encPath(resolvePath(note, src)));
    });
  }

  async function showNote(note, token) {
    setTitle(note.title);
    const tags = note.tags.length
      ? `<ul class="tags">${note.tags.map((t) => `<li><button class="tag" type="button" data-tag="${esc(t)}">${esc(t)}</button></li>`).join('')}</ul>`
      : '';
    mainEl.innerHTML = `<article class="page">${note.folder.length ? crumbs(note.folder) : ''}<h1>${esc(note.title)}</h1><div class="meta"><time datetime="${note.date}">${fmtDate(note.date)}</time>${tags}</div>${downloadsHTML(note)}<div class="body" aria-busy="true"></div></article>`;
    const body = $('.body', mainEl);
    try {
      const md = await getMarkdown(note);
      if (token !== navToken) return;
      body.innerHTML = marked.parse(prepare(md, note), { gfm: true, breaks: true });
      fixLinks(body, note);
    } catch {
      if (token !== navToken) return;
      body.innerHTML = '<p class="muted">Der Eintrag konnte nicht geladen werden.</p>';
    }
    body.removeAttribute('aria-busy');
  }

  mainEl.addEventListener('click', (e) => {
    const tag = e.target.closest('[data-tag]');
    if (tag) focusSearch(tag.dataset.tag);
  });

  /* ---------- Start ---------- */
  (async () => {
    try {
      const res = await fetch(NOTES_DIR + 'index.json', { cache: 'no-cache' });
      if (!res.ok) throw new Error(res.status);
      setup((await res.json()).notes || []);
      route();
    } catch {
      mainEl.innerHTML = '<div class="page"><h1>Index fehlt</h1><p class="lead">Führe <code>node scripts/build-index.mjs</code> aus und öffne die Seite über einen lokalen Server.</p></div>';
    }
  })();
})();
