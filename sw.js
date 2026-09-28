// App shell cache. Cross-origin CDN/core files are intentionally left alone —
// see the note in the fetch handler below.
const CACHE = 'mame-drive-v11';
const SHELL = ['./', './index.html', './manifest.json', './icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    // Also clears out 'mame-drive-emulator', a cache an earlier version created for
    // CDN/core files; that approach broke WASM streaming compile and was removed.
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
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

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin){
    // 4s cap so a bad mobile connection falls back to the cached copy instead of hanging.
    e.respondWith(networkFirst(req, CACHE, 4000));
  }
  // Cross-origin requests (emulator CDN cores/wasm, metadata, fflate, etc.) are
  // left completely alone. A previous version tried to cache these ourselves,
  // but re-wrapping a WASM core's response broke WebAssembly's fast streaming
  // compile on the first load and forced a retry. EmulatorJS already caches
  // its own core files (EJS_cacheConfig, set in index.html); this service
  // worker only needs to own the app shell.
});
