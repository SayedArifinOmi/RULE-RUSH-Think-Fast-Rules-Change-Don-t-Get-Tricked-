'use strict';
/* Achievements (derived from persistent stats) and the themes they unlock. */
const Progress = (() => {
  const ACH = [
    { id: 'first', n: 'First Blood', i: '🩸', d: 'Complete your first game', t: 1, g: s => s.games },
    { id: 'century', n: 'Century', i: '💯', d: 'Score 100 points', t: 100, g: s => s.bestScore },
    { id: 'combo10', n: 'Combo Master', i: '🔥', d: 'Reach a 10-action combo', t: 10, g: s => s.maxCombo },
    { id: 'perfect', n: 'Perfect Run', i: '🎯', d: 'Finish a timed game with 0 mistakes (10+ taps)', t: 1, g: s => s.perfect },
    { id: 'speed', n: 'Speed Demon', i: '⚡', d: 'Complete 6 rules within 25 seconds', t: 1, g: s => s.fast },
    { id: 'survivor', n: 'Survivor', i: '🛡', d: 'Survive 60 seconds in Endless', t: 60, g: s => Math.floor(s.endlessBest) },
    { id: 'daily', n: 'Daily Champion', i: '📅', d: 'Complete a Daily Challenge', t: 1, g: s => s.dailyDone },
    { id: 'legend', n: 'Legend', i: '👑', d: 'Reach 1000 points', t: 1000, g: s => s.bestScore },
    { id: 'boss5', n: 'Boss Slayer', i: '👹', d: 'Clear 5 boss rounds', t: 5, g: s => s.bosses },
    { id: 'streak3', n: 'On Fire', i: '📆', d: 'Play the Daily 3 days in a row', t: 3, g: (s, d) => d.streak.best },
    { id: 'weekly', n: 'Weekly Warrior', i: '🏆', d: 'Complete the Weekly Challenge', t: 1, g: s => s.weeklyDone }];
  const THEMES = [
    { id: 'neon', n: 'Neon Cyberpunk', req: null, sw: ['#0b0720', '#ff3df0', '#27e9ff'] },
    { id: 'midnight', n: 'Midnight Purple', req: 'first', sw: ['#10061f', '#c77dff', '#9d8cff'] },
    { id: 'retro', n: 'Retro Arcade', req: 'century', sw: ['#1a0f00', '#ff9f1c', '#ffe066'] },
    { id: 'galaxy', n: 'Space Galaxy', req: 'streak3', sw: ['#02030f', '#8f7bff', '#5ee6ff'] },
    { id: 'matrix', n: 'Matrix Green', req: 'boss5', sw: ['#000a03', '#00ff66', '#c8ff00'] },
    { id: 'light', n: 'Minimal Light', req: 'perfect', sw: ['#f2f4ff', '#e0238f', '#1b6df0'] }];
  const ach = id => ACH.find(a => a.id === id);
  // Unlock whatever is newly earned. Each id is stored once, so rewards can never repeat.
  function check() {
    const d = Store.get(), out = { ach: [], themes: [] };
    ACH.forEach(a => { if (!d.ach[a.id] && a.g(d.stats, d) >= a.t) { d.ach[a.id] = Date.now(); out.ach.push(a); } });
    THEMES.forEach(t => { if (t.req && d.ach[t.req] && !d.themes.includes(t.id)) { d.themes.push(t.id); out.themes.push(t); } });
    Store.save(); return out;
  }
  return { ACH, THEMES, ach, check };
})();
