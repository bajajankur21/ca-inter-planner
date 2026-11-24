// Network first, cache as fallback: always the latest version online, still opens offline.
// Bump CACHE whenever the file list changes, so installed copies pick up the new code.
const CACHE = 'ca-inter-hq-v3';
const SHELL = [
  './', './index.html', './manifest.webmanifest', './icons/owl.svg',
  './css/base.css', './css/pages.css', './css/owl.css',
  './js/app.js', './js/util.js', './js/store.js', './js/router.js', './js/stats.js', './js/tasks.js', './js/charts.js',
  './js/owl.js', './js/sound.js', './js/focusTimer.js', './js/sync.js', './js/syncCore.js', './js/firebaseConfig.js',
  './js/schedule.js', './js/assistant.js',
  './js/pages/dashboard.js', './js/pages/tracker.js', './js/pages/daily.js', './js/pages/weekly.js', './js/pages/monthly.js',
  './js/pages/study.js', './js/pages/focus.js', './js/pages/habits.js', './js/pages/goals.js', './js/pages/analytics.js',
  './js/pages/settings.js', './js/pages/skills.js', './js/pages/reminders.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

const isFont = (url) => url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Only our own files and fonts. Google sign-in and Firestore traffic must reach the network untouched.
  if (e.request.method !== 'GET' || (url.origin !== location.origin && !isFont(url))) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true })),
  );
});

// Reminder notifications: a tap (or Chrome's Completed / Still pending buttons) is handled by the open planner tab.
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const key = e.notification.data?.key;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((tabs) => {
    const tab = tabs[0];
    if (!tab) return self.clients.openWindow('./');
    if (key) tab.postMessage({ type: 'reminder', key, action: e.action || 'open' });
    return tab.focus();
  }));
});
