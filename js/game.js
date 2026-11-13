'use strict';
/* RULE RUSH engine v2 — pure logic, no DOM. Every duration / lives / difficulty value comes from MODES + CFG. */
const Game = (() => {
  const HEX = { RED: '#ff4d6d', BLUE: '#3a86ff', GREEN: '#2ee59d', YELLOW: '#ffd60a', PURPLE: '#b05cff', ORANGE: '#ff8a3d' };
  const COLORS = Object.keys(HEX), SHAPES = ['circle', 'square', 'triangle', 'star', 'diamond', 'hexagon'], SIZES = [13, 15.5, 18, 21];
  const CFG = { base: 10, hitsPerRule: 4, bossEvery: 10, bossTime: 8, bossBonus: 100, intro: 1.8, orbTtl: 6, orbGap: [14, 22], orbBonus: 25,
    mult: [[20, 5], [15, 4], [10, 3], [5, 2], [0, 1]], say: { 5: 'NICE!', 10: 'GREAT!', 15: 'AMAZING!', 20: 'UNSTOPPABLE!', 30: 'LEGENDARY!' } };
  // time: seconds (Infinity = endless) | ruleBase/ruleMin: rule seconds at level 0 / floor | lvlEvery: seconds per difficulty level | boost: starting level
  const MODES = {
    classic: { name: 'Classic', time: 45, lives: 3, ruleBase: 5.5, ruleMin: 2.2, lvlEvery: 8, boost: 0, desc: '45 s · 3 lives · balanced' },
    quick: { name: 'Quick Rush', time: 30, lives: 2, ruleBase: 4, ruleMin: 1.8, lvlEvery: 5, boost: 1, desc: '30 s · 2 lives · fast & fierce' },
    endless: { name: 'Endless', time: Infinity, lives: 3, ruleBase: 5.5, ruleMin: 1.6, lvlEvery: 8, boost: 0, desc: 'No timer · 3 lives · survive!' },
    daily: { name: 'Daily Challenge', time: 60, lives: 3, ruleBase: 5, ruleMin: 2, lvlEvery: 8, boost: 0, seed: 'day', desc: '60 s · same seed for today' },
    duel: { name: '2-Player Duel', time: 30, lives: 3, ruleBase: 5, ruleMin: 2, lvlEvery: 8, boost: 0, desc: '30 s turns · same seed for both players' },
    weekly: { name: 'Weekly Challenge', time: 60, lives: 3, ruleBase: 4.5, ruleMin: 1.8, lvlEvery: 6, boost: 2, bossEvery: 6, seed: 'week', desc: '60 s · hard start · boss every 6 rules' } };
  const POWERS = { freeze: { icon: '❄', color: '#27e9ff', dur: 4, key: 'f', name: 'Time Freeze' }, slow: { icon: '⏳', color: '#ffd60a', dur: 6, key: 's', name: 'Slow Motion' },
    shield: { icon: '🛡', color: '#2ee59d', dur: 0, key: 'x', name: 'Second Chance' }, clear: { icon: '💥', color: '#ff8a3d', dur: 0, key: 'c', name: 'Clear Board' } };
  const BOSSES = ['rapid', 'reverse', 'double', 'survival', 'memory'];
  const TESTS = {
    color: (o, r) => o.color === r.color, shape: (o, r) => o.shape === r.shape,
    noColor: (o, r) => o.color !== r.color, noShape: (o, r) => o.shape !== r.shape,
    both: (o, r) => o.color === r.color && o.shape === r.shape,
    noEither: (o, r) => o.color !== r.color && o.shape !== r.shape, // boss "survival"
    small: (o, r, l) => o.size === Math.min(...l.filter(x => !x.power).map(x => x.size)),
    big: (o, r, l) => o.size === Math.max(...l.filter(x => !x.power).map(x => x.size)) };
  const MIN_LEVEL = { color: 0, shape: 0, noColor: 1, noShape: 1, small: 2, big: 2, both: 3, noEither: 99 };
  const INV = { color: 'noColor', noColor: 'color', shape: 'noShape', noShape: 'shape' };
  const ruleKey = q => q.type + (/olor|both|Either/.test(q.type) ? q.color : '') + (/hape|both|Either/.test(q.type) ? q.shape : '');

  function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function hashStr(s) { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  const rating = s => s < 150 ? 'Rookie 🐣' : s < 350 ? 'Quick Thinker ⚡' : s < 700 ? 'Sharp Mind 🧠' : s < 1200 ? 'Rule Master 🔥' : 'Legend 👑';
  const mult = c => CFG.mult.find(([n]) => c >= n)[1];

  const S = { status: 'idle', W: 360, H: 500, cb: {}, objs: [] };
  const pick = (r, a) => a[Math.floor(r() * a.length)];
  const lvl = () => Math.min(Math.floor(S.elapsed / S.cfg.lvlEvery) + S.cfg.boost, 9);
  const poolN = () => Math.min(3 + lvl(), 6);
  const valid = o => TESTS[S.rule.type](o, S.rule, S.objs);
  const normal = () => S.objs.filter(o => !o.power);

  function place(o) { // random non-overlapping position, always fully inside the arena
    const u = Math.min(S.W, S.H) / 100, rad = o.size * u / 2; let x, y;
    for (let i = 0; i < 40; i++) {
      x = rad + S.rO() * Math.max(0, S.W - 2 * rad); y = rad + S.rO() * Math.max(0, S.H - 2 * rad);
      if (S.objs.every(p => Math.hypot(p.x * S.W - x, p.y * S.H - y) > (p.size + o.size) * u / 2 * 1.08)) break;
    }
    o.x = x / S.W; o.y = y / S.H;
  }
  function freeSlot() { let i = 0; while (S.objs.some(o => o.slot === i)) i++; return i; }
  function spawn(slot = freeSlot()) {
    const n = poolN(), r = S.rO;
    const o = { id: ++S.uid, slot, shape: pick(r, SHAPES.slice(0, n)), color: pick(r, COLORS.slice(0, n)), size: pick(r, SIZES) };
    place(o); S.objs.push(o); return o;
  }
  function spawnOrb() {
    const free = Object.keys(POWERS).filter(k => !S.inv[k]); if (!free.length) return false;
    const o = { id: ++S.uid, slot: freeSlot(), power: pick(S.rO, free), size: 16, ttl: CFG.orbTtl }; place(o); S.objs.push(o); return true;
  }
  // Guarantee at least one valid target (no impossible rules): mutate a random object if none matches.
  function ensureValid() {
    const c = normal(); if (!c.length || c.some(valid)) return;
    const o = pick(S.rO, c), r = S.rule, t = r.type;
    if (t === 'color' || t === 'both') o.color = r.color;
    if (t === 'shape' || t === 'both') o.shape = r.shape;
    if (t === 'noColor' || t === 'noEither') o.color = COLORS.find(x => x !== r.color);
    if (t === 'noShape' || t === 'noEither') o.shape = SHAPES.find(x => x !== r.shape);
  }
  function setRule(rule, dur, info) {
    S.rule = rule; S.ruleDur = S.ruleLeft = dur; S.ruleHits = 0; ensureValid(); S.cb.onRule(rule, info || {});
  }
  function newRule(first) {
    const L = lvl(), n = poolN(), r = S.rR, c = S.cfg, types = Object.keys(TESTS).filter(t => MIN_LEVEL[t] <= L);
    let rule, tries = 0;
    do rule = { type: pick(r, types), color: pick(r, COLORS.slice(0, n)), shape: pick(r, SHAPES.slice(0, n)) };
    while (S.rule && ruleKey(rule) === ruleKey(S.rule) && ++tries < 30);
    const base = Math.max(c.ruleMin, c.ruleBase - L * .4), surprise = !first && L >= 1 && r() < .25;
    setRule(rule, surprise ? base * .55 : base, { surprise, first });
  }
  /* ----- boss rounds ----- */
  function simple() { const n = poolN(); return { type: pick(S.rR, ['color', 'shape', 'noColor', 'noShape']), color: pick(S.rR, COLORS.slice(0, n)), shape: pick(S.rR, SHAPES.slice(0, n)) }; }
  function bossRule() {
    const b = S.boss, n = poolN(), r = S.rR, c = pick(r, COLORS.slice(0, n)), s = pick(r, SHAPES.slice(0, n));
    switch (b.type) {
      case 'rapid': setRule(simple(), 1.5, { boss: b.type }); break;
      case 'reverse': // alternates a rule and its exact opposite
        if (!b.base) b.base = { type: pick(r, ['color', 'shape']), color: c, shape: s };
        b.flip = !b.flip; setRule(b.flip ? b.base : { ...b.base, type: INV[b.base.type] }, 2.5, { boss: b.type, rev: !b.flip }); break;
      case 'double': setRule({ type: 'both', color: c, shape: s }, 3, { boss: b.type }); break;
      case 'survival': setRule({ type: 'noEither', color: c, shape: s }, 4, { boss: b.type }); break;
      default: setRule(simple(), b.dur, { boss: b.type, memory: true }); // memory: shown once, UI hides it
    }
  }
  function startIntro() {
    const type = BOSSES[(S.bossN + S.bossOff) % BOSSES.length]; S.pendingBoss = type; S.intro = CFG.intro; S.cb.onBoss({ phase: 'intro', type });
  }
  function beginBoss() {
    S.boss = { type: S.pendingBoss, left: CFG.bossTime, dur: CFG.bossTime, mistakes: 0, base: null, flip: false };
    S.bossN++; S.cb.onBoss({ phase: 'start', type: S.boss.type }); bossRule(); S.cb.onObjects(S.objs);
  }
  function endBoss() {
    const b = S.boss, ok = b.mistakes === 0; S.boss = null; let bonus = 0;
    if (ok) { bonus = CFG.bossBonus; S.score += bonus; S.bossWins++; }
    S.cb.onBoss({ phase: 'end', type: b.type, ok, bonus }); newRule(); S.cb.onObjects(S.objs);
  }
  // A rule "counts" when the player really engaged with it (4 hits, or 2+ hits when it times out).
  function advance(counted) {
    if (counted) { S.rulesDone++; S.ruleT.push(S.elapsed); }
    if (counted && S.rulesDone >= S.nextBoss) { S.nextBoss += S.cfg.bossEvery || CFG.bossEvery; startIntro(); }
    else newRule();
    S.cb.onObjects(S.objs);
  }
  function loop(t) {
    if (S.status !== 'playing') return;
    const dt = Math.min((t - S.last) / 1000, .1); S.last = t;
    if (S.intro > 0) { S.intro -= dt; if (S.intro <= 0) beginBoss(); S.cb.onTick(S); S.raf = requestAnimationFrame(loop); return; }
    S.elapsed += dt;
    if (S.cfg.time !== Infinity) { S.timeLeft = Math.max(0, S.timeLeft - dt); if (S.timeLeft <= 0) return end('time'); }
    for (const k in S.fx) S.fx[k] = Math.max(0, S.fx[k] - dt);
    const rdt = S.fx.freeze > 0 ? 0 : S.fx.slow > 0 ? dt * .5 : dt; // freeze stops rule countdown, slow halves it
    S.ruleLeft -= rdt;
    if (S.boss) { S.boss.left -= rdt; if (S.boss.left <= 0) endBoss(); else if (S.ruleLeft <= 0) { bossRule(); S.cb.onObjects(S.objs); } }
    else if (S.ruleLeft <= 0) advance(S.ruleHits >= 2);
    let changed = false;
    if ((S.orbCd -= dt) <= 0) { S.orbCd = CFG.orbGap[0] + S.rO() * (CFG.orbGap[1] - CFG.orbGap[0]); if (!S.objs.some(o => o.power) && spawnOrb()) changed = true; }
    const ex = S.objs.filter(o => o.power && (o.ttl -= dt) <= 0);
    if (ex.length) { S.objs = S.objs.filter(o => !ex.includes(o)); changed = true; }
    const want = Math.min(6 + lvl(), 12);
    while (normal().length < want) { spawn(); changed = true; }
    if (changed) S.cb.onObjects(S.objs);
    S.cb.onTick(S); S.raf = requestAnimationFrame(loop);
  }
  function tap(id) {
    if (S.status !== 'playing' || S.intro > 0) return;
    const o = S.objs.find(x => x.id === id); if (!o) return;
    if (o.power) { // power-up orb: collect (never right or wrong)
      S.objs.splice(S.objs.indexOf(o), 1); if (S.inv[o.power]) S.score += CFG.orbBonus; else S.inv[o.power] = 1;
      S.cb.onPower('collect', o.power, o); S.cb.onObjects(S.objs); return;
    }
    const ok = valid(o), now = performance.now();
    if (!ok && now < S.lock) return; // ignore accidental double wrong-taps
    S.objs.splice(S.objs.indexOf(o), 1); // removed instantly => cannot score twice
    let gain = 0, shield = false, milestone = null;
    if (ok) { S.combo++; gain = CFG.base * mult(S.combo); S.score += gain; S.correct++; S.ruleHits++; S.maxCombo = Math.max(S.maxCombo, S.combo); milestone = CFG.say[S.combo] || null; }
    else { S.wrong++; S.lock = now + 250; if (S.shield) { S.shield = false; shield = true; } else { S.lives--; S.combo = 0; if (S.boss) S.boss.mistakes++; } }
    spawn(o.slot); ensureValid();
    S.cb.onTap({ ok, gain, obj: o, combo: S.combo, mult: mult(S.combo), shield, milestone });
    if (ok && !S.boss && S.ruleHits >= CFG.hitsPerRule) advance(true);
    S.cb.onObjects(S.objs);
    if (S.lives <= 0) end('lives');
  }
  function use(type) {
    if (S.status !== 'playing' || S.intro > 0 || !S.inv[type]) return false;
    S.inv[type] = 0; const P = POWERS[type];
    if (P.dur) S.fx[type] = P.dur; else if (type === 'shield') S.shield = true;
    else { S.objs = S.objs.filter(o => o.power); const want = Math.min(6 + lvl(), 12); while (normal().length < want) spawn(); ensureValid(); }
    S.cb.onPower('use', type); S.cb.onObjects(S.objs); return true;
  }
  function reflow() { const old = S.objs; S.objs = []; old.forEach(o => { place(o); S.objs.push(o); }); } // after resize/rotation
  function end(reason) {
    if (S.status === 'over') return;
    S.status = 'over'; cancelAnimationFrame(S.raf);
    S.cb.onEnd({ mode: S.mode, reason, score: S.score, maxCombo: S.maxCombo, correct: S.correct, wrong: S.wrong, rulesDone: S.rulesDone,
      bosses: S.bossWins, time: S.elapsed, ruleT: S.ruleT, rating: rating(S.score) });
  }
  function start(mode, cb, opts) {
    cancelAnimationFrame(S.raf); const cfg = MODES[mode]; if (!cfg) return;
    const key = (opts && opts.seed) || (cfg.seed === 'week' ? DateKeys.week() : cfg.seed === 'day' ? DateKeys.day() : null), seed = key ? hashStr('RR' + mode + key) : 0;
    Object.assign(S, { mode, cfg, cb, status: 'playing', score: 0, lives: cfg.lives, combo: 0, maxCombo: 0, correct: 0, wrong: 0, elapsed: 0, timeLeft: cfg.time,
      objs: [], rule: null, uid: 0, lock: 0, intro: 0, boss: null, bossN: 0, bossWins: 0, rulesDone: 0, ruleHits: 0, ruleT: [], inv: {}, fx: { freeze: 0, slow: 0 }, shield: false,
      nextBoss: cfg.bossEvery || CFG.bossEvery, rR: key ? mulberry32(seed) : Math.random, rO: key ? mulberry32(seed ^ 0x9e3779b9) : Math.random });
    S.orbCd = 10 + S.rO() * 6; S.bossOff = Math.floor(S.rR() * BOSSES.length);
    for (let i = 0; i < 6; i++) spawn();
    newRule(true); cb.onObjects(S.objs); cb.onTick(S);
    S.last = performance.now(); S.raf = requestAnimationFrame(loop);
  }
  function pause() { if (S.status === 'playing') { S.status = 'paused'; cancelAnimationFrame(S.raf); } }
  function resume() { if (S.status === 'paused') { S.status = 'playing'; S.last = performance.now(); S.raf = requestAnimationFrame(loop); } }
  function stop() { cancelAnimationFrame(S.raf); S.status = 'idle'; }
  return { start, tap, use, pause, resume, stop, reflow, state: () => S, setArena(w, h) { S.W = w; S.H = h; }, MODES, POWERS, BOSSES, CFG, HEX, valid, mult };
})();
