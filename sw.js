// Работа без интернета: файлы приложения сохраняются в телефоне.
// При каждом запуске показываем сохранённую версию и тихо проверяем, нет ли новой.
const CACHE = 'techeng-v2';
const FILES = [
  './', './index.html', './style.css', './manifest.webmanifest',
  './js/words.js', './js/srs.js', './js/quiz.js', './js/app.js',
  './img/emblem.svg', './icons/icon-512.png',
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request).then(r => { if (r.ok) cache.put(e.request, r.clone()); return r; }).catch(() => cached);
    return cached || net;
  }));
});
