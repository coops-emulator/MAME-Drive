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
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/mame-meta') {
      const name = url.searchParams.get('name');
      if (!name) return new Response('Missing "name" parameter', { status: 400 });

      const upstream = `https://adb.arcadeitalia.net/service_scraper.php?ajax=query_mame&lang=en&game_name=${encodeURIComponent(name)}`;

      try {
        const res = await fetch(upstream, { headers: { 'User-Agent': 'MAME-Drive/1.0' } });
        const json = await res.json();
        const hit = json && json.result && json.result[0];
        const meta = hit ? {
          title: hit.title || name,
          manufacturer: hit.manufacturer || '',
          year: hit.year || '',
          image: hit.url_image_flyer || hit.url_image_title || hit.url_image_ingame || ''
        } : { title: name, manufacturer: '', year: '', image: '' };

        return new Response(JSON.stringify(meta), {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=604800' // cache a week; MAME game data doesn't change
          }
        });
      } catch (e) {
        return new Response(JSON.stringify({ title: name, manufacturer: '', year: '', image: '' }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    return env.ASSETS.fetch(request);
  }
};
