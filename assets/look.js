// Nur Optik: Theme-Schalter, eigener Cursor, Scroll-Reveal.
// Greift nicht in die Logik von app.js ein.
(() => {
  'use strict';
  const root = document.documentElement;
  const darkMQ = window.matchMedia('(prefers-color-scheme: dark)');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- Theme ---------- */
  const current = () => root.dataset.theme || (darkMQ.matches ? 'dark' : 'light');
  function syncMeta() {
    const color = current() === 'dark' ? '#000000' : '#f5f5f7';
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', color));
    document.querySelectorAll('.theme-btn').forEach((b) =>
      b.setAttribute('aria-label', current() === 'dark' ? 'Helles Design' : 'Dunkles Design')
    );
  }
  document.querySelectorAll('.theme-btn').forEach((b) =>
    b.addEventListener('click', () => {
      const next = current() === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next;
      try { localStorage.setItem('theme', next); } catch {}
      syncMeta();
    })
  );
  darkMQ.addEventListener?.('change', syncMeta);
  syncMeta();

  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  /* ---------- Scroll-Reveal ---------- */
  const main = document.getElementById('main');
  if (main && 'IntersectionObserver' in window && !reduced.matches) {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      },
      { rootMargin: '0px 0px -6% 0px', threshold: 0.05 }
    );
    const decorate = () => {
      const els = main.querySelectorAll('.page > :not(.body):not(.group):not(.rv),.group > li:not(.rv), .body > :not(.rv)');
      let i = 0;
      els.forEach((el) => {
        el.classList.add('rv');
        el.style.setProperty('--rv-d', `${Math.min(i++, 8) * 0.05}s`);
        io.observe(el);
      });
    };
    new MutationObserver(decorate).observe(main, { childList: true, subtree: true });
    decorate();
  }

  /* ---------- Eigener Cursor ---------- */
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  if (fine.matches && !reduced.matches) {
    const dot = document.createElement('div');
    const ring = document.createElement('div');
    dot.className = 'cursor-dot';
    ring.className = 'cursor-ring';
    dot.setAttribute('aria-hidden', 'true');
    ring.setAttribute('aria-hidden', 'true');
    dot.style.transform = ring.style.transform = 'translate3d(-100px, -100px, 0)';
    document.body.append(dot, ring);
    root.classList.add('has-cursor');

    let x = -100, y = -100, rx = x, ry = y, raf = 0;
    const loop = () => {
      rx += (x - rx) * 0.18;
      ry += (y - ry) * 0.18;
      ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
      raf = Math.abs(x - rx) + Math.abs(y - ry) > 0.1 ? requestAnimationFrame(loop) : 0;
    };
    window.addEventListener(
      'pointermove',
      (e) => {
        if (e.pointerType !== 'mouse') return;
        x = e.clientX;
        y = e.clientY;
        dot.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        root.classList.add('cursor-on');
        if (!raf) raf = requestAnimationFrame(loop);
      },
      { passive: true }
    );
    document.addEventListener('pointerover', (e) => {
      root.classList.toggle('cursor-hover', !!e.target.closest?.('a, button, input, label, [role="button"]'));
    });
    document.addEventListener('pointerdown', () => root.classList.add('cursor-down'));
    document.addEventListener('pointerup', () => root.classList.remove('cursor-down'));
    document.documentElement.addEventListener('pointerleave', () => root.classList.remove('cursor-on'));
  }
})();
