/*
 * Cloudflare Pages Function: GET /api/games
 *
 * Runs on the server, so the game list and the Roblox API calls never appear
 * in the website's source code. The browser only ever sees /api/games on your own domain.
 * Responses are cached at the edge for CACHE_SECONDS so Roblox isn't hit on every visit.
 *
 * To add a game, add its universe ID below.
 */
const UNIVERSE_IDS = ["8581899016", "7201268162", "9533030530"];

// Creators shown with a verified badge even if Roblox doesn't flag them.
const VERIFIED_CREATORS = ["Secret Base Community", "Shopping Drift"];

const CACHE_SECONDS = 60;

const json = (body, status, maxAge) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": maxAge ? `public, max-age=${maxAge}` : "no-store",
    },
  });

export async function onRequestGet(context) {
  const cache = caches.default;
  const cacheKey = new Request(new URL("/api/games", context.request.url).toString());

  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const ids = UNIVERSE_IDS.join(",");

  try {
    const [gamesRes, thumbsRes] = await Promise.all([
      fetch(`https://games.roblox.com/v1/games?universeIds=${ids}`),
      fetch(
        `https://thumbnails.roblox.com/v1/games/multiget/thumbnails?universeIds=${ids}&countPerUniverse=1&size=768x432&format=Png&isCircular=false`
      ),
    ]);
    if (!gamesRes.ok) throw new Error(`games.roblox.com ${gamesRes.status}`);

    const games = (await gamesRes.json()).data || [];
    const thumbs = thumbsRes.ok ? (await thumbsRes.json()).data || [] : [];
    const thumbFor = (id) => thumbs.find((t) => t.universeId === id)?.thumbnails?.[0]?.imageUrl || "";

    const body = {
      games: games.map((g) => ({
        name: g.name || "",
        description: g.description || "",
        thumbnail: thumbFor(g.id),
        placeId: g.rootPlaceId || null,
        creator: g.creator?.name || "",
        verified: !!g.creator?.hasVerifiedBadge || VERIFIED_CREATORS.includes(g.creator?.name),
        playing: g.playing || 0,
        visits: g.visits || 0,
      })),
    };

    const res = json(body, 200, CACHE_SECONDS);
    context.waitUntil(cache.put(cacheKey, res.clone()));
    return res;
  } catch (e) {
    console.error(e);
    return json({ games: [] }, 502, 0);
  }
}
