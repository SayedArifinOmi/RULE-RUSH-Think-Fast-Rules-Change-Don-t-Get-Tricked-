/* Offline cache. Bump V whenever any file changes so installed copies update. */
const V = 'rule-rush-v3.6', FILES = ['./', 'index.html', 'manifest.json', 'css/style.css', 'css/premium.css', 'js/storage.js', 'js/progress.js', 'js/audio.js', 'js/game.js', 'js/ui.js', 'js/fx.js', 'assets/logo.svg', 'assets/icon-192.png', 'assets/icon-512.png'];
self.addEventListener('install', e => e.waitUntil(caches.open(V).then(c => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== V).map(x => caches.delete(x)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => { const c = res.clone(); caches.open(V).then(ch => ch.put(e.request, c)); return res; }).catch(() => caches.match('index.html'))));
});