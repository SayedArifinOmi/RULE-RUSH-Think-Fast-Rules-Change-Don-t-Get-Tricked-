'use strict';
/* RULE RUSH — visual FX layer v2 (no game logic). Light canvas backdrop (sprites, 30 fps, paused in-game),
   button ripples, card tilt, high-score mode label. */
(() => {
  const app = document.getElementById('app'); if (!app) return;
  const root = document.documentElement, game = document.getElementById('game');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hero = document.querySelector('#home .hero');

  /* ---------- particle backdrop (pre-rendered glow sprites => no per-frame shadowBlur) ---------- */
  const cv = document.createElement('canvas'); cv.id = 'fxbg'; app.insertBefore(cv, app.firstChild);
  const g = cv.getContext('2d');
  let W = 0, H = 0, cols = ['#27e9ff', '#ff3df0', '#b6ff3b'], sprites = [], P = [], raf = 0, last = 0, tx = 0, ty = 0, px = 0, py = 0;

  function buildSprites() {
    const s = getComputedStyle(root);
    cols = ['--cyan', '--pink', '--lime'].map(v => s.getPropertyValue(v).trim() || '#fff');
    sprites = cols.map(c => {
      const o = document.createElement('canvas'); o.width = o.height = 48; const x = o.getContext('2d');
      x.shadowColor = c; x.shadowBlur = 12; x.fillStyle = c; x.beginPath(); x.arc(24, 24, 5, 0, 6.283); x.fill(); return o;
    });
  }
  const mk = () => ({ x: Math.random() * W, y: Math.random() * H, z: .35 + Math.random() * .8, vy: -(6 + Math.random() * 14), vx: (Math.random() - .5) * 6,
    c: Math.floor(Math.random() * 3), tw: Math.random() * 6.28, k: .5 + Math.random() * .7 });
  function size() {
    const w = app.clientWidth, h = app.clientHeight; if (!w || (Math.abs(w - W) < 2 && Math.abs(h - H) < 80)) return;
    W = w; H = h; cv.width = W; cv.height = H; // 1x resolution: soft glows don't need retina pixels
    P = Array.from({ length: Math.round(Math.min(34, Math.max(16, W * H / 22000))) }, mk);
  }
  function frame(t) {
    raf = requestAnimationFrame(frame);
    if (t - last < 33) return; // ~30 fps is plenty for ambient motion
    const dt = Math.min((t - last) / 1000, .1); last = t;
    px += (tx - px) * .08; py += (ty - py) * .08;
    if (hero) { hero.style.setProperty('--mx', px.toFixed(2)); hero.style.setProperty('--my', py.toFixed(2)); } // pointer parallax
    g.clearRect(0, 0, W, H);
    for (const p of P) {
      p.y += p.vy * p.z * dt; p.x += p.vx * p.z * dt; p.tw += dt * 1.6;
      if (p.y < -20) { p.y = H + 20; p.x = Math.random() * W; }
      if (p.x < -20) p.x = W + 20; else if (p.x > W + 20) p.x = -20;
      const s = 48 * p.k * p.z;
      g.globalAlpha = Math.max(.08, (.35 + .3 * Math.sin(p.tw)) * p.z);
      g.drawImage(sprites[p.c], p.x + px * 20 * p.z - s / 2, p.y + py * 20 * p.z - s / 2, s, s);
    }
    g.globalAlpha = 1;
  }
  const start = () => { if (reduce || raf || root.classList.contains('playing') || document.hidden) return; last = 0; raf = requestAnimationFrame(frame); };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; };
  buildSprites(); size(); start();
  addEventListener('resize', size);
  new MutationObserver(buildSprites).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  addEventListener('pointermove', e => { tx = e.clientX / innerWidth - .5; ty = e.clientY / innerHeight - .5; }, { passive: true });

  /* Heavy effects off while a round is running: stops the canvas and lets CSS drop the extras (html.playing). */
  function sync() { const on = !!game && game.classList.contains('active'); root.classList.toggle('playing', on); on ? stop() : start(); }
  if (game) new MutationObserver(sync).observe(game, { attributes: true, attributeFilter: ['class'] });
  document.addEventListener('visibilitychange', () => document.hidden ? stop() : start());
  sync();

  /* ---------- button ripple (delegated) ---------- */
  document.addEventListener('pointerdown', e => {
    if (reduce) return;
    const b = e.target.closest && e.target.closest('.btn,.mode,.th'); if (!b || b.disabled) return;
    const r = b.getBoundingClientRect(), d = Math.max(r.width, r.height) * 2.2, s = document.createElement('span');
    s.className = 'rip'; s.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`;
    b.appendChild(s); s.onanimationend = () => s.remove();
  }, { passive: true });

  /* ---------- mode-card tilt (mouse only) ---------- */
  if (!reduce && matchMedia('(hover:hover)').matches) {
    document.addEventListener('pointermove', e => {
      const c = e.target.closest && e.target.closest('.mode'); if (!c) return;
      const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      c.style.transform = `perspective(600px) rotateX(${(-y * 9).toFixed(1)}deg) rotateY(${(x * 11).toFixed(1)}deg) translateY(-4px)`;
    }, { passive: true });
    document.addEventListener('pointerout', e => {
      const c = e.target.closest && e.target.closest('.mode'); if (c && !c.contains(e.relatedTarget)) c.style.transform = '';
    }, { passive: true });
  }

  /* ---------- high-score card shows which mode it belongs to ---------- */
  const modes = document.getElementById('modes'), lab = document.getElementById('hsLabel');
  function label() { const s = modes && modes.querySelector('.mode.sel b'); if (lab) lab.textContent = 'HIGH SCORE' + (s ? ' · ' + s.textContent.toUpperCase() : ''); }
  if (modes && lab) { new MutationObserver(label).observe(modes, { childList: true, subtree: true }); label(); }

  /* ---------- ambient layer: aurora blobs + drifting shapes (CSS animates transform only) ---------- */
  const layer = document.createElement('div'); layer.className = 'fxlayer';
  layer.innerHTML = '<i class="au" style="left:-18%;top:-12%;--c:var(--pink);--x1:70px;--y1:90px;--t:22s"></i>' +
    '<i class="au" style="right:-22%;bottom:-14%;--c:var(--cyan);--x1:-80px;--y1:-70px;--t:26s"></i>' +
    '<i class="au s" style="left:25%;top:42%;--c:var(--lime);--x1:50px;--y1:-60px;--t:30s"></i>';
  const kinds = ['circle', 'square', 'triangle', 'star', 'diamond', 'hexagon'], hex = ['#ff4d6d', '#3a86ff', '#2ee59d', '#ffd60a', '#b05cff', '#ff8a3d'], rnd = (a, b) => a + Math.random() * (b - a);
  for (let i = 0; i < 9; i++) {
    const e = document.createElement('i'); e.className = 'fs ' + kinds[i % 6];
    e.style.cssText = `--c:${hex[i % 6]};--z:${rnd(18, 52) | 0}px;left:${rnd(0, 92) | 0}%;top:${rnd(0, 92) | 0}%;--dx:${rnd(-60, 60) | 0}px;--dy:${rnd(-80, 80) | 0}px;--r:${rnd(-120, 120) | 0}deg;--t:${rnd(14, 28).toFixed(1)}s;animation-delay:-${rnd(0, 10).toFixed(1)}s`;
    layer.appendChild(e);
  }
  app.insertBefore(layer, cv.nextSibling);

  /* ---------- rotating tagline ---------- */
  const home = document.getElementById('home'), tag = home && home.querySelector('.tag');
  if (tag && !reduce) {
    const lines = [tag.textContent, 'Tap what matches. Dodge the traps.', 'Chain combos. Beat the boss.', 'One wrong tap costs a life!']; let li = 0;
    setInterval(() => {
      if (document.hidden || !home.classList.contains('active')) return;
      tag.classList.add('swap'); setTimeout(() => { li = (li + 1) % lines.length; tag.textContent = lines[li]; tag.classList.remove('swap'); }, 260);
    }, 3600);
  }

  /* ---------- count-up high score ---------- */
  const best = document.getElementById('best'); let skip = false, tok = 0;
  function countUp() {
    if (skip) { skip = false; return; } // ignore our own writes
    const to = parseInt(best.textContent, 10) || 0, my = ++tok; if (!to || reduce) return;
    const t0 = performance.now(), step = t => {
      if (my !== tok) return; const p = Math.min((t - t0) / 800, 1); skip = true; best.textContent = Math.round(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  if (best) { new MutationObserver(countUp).observe(best, { childList: true, characterData: true, subtree: true }); countUp(); }

  /* ---------- entrance replay + "new" dot on Challenges ---------- */
  const menu = home && home.querySelector('.menu'); let introT;
  function alertDot() {
    try { const t = home.querySelector('[data-go=daily]'); if (t) t.classList.toggle('alert', !Store.get().dailyDone[DateKeys.day()]); } catch (e) {}
  }
  function intro() {
    alertDot(); if (reduce) return;
    [modes, menu].forEach(e => e && e.classList.remove('intro')); void home.offsetWidth; [modes, menu].forEach(e => e && e.classList.add('intro'));
    clearTimeout(introT); introT = setTimeout(() => [modes, menu].forEach(e => e && e.classList.remove('intro')), 1500);
  }
  if (home) { new MutationObserver(() => { if (home.classList.contains('active')) intro(); }).observe(home, { attributes: true, attributeFilter: ['class'] }); intro(); }

  /* ---------- soft tick when pressing mode cards / menu tiles ---------- */
  document.addEventListener('pointerdown', e => {
    const t = e.target.closest && e.target.closest('.mode,.menu .btn'); if (t && typeof Sfx !== 'undefined') Sfx.rule();
  }, { passive: true });
})();