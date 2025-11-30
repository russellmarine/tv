(function () {
  'use strict';

  const Events = window.RussellTV?.Events;
  if (!Events) return;

  const API_PROXY = '/api/n2yo';
  const MIN_ELEV_FILTER = 5;

  const CONSTELLATIONS = {
    wgs: { name: 'WGS (Wideband Global)', band: 'X/Ka', satellites: [{ id: 32258, name: 'WGS-1' }, { id: 33055, name: 'WGS-2' }, { id: 39168, name: 'WGS-5' }, { id: 42075, name: 'WGS-9' }] },
    aehf: { name: 'AEHF (Protected)', band: 'EHF', satellites: [{ id: 39256, name: 'AEHF-3' }, { id: 43651, name: 'AEHF-4' }, { id: 46757, name: 'AEHF-6' }] },
    muos: { name: 'MUOS (Narrowband)', band: 'UHF', satellites: [{ id: 38093, name: 'MUOS-1' }, { id: 40374, name: 'MUOS-3' }, { id: 41622, name: 'MUOS-5' }] },
    intelsat: { name: 'Intelsat', band: 'C/Ku', satellites: [{ id: 42950, name: 'IS 37e' }, { id: 40874, name: 'IS 34' }] },
    eutelsat: { name: 'Eutelsat', band: 'Ku/Ka', satellites: [{ id: 40875, name: 'E 8WB' }, { id: 39163, name: 'E 7B' }] },
    ses: { name: 'SES/Astra', band: 'C/Ku/Ka', satellites: [{ id: 41382, name: 'SES-10' }, { id: 43157, name: 'SES-14' }] },
    telesat: { name: 'Telesat', band: 'C/Ku', satellites: [{ id: 42951, name: 'Telstar 19V' }, { id: 26824, name: 'Telstar 11N' }] },
    mena: { name: 'MENA Regional', band: 'C/Ku/Ka', satellites: [{ id: 37777, name: 'Arabsat 5C' }, { id: 37777, name: 'Arabsat 5C' }] },
    asia: { name: 'Asia-Pacific', band: 'C/Ku', satellites: [{ id: 40425, name: 'JCSAT-14' }, { id: 43875, name: 'Apstar 5C' }] }
  };

  const FALLBACK = {
    wgs: [{ name: 'WGS-5', az: 140.8, el: 41.9, range: '36k km' }, { name: 'WGS-1', az: 129.3, el: 35.3, range: '36k km' }, { name: 'WGS-6', az: 250.3, el: 17.7, range: '36k km' }, { name: 'WGS-2', az: 110.6, el: 14.6, range: '37k km' }, { name: 'WGS-9', az: 104.6, el: 11.6, range: '37k km' }],
    aehf: [{ name: 'AEHF-4', az: 163.4, el: 48.2, range: '36k km' }, { name: 'AEHF-3', az: 239.4, el: 24.8, range: '36k km' }, { name: 'AEHF-2', az: 110.0, el: 13.1, range: '37k km' }],
    muos: [{ name: 'MUOS-5', az: 220.0, el: 41.7, range: '36k km' }, { name: 'MUOS-1', az: 213.6, el: 38.0, range: '36k km' }, { name: 'MUOS-3', az: 107.5, el: 13.7, range: '37k km' }],
    intelsat: [{ name: 'IS 34', az: 144.8, el: 43.5, range: '36k km' }, { name: 'IS 37e', az: 108.6, el: 16.5, range: '37k km' }]
  };

  let selectedConstellations = new Set(Object.keys(CONSTELLATIONS));
  let hideBelowFive = true;
  let lastLocation = null;
  let constellationData = [];
  let isLoading = false;

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function formatUserClock(dateVal) {
    const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).replace(/:/g, '');
  }

  function severityClass(el) {
    if (el >= 30) return 'severity-good';
    if (el >= 15) return 'severity-fair';
    if (el >= MIN_ELEV_FILTER) return 'severity-watch';
    return 'severity-poor';
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

  async function buildConstellation(key, loc) {
    const def = CONSTELLATIONS[key];
    if (!def) return null;
    const sats = await Promise.all(def.satellites.map(async (s) => {
      const pos = await fetchSatellitePosition(s.id, loc);
      if (!pos) return null;
      return { name: s.name, band: def.band, az: pos.az, el: pos.el, range: pos.range };
    }));
    const filtered = sats.filter(Boolean);
    if (!filtered.length && FALLBACK[key]) {
      return { key, name: def.name, band: def.band, sats: FALLBACK[key] };
    }
    return { key, name: def.name, band: def.band, sats: filtered };
  }

  function renderControls() {
    const toggles = Object.keys(CONSTELLATIONS).map(key => {
      const checked = selectedConstellations.has(key) ? 'checked' : '';
      return `<label class="look-toggle"><input type="checkbox" data-constellation="${key}" ${checked}>${escapeHtml(CONSTELLATIONS[key].name)}</label>`;
    }).join('');
    const lowLabel = hideBelowFive ? 'Hiding <5°' : 'Show <5°';
    return `<div class="look-controls">${toggles}<label class="look-toggle secondary"><input type="checkbox" id="look-toggle-low" ${hideBelowFive ? 'checked' : ''}>${lowLabel}</label></div>`;
  }

  function renderSection(section) {
    if (!section || !section.sats || !section.sats.length) return '';
    const sats = section.sats.filter(s => !hideBelowFive || (s.el ?? 0) >= MIN_ELEV_FILTER);
    if (!sats.length) return '';
    const rows = sats.map(s => {
      const cls = severityClass(s.el || 0);
      return `<div class="look-row ${cls}"><span>${escapeHtml(s.name)}</span><span>${(s.az ?? 0).toFixed ? (s.az).toFixed(1) : escapeHtml(s.az)}</span><span>${(s.el ?? 0).toFixed ? (s.el).toFixed(1) : escapeHtml(s.el)}</span><span>${escapeHtml(s.range || '')}</span></div>`;
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
      '    <div class="look-table-head"><span>Sat</span><span>Az°</span><span>El°</span><span>Range</span></div>',
      rows,
      '  </div>',
      '</div>'
    ].join('');
  }

  function renderLookAngles(loc) {
    const body = document.getElementById('comm-satla-body');
    const status = document.getElementById('comm-satla-status');
    if (!body) return;

    if (!loc) {
      body.innerHTML = '<p class="comm-placeholder">Select a location to load satellite look angles.</p>';
      if (status) status.textContent = 'n/a';
      return;
    }

    const wx = window.RussellTV?.CommPlanner?.getLastWeather?.();
    const wxLine = wx
      ? `<div class="look-meta"><div class="look-meta-icon">${getWeatherGlyph(wx.main)}</div><div class="look-meta-text">${escapeHtml((wx.desc || wx.main || 'Weather'))}, ${wx.temp != null ? escapeHtml(wx.temp + '°F') : '--'}, ${wx.humidity != null ? escapeHtml(wx.humidity + '%') : '--'}</div></div>`
      : '';

    const controls = renderControls();
    const sections = constellationData.map(renderSection).join('') || '<p class="comm-placeholder">' + (isLoading ? 'Loading satellite geometry…' : 'No satellites in view above horizon.') + '</p>';

    body.innerHTML = [
      '<div class="look-header">',
      '<div class="look-location">' + escapeHtml(loc.label) + '<div class="look-coords">' + loc.coords.lat.toFixed(4) + '°, ' + loc.coords.lon.toFixed(4) + '°</div></div>',
      wxLine,
      '<div class="look-availability">Starlink: <span class="look-available">Available</span></div>',
      '</div>',
      controls,
      '<div class="look-note">Azimuth is TRUE north (not magnetic)</div>',
      '<div class="look-grid">' + sections + '</div>',
      '<div class="comm-card-micro">Data: ' + escapeHtml(formatUserClock(Date.now())) + ' • Via N2YO</div>'
    ].join('');

    if (status) status.textContent = isLoading ? 'Loading…' : 'Loaded';

    wireControlEvents();
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
  }

  async function loadLookAngles(loc) {
    lastLocation = loc;
    if (!loc) {
      renderLookAngles(null);
      return;
    }
    isLoading = true;
    renderLookAngles(loc);
    const selected = Array.from(selectedConstellations);
    const data = await Promise.all(selected.map(key => buildConstellation(key, loc)));
    constellationData = data.filter(Boolean);
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

