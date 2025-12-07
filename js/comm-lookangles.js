(function () {
  'use strict';

  const Events = window.RussellTV?.Events;
  if (!Events) return;

  const API_PROXY = '/api/n2yo';
  const SAT_CATALOG_URL = '/weather/sat/catalog';
  const MIN_ELEV_FILTER = 5;
  const CONSTELLATION_ORDER = ['aehf', 'wgs', 'muos', 'coalition_mil', 'intelsat', 'eutelsat', 'ses', 'telesat', 'mena', 'asia'];

  const CONSTELLATIONS = {
    wgs: { name: 'WGS (Wideband Global)', band: 'X/Ka' },
    aehf: { name: 'AEHF (Protected)', band: 'EHF' },
    muos: { name: 'MUOS (Narrowband)', band: 'UHF' },
    coalition_mil: { name: 'Coalition MILSATCOM', band: 'mixed' },
    intelsat: { name: 'Intelsat', band: 'C/Ku' },
    eutelsat: { name: 'Eutelsat', band: 'Ku/Ka' },
    ses: { name: 'SES/Astra', band: 'C/Ku/Ka' },
    telesat: { name: 'Telesat', band: 'C/Ku' },
    mena: { name: 'MENA Regional', band: 'C/Ku/Ka' },
    asia: { name: 'Asia-Pacific', band: 'C/Ku' }
  };

  const FALLBACK = {
    wgs: [{ name: 'WGS-5', az: 140.8, el: 41.9, range: '36k km' }, { name: 'WGS-1', az: 129.3, el: 35.3, range: '36k km' }, { name: 'WGS-6', az: 250.3, el: 17.7, range: '36k km' }, { name: 'WGS-2', az: 110.6, el: 14.6, range: '37k km' }, { name: 'WGS-9', az: 104.6, el: 11.6, range: '37k km' }],
    aehf: [{ name: 'AEHF-4', az: 163.4, el: 48.2, range: '36k km' }, { name: 'AEHF-3', az: 239.4, el: 24.8, range: '36k km' }, { name: 'AEHF-2', az: 110.0, el: 13.1, range: '37k km' }],
    muos: [{ name: 'MUOS-5', az: 220.0, el: 41.7, range: '36k km' }, { name: 'MUOS-1', az: 213.6, el: 38.0, range: '36k km' }, { name: 'MUOS-3', az: 107.5, el: 13.7, range: '37k km' }],
    intelsat: [{ name: 'IS 34', az: 144.8, el: 43.5, range: '36k km' }, { name: 'IS 37e', az: 108.6, el: 16.5, range: '37k km' }],
    eutelsat: [{ name: 'Eutelsat 8WB', az: 118.2, el: 32.1, range: '36k km' }, { name: 'Eutelsat 7B', az: 101.8, el: 14.4, range: '37k km' }],
    ses: [{ name: 'SES-10', az: 147.3, el: 39.5, range: '36k km' }, { name: 'SES-14', az: 119.4, el: 28.7, range: '36k km' }],
    telesat: [{ name: 'Telstar 19V', az: 145.3, el: 70.6, range: '35k km' }, { name: 'Telstar 11N', az: 107.1, el: 46.1, range: '36k km' }],
    mena: [{ name: 'Arabsat 5C', az: 90.0, el: 22.0, range: '36k km' }, { name: 'Arabsat 6A', az: 82.5, el: 18.2, range: '37k km' }],
    asia: [{ name: 'JCSAT-14', az: 102.4, el: 16.9, range: '37k km' }, { name: 'Apstar 5C', az: 75.2, el: 12.3, range: '37k km' }]
  };

  const CONSTELLATION_SUMMARY = [
    { name: 'Starlink', orbit: 'LEO', band: 'Ku/Ka', use: 'Broadband', status: 'severity-good', note: 'Available' },
    { name: 'OneWeb', orbit: 'LEO', band: 'Ku/Ka', use: 'Broadband', status: 'severity-fair', note: 'Available' },
    { name: 'O3b/mPOWER', orbit: 'MEO', band: 'Ka', use: 'Broadband', status: 'severity-fair', note: 'Regional equatorial' },
    { name: 'Iridium', orbit: 'LEO', band: 'L-band', use: 'Narrowband', status: 'severity-good', note: 'Polar capable' },
    { name: 'Globalstar', orbit: 'LEO', band: 'L/S', use: 'Narrowband', status: 'severity-watch', note: 'Limited regions' },
    { name: 'Project Kuiper', orbit: 'LEO', band: 'Ku/Ka', use: 'Broadband', status: 'severity-watch', note: 'Pre-launch' },
    { name: 'HTS Ka (GX/Viasat/SES)', orbit: 'GEO', band: 'Ka', use: 'Wideband', status: 'severity-fair', note: 'Global HTS capacity' },
    { name: 'Partner MILSATCOM', orbit: 'GEO', band: 'X/Ka/UHF', use: 'Coalition', status: 'severity-fair', note: 'Skynet/Syracuse/Sicral' }
  ];

  const DEFAULT_SELECTED_CONSTELLATIONS = ['wgs', 'aehf', 'muos'];

  let selectedConstellations = new Set(
    DEFAULT_SELECTED_CONSTELLATIONS.filter(key => !!CONSTELLATIONS[key])
  );
  let hideBelowFive = true;
  let lastLocation = null;
  let constellationData = [];
  let isLoading = false;
  let constellationDefs = {};
  let satCatalogLoaded = false;

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function formatUserClock(dateVal, includeSeconds) {
    const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
    const opts = { hour: '2-digit', minute: '2-digit', hour12: false };
    if (includeSeconds) opts.second = '2-digit';
    return d.toLocaleTimeString(undefined, opts).replace(/:/g, '');
  }

  function formatUserStamp(dateVal) {
    const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
    const time = formatUserClock(d, false);
    const day = String(d.getDate()).padStart(2, '0');
    const month = d.toLocaleDateString(undefined, { month: 'short' });
    const year = d.getFullYear().toString().slice(-2);
    return `${time} ${day} ${month} ${year}`;
  }

  function severityClass(el) {
    if (el >= 30) return 'severity-good';
    if (el >= 15) return 'severity-fair';
    if (el >= MIN_ELEV_FILTER) return 'severity-watch';
    return 'severity-poor';
  }


function formatAzimuthWithMag(az) {
  if (az === null || az === undefined || isNaN(az)) return '—';
  const trueAz = ((az % 360) + 360) % 360;
  const decl = window.RussellTV?.CommPlanner?.getDeclination?.();
  if (typeof decl !== 'number' || !isFinite(decl)) {
    return trueAz.toFixed(1) + '°T';
  }
  const mag = ((trueAz - decl) % 360 + 360) % 360;
  return Math.round(trueAz) + '°T / ' + Math.round(mag) + '°M';
}

  async function fetchSatellitePosition(noradId, loc) {
    try {
      const url = `${API_PROXY}/positions/${noradId}/${loc.coords.lat}/${loc.coords.lon}/0/1`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      if (data.error || !data.positions || !data.positions.length) return null;
      const pos = data.positions[0];
      return { az: pos.azimuth, el: pos.elevation, range: Math.round((pos.sataltitude || 35786)) + ' km' };
    } catch (e) {
      return null;
    }
  }

async function ensureSatCatalogLoaded() {
  if (satCatalogLoaded && Object.keys(constellationDefs).length) return;
  try {
    const res = await fetch(SAT_CATALOG_URL);
    if (!res.ok) throw new Error('catalog_http_' + res.status);
    const list = await res.json();
    const map = {};
    for (const row of list) {
      const key = (row.constellation || '').toLowerCase() || 'other';
      if (!map[key]) {
        const meta = CONSTELLATIONS[key] || {};
        map[key] = {
          name: meta.name || (row.operator || key.toUpperCase()),
          band: meta.band || row.band || '',
          satellites: []
        };
      }
      map[key].satellites.push({
        id: row.norad_id,
        name: row.name,
        band: map[key].band
      });
    }
    constellationDefs = map;
    satCatalogLoaded = true;
  } catch (e) {
    console.error('[sat-catalog] failed to load, using static CONSTELLATIONS only', e);
    // Avoid hammering the endpoint if it keeps failing
    satCatalogLoaded = true;
  }
}

async function buildConstellation(key, loc) {
  const def = constellationDefs[key] || CONSTELLATIONS[key];
  if (!def) return null;

  const satsSource = def.satellites || [];
  if (!satsSource.length && FALLBACK[key]) {
    const metaName = def.name || (CONSTELLATIONS[key]?.name) || key.toUpperCase();
    const metaBand = def.band || (CONSTELLATIONS[key]?.band) || '';
    return { key, name: metaName, band: metaBand, sats: FALLBACK[key] };
  }

  const sats = await Promise.all(satsSource.map(async (s) => {
    const pos = await fetchSatellitePosition(s.id, loc);
    if (!pos) return null;
    return {
      id: s.id,
      name: s.name,
      band: def.band,
      az: pos.az,
      el: pos.el,
      range: pos.range
    };
  }));

  const filtered = sats.filter(Boolean);
  const metaName = def.name || (CONSTELLATIONS[key]?.name) || key.toUpperCase();
  const metaBand = def.band || (CONSTELLATIONS[key]?.band) || '';
  if (!filtered.length && FALLBACK[key]) {
    return { key, name: metaName, band: metaBand, sats: FALLBACK[key] };
  }
  return { key, name: metaName, band: metaBand, sats: filtered };
}

function renderControls() {
    const toggles = CONSTELLATION_ORDER.filter(key => CONSTELLATIONS[key]).map(key => {
      const checked = selectedConstellations.has(key) ? 'checked' : '';
      return `<label class="look-toggle"><input type="checkbox" data-constellation="${key}" ${checked}>${escapeHtml(CONSTELLATIONS[key].name)}</label>`;
    }).join('');
    const lowLabel = hideBelowFive ? 'Hiding <5°' : 'Show <5°';
    return `<div class="look-controls">`+
      `<details class="look-toggle-panel"><summary>Constellation selection</summary><div class="look-toggle-grid">${toggles}</div></details>`+
      `<div class="look-toggle-row"><label class="look-toggle secondary"><input type="checkbox" id="look-toggle-low" ${hideBelowFive ? 'checked' : ''}>${lowLabel}</label><button class="look-refresh wide" type="button" id="look-refresh">↻ Refresh</button></div>`+
      `</div>`;
  }

  function renderSection(section) {
    if (!section || !section.sats || !section.sats.length) return '';
    const sats = section.sats
      .filter(s => !hideBelowFive || (s.el ?? 0) >= MIN_ELEV_FILTER)
      .sort((a, b) => (b.el || 0) - (a.el || 0));
    if (!sats.length) return '';
    const rows = sats.map(s => {
      const cls = severityClass(s.el || 0);
      const wrapperStart = s.id ? `<a class="look-row ${cls} look-row-link" href="https://www.n2yo.com/satellite/?s=${s.id}" target="_blank" rel="noopener noreferrer">` : `<div class="look-row ${cls}">`;
      const wrapperEnd = s.id ? '</a>' : '</div>';
      return `${wrapperStart}<span>${escapeHtml(s.name)}</span><span>${formatAzimuthWithMag(s.az)}</span><span>${(s.el ?? 0).toFixed ? (s.el).toFixed(1) : escapeHtml(s.el)}</span><span>${escapeHtml(s.range || '')}</span>${wrapperEnd}`;
    }).join('');
    return [
      '<div class="look-section">',
      '  <div class="look-section-header">',
      '    <div>',
      '      <div class="look-section-name">' + escapeHtml(section.name) + '</div>',
      '      <div class="look-section-band">' + escapeHtml(section.band) + '</div>',
      '    </div>',
      '    <div class="look-section-count">' + escapeHtml((section.sats || []).length + ' sats') + '</div>',
      '  </div>',
      '  <div class="look-table">',
      '    <div class="look-table-head"><span>Sat</span><span>Az (T/M)</span><span>El°</span><span>Range</span></div>',
      rows,
      '  </div>',
      '</div>'
    ].join('');
  }

  function renderAvailability() {
    const pills = CONSTELLATION_SUMMARY.map(p =>
      '<a class="look-pill ' + p.status + ' look-pill-compact" href="#" onclick="return false;" title="' + escapeHtml(p.use + ' • ' + p.band) + '">' + escapeHtml(p.name)
      + '<span class="pill-sub">' + escapeHtml(p.note) + '</span></a>'
    ).join('');
    return '<details class="look-availability-panel">'
      + '<summary>Constellation availability (reference)</summary>'
      + '<div class="look-availability-pills">' + pills + '</div>'
      + '</details>';
  }

  function renderLookAngles(loc) {
    const body = document.getElementById('comm-satla-body');
    const status = document.getElementById('comm-satla-status');
    if (!body) return;

    if (!loc) {
      body.innerHTML = '<p class="comm-placeholder">Select a location to load satellite look angles.</p>';
      if (status) status.innerHTML = 'n/a';
      return;
    }

    const wx = window.RussellTV?.CommPlanner?.getLastWeather?.();
    const wxLine = wx
      ? `<div class="look-meta"><div class="look-meta-icon">${getWeatherGlyph(wx.main)}</div><div class="look-meta-text">${escapeHtml((wx.desc || wx.main || 'Weather'))}, ${wx.temp != null ? escapeHtml(wx.temp + '°F') : '--'}, ${wx.humidity != null ? escapeHtml(wx.humidity + '%') : '--'}</div></div>`
      : '';

    const controls = renderControls();
    const sections = constellationData.map(renderSection).join('') || '<p class="comm-placeholder">' + (isLoading ? 'Loading satellite geometry…' : 'No satellites in view above horizon.') + '</p>';
    const availability = renderAvailability();

    body.innerHTML = [
      '<div class="look-header">',
      wxLine,
      availability,
      '</div>',
      controls,
      '<div class="look-note">Azimuth shown as True / Magnetic using local declination</div>',
      '<div class="look-grid">' + sections + '</div>',
      '<div class="comm-card-micro comm-card-footer">Source: <a class="inline-link" href="https://www.n2yo.com/" target="_blank" rel="noopener noreferrer">N2YO</a> • Last Updated: ' + escapeHtml(formatUserStamp(Date.now())) + '</div>'
    ].join('');

    if (status) {
      const cls = isLoading ? 'severity-fair' : 'severity-good';
      const text = isLoading ? 'Loading…' : 'Loaded';
      status.innerHTML = '<span class="status-pill ' + cls + '">' + escapeHtml(text) + '</span>';
    }

    wireControlEvents();
    window.RussellTV?.CommPlanner?.queueLayout?.();
  }

  function wireControlEvents() {
    document.querySelectorAll('#comm-satla-body input[data-constellation]').forEach(input => {
      input.addEventListener('change', () => {
        const key = input.dataset.constellation;
        if (input.checked) selectedConstellations.add(key); else selectedConstellations.delete(key);
        if (lastLocation) loadLookAngles(lastLocation);
      });
    });
    const lowToggle = document.getElementById('look-toggle-low');
    if (lowToggle) {
      lowToggle.addEventListener('change', () => {
        hideBelowFive = lowToggle.checked;
        if (lastLocation) renderLookAngles(lastLocation);
      });
    }
    const refresh = document.getElementById('look-refresh');
    if (refresh) {
      refresh.addEventListener('click', () => {
        if (lastLocation) loadLookAngles(lastLocation);
      });
    }
  }

  async function loadLookAngles(loc) {
    lastLocation = loc;
    if (!loc) {
      renderLookAngles(null);
      return;
    }
    isLoading = true;
    renderLookAngles(loc);

    await ensureSatCatalogLoaded();

    const selected = Array.from(selectedConstellations);
    const data = await Promise.all(selected.map(key => buildConstellation(key, loc)));
    constellationData = data.filter(Boolean).sort((a, b) => CONSTELLATION_ORDER.indexOf(a.key) - CONSTELLATION_ORDER.indexOf(b.key));
    isLoading = false;
    renderLookAngles(loc);
  }

  document.addEventListener('DOMContentLoaded', () => {
    renderLookAngles(null);
    Events.on('comm:location-changed', (loc) => loadLookAngles(loc));
  });

  function getWeatherGlyph(main) {
    const m = (main || '').toLowerCase();
    if (m.includes('rain')) return '🌧️';
    if (m.includes('snow')) return '❄️';
    if (m.includes('cloud')) return '☁️';
    if (m.includes('storm') || m.includes('thunder')) return '⛈️';
    if (m.includes('mist') || m.includes('fog')) return '🌫️';
    return '☀️';
  }
})();

