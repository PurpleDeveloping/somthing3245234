(() => {
  const site = window.SITE || {};
  const $ = (sel) => document.querySelector(sel);

  const esc = (s = "") =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const fmt = (n) => {
    if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, "") + "B";
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
    return String(n);
  };

  const truncate = (text, max) =>
    !text ? "" : text.length <= max ? text : text.slice(0, max).trimEnd() + "…";

  const ICONS = {
    user: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-5.33 0-8 2.67-8 5v1h16v-1c0-2.33-2.67-5-8-5Z"/></svg>',
    eye: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 5C6.5 5 2.7 9.1 1.5 12c1.2 2.9 5 7 10.5 7s9.3-4.1 10.5-7C21.3 9.1 17.5 5 12 5Zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8Z"/></svg>',
    verified: '<svg class="verified" viewBox="0 0 24 24" aria-label="Verified"><path fill="#5200FF" d="m12 1 2.6 2.2 3.4-.3.9 3.3 3 1.7-1.2 3.1 1.2 3.1-3 1.7-.9 3.3-3.4-.3L12 23l-2.6-2.2-3.4.3-.9-3.3-3-1.7L3.3 12 2.1 8.9l3-1.7.9-3.3 3.4.3z"/><path fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="m7.5 12.2 3 3 6-6.2"/></svg>',
  };

  /* ---------- Static bits ---------- */
  document.querySelectorAll("[data-link]").forEach((a) => {
    const href = site.links?.[a.dataset.link];
    if (href) a.href = href;
  });

  $("#stats").innerHTML = (site.stats || [])
    .map(
      (s, i) => `<div class="number reveal d${i + 1}">
        <dt>${s.live === "playing" ? '<span class="live-dot"></span>' : ""}${esc(s.label)}</dt>
        <dd${s.live ? ` data-live="${s.live}"` : ""}>${esc(s.value)}</dd>
      </div>`
    )
    .join("");

  $("#gamesNote").textContent = site.gamesNote || "";
  $("#year").textContent = new Date().getFullYear();

  /* ---------- Reveal on scroll ---------- */
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const io =
    "IntersectionObserver" in window && !reduceMotion
      ? new IntersectionObserver(
          (entries) =>
            entries.forEach((e) => {
              if (e.isIntersecting) {
                e.target.classList.add("is-visible");
                io.unobserve(e.target);
              }
            }),
          { threshold: 0.2 }
        )
      : null;
  const observe = (root = document) =>
    root.querySelectorAll(".reveal:not(.is-visible)").forEach((el) => (io ? io.observe(el) : el.classList.add("is-visible")));

  /* ---------- Hero background ---------- */
  const heroMedia = $("#heroMedia");

  if (site.heroVideo) {
    const v = document.createElement("video");
    Object.assign(v, { src: site.heroVideo, muted: true, loop: true, playsInline: true, autoplay: true });
    heroMedia.appendChild(v);
    // Some browsers block autoplay until the first interaction
    v.play().catch(() => {
      const retry = () => v.play().catch(() => {});
      document.addEventListener("click", retry, { once: true });
      document.addEventListener("touchstart", retry, { once: true });
    });
  }

  const startHeroSlideshow = (images) => {
    if (site.heroVideo || !images.length) return;
    heroMedia.innerHTML = images
      .map((src, i) => `<div class="hero-slide${i === 0 ? " is-active" : ""}" style="background-image:url('${esc(src)}')"></div>`)
      .join("");
    if (images.length < 2 || reduceMotion) return;
    const slides = heroMedia.querySelectorAll(".hero-slide");
    let idx = 0;
    setInterval(() => {
      slides[idx].classList.remove("is-active");
      idx = (idx + 1) % slides.length;
      slides[idx].classList.add("is-active");
    }, 7000);
  };

  /* ---------- Games (from our own /api/games endpoint) ---------- */
  const showcase = $("#showcase");
  const moreGames = $("#moreGames");
  const CACHE_KEY = "soggytoast_games_v2";
  const CACHE_TTL = 5 * 60 * 1000;

  const readCache = () => {
    try {
      const c = JSON.parse(sessionStorage.getItem(CACHE_KEY));
      if (c && Date.now() - c.t < CACHE_TTL) return c.games;
    } catch {}
    return null;
  };
  const writeCache = (games) => {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), games }));
    } catch {}
  };

  const fetchGames = async () => {
    try {
      const res = await fetch("/api/games");
      if (!res.ok) throw new Error(res.status);
      return ((await res.json()).games || []).map((g) => ({ ...g, name: g.name || "Untitled game" }));
    } catch (e) {
      console.warn("Failed to load games", e);
      return [];
    }
  };

  const card = (g, i, extraClass = "") => {
    const url = g.placeId ? `https://www.roblox.com/games/${g.placeId}` : "";
    const tag = url ? "a" : "div";
    const attrs = url ? `href="${esc(url)}" target="_blank" rel="noopener"` : "";
    const img = g.thumbnail ? `<img src="${esc(g.thumbnail)}" alt="" loading="lazy" onerror="this.remove()" />` : "";
    return `
      <${tag} class="game reveal ${extraClass} d${(i % 3) + 1}" ${attrs}>
        <div class="game-media">
          <span class="game-initial">${esc(g.name.charAt(0))}</span>${img}
          <div class="game-shade"></div>
          <div class="game-info">
            <div class="game-pills">
              <span class="pill">${ICONS.user}${fmt(g.playing)}</span>
              <span class="pill">${ICONS.eye}${fmt(g.visits)}</span>
            </div>
            <h3 class="game-title">${esc(g.name)}</h3>
            ${g.creator ? `<p class="game-creator">by ${esc(g.creator)}${g.verified ? ICONS.verified : ""}</p>` : ""}
          </div>
        </div>
        ${g.description ? `<p class="game-desc">${esc(truncate(g.description, 100))}</p>` : ""}
      </${tag}>`;
  };

  const skeletons = (n) =>
    Array.from({ length: n }, (_, i) => `<div class="game is-loading t${(i % 3) + 1}" aria-hidden="true"><div class="game-media"></div></div>`).join("");

  const updateLiveStats = (games) => {
    const totals = {
      playing: games.reduce((s, g) => s + g.playing, 0),
      visits: games.reduce((s, g) => s + g.visits, 0),
    };
    document.querySelectorAll("[data-live]").forEach((el) => {
      const n = totals[el.dataset.live];
      if (n) el.textContent = fmt(n);
    });
  };

  const render = (games) => {
    if (!games.length) {
      const local = location.protocol === "file:" || ["localhost", "127.0.0.1"].includes(location.hostname);
      if (local) console.info("Games come from /api/games, which only runs on Cloudflare Pages (or `npx wrangler pages dev .`).");
      showcase.innerHTML = local
        ? `<p class="games-empty">Games load from <code>/api/games</code>, which only runs once the site is on Cloudflare Pages.</p>`
        : `<p class="games-empty">Couldn't load games right now. <a class="nav-link" href="${esc(site.links.robloxGroup)}" target="_blank" rel="noopener">See them on Roblox ↗</a></p>`;
      return;
    }
    const sorted = [...games].sort((a, b) => b.visits - a.visits);
    showcase.innerHTML = sorted.slice(0, 3).map((g, i) => card(g, i, `t${i + 1}`)).join("");
    moreGames.innerHTML = sorted.slice(3).map((g, i) => card(g, i)).join("");
    updateLiveStats(sorted);
    startHeroSlideshow(sorted.map((g) => g.thumbnail).filter(Boolean));
    observe(showcase);
    observe(moreGames);
  };

  const loadGames = async () => {
    const cached = readCache();
    if (cached) return render(cached);

    showcase.innerHTML = skeletons(3);
    const games = await fetchGames();
    if (games.length) writeCache(games);
    render(games);
  };

  /* ---------- Header ---------- */
  const header = $("#header");
  const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 10);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  const menuBtn = $("#menuBtn");
  const setMenu = (open) => {
    header.classList.toggle("is-open", open);
    menuBtn.setAttribute("aria-expanded", open);
    menuBtn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  };
  menuBtn.addEventListener("click", () => setMenu(!header.classList.contains("is-open")));
  $("#nav").addEventListener("click", (e) => e.target.closest("a") && setMenu(false));

  observe();
  loadGames();
})();
