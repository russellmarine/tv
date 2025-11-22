(function () {
  const CONFIG = window.CHANNEL_NEWS_CONFIG || {};
  const BASE_URL = "/news-cache/";

  // -------- Fetch + normalize JSON --------
  async function fetchJsonFile(fileName) {
    const url = BASE_URL + fileName;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.warn("Failed to fetch news JSON:", url, res.status);
        return [];
      }
      const data = await res.json();

      let rawItems;

      // Shape 1: { status, totalResults, articles: [ ... ] }  <-- your current case
      if (Array.isArray(data.articles)) {
        rawItems = data.articles;
      }
      // Shape 2: { items: [ ... ] }
      else if (Array.isArray(data.items)) {
        rawItems = data.items;
      }
      // Shape 3: [ ... ]
      else if (Array.isArray(data)) {
        rawItems = data;
      }
      // Fallback: treat object values as items
      else {
        rawItems = Object.values(data);
      }

      return rawItems
        .map(normalizeArticle)
        .filter(Boolean);
    } catch (e) {
      console.error("Error loading news JSON:", fileName, e);
      return [];
    }
  }

  function normalizeArticle(raw) {
    if (!raw || typeof raw !== "object") return null;

    const title =
      raw.title ||
      raw.headline ||
      raw.name ||
      "(no title)";

    const url =
      raw.url ||
      raw.link ||
      raw.permalink ||
      "#";

    const source =
      // NewsAPI-style: { source: { name: "CBS News" } }
      (raw.source && raw.source.name) ||
      raw.source_name ||
      raw.source ||
      (raw.meta && raw.meta.source) ||
      "";

    const dateStr =
      raw.publishedAt ||
      raw.published_at ||
      raw.pubDate ||
      raw.date ||
      raw.updated ||
      "";

    let pubDate = null;
    if (dateStr) {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) pubDate = d;
    }

    return { title, url, source, pubDate };
  }

  // -------- Rendering helpers --------
  function renderHeadlineList(containerId, articles, emptyText) {
    const listEl = document.getElementById(containerId);
    if (!listEl) return;

    listEl.innerHTML = "";

    if (!articles || articles.length === 0) {
      const li = document.createElement("li");
      li.className = "headline-item";
      li.textContent = emptyText;
      listEl.appendChild(li);
      return;
    }

    articles.forEach((article) => {
      const li = document.createElement("li");
      li.className = "headline-item";

      const link = document.createElement("a");
      link.href = article.url || "#";
      link.target = "_blank";
      link.rel = "noopener noreferrer";

      const titleEl = document.createElement("div");
      titleEl.className = "headline-title";
      titleEl.textContent = article.title || "(no title)";

      const metaEl = document.createElement("div");
      metaEl.className = "headline-meta";

      const parts = [];
      if (article.source) parts.push(article.source);
      if (article.pubDate) {
        try {
          parts.push(
            article.pubDate.toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              hour: "2-digit", minute: "2-digit", hour12: false,
              minute: "2-digit"
            })
          );
        } catch (_) {}
      }
      metaEl.textContent = parts.join(" • ");

      link.appendChild(titleEl);
      if (parts.length > 0) {
        link.appendChild(metaEl);
      }

      li.appendChild(link);
      listEl.appendChild(li);
    });
  }

  function setUpdatedText(elementId, prefix) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.textContent =
      (prefix || "Last updated: ") +
      new Date().toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit", minute: "2-digit", hour12: false,
        minute: "2-digit"
      });
  }

  // -------- Channel headlines (right panel) --------
  async function loadChannelHeadlines(channelId, channelLabel) {
    const cfg = CONFIG[channelId];
    const titleEl = document.getElementById("channel-headlines-title");
    const metaEl = document.getElementById("channel-headlines-updated");

    // Title
    if (titleEl) {
      const label = (cfg && cfg.label) || channelLabel || channelId;
      titleEl.textContent = label;
    }

    // Loading state
    if (metaEl) metaEl.textContent = "Loading…";
    renderHeadlineList(
      "channel-headlines-list",
      [],
      "Loading…"
    );

    if (!cfg || !cfg.file) {
      renderHeadlineList(
        "channel-headlines-list",
        [],
        "No news file configured for this channel."
      );
      if (metaEl) metaEl.textContent = "No config.";
      return;
    }

    const articles = await fetchJsonFile(cfg.file);

    renderHeadlineList(
      "channel-headlines-list",
      articles,
      "No headlines found for this channel."
    );

    setUpdatedText("channel-headlines-updated", "Last updated: ");
  }

  // -------- Marine Corps headlines (bottom section) --------
  async function loadMarinesHeadlines() {
    const cfg = CONFIG.marines;
    const metaEl = document.getElementById("marines-headlines-updated");

    renderHeadlineList(
      "marines-headlines-list",
      [],
      "Loading Marine Corps news…"
    );
    if (metaEl) metaEl.textContent = "Loading…";

    if (!cfg || !cfg.file) {
      renderHeadlineList(
        "marines-headlines-list",
        [],
        "No Marine Corps news file configured."
      );
      if (metaEl) metaEl.textContent = "No config.";
      return;
    }

    const articles = await fetchJsonFile(cfg.file);

    renderHeadlineList(
      "marines-headlines-list",
      articles,
      "No recent Marine Corps stories found."
    );

    setUpdatedText("marines-headlines-updated", "Last updated: ");
  }

  // Export for index.html to call
  window.loadChannelHeadlines = loadChannelHeadlines;

  // Marines news auto-load + refresh every 15 minutes
  window.addEventListener("load", function () {
    loadMarinesHeadlines();
    setInterval(loadMarinesHeadlines, 15 * 60 * 1000);
  });
})();
