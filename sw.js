const CACHE = 'mame-drive-v8';
const SHELL = ['./', './index.html', './manifest.json', './icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Only ever manage same-origin GETs. Cross-origin requests (the emulator
  // CDN, the metadata API, etc.) are left alone so a failure there can never
  // break or crash this service worker.
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  // Network-first: always try to get the latest deployed version. Only fall
  // back to the cached copy when offline, so updates show up on the very
  // next load instead of requiring a manual cache clear.
  e.respondWith(
    fetch(e.request).then(res => {
      // Clone synchronously, right here, before the body is touched — cloning
      // later inside the caches.open().then() callback is too late, since by
      // then the browser may have already started consuming the original.
      if (res.ok){
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      }
      return res;
    }).catch(() => caches.match(e.request).then(cached => cached || Response.error()))
  );
});
