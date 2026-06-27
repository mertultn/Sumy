// sw.js
const CACHE_NAME = 'sumy-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/login/welcome.html',
  '/login/haveAcc.html',
  '/login/createAcc.html',
  '/images/icon.png' // Varsa ikonunun yolu
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener('fetch', (e) => {
  e.respondWith(caches.match(e.request).then(res => res || fetch(e.request)));
});