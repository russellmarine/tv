/**
 * Sidebar news for RussellTV
 * Reads pre-fetched JSON from /news-cache/*.json (populated by update-russelltv-news.sh).
 */

const CHANNEL_NEWS_MAP = {
  cbs:       { file: 'cbs.json',       title: 'CBS 2.1 – New York Headlines' },
  nbc:       { file: 'nbc.json',       title: 'NBC 4.1 – New York Headlines' },
  fox:       { file: 'fox.json',       title: 'FOX 5.1 – New York Headlines' },
  bloomberg: { file: 'bloomberg.json', title: 'Bloomberg Headlines' },
  abc:       { file: 'cbs.json',       title: 'ABC / CBS Headlines' }, // reuse for now
  foxnation: { file: 'fox.json',       title: 'Fox Nation Headlines' },
  skynews:   { file: 'bloomberg.json', title: 'Sky News Headlines' },
  france24:  { file: 'bloomberg.json', title: 'France 24 Headlines' },
  dw:        { file: 'bloomberg.json', title: 'DW Headlines' },
  gijoe:     { file: 'gijoe.json',     title: 'GI Joe / Entertainment' },
  euronews:  { file: 'bloomberg.json', title: 'Euronews Headlines' },
  aljazeera: { file: 'bloomberg.json', title: 'Al Jazeera Headlines' }
};

const USMC_NEWS_FILE = 'marines.json';

/**
 * Fetch JSON from /news-cache/<file>.
 */
async function fetchCache(fileName) {
  const res = await fetch(`/news-cache/${fileName}`);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * Render a list of NewsAPI articles into a pretty <ul>.
 */
function renderArticles(listEl, articles) {
  listEl.innerHTML = '';
  if (!articles || !articles.length) {
    const li = document.createElement('li');
    li.className = 'rtv-headline-empty';
    li.textContent = 'No headlines found.';
    listEl.appendChild(li);
    return;
  }

  articles.slice(0, 6).forEach(a => {
    const li = document.createElement('li');
    li.className = 'rtv-headline-item';

    const link = document.createElement('a');
    link.href = a.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = a.title || '(no title)';

    li.appendChild(link);
    listEl.appendChild(li);
  });
}

/**
 * Inject sidebar styles once.
 */
function injectSidebarStyles() {
  if (document.getElementById('rtv-sidebar-style')) return;

  const style = document.createElement('style');
  style.id = 'rtv-sidebar-style';
  style.textContent = `
    #single-side-panel {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    .rtv-sidebar-shell {
      background: rgba(0, 0, 0, 0.78);
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      box-shadow: 0 0 18px rgba(0, 0, 0, 0.6);
      padding: 0.8rem 0.9rem;
      font-size: 0.82rem;
      color: #f5f5f5;
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      max-height: 100%;
      overflow-y: auto;
      backdrop-filter: blur(6px);
    }

    .rtv-sidebar-shell h2 {
      margin: 0 0 0.35rem 0;
      font-size: 0.95rem;
      font-weight: 600;
      letter-spacing: 0.02em;
      color: #ffffff;
    }

    .rtv-sidebar-shell small {
      font-size: 0.78rem;
      color: #c0c0c0;
    }

    .rtv-divider {
      border: none;
      border-top: 1px solid rgba(255, 255, 255, 0.12);
      margin: 0.35rem 0;
    }

    .rtv-headline-list {
      list-style: none;
      padding-left: 0;
      margin: 0.3rem 0 0 0;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .rtv-headline-item,
    .rtv-headline-empty {
      padding: 0.35rem 0.5rem;
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.04);
      transition: background 0.15s ease, transform 0.12s ease;
      line-height: 1.25;
    }

    .rtv-headline-item a {
      color: #f3f3f3;
      text-decoration: none;
    }

    .rtv-headline-item a:hover {
      text-decoration: underline;
    }

    .rtv-headline-item:hover {
      background: rgba(255, 255, 255, 0.10);
      transform: translateY(-1px);
    }

    .rtv-status-text {
      font-size: 0.78rem;
      color: #c0c0c0;
    }
  `;
  document.head.appendChild(style);
}

/**
 * Build the sidebar skeleton once.
 */
function buildSidebarSkeleton() {
  const panel = document.getElementById('single-side-panel');
  if (!panel) return;

  injectSidebarStyles();

  panel.innerHTML = `
    <div class="rtv-sidebar-shell">
      <section>
        <h2 id="channel-headline-title">
          Channel Headlines
        </h2>
        <div id="channel-headline-status" class="rtv-status-text">
          Select a channel to load headlines…
        </div>
        <ul id="channel-headline-list" class="rtv-headline-list"></ul>
      </section>

      <hr class="rtv-divider" />

      <section>
        <h2>
          Marine Corps News
        </h2>
        <div id="usmc-headline-status" class="rtv-status-text">
          Loading Marine Corps news…
        </div>
        <ul id="usmc-headline-list" class="rtv-headline-list"></ul>
      </section>
    </div>
  `;
}

/**
 * Load Marine Corps headlines from local cache.
 */
async function loadUSMCNews() {
  const statusEl = document.getElementById('usmc-headline-status');
  const listEl   = document.getElementById('usmc-headline-list');
  if (!statusEl || !listEl) return;

  statusEl.textContent = 'Loading Marine Corps news…';
  listEl.innerHTML = '';

  try {
    const data = await fetchCache(USMC_NEWS_FILE);
    const articles = data && data.articles ? data.articles : [];
    if (!articles.length) {
      statusEl.textContent = 'No recent Marine Corps stories found.';
      return;
    }
    statusEl.textContent = '';
    renderArticles(listEl, articles);
  } catch (err) {
    console.error('USMC news error:', err);
    statusEl.textContent = 'Error loading Marine Corps news.';
  }
}

/**
 * Update sidebar for the given channel key.
 */
async function updateSidebarForChannel(channelKey) {
  const map = CHANNEL_NEWS_MAP[channelKey];
  const titleEl = document.getElementById('channel-headline-title');
  const statusEl = document.getElementById('channel-headline-status');
  const listEl = document.getElementById('channel-headline-list');

  if (!titleEl || !statusEl || !listEl) return;

  if (!map) {
    titleEl.textContent = 'Channel Headlines';
    statusEl.textContent = 'No headlines mapped for this channel.';
    listEl.innerHTML = '';
    return;
  }

  titleEl.textContent = map.title;
  statusEl.textContent = 'Loading headlines…';
  listEl.innerHTML = '';

  try {
    const data = await fetchCache(map.file);
    const articles = data && data.articles ? data.articles : [];
    if (!articles.length) {
      statusEl.textContent = 'No headlines found for this channel.';
      return;
    }
    statusEl.textContent = '';
    renderArticles(listEl, articles);
  } catch (err) {
    console.error('Channel news error:', err);
    statusEl.textContent = 'Error loading headlines.';
  }
}

/**
 * Hook into RussellTV once everything exists.
 */
window.addEventListener('load', function () {
  buildSidebarSkeleton();
  loadUSMCNews();

  // Wrap setSingleChannel so we update the sidebar whenever the main video changes
  if (typeof window.setSingleChannel === 'function') {
    const originalSetSingleChannel = window.setSingleChannel;
    window.setSingleChannel = function (key) {
      originalSetSingleChannel(key);
      updateSidebarForChannel(key);
    };
  } else {
    console.warn('sidebar-news.js: setSingleChannel not found; sidebar will not auto-update.');
  }
});
