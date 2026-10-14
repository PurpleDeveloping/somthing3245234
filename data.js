/*
 * SoggyToast site content: edit this file to update the site.
 *
 * Games are loaded live from Roblox (via RoProxy, a public Roblox API mirror that browsers are allowed to call).
 * Only the universe IDs listed in `games` are shown. To add a game, add its universe ID.
 * The 3 most-visited games get the tilted showcase; any extras appear in a grid below it.
 */
window.SITE = {
  games: ["8581899016", "7201268162", "9533030530"],

  // Creators shown with a verified badge even if Roblox doesn't flag them.
  verifiedCreators: ["Secret Base Community", "Shopping Drift"],

  // Optional looping hero video (e.g. "assets/background.mp4").
  // Leave empty to use a slow crossfade of your game thumbnails instead.
  heroVideo: "",

  links: {
    discord: "https://discord.gg/FupwKNtQfN",
    robloxGroup: "https://www.roblox.com/groups/9530841",
  },

  // `live` stats are replaced by real numbers once the games load;
  // `value` is shown until then (or if loading fails).
  stats: [
    { label: "Total visits", value: "42M+", live: "visits" },
    { label: "Playing right now", value: "700", live: "playing" },
    { label: "Games published", value: "5+" },
    { label: "Established", value: "2021" },
  ],

  gamesNote: "*Some games were contributed to by SoggyToast and are not studio-owned.",
};
