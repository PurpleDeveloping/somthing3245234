/*
 * SoggyToast site content: edit this file to update the site.
 *
 * The game list lives server-side in functions/api/games.js (so it isn't visible in the page source).
 * The 3 most-visited games get the tilted showcase; any extras appear in a grid below it.
 */
window.SITE = {
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
