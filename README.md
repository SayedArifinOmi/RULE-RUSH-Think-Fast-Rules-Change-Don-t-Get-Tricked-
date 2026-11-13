# RULE RUSH v2 — Think Fast. Rules Change. Don't Get Tricked!
Vanilla HTML/CSS/JS arcade game. No frameworks, no backend, no audio files. Installable as a PWA and playable offline.

## Run locally
- Quick: open `index.html` (everything except PWA install/offline works from `file://`).
- Full (PWA, service worker): `python3 -m http.server 8000` → http://localhost:8000 (localhost counts as secure).
## Host
Upload the folder to any static host over **HTTPS** (GitHub Pages, Netlify, Cloudflare Pages…). After changing any file, bump `V` in `sw.js` so installed copies refresh.

## Modes (single source of truth: `MODES` + `CFG` in `js/game.js`)
| Mode | Time | Lives | Notes |
|---|---|---|---|
| Classic | 45 s | 3 | balanced |
| Quick Rush | 30 s | 2 | faster rules, starts at higher level |
| Endless | ∞ | 3 | survival time tracked, difficulty keeps rising |
| Daily Challenge | 60 s | 3 | seeded from the device's local date |
| Weekly Challenge | 60 s | 3 | seeded from ISO week; hard start, boss every 6 rules |
| 2-Player Duel | 30 s per turn | 3 each | local, same device, alternate turns |

## Rules of the game
- Rules: color, shape, avoid color/shape, smallest/largest, color+shape. A rule "completes" after 4 correct taps (or 2+ when it times out). Every 10 completed rules → **boss round**.
- Combo multiplier: 1–4 ×1, 5–9 ×2, 10–14 ×3, 15–19 ×4, 20+ ×5; 10 points × multiplier per tap. Messages at 5/10/15/20/30 (NICE → LEGENDARY). A wrong tap resets the combo and costs a life.
- Power-up orbs ❄ Time Freeze (4 s) · ⏳ Slow Motion (6 s, half-speed rule timer) · 🛡 Second Chance · 💥 Clear Board. An orb shows for 6 s every ~14–22 s; tap it to store it (max one of each), then use it from the bar or with **F / S / X / C**.
- Bosses (8 s, +100 for a mistake-free clear): Rapid Rule, Reverse Rule, Double Trouble, Survival, Memory Test.
- Controls: mouse/touch, number keys `1–9,0,-,=`, `P`/`Space`/`Esc` pause, `M` mute.
- Achievements (11) unlock themes (Midnight ← First Blood, Retro ← Century, Galaxy ← On Fire, Matrix ← Boss Slayer, Light ← Perfect Run).

## 2-Player Duel (local, same device — not online multiplayer)
Home → **👥 2 Players**. Player 1 plays a 30 s turn, passes the device, then Player 2 plays. Both turns start from the **same random seed** (identical starting board and rule, same power-up/boss schedule), with separate scores, a winner/draw announcement and a **Rematch** (new seed, player order swapped). Duel turns don't change solo high scores, stats or achievements, and a turn can't be restarted from the pause menu.
Note: the seed fixes the starting conditions and random sequences, but later boards still depend on how each player taps, so the two runs are equal in setup rather than frame-identical.

## UI
v3 visual pass: animated emblem + gradient logo, glass cards, icon tiles, richer HUD/rule card, dotted arena, glossy shapes, redesigned results. Pure CSS (plus small HTML/JS tweaks) — layout was checked in jsdom only, not in a real browser.

## Files
`index.html` · `css/style.css` · `js/storage.js` (dates, versioned storage) · `js/progress.js` (achievements, themes) · `js/audio.js` · `js/game.js` (engine) · `js/ui.js` · `manifest.json` · `sw.js` · `assets/icon-*.png`

## Data
Key `ruleRush.v1` (kept so v1 records survive) with `v:2` inside. Old data is merged into the new schema (never reset); wrong-typed fields fall back to defaults; unparsable data is copied to `ruleRush.v1.corrupt`.
**Daily/weekly scores, streaks and rewards are stored on this device only — there is no online verification or leaderboard** (and device-clock changes can affect them).

## Testing report (what was actually run)
- `node --check` on all JS; manifest parses. ✔
- Headless engine simulation (Node, bot player), all 5 modes: runs end at the configured duration/lives, 0 frames without a valid target (incl. 400 s Endless with all 5 boss types), objects always inside the arena, unique ids/slots, score equals the sum of per-tap gains + boss bonuses, multiplier table, no double scoring, shield/freeze/clear behave, pause freezes the clock, stop halts the loop, daily and weekly are deterministic. ✔
- Storage: v1 → v2 migration keeps records, corrupted/wrong-type data handled, achievements/themes never re-awarded, daily reward once per day, streak continue/break logic. ✔
- UI smoke test in jsdom (scripted clicks/keys): all screens and back buttons, mode selection, locked themes not selectable, play/pause/resume/restart/home, hotkeys, power buttons, tab-hidden auto-pause, boss banner, game over → Play Again, share clipboard fallback, localStorage writes, 0 JS errors. ✔
- Duel: same seed ⇒ identical starting board/rule (engine + UI), turn handoff, winner/draw text, rematch swaps order, restart hidden, solo records untouched, 0 JS errors. ✔ (One earlier run of the general UI smoke test exited abnormally; I could not reproduce it in 4 reruns, all passed.)
- **NOT verified** (no real browser/device available): visual layout and animation quality on real screens, touch/orientation behaviour, safe-area insets, actual audio and vibration output, Web Share sheet, PWA install prompt and offline reload, performance on low-end phones. Please test these on a real phone.

## Known limitations / future
- Objects are static, so Slow Motion slows the rule/boss timers rather than object movement.
- Duel is hot-seat only (one device, one winner per match); there is no online play, tournament or match history.
- Haptics depend on browser support (not available on iOS Safari).
