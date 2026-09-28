// App shell cache is versioned; the CDN cache (emulator + cores) is NOT, so a
// new app deploy never forces people to re-download several MB of emulator.
const CACHE = 'mame-drive-v10';
const CDN_CACHE = 'mame-drive-emulator';
const SHELL = ['./', './index.html', './manifest.json', './icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== CDN_CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

function fetchTimeout(req, ms){
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return fetch(req, { signal: ctrl.signal }).finally(() => clearTimeout(t));
}

// Try the network (so updates arrive), fall back to cache when offline or slow.
async function networkFirst(req, cacheName, ms, matchOpts){
  const cache = await caches.open(cacheName);
  try{
    const res = await fetchTimeout(req, ms);
    if (res.ok) cache.put(req, res.clone()); // clone synchronously, before the body is used
    return res;
  }catch(err){
    const cached = await cache.match(req, matchOpts);
    if (cached) return cached;
    if (req.mode === 'navigate'){ const shell = await cache.match('./index.html'); if (shell) return shell; }
    return Response.error();
  }
}

// Emulator files never change for a given URL, so serve from cache first.
async function cacheFirstCdn(req){
  const cache = await caches.open(CDN_CACHE);
  const cached = await cache.match(req.url);
  if (cached) return cached;
  try{
    // Re-request in CORS mode so we store a real (non-opaque) response.
    const res = await fetch(req.url, { mode: 'cors' });
    if (res.ok) cache.put(req.url, res.clone());
    return res;
  }catch(err){
    return Response.error();
  }
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin){
    // 4s cap so a bad mobile connection falls back to the cached copy instead of hanging.
    e.respondWith(networkFirst(req, CACHE, 4000));
    return;
  }
  if (url.hostname === 'cdn.emulatorjs.org'){
    // Core "report" files are re-fetched with a changing ?v= — prefer fresh, match cache ignoring the query.
    if (url.pathname.includes('/cores/reports/')){
      e.respondWith(networkFirst(req, CDN_CACHE, 3000, { ignoreSearch: true }));
    } else {
      e.respondWith(cacheFirstCdn(req));
    }
  }
  // everything else (metadata CDN, fflate, etc.) passes straight through
});
