(function () {
  const API_KEY = window.NEWS_API_KEY;
  const API_URL = "https://newsapi.org/v2/everything";

  function getChannelQuery(channelKey) {
    if (window.CHANNEL_NEWS_QUERIES && window.CHANNEL_NEWS_QUERIES[channelKey]) {
      return window.CHANNEL_NEWS_QUERIES[channelKey];
    }
    const ch = window.CHANNELS && window.CHANNELS[channelKey];
    if (ch && ch.label) return ch.label;
    return channelKey;
  }

  function buildSidebarUI() {
    const panel = document.getElementById("single-side-panel");
    if (!panel) {
      console.warn("news-sidebar: #single-side-panel not found");
      return null;
    }

    panel.innerHTML = `
      <div style="padding:0.5rem 0.75rem; font-size:0.85rem; line-height:1.4;">
        <div style="margin-bottom:0.75rem;">
          <h2 style="margin:0 0 0.35rem; font-size:0.95rem; font-weight:600;">Channel Headlines</h2>
          <div id="channel-headlines-status" style="color:#ccc; margin-bottom:0.3rem;">
            Select a channel to load headlines…
          </div>
          <ul id="channel-headlines-list" style="list-style:none; padding-left:0; margin:0;"></ul>
        </div>
        <hr style="border:0; border-top:1px solid rgba(255,255,255,0.12); margin:0.5rem 0 0.75rem;">
        <div>
          <h2 style="margin:0 0 0.35rem; font-size:0.95rem; font-weight:600;">Marine Corps News</h2>
          <div id="usmc-headlines-status" style="color:#ccc; margin-bottom:0.3rem;">
            Loading Marine Corps news…
          </div>
          <ul id="usmc-headlines-list" style="list-style:none; padding-left:0; margin:0;"></ul>
        </div>
      </div>
    `;

    return {
      channelStatus: document.getElementById("channel-headlines-status"),
      channelList: document.getElementById("channel-headlines-list"),
      usmcStatus: document.getElementById("usmc-headlines-status"),
      usmcList: document.getElementById("usmc-headlines-list")
    };
  }

  async function fetchNews(query, extraParams = {}) {
    if (!API_KEY) {
      throw new Error("No NEWS_API_KEY configured");
    }

    const params = new URLSearchParams({
      q: query,
      language: "en",
      pageSize: "5",
      sortBy: "publishedAt",
      apiKey: API_KEY,
      ...extraParams
    });

    const url = `${API_URL}?${params.toString()}`;
    console.log("news-sidebar: fetching", url);

    const res = await fetch(url);
    const data = await res.json();
    if (data.status !== "ok") {
      throw new Error(data.message || "News API error");
    }
    return data.articles || [];
  }

  function renderArticles(listEl, statusEl, articles, emptyMsg) {
    if (!listEl || !statusEl) return;

    listEl.innerHTML = "";

    if (!articles.length) {
      statusEl.textContent = emptyMsg;
      return;
    }

    statusEl.textContent = "";

    articles.forEach(a => {
      const li = document.createElement("li");
      li.style.marginBottom = "0.35rem";

      const link = document.createElement("a");
      link.href = a.url;
      link.target = "_blank";
      link.rel = "noreferrer noopener";
      link.textContent = a.title || "(no title)";
      link.style.color = "#4fa3ff";
      link.style.textDecoration = "none";
      link.style.display = "block";

      const meta = document.createElement("div");
      meta.style.fontSize = "0.7rem";
      meta.style.color = "#aaa";
      const src = (a.source && a.source.name) ? a.source.name : "";
      const date = a.publishedAt ? new Date(a.publishedAt).toLocaleString() : "";
      meta.textContent = [src, date].filter(Boolean).join(" • ");

      li.appendChild(link);
      if (meta.textContent) li.appendChild(meta);

      listEl.appendChild(li);
    });
  }

  async function loadMarineNews(ui) {
    if (!ui) return;
    const { usmcStatus, usmcList } = ui;

    if (!API_KEY) {
      usmcStatus.textContent = "Marine Corps news disabled (no API key configured).";
      return;
    }

    usmcStatus.textContent = "Loading Marine Corps news…";
    usmcList.innerHTML = "";

    try {
      const query = window.MARINE_NEWS_QUERY ||
        "\"United States Marine Corps\" OR \"US Marines\" OR USMC";

      const articles = await fetchNews(query);
      renderArticles(usmcList, usmcStatus, articles, "No recent Marine Corps stories found.");
    } catch (err) {
      console.error("news-sidebar: Marine news error", err);
      usmcStatus.textContent = "Error loading Marine Corps news.";
    }
  }

  async function loadChannelNews(ui, channelKey) {
    if (!ui) return;
    const { channelStatus, channelList } = ui;

    if (!API_KEY) {
      channelStatus.textContent = "Channel headlines disabled (no API key configured).";
      channelList.innerHTML = "";
      return;
    }

    // Special-case for GI Joe: it's not a real news channel
    if (channelKey === "gijoe") {
      channelStatus.textContent = "No news lookup for this channel (entertainment only).";
      channelList.innerHTML = "";
      return;
    }

    const query = getChannelQuery(channelKey);
    channelStatus.textContent = `Loading headlines for ${query}…`;
    channelList.innerHTML = "";

    try {
      const articles = await fetchNews(query);
      renderArticles(
        channelList,
        channelStatus,
        articles,
        "No headlines found for this channel."
      );
    } catch (err) {
      console.error("news-sidebar: channel headlines error", err);
      channelStatus.textContent = "Error loading channel headlines.";
    }
  }

  function init() {
    const ui = buildSidebarUI();
    if (!ui) return;

    // Kick off Marine Corps news once on load
    loadMarineNews(ui);

    // Expose global function for index.html to call on channel change
    window.updateChannelHeadlines = function (channelKey) {
      loadChannelNews(ui, channelKey);
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
