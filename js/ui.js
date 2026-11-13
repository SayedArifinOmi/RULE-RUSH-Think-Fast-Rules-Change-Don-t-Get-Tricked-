'use strict';
/* DOM, input, effects and screen flow. Rules live in game.js, saving in storage.js, unlocks in progress.js. */
(() => {
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const KEYS = '1234567890-='.split(''), HEX = Game.HEX, MODES = Game.MODES, POW = Game.POWERS, PLAY = ['classic', 'quick', 'endless'];
  const BOSS = { rapid: ['⚡', 'RAPID RULE', 'Rules change FAST!'], reverse: ['↺', 'REVERSE RULE', 'Rules flip — correct becomes wrong!'], double: ['✌', 'DOUBLE TROUBLE', 'Match color AND shape!'],
    survival: ['☠', 'SURVIVAL', 'Avoid ALL dangerous objects!'], memory: ['🧠', 'MEMORY TEST', 'Memorize it — the rule will vanish!'] };
  const data = Store.get(), arena = $('#arena'), els = new Map();
  let mode = PLAY.includes(data.mode) ? data.mode : 'classic', last = {}, hv = {}, toastT, clock, busy = false, curHtml = '', memHid = false, duel = null;

  const fmt = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
  const vib = p => { if (data.haptics && navigator.vibrate) try { navigator.vibrate(p); } catch (e) {} };
  const cb = c => `<b style="color:${HEX[c]}">${c}</b>`, sh = s => `<b>${s.toUpperCase()}S</b>`;
  function ruleHtml(r) {
    switch (r.type) {
      case 'color': return `TAP all ${cb(r.color)} objects`;
      case 'shape': return `TAP only ${sh(r.shape)}`;
      case 'noColor': return `AVOID ${cb(r.color)} — tap the rest`;
      case 'noShape': return `TAP everything except ${sh(r.shape)}`;
      case 'both': return `TAP ${cb(r.color)} ${sh(r.shape)}`;
      case 'noEither': return `AVOID ${cb(r.color)} and ${sh(r.shape)}`;
      case 'small': return 'TAP the <b>SMALLEST</b> object';
      default: return 'TAP the <b>LARGEST</b> object';
    }
  }
  const overlay = (id, on) => $(id).classList.toggle('show', on);
  function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2200); }
  function retrigger(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
  function countTo(el, to, ms = 300) {
    cancelAnimationFrame(el._r); const from = +el.textContent || 0, t0 = performance.now();
    const step = t => { const p = Math.min((t - t0) / ms, 1); el.textContent = Math.round(from + (to - from) * p); if (p < 1) el._r = requestAnimationFrame(step); };
    el._r = requestAnimationFrame(step);
  }
  const put = (id, v, html) => { if (hv[id] === v) return false; hv[id] = v; $('#' + id)[html ? 'innerHTML' : 'textContent'] = v; return true; };
  function say(t) { const m = $('#msg'); m.textContent = t; retrigger(m, 'show'); }
  function confetti(n = 40) {
    for (let i = 0; i < n; i++) {
      const p = document.createElement('i'); p.className = 'cf'; const cols = Object.values(HEX);
      p.style.cssText = `left:${Math.random() * 100}%;--x:${(Math.random() - .5) * 200}px;background:${cols[i % cols.length]};animation-delay:${Math.random() * .6}s`;
      p.onanimationend = () => p.remove(); $('#app').appendChild(p);
    }
  }

  /* ---------- settings ---------- */
  function snd() { $$('.snd').forEach(b => b.innerHTML = data.sound ? '<span>🔊</span>Sound On' : '<span>🔇</span>Sound Off'); }
  function hap() { const ok = !!navigator.vibrate; $$('.hap').forEach(b => { b.innerHTML = data.haptics ? '<span>📳</span>Haptics On' : '<span>📴</span>Haptics Off'; b.disabled = !ok; b.title = ok ? '' : 'Not supported on this device'; }); }
  const toggleSound = () => { data.sound = !data.sound; Sfx.setOn(data.sound); Store.save(); snd(); if (data.sound) Sfx.correct(); };
  const toggleHaptics = () => { data.haptics = !data.haptics; Store.save(); hap(); vib(30); };
  function applyTheme(id) {
    if (!data.themes.includes(id)) id = 'neon';
    document.documentElement.dataset.theme = id; data.theme = id; Store.save();
    $('meta[name=theme-color]').content = getComputedStyle(document.documentElement).getPropertyValue('--bg1').trim() || '#0b0720';
  }

  /* ---------- screens ---------- */
  function show(id) {
    $$('.screen').forEach(s => s.classList.toggle('active', s.id === id));
    clearInterval(clock); if (id === 'daily') { renderDaily(); clock = setInterval(renderDaily, 1000); } // countdown only runs while visible
  }
  const RENDER = { ach: renderAch, themes: renderThemes, duel: () => newDuel(false) };
  function go(id) { if (id === 'home') return home(); if (RENDER[id]) RENDER[id](); show(id); }
  function home() { Game.stop(); busy = false; duel = null; overlay('#pause', false); $('#game').classList.remove('ending', 'bossmode'); refresh(); show('home'); }
  function refresh() {
    $('#modes').innerHTML = PLAY.map(m => `<button class="panel mode${m === mode ? ' sel' : ''}" data-mode="${m}"><span class="mi">${{ classic: '⏱', quick: '⚡', endless: '♾' }[m]}</span><b>${MODES[m].name}</b><small>Best ${Store.bestFor(m)}</small></button>`).join('');
    $('#desc').textContent = MODES[mode].desc; $('#best').textContent = Store.bestFor(mode);
    const s = data.stats, sk = Store.streakNow();
    $('#stats').textContent = `${s.games} games · top combo ${s.maxCombo}` + (sk ? ` · 🔥 ${sk}-day streak` : '');
  }
  function renderDaily() {
    const k = DateKeys.day(), wk = DateKeys.week(), ms = DateKeys.msToNextDay(), h = Math.floor(ms / 36e5), m = Math.floor(ms % 36e5 / 6e4), s = Math.floor(ms % 6e4 / 1e3);
    $('#dKey').textContent = k; $('#wKey').textContent = wk; $('#dBest').textContent = data.daily[k] || 0; $('#wBest').textContent = data.weekly[wk] || 0;
    $('#dStreak').textContent = '🔥 ' + Store.streakNow();
    $('#dStatus').textContent = data.dailyDone[k] ? '✔ Completed today' : data.daily[k] ? 'Played — finish the 60 s to complete' : 'Not completed yet';
    $('#wStatus').textContent = data.weeklyDone[wk] ? '✔ Completed this week' : 'Not completed yet';
    $('#dNext').textContent = `Next daily in ${[h, m, s].map(x => String(x).padStart(2, '0')).join(':')} (device time)`;
  }
  function renderAch() {
    const A = Progress.ACH; $('#achCount').textContent = `${A.filter(a => data.ach[a.id]).length}/${A.length}`;
    $('#achList').innerHTML = A.map(a => { const cur = Math.min(a.g(data.stats, data), a.t), done = !!data.ach[a.id];
      return `<div class="panel ach${done ? ' done' : ''}"><span class="ai">${done ? a.i : '🔒'}</span><div><b>${a.n}</b><small>${a.d}</small><div class="pb"><i style="width:${cur / a.t * 100}%"></i></div></div><em>${done ? '✔' : cur + '/' + a.t}</em></div>`; }).join('');
  }
  function renderThemes() {
    $('#themeList').innerHTML = Progress.THEMES.map(t => { const open = data.themes.includes(t.id), sel = data.theme === t.id;
      return `<button class="panel th${sel ? ' sel' : ''}" data-theme="${t.id}" ${open ? '' : 'disabled'}><span class="sw">${t.sw.map(c => `<i style="background:${c}"></i>`).join('')}</span>
      <div><b>${t.n}</b><small>${open ? (sel ? 'Selected' : 'Tap to use') : '🔒 Unlock: ' + Progress.ach(t.req).n}</small></div></button>`; }).join('');
  }
  /* ---------- local 2-player duel: alternate turns, same seed, separate scores (no solo records touched) ---------- */
  const pn = p => 'Player ' + (p + 1);
  function newDuel(swap) { // rematch swaps who goes first so neither player always has the last-turn advantage
    const first = swap && duel ? 1 - duel.order[0] : 0;
    duel = { seed: 'duel-' + Date.now().toString(36) + Math.floor(Math.random() * 1e6), order: [first, 1 - first], i: 0, scores: [null, null], done: false }; renderDuel();
  }
  function renderDuel() {
    const d = duel, p = d.order[d.i], [a, b] = d.scores;
    $('#duScore').innerHTML = [0, 1].map(q => `<span>${pn(q)}<b>${d.scores[q] === null ? '—' : d.scores[q]}</b></span>`).join('');
    if (d.done) { $('#duTitle').textContent = a === b ? '🤝 DRAW!' : `🏆 ${pn(a > b ? 0 : 1).toUpperCase()} WINS!`; $('#duMsg').textContent = `Final: ${a} – ${b}. Both players started from the same seed.`; $('#duGo').textContent = '↻ Rematch (swap order)'; }
    else { $('#duTitle').textContent = pn(p).toUpperCase(); $('#duGo').textContent = '▶ Start turn';
      $('#duMsg').textContent = d.i === 0 ? `Pass the device to ${pn(p)}. 30 s, 3 lives. Both players get the same board seed.` : `${pn(d.order[0])} scored ${d.scores[d.order[0]]}. ${pn(p)}, beat it!`; }
  }
  function duelEnd(sum) {
    Sfx.over(); vib([60, 40, 60]); const g = $('#game'); g.classList.add('ending'); busy = true;
    setTimeout(() => { if (!busy || !duel) return; g.classList.remove('ending', 'bossmode');
      duel.scores[duel.order[duel.i]] = sum.score; duel.i++; if (duel.i > 1) duel.done = true; renderDuel(); show('duel'); busy = false;
      if (duel.done) { Sfx.record(); confetti(); vib([40, 30, 40, 30, 90]); } }, 1000);
  }
  const EX = [[{ type: 'color', color: 'BLUE' }, [['circle', 'BLUE', 1], ['square', 'RED', 0], ['star', 'BLUE', 1], ['triangle', 'GREEN', 0]]],
    [{ type: 'noShape', shape: 'triangle' }, [['triangle', 'ORANGE', 0], ['circle', 'PURPLE', 1], ['diamond', 'YELLOW', 1], ['triangle', 'RED', 0]]],
    [{ type: 'small' }, [['hexagon', 'GREEN', 0, 50], ['circle', 'BLUE', 1, 24], ['star', 'ORANGE', 0, 40]]]];
  $('#examples').innerHTML = EX.map(([r, it]) => `<div class="panel ex"><div class="rt">${ruleHtml(r)}</div><div class="mr">${it.map(([s, c, ok, z = 36]) =>
    `<span class="mini ${ok ? 'ok' : 'no'}" style="--c:${HEX[c]};width:${z}px;height:${z}px"><i class="shape ${s}"></i></span>`).join('')}</div></div>`).join('');
  $('#powers').innerHTML = Object.entries(POW).map(([k, p]) => `<button class="pw" data-p="${k}" style="--c:${p.color}" aria-label="${p.name}" title="${p.name}">${p.icon}<small>${p.key.toUpperCase()}</small></button>`).join('');

  /* ---------- game rendering ---------- */
  function applyObj(el, o) {
    el.style.cssText = `left:${o.x * 100}%;top:${o.y * 100}%;--s:${o.size};--c:${o.power ? POW[o.power].color : HEX[o.color]}`;
    el.firstChild.className = 'shape ' + (o.power ? 'circle' : o.shape);
    el.lastChild.textContent = o.power ? POW[o.power].icon : KEYS[o.slot] || ''; el.dataset.sig = o.shape + o.color + o.size + o.slot;
  }
  function sync(list) {
    const ids = new Set(list.map(o => o.id));
    els.forEach((el, id) => { if (!ids.has(id)) { els.delete(id); el.classList.add('out'); setTimeout(() => el.remove(), 260); } });
    list.forEach(o => {
      let el = els.get(o.id);
      if (!el) { el = document.createElement('div'); el.className = 'obj' + (o.power ? ' orb' : ''); el.dataset.id = o.id; el.innerHTML = '<i class="shape"></i><b></b>'; arena.appendChild(el); els.set(o.id, el); applyObj(el, o); }
      else if (el.dataset.sig !== o.shape + o.color + o.size + o.slot) { applyObj(el, o); retrigger(el, 'morph'); }
    });
  }
  function burst(o, gain) {
    const W = arena.clientWidth, H = arena.clientHeight, x = o.x * W, y = o.y * H, hex = HEX[o.color];
    for (let i = 0; i < 10; i++) {
      const p = document.createElement('span'), a = Math.PI * 2 * i / 10 + Math.random() * .5, d = 40 + Math.random() * 50;
      p.className = 'p'; p.style.cssText = `left:${x}px;top:${y}px;--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d}px;background:${hex}`; p.onanimationend = () => p.remove(); arena.appendChild(p);
    }
    const f = document.createElement('span'); f.className = 'fl'; f.textContent = '+' + gain; f.style.cssText = `left:${x}px;top:${y}px`; f.onanimationend = () => f.remove(); arena.appendChild(f);
  }
  function hud(s) {
    if (put('lives', s.lives, true)) $('#lives').innerHTML = '<i class="h">♥</i>'.repeat(s.lives) + '<i class="h x">♥</i>'.repeat(Math.max(0, s.cfg.lives - s.lives));
    const m = Game.mult(s.combo);
    if (put('combo', s.combo + ' ×' + m) && s.combo > 0) retrigger($('#combo'), 'bump');
    $('#combo').classList.toggle('hot', m > 1);
  }
  function powers(s) {
    $$('.pw').forEach(b => {
      const t = b.dataset.p, P = POW[t], act = t === 'shield' ? s.shield : s.fx[t] > 0, pct = act ? (P.dur ? Math.round(s.fx[t] / P.dur * 100) : 100) : 0, st = (s.inv[t] ? 'r' : '') + (act ? 'a' + pct : '');
      if (b.dataset.st === st) return; b.dataset.st = st; b.classList.toggle('ready', !!s.inv[t]); b.classList.toggle('on', act); b.style.setProperty('--p', pct);
    });
  }
  const callbacks = {
    onObjects: sync,
    onRule(r, info) {
      curHtml = (info.rev ? '↺ REVERSED: ' : '') + (info.surprise ? '⚡ ' : '') + ruleHtml(r); memHid = false; $('#ruleText').innerHTML = curHtml;
      const rl = $('#rule'); retrigger(rl, 'swap'); rl.classList.toggle('surprise', !!info.surprise); if (!info.first) Sfx.rule();
    },
    onTick(s) {
      put('time', s.cfg.time === Infinity ? fmt(s.elapsed) : String(Math.ceil(s.timeLeft))); $('#time').classList.toggle('low', s.cfg.time !== Infinity && s.timeLeft <= 5);
      $('#ruleBar').style.transform = `scaleX(${Math.max(0, s.ruleLeft / s.ruleDur)})`;
      const b = s.boss, rl = $('#rule'); rl.classList.toggle('boss', !!b);
      put('tag', b ? `${BOSS[b.type][0]} ${BOSS[b.type][1]} · ${Math.ceil(b.left)}s` : `RULE ${s.rulesDone + 1} · BOSS IN ${Math.max(1, s.nextBoss - s.rulesDone)}`);
      const hide = !!b && b.type === 'memory' && b.dur - b.left > 2.5;
      if (hide !== memHid) { memHid = hide; $('#ruleText').innerHTML = hide ? '❓ REMEMBER THE RULE!' : curHtml; }
      powers(s);
    },
    onTap(r) {
      const s = Game.state();
      if (r.ok) { Sfx.correct(r.combo); vib(8); burst(r.obj, r.gain); countTo($('#score'), s.score); if (r.milestone) { say(r.milestone); Sfx.combo(r.combo); vib(25); } }
      else if (r.shield) { Sfx.power(); say('SAVED!'); vib(20); }
      else { Sfx.wrong(); vib([30, 40, 30]); retrigger(arena, 'shake'); }
      hud(s);
    },
    onPower(kind, type) {
      Sfx.power();
      if (kind === 'collect') { vib(15); toast(`${POW[type].icon} ${POW[type].name} ready — tap it below or press ${POW[type].key.toUpperCase()}`); }
      else { vib(25); arena.style.setProperty('--fc', POW[type].color); retrigger(arena, 'fxp'); say(POW[type].name.toUpperCase()); }
    },
    onBoss(i) {
      const g = $('#game'), B = BOSS[i.type], ban = $('#bossBanner');
      if (i.phase === 'intro') { g.classList.add('bossmode'); ban.innerHTML = `<span>⚠ BOSS ROUND ⚠</span><big>${B[0]} ${B[1]}</big><span>${B[2]}</span>`; retrigger(ban, 'show'); Sfx.boss(); vib([80, 50, 80]); }
      else if (i.phase === 'end') {
        g.classList.remove('bossmode'); ban.classList.remove('show');
        if (i.ok) { say(`BOSS CLEARED +${i.bonus}`); Sfx.bossWin(); vib([30, 30, 60]); countTo($('#score'), Game.state().score, 500); confetti(18); } else { say('BOSS FAILED'); Sfx.wrong(); }
      } else ban.classList.remove('show');
    },
    onEnd(sum) {
      if (sum.mode === 'duel') return duelEnd(sum);
      Sfx.over(); vib([60, 40, 60]); const g = $('#game'); g.classList.add('ending'); busy = true; last = sum;
      const rec = Store.record(sum), un = Progress.check();
      setTimeout(() => { if (!busy) return; // user may have left meanwhile
        g.classList.remove('ending', 'bossmode'); fillOver(sum, rec, un); show('over'); busy = false; applyTheme(data.theme);
        if (rec.isNew) { Sfx.record(); confetti(); vib([40, 30, 40, 30, 90]); } else if (un.ach.length) Sfx.ach();
      }, 1000);
    }
  };
  function fillOver(s, rec, un) {
    $('#overTitle').textContent = s.reason === 'time' ? "TIME'S UP!" : 'GAME OVER'; $('#fScore').textContent = '0'; countTo($('#fScore'), s.score, 900);
    const n = s.correct + s.wrong, cell = (l, v) => `<span>${l}<b>${v}</b></span>`;
    $('#stats8').innerHTML = cell('Best', rec.best) + cell('Max combo', s.maxCombo) + cell('Correct', s.correct) + cell('Mistakes', s.wrong) + cell('Accuracy', n ? Math.round(100 * s.correct / n) + '%' : '—') + cell('Rules', s.rulesDone) + cell('Bosses', s.bosses) + cell('Time', fmt(s.time));
    $('#rating').textContent = s.rating; $('#newBest').classList.toggle('show', rec.isNew);
    $('#reward').textContent = rec.firstCompletion ? (s.mode === 'daily' ? `📅 Daily complete! 🔥 ${Store.streakNow()}-day streak` : '🏆 Weekly challenge complete!') : s.mode === 'daily' && s.reason !== 'time' ? 'Survive all 60 s to complete the Daily.' : '';
    $('#unlocks').innerHTML = un.ach.map(a => `<div class="ul">${a.i} Achievement: ${a.n}</div>`).concat(un.themes.map(t => `<div class="ul">🎨 Theme unlocked: ${t.n}</div>`)).join('');
  }
  function fit() { // keep objects inside the arena after resize / rotation
    const r = arena.getBoundingClientRect(); if (!r.width) return;
    Game.setArena(r.width, r.height); arena.style.setProperty('--u', Math.min(r.width, r.height) / 100 + 'px');
    const s = Game.state(); if (s.status === 'playing' || s.status === 'paused') { Game.reflow(); s.objs.forEach(o => { const el = els.get(o.id); if (el) applyObj(el, o); }); }
  }
  function play(m, opts) {
    if (busy) return; Game.stop(); if (PLAY.includes(m)) { mode = m; data.mode = m; Store.save(); }
    Sfx.unlock(); overlay('#pause', false); show('game');
    const g = $('#game'); g.classList.remove('ending', 'bossmode'); $('#bossBanner').classList.remove('show');
    arena.querySelectorAll('.obj,.p,.fl').forEach(e => e.remove()); els.clear(); hv = {}; memHid = false; $$('.pw').forEach(b => delete b.dataset.st);
    $('#restart').style.display = m === 'duel' ? 'none' : ''; // no restarting a duel turn to re-roll a score
    $('#tl').textContent = m === 'duel' ? 'P' + (duel.order[duel.i] + 1) + ' TIME' : MODES[m].time === Infinity ? 'SURVIVED' : 'TIME'; $('#score').textContent = '0'; cancelAnimationFrame($('#score')._r); fit();
    Game.start(m, callbacks, opts); hud(Game.state());
  }
  const doPause = () => { if (Game.state().status === 'playing') { Game.pause(); overlay('#pause', true); } };
  const doResume = () => { if (Game.state().status === 'paused') { overlay('#pause', false); Game.resume(); } };
  async function share() {
    const text = `I scored ${last.score} in RULE RUSH (${MODES[last.mode].name})! Can you beat me? Play now!`, url = location.protocol.startsWith('http') ? location.href : '';
    try { if (navigator.share) { await navigator.share({ title: 'RULE RUSH', text, url: url || undefined }); return; } } catch (e) { if (e.name === 'AbortError') return; }
    const full = url ? text + ' ' + url : text;
    try { await navigator.clipboard.writeText(full); toast('Score copied to clipboard!'); } catch (e) { window.prompt('Copy your score:', full); }
  }

  /* ---------- events (each bound once) ---------- */
  $('#modes').onclick = e => { const b = e.target.closest('.mode'); if (b) { mode = b.dataset.mode; data.mode = mode; Store.save(); refresh(); } };
  $('#themeList').onclick = e => { const b = e.target.closest('.th'); if (b && !b.disabled) { applyTheme(b.dataset.theme); renderThemes(); } };
  $$('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go));
  $('#play').onclick = () => play(mode); $('#again').onclick = () => play(last.mode || mode);
  $('#duGo').onclick = () => (duel.done ? newDuel(true) : play('duel', { seed: duel.seed }));
  $('#playDaily').onclick = () => play('daily'); $('#playWeekly').onclick = () => play('weekly');
  $('#pauseBtn').onclick = doPause; $('#resume').onclick = doResume; $('#restart').onclick = () => play(Game.state().mode || mode); $('#shareBtn').onclick = share;
  $$('.snd').forEach(b => b.onclick = toggleSound); $$('.hap').forEach(b => b.onclick = toggleHaptics); $$('.homeBtn').forEach(b => b.onclick = home);
  arena.addEventListener('pointerdown', e => { const o = e.target.closest('.obj'); if (o && !o.classList.contains('out')) { e.preventDefault(); Game.tap(+o.dataset.id); } });
  $('#powers').addEventListener('pointerdown', e => { const b = e.target.closest('.pw'); if (b) { e.preventDefault(); Game.use(b.dataset.p); } });
  document.addEventListener('touchmove', e => { if (e.target.closest('#arena')) e.preventDefault(); }, { passive: false });
  document.addEventListener('visibilitychange', () => { if (document.hidden) doPause(); });
  new ResizeObserver(fit).observe(arena); addEventListener('orientationchange', () => setTimeout(fit, 250));
  addEventListener('keydown', e => {
    if (e.repeat) return; const s = Game.state(), k = e.key.toLowerCase();
    if (k === 'm') return toggleSound();
    if (!$('#game').classList.contains('active')) return;
    if (s.status === 'playing') {
      const i = KEYS.indexOf(e.key), o = i >= 0 && s.objs.find(x => x.slot === i); if (o) return Game.tap(o.id);
      const p = Object.keys(POW).find(t => POW[t].key === k); if (p) return Game.use(p);
    }
    if (k === 'p' || k === 'escape' || k === ' ') { e.preventDefault(); s.status === 'playing' ? doPause() : doResume(); }
  });
  Sfx.setOn(data.sound); snd(); hap(); applyTheme(data.theme); refresh();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
})();
