'use strict';
/* Local date keys (device time) + versioned, migration-safe LocalStorage. Nothing here is verified online. */
const DateKeys = (() => {
  const p = n => String(n).padStart(2, '0');
  const day = (d = new Date()) => d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return day(d); };
  const week = (d = new Date()) => { // ISO week
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
    const y = t.getUTCFullYear(); return y + '-W' + p(Math.ceil(((t - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7));
  };
  const msToNextDay = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1) - n; };
  return { day, yesterday, week, msToNextDay };
})();

const Store = (() => {
  const K = 'ruleRush.v1', VERSION = 2; // key kept so v1 records migrate in place
  const def = () => ({ v: VERSION, sound: true, haptics: true, theme: 'neon', themes: ['neon'], mode: 'classic',
    best: { classic: 0, quick: 0, endless: 0 }, daily: {}, dailyDone: {}, weekly: {}, weeklyDone: {},
    streak: { count: 0, last: '', best: 0 }, ach: {},
    stats: { games: 0, maxCombo: 0, totalScore: 0, correct: 0, wrong: 0, bosses: 0, bestScore: 0, endlessBest: 0, dailyDone: 0, weeklyDone: 0, perfect: 0, fast: 0 },
    history: [] });
  const isObj = x => x && typeof x === 'object' && !Array.isArray(x);
  // Copy only values whose type matches the defaults; free-form maps (empty default objects) are copied whole.
  function merge(d, s) {
    for (const k in d) {
      if (!(k in s)) continue;
      if (isObj(d[k]) && Object.keys(d[k]).length === 0) { if (isObj(s[k])) d[k] = s[k]; }
      else if (isObj(d[k])) { if (isObj(s[k])) merge(d[k], s[k]); }
      else if (Array.isArray(d[k]) ? Array.isArray(s[k]) : typeof d[k] === typeof s[k]) d[k] = s[k];
    }
    return d;
  }
  let d = def();
  try {
    const raw = localStorage.getItem(K);
    if (raw) {
      let s = null;
      try { s = JSON.parse(raw); } catch (e) { try { localStorage.setItem(K + '.corrupt', raw); } catch (_) {} } // keep a copy of broken data
      if (isObj(s)) d = merge(def(), s); // v1 -> v2: old records are kept, new fields get defaults
    }
  } catch (e) {}
  d.v = VERSION; if (!d.themes.includes('neon')) d.themes.unshift('neon');
  const save = () => { try { localStorage.setItem(K, JSON.stringify(d)); } catch (e) {} };
  const bestFor = m => (m === 'daily' ? d.daily[DateKeys.day()] : m === 'weekly' ? d.weekly[DateKeys.week()] : d.best[m]) || 0;
  const streakNow = () => (d.streak.last === DateKeys.day() || d.streak.last === DateKeys.yesterday() ? d.streak.count : 0);
  const prune = (o, n) => Object.keys(o).sort().slice(0, -n).forEach(k => delete o[k]);
  function record(s) { // s = summary from Game
    const k = DateKeys.day(), wk = DateKeys.week(), m = s.mode, st = d.stats, r = { firstCompletion: false }, done = s.reason === 'time';
    r.isNew = s.score > 0 && s.score > bestFor(m);
    if (m === 'daily') {
      d.daily[k] = Math.max(d.daily[k] || 0, s.score);
      if (done && !d.dailyDone[k]) { d.dailyDone[k] = 1; st.dailyDone++; r.firstCompletion = true; } // reward only once per day
      const sk = d.streak;
      if (sk.last !== k) { sk.count = sk.last === DateKeys.yesterday() ? sk.count + 1 : 1; sk.last = k; sk.best = Math.max(sk.best, sk.count); }
    } else if (m === 'weekly') {
      d.weekly[wk] = Math.max(d.weekly[wk] || 0, s.score);
      if (done && !d.weeklyDone[wk]) { d.weeklyDone[wk] = 1; st.weeklyDone++; r.firstCompletion = true; }
    } else d.best[m] = Math.max(d.best[m] || 0, s.score);
    st.games++; st.totalScore += s.score; st.correct += s.correct; st.wrong += s.wrong; st.bosses += s.bosses;
    st.maxCombo = Math.max(st.maxCombo, s.maxCombo); st.bestScore = Math.max(st.bestScore, s.score);
    if (m === 'endless') st.endlessBest = Math.max(st.endlessBest, s.time);
    if (s.wrong === 0 && s.correct >= 10 && done) st.perfect++;
    if (s.ruleT && s.ruleT[5] <= 25) st.fast++;
    d.history.unshift({ mode: m, score: s.score, t: Date.now() }); d.history.length = Math.min(d.history.length, 20);
    prune(d.daily, 30); prune(d.dailyDone, 30); prune(d.weekly, 12); prune(d.weeklyDone, 12);
    save(); r.best = bestFor(m); return r;
  }
  return { get: () => d, save, bestFor, record, streakNow };
})();
