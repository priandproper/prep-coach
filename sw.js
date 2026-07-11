// sw.js — offline app-shell cache. Bump CACHE when you deploy changes so
// installed phones pick up the new version.
const CACHE = 'prepcoach-v15';
const ASSETS = [
  './', './index.html', './styles.css', './manifest.json',
  './js/app.js', './js/store.js', './js/ui.js', './js/scheduler.js',
  './js/ics.js', './js/notify.js', './js/pomodoro.js', './js/confetti.js',
  './js/views/today.js', './js/views/plan.js', './js/views/config.js', './js/views/jobsearch.js',
  './js/data/sql-plan.js', './js/data/resources.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.allSettled(ASSETS.map((a) => c.add(a))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Cache-first for same-origin GETs; fall back to the app shell for navigations offline.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.match(req).then((cached) => cached || fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => (req.mode === 'navigate' ? caches.match('./index.html') : undefined)))
  );
});
