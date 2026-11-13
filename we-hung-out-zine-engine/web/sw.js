// Network-first service worker: the site always loads the newest version
// when online (so updates show up in the installed app too), and falls
// back to the last copy it saw when offline.
var CACHE = 'who-v2';
var SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png',
  'fonts/bricolage-var.woff2', 'fonts/caveat-600.woff2'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var r = e.request;
  if (r.method !== 'GET') return;
  var u = new URL(r.url);
  if (u.origin !== location.origin) return;
  e.respondWith(
    fetch(r).then(function (res) {
      if (res && res.status === 200) { var cp = res.clone(); caches.open(CACHE).then(function (c) { c.put(r, cp); }); }
      return res;
    }).catch(function () {
      return caches.match(r).then(function (m) { return m || caches.match('index.html'); });
    })
  );
});
