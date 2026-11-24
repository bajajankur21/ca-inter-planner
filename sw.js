// Network first, cache as fallback: always the latest version online, still opens offline.
const CACHE = 'ca-inter-hq-v1';
const SHELL = [
  './', './index.html', './manifest.webmanifest', './icons/owl.svg',
  './css/base.css', './css/pages.css', './css/owl.css',
  './js/app.js', './js/util.js', './js/store.js', './js/router.js', './js/stats.js', './js/tasks.js', './js/charts.js',
  './js/owl.js', './js/sound.js', './js/focusTimer.js',
  './js/pages/dashboard.js', './js/pages/tracker.js', './js/pages/daily.js', './js/pages/weekly.js', './js/pages/monthly.js',
  './js/pages/study.js', './js/pages/focus.js', './js/pages/habits.js', './js/pages/goals.js', './js/pages/analytics.js',
  './js/pages/settings.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok && (new URL(e.request.url).origin === location.origin || e.request.url.includes('fonts.g'))) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true })),
  );
});
