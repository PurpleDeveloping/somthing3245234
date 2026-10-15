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
    verified: '<img class="verified" src="assets/VerifiedIcon.png" alt="Verified" title="Verified" width="16" height="16" />',
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

  /* ---------- Cookie consent ----------
     Accept: remember the choice + cache game data for 5 minutes.
     Decline: store nothing at all (and wipe anything stored before). The popup asks again next visit.
     The site never sets real cookies; this covers browser storage only. */
  const CONSENT_KEY = "soggytoast_consent";
  const consentEl = $("#consent");
  let declinedThisVisit = false;

  const getConsent = () => {
    try {
      return localStorage.getItem(CONSENT_KEY);
    } catch {
      return null;
    }
  };
  const hasConsent = () => !declinedThisVisit && getConsent() === "accepted";

  // Removes every key this site (or any older version of it) has ever stored.
  const clearSiteStorage = () => {
    for (const store of ["localStorage", "sessionStorage"]) {
      try {
        const s = window[store];
        Object.keys(s)
          .filter((k) => k.startsWith("soggytoast_"))
          .forEach((k) => s.removeItem(k));
      } catch {}
    }
  };

  const showConsent = () => {
    if (!consentEl) return;
    consentEl.hidden = false;
    requestAnimationFrame(() => consentEl.classList.add("is-open"));
  };
  const hideConsent = () => {
    if (!consentEl) return;
    consentEl.classList.remove("is-open");
    setTimeout(() => (consentEl.hidden = true), 300);
  };

  $("#consentAccept")?.addEventListener("click", () => {
    declinedThisVisit = false;
    try {
      localStorage.setItem(CONSENT_KEY, "accepted");
    } catch {}
    if (lastGames.length) writeCache(lastGames);
    if (lastGroups.length) cacheSet(GROUPS_KEY, groupsSig, lastGroups);
    hideConsent();
  });
  $("#consentDecline")?.addEventListener("click", () => {
    declinedThisVisit = true;
    clearSiteStorage();
    hideConsent();
  });
  $("#cookieSettings")?.addEventListener("click", showConsent);

  if (getConsent() !== "accepted") {
    clearSiteStorage(); // no consent yet: make sure nothing is left over from older versions
    setTimeout(showConsent, 800);
  }

  /* ---------- Games (live from Roblox via RoProxy) ---------- */
  const showcase = $("#showcase");
  const moreGames = $("#moreGames");
  const ids = (site.games || []).map(String);
  const CACHE_KEY = "soggytoast_games_v5";
  const CACHE_TTL = 5 * 60 * 1000;
  let lastGames = [];

  // Caches are only used when the visitor has accepted storage.
  // `sig` is the list of IDs the data was fetched for, so editing data.js invalidates the cache.
  const cacheGet = (key, sig) => {
    if (!hasConsent()) return null;
    try {
      const c = JSON.parse(sessionStorage.getItem(key));
      if (c && Date.now() - c.t < CACHE_TTL && c.sig === sig) return c.data;
    } catch {}
    return null;
  };
  const cacheSet = (key, sig, data) => {
    if (!hasConsent()) return;
    try {
      sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), sig, data }));
    } catch {}
  };
  const readCache = () => cacheGet(CACHE_KEY, ids.join());
  const writeCache = (games) => cacheSet(CACHE_KEY, ids.join(), games);

  // RoProxy is shared by lots of sites, so it sometimes answers 429 (too many requests) or errors briefly.
  // Retry with a growing delay before giving up.
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const fetchJSON = async (url, attempts = 5) => {
    for (let i = 0; i < attempts; i++) {
      try {
        const res = await fetch(url);
        if (res.ok) return await res.json();
        if (res.status < 500 && res.status !== 429) break; // a real error, retrying won't help
      } catch {}
      if (i < attempts - 1) await sleep(500 * 2 ** i + Math.random() * 300);
    }
    throw new Error(`Failed to load ${url}`);
  };
  const fetchData = (url, attempts) => fetchJSON(url, attempts).then((d) => d.data || []);

  // Game details, square icons (cards) and wide thumbnails (hero background): 3 requests in parallel.
  const fetchGames = async () => {
    if (!ids.length) return [];
    const q = ids.join(",");
    try {
      const [games, icons, thumbs] = await Promise.all([
        fetchData(`https://games.roproxy.com/v1/games?universeIds=${q}`),
        fetchData(`https://thumbnails.roproxy.com/v1/games/icons?universeIds=${q}&returnPolicy=PlaceHolder&size=512x512&format=Png&isCircular=false`).catch(() => []),
        fetchData(`https://thumbnails.roproxy.com/v1/games/multiget/thumbnails?universeIds=${q}&countPerUniverse=1&size=768x432&format=Png&isCircular=false`).catch(() => []),
      ]);
      const iconFor = (id) => icons.find((t) => String(t.targetId) === String(id))?.imageUrl || "";
      const thumbFor = (id) => thumbs.find((t) => String(t.universeId) === String(id))?.thumbnails?.[0]?.imageUrl || "";
      const verified = site.verifiedCreators || [];

      return games
        .filter((g) => ids.includes(String(g.id)))
        .map((g) => ({
          name: g.name || "Untitled game",
          description: g.description || "",
          icon: iconFor(g.id),
          thumbnail: thumbFor(g.id),
          placeId: g.rootPlaceId || null,
          creator: g.creator?.name || "",
          verified: !!g.creator?.hasVerifiedBadge || verified.includes(g.creator?.name),
          playing: g.playing || 0,
          visits: g.visits || 0,
        }));
    } catch (e) {
      console.warn("Failed to load games", e);
      return [];
    }
  };

  const card = (g, i, extraClass = "") => {
    const url = g.placeId ? `https://www.roblox.com/games/${g.placeId}` : "";
    const tag = url ? "a" : "div";
    const attrs = url ? `href="${esc(url)}" target="_blank" rel="noopener"` : "";
    const src = g.icon || g.thumbnail;
    const img = src ? `<img src="${esc(src)}" alt="" loading="lazy" onerror="this.remove()" />` : "";
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
      showcase.innerHTML = `<p class="games-empty">Couldn't load games right now. <a class="nav-link" href="${esc(site.links.robloxGroup)}" target="_blank" rel="noopener">See them on Roblox ↗</a></p>`;
      return;
    }
    lastGames = games;
    const sorted = [...games].sort((a, b) => b.visits - a.visits);
    showcase.innerHTML = sorted.slice(0, 3).map((g, i) => card(g, i, `t${i + 1}`)).join("");
    moreGames.innerHTML = sorted.slice(3).map((g, i) => card(g, i)).join("");
    updateLiveStats(sorted);
    startHeroSlideshow(sorted.map((g) => g.thumbnail || g.icon).filter(Boolean));
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

  /* ---------- Groups (live from Roblox via RoProxy) ---------- */
  const groupsSection = $("#groups");
  const groupsGrid = $("#groupsGrid");
  const groupIds = (site.groups || []).map(String);
  const GROUPS_KEY = "soggytoast_groups_v2";
  const groupsSig = groupIds.join() + JSON.stringify(site.groupBanners || {}); // changing IDs or banners refreshes the cache
  let lastGroups = [];

  // RoProxy rate-limits each visitor, so groups use as few requests as possible:
  // names + icons + banner images (1 request each) now, member counts later one at a time (see fillMemberCounts).
  const fetchGroups = async () => {
    const q = groupIds.join(",");
    const bannerIds = groupIds.map((id) => site.groupBanners?.[id]).filter(Boolean);
    try {
      const [info, icons, banners] = await Promise.all([
        fetchData(`https://groups.roproxy.com/v2/groups?groupIds=${q}`),
        fetchData(`https://thumbnails.roproxy.com/v1/groups/icons?groupIds=${q}&size=420x420&format=Png&isCircular=false`).catch(() => []),
        bannerIds.length
          ? fetchData(`https://thumbnails.roproxy.com/v1/assets?assetIds=${bannerIds.join(",")}&size=768x432&format=Png&isCircular=false`).catch(() => [])
          : [],
      ]);
      const byId = new Map(info.map((g) => [String(g.id), g]));
      const bannerFor = (id) => banners.find((b) => String(b.targetId) === String(site.groupBanners?.[id]))?.imageUrl || "";
      return groupIds
        .filter((id) => byId.has(id))
        .map((id) => ({
          id,
          name: byId.get(id).name || "Roblox group",
          verified: !!byId.get(id).hasVerifiedBadge,
          icon: icons.find((t) => String(t.targetId) === id)?.imageUrl || "",
          banner: bannerFor(id),
          members: null,
        }));
    } catch (e) {
      console.warn("Failed to load groups", e);
      return [];
    }
  };

  const membersText = (n) => `${fmt(n)} ${n === 1 ? "member" : "members"}`;

  // Member counts are nice-to-have: fetched one by one after everything else, skipped quietly if they fail.
  const fillMemberCounts = async (groups) => {
    for (const g of groups) {
      if (g.members != null) continue;
      try {
        const d = await fetchJSON(`https://groups.roproxy.com/v1/groups/${g.id}`, 3);
        if (d.memberCount == null) continue;
        g.members = d.memberCount;
        const el = groupsGrid.querySelector(`[data-members="${g.id}"]`);
        if (el) el.textContent = membersText(g.members);
      } catch {}
    }
    cacheSet(GROUPS_KEY, groupsSig, groups);
  };

  const groupCard = (g, i) => `
    <a class="group reveal d${(i % 4) + 1}${g.banner ? " has-banner" : ""}" href="https://www.roblox.com/groups/${esc(g.id)}" target="_blank" rel="noopener">
      ${g.banner ? `<div class="group-bg" style="background-image:url('${esc(g.banner)}')" aria-hidden="true"></div>` : ""}
      <div class="group-body">
        <div class="group-icon">
          <span>${esc(g.name.charAt(0))}</span>
          ${g.icon ? `<img src="${esc(g.icon)}" alt="" loading="lazy" onerror="this.remove()" />` : ""}
        </div>
        <h3 class="group-name">${esc(g.name)}${g.verified ? ICONS.verified : ""}</h3>
        <p class="group-meta" data-members="${esc(g.id)}">${g.members != null ? membersText(g.members) : ""}</p>
        <span class="group-link">View group <span class="arrow">↗</span></span>
      </div>
    </a>`;

  const renderGroups = (groups) => {
    if (!groups.length) {
      groupsSection?.remove(); // nothing to show: hide the section rather than show an error
      return;
    }
    lastGroups = groups;
    groupsGrid.innerHTML = groups.map(groupCard).join("");
    observe(groupsGrid);
  };

  const loadGroups = async () => {
    if (!groupsGrid || !groupIds.length) return renderGroups([]);
    const cached = cacheGet(GROUPS_KEY, groupsSig);
    if (cached) return renderGroups(cached);

    groupsGrid.innerHTML = groupIds
      .map(() => `<div class="group is-loading" aria-hidden="true"><div class="group-icon"></div></div>`)
      .join("");
    const groups = await fetchGroups();
    renderGroups(groups);
    if (groups.length) fillMemberCounts(groups);
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
  // Games first; groups only start once the games are done, so they never compete for RoProxy's rate limit.
  loadGames().finally(loadGroups);
})();
