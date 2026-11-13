'use strict';
/* Web Audio synthesized SFX. Context is created lazily on the first user gesture; voices are capped. */
const Sfx = (() => {
  let ctx, on = true, voices = 0;
  const c = () => {
    if (!ctx) { const A = window.AudioContext || window.webkitAudioContext; if (!A) return null; ctx = new A(); }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  };
  function tone(f, d = .12, type = 'sine', v = .15, t0 = 0, slide = 0) {
    if (!on || voices >= 10) return; const a = c(); if (!a) return;
    const t = a.currentTime + t0, o = a.createOscillator(), g = a.createGain(); voices++; o.onended = () => voices--;
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + d);
    o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + d + .02);
  }
  const arp = (fs, d, type, v, gap) => fs.forEach((f, i) => tone(f, d, type, v, i * gap));
  return {
    setOn(v) { on = v; }, unlock() { if (on) c(); },
    correct(n = 0) { const k = Math.min(n, 20) * 15; tone(520 + k, .1, 'triangle', .18); tone(780 + k, .1, 'triangle', .12, .06); },
    wrong() { tone(190, .28, 'sawtooth', .14, 0, -120); },
    combo(n = 5) { const b = 523 * (1 + Math.min(n, 30) / 60); arp([b, b * 1.26, b * 1.5, b * 2], .12, 'square', .07, .06); },
    rule() { tone(330, .08, 'sine', .14); tone(660, .14, 'sine', .14, .08); },
    power() { arp([440, 660, 880, 1320], .09, 'sine', .14, .045); },
    boss() { tone(110, .5, 'sawtooth', .16, 0, 60); tone(98, .5, 'square', .08, .25, 70); tone(146, .6, 'sawtooth', .14, .5, -30); },
    bossWin() { arp([392, 494, 587, 784, 988], .16, 'triangle', .16, .08); },
    ach() { arp([660, 880, 1100], .14, 'triangle', .15, .09); tone(1320, .35, 'sine', .12, .3); },
    record() { arp([523, 659, 784, 1047, 1319], .18, 'square', .08, .1); },
    over() { arp([392, 330, 262, 196], .3, 'triangle', .18, .18); }
  };
})();
