// cyber/js/panels/threatmap-panel.js
(function () {
  'use strict';

  console.log('[Cyber ThreatMap] panel script loaded');

  const RTV = window.RussellTV || (window.RussellTV = {});
  const ThreatMap = RTV.CyberThreatMap || (RTV.CyberThreatMap = {});

  const COUNTRY_POS = {
    'United States': { x: 18, y: 42 },
    'Canada':        { x: 20, y: 28 },
    'Mexico':        { x: 20, y: 52 },
    'Brazil':        { x: 30, y: 64 },
    'United Kingdom':{ x: 40, y: 30 },
    'Germany':       { x: 43, y: 33 },
    'France':        { x: 41, y: 36 },
    'Italy':         { x: 44, y: 40 },
    'Turkey':        { x: 49, y: 38 },
    'South Africa':  { x: 47, y: 70 },
    'Russia':        { x: 55, y: 28 },
    'China':         { x: 65, y: 40 },
    'Vietnam':       { x: 69, y: 47 },
    'Malaysia':      { x: 67, y: 55 },
    'Japan':         { x: 75, y: 38 },
    'Australia':     { x: 78, y: 68 },
    'India':         { x: 60, y: 50 },
    'Singapore':     { x: 68, y: 58 },
    'Korea, Republic of': { x: 72, y: 40 }
  };

  // ---- Helpers -------------------------------------------------------------

  function qs(id) {
    return document.getElementById(id);
  }

  function setText(id, text) {
    const el = qs(id);
    if (el) el.textContent = text;
  }

  function mapSeverityBadge(sev) {
    const badge = qs('cyber-threatmap-severity');
    if (!badge) return;

    const s = (sev || '').toLowerCase();
    badge.textContent = s ? ('GLOBAL: ' + s.toUpperCase()) : 'LOW';

    badge.classList.remove('cyber-badge-low', 'cyber-badge-med', 'cyber-badge-high');
    if (s === 'critical' || s === 'high') {
      badge.classList.add('cyber-badge-high');
    } else if (s === 'elevated' || s === 'medium' || s === 'med') {
      badge.classList.add('cyber-badge-med');
    } else {
      badge.classList.add('cyber-badge-low');
    }
  }

  // ---- Sample / fallback data ---------------------------------------------

  function getSampleDataset() {
    return {
      severity: 'critical',
      windowEnd: 'Dec 05, 2025, 02:30 PM',
      topTargets: [
        { country: 'United States', pct: 38.7 },
        { country: 'Vietnam',       pct: 8.8 },
        { country: 'Canada',        pct: 7.5 },
        { country: 'China',         pct: 5.4 },
        { country: 'Malaysia',      pct: 3.7 }
      ],
      sourceLabel: 'Sample: Cloudflare Radar-style HTTP attack distribution'
    };
  }

  async function fetchShadowserverDataset() {
    // Stub for when you wire a real Shadowserver-backed API.
    // Expected shape:
    // { severity: 'critical', windowEnd: 'ISO or human time', topTargets: [{country, pct}, ...], sourceLabel: 'Shadowserver + Radar + …' }
    try {
      const resp = await fetch('/api/cyber/shadowserver/top-targets', { cache: 'no-store' });
      if (!resp.ok) throw new Error('Shadowserver API HTTP ' + resp.status);
      const json = await resp.json();
      if (!json || !Array.isArray(json.topTargets) || !json.topTargets.length) {
        throw new Error('No targets in Shadowserver payload');
      }
      return json;
    } catch (err) {
      console.warn('[Cyber ThreatMap] Shadowserver fetch failed, using sample data:', err);
      return getSampleDataset();
    }
  }

  // ---- Heatmap rendering ---------------------------------------------------

  function buildHeatmap(container, data) {
    const targets = (data && Array.isArray(data.topTargets) && data.topTargets.length)
      ? data.topTargets.slice(0, 8)  // keep it tight
      : getSampleDataset().topTargets;

    const maxPct = targets.reduce((m, t) => Math.max(m, t.pct || 0), 0) || 1;

    container.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.className = 'cyber-heatmap-wrap';

    const map = document.createElement('div');
    map.className = 'cyber-heatmap-map';

    const world = document.createElement('div');
    world.className = 'cyber-heatmap-world';
    map.appendChild(world);

    targets.forEach(t => {
      const pct = Number(t.pct) || 0;
      const norm = pct / maxPct;
      const pos = COUNTRY_POS[t.country] || { x: 50, y: 50 };

      const dot = document.createElement('div');
      dot.className = 'cyber-heat-dot';

      const size = 16 + Math.round(norm * 26); // 16px – 42px
      dot.style.setProperty('--dot-size', size + 'px');
      dot.style.left = pos.x + '%';
      dot.style.top = pos.y + '%';

      let band = 'low';
      if (norm >= 0.75) band = 'hot';
      else if (norm >= 0.4) band = 'med';
      dot.dataset.band = band;

      const label = document.createElement('div');
      label.className = 'cyber-heat-label';
      label.textContent = t.country + ' ' + pct.toFixed(1) + '%';

      dot.appendChild(label);
      map.appendChild(dot);
    });

    const list = document.createElement('div');
    list.className = 'cyber-heatmap-list';

    targets.forEach(t => {
      const row = document.createElement('div');
      row.className = 'cyber-heat-row';

      const name = document.createElement('div');
      name.className = 'cyber-heat-row-name';
      name.textContent = t.country;

      const bar = document.createElement('div');
      bar.className = 'cyber-heat-row-bar';

      const fill = document.createElement('div');
      fill.className = 'cyber-heat-row-fill';
      fill.style.width = Math.max(4, (t.pct / maxPct) * 100).toFixed(1) + '%';

      bar.appendChild(fill);

      const pct = document.createElement('div');
      pct.className = 'cyber-heat-row-pct';
      pct.textContent = t.pct.toFixed(1) + '%';

      row.appendChild(name);
      row.appendChild(bar);
      row.appendChild(pct);

      list.appendChild(row);
    });

    const legend = document.createElement('div');
    legend.className = 'cyber-heatmap-legend';
    legend.innerHTML = [
      '<span class="dot dot-low"></span> Low volume',
      '<span class="dot dot-med"></span> Elevated',
      '<span class="dot dot-hot"></span> High / focused'
    ].join(' · ');

    const footer = document.createElement('div');
    footer.className = 'cyber-heatmap-footer';
    const summaryLine = targets
      .map(t => t.country + ' ' + t.pct.toFixed(1) + '%')
      .join(', ');
    const windowText = data && data.windowEnd ? ('Window end: ' + data.windowEnd + '.') : '';
    const source = data && data.sourceLabel ? data.sourceLabel : 'Public telemetry (HTTP attacks / scanning), sample only.';
    footer.textContent =
      'Top targets (L7 attacks / hostile traffic, last 24 hrs): ' +
      summaryLine +
      '. ' + windowText + ' Source: ' + source;

    wrap.appendChild(map);
    wrap.appendChild(list);

    container.appendChild(wrap);
    container.appendChild(legend);
    container.appendChild(footer);
  }

  async function renderThreatMap() {
    const container = qs('cyber-threatmap-placeholder');
    if (!container) return;

    container.innerHTML = '<div class="cyber-heatmap-loading">Loading global threat activity…</div>';

    const data = await fetchShadowserverDataset();
    mapSeverityBadge(data && data.severity);
    buildHeatmap(container, data);
  }

  ThreatMap.refresh = renderThreatMap;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      renderThreatMap().catch(err => console.error('[Cyber ThreatMap] render error', err));
    });
  } else {
    renderThreatMap().catch(err => console.error('[Cyber ThreatMap] render error', err));
  }
})();