// Cloudflare Worker entry point for MAME Drive.
//
// Handles GET /api/mame-meta?name=<mame-short-name> by calling
// adb.arcadeitalia.net server-side (no CORS restriction between servers)
// and returning a small, same-origin-friendly JSON payload.
// Everything else falls through to the static asset bindings.
//
// If your project already has its own worker entry file (e.g. from a
// wrangler.toml `main` setting), copy the `/api/mame-meta` branch into it
// rather than replacing the whole file — just keep your existing
// `env.ASSETS.fetch(request)` fallback for everything else.

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/mame-meta') {
      const name = url.searchParams.get('name');
      if (!name) return new Response('Missing "name" parameter', { status: 400 });

      // Edge cache: once any visitor looks up a game, every other visitor
      // gets an instant response instead of re-hitting arcadeitalia.net.
      // ?v=2 busts any entries cached before the biosOf field was added.
      const cacheKey = new Request(url.toString() + '&v=2', request);
      const cache = caches.default;
      const cached = await cache.match(cacheKey);
      if (cached) return cached;

      const upstream = `https://adb.arcadeitalia.net/service_scraper.php?ajax=query_mame&lang=en&game_name=${encodeURIComponent(name)}`;
      let meta;
      try {
        const res = await fetch(upstream, { headers: { 'User-Agent': 'MAME-Drive/1.0' }, signal: AbortSignal.timeout(6000) });
        const json = await res.json();
        const hit = json && json.result && json.result[0];
        meta = hit ? {
          title: hit.title || name,
          manufacturer: hit.manufacturer || '',
          year: hit.year || '',
          image: hit.url_image_flyer || hit.url_image_title || hit.url_image_ingame || '',
          // Name of the BIOS/parent set this game needs (e.g. "neogeo"), if any —
          // lets the app auto-pick a matching uploaded BIOS file instead of
          // making the user guess from a list of hundreds.
          biosOf: hit.romof || hit.bios || hit.cloneof || ''
        } : { title: name, manufacturer: '', year: '', image: '', biosOf: '' };
      } catch (e) {
        meta = { title: name, manufacturer: '', year: '', image: '' };
      }

      const response = new Response(JSON.stringify(meta), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=604800' // a week — MAME game data doesn't change
        }
      });
      ctx.waitUntil(cache.put(cacheKey, response.clone()));
      return response;
    }

    // Cover art, served from our own origin so the service worker can cache it
    // for offline use (the source site sends no CORS headers, so the browser
    // can't fetch/cache it directly).
    if (url.pathname === '/api/mame-art') {
      const name = url.searchParams.get('name');
      if (!name) return new Response('Missing "name" parameter', { status: 400 });
      const cache = caches.default;
      const cacheKey = new Request(url.toString(), request);
      const hit = await cache.match(cacheKey);
      if (hit) return hit;
      try {
        const metaRes = await fetch(`https://adb.arcadeitalia.net/service_scraper.php?ajax=query_mame&lang=en&game_name=${encodeURIComponent(name)}`, { signal: AbortSignal.timeout(6000) });
        const json = await metaRes.json();
        const g = json && json.result && json.result[0];
        const imgUrl = g && (g.url_image_flyer || g.url_image_title || g.url_image_ingame);
        if (!imgUrl) return new Response('No art', { status: 404 });
        const img = await fetch(imgUrl, { signal: AbortSignal.timeout(10000) });
        if (!img.ok) return new Response('No art', { status: 404 });
        const out = new Response(img.body, { headers: {
          'Content-Type': img.headers.get('Content-Type') || 'image/png',
          'Cache-Control': 'public, max-age=2592000'
        }});
        ctx.waitUntil(cache.put(cacheKey, out.clone()));
        return out;
      } catch (e) {
        return new Response('Art unavailable', { status: 502 });
      }
    }

    return env.ASSETS.fetch(request);
  }
};
