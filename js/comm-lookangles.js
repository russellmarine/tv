(function () {
  'use strict';

  const Events = window.RussellTV?.Events;
  if (!Events) return;

  const MOCK_LOOKANGLES = {
    constellations: [
      {
        key: 'wgs',
        name: 'WGS (Wideband Global)',
        band: 'X/Ka',
        sats: [
          { name: 'WGS-5', az: 140.8, el: 41.9, range: '36k km' },
          { name: 'WGS-1', az: 129.3, el: 35.3, range: '36k km' },
          { name: 'WGS-6', az: 250.3, el: 17.7, range: '36k km' },
          { name: 'WGS-2', az: 110.6, el: 14.6, range: '37k km' },
          { name: 'WGS-9', az: 104.6, el: 11.6, range: '37k km' }
        ]
      },
      {
        key: 'aehf',
        name: 'AEHF (Protected)',
        band: 'EHF',
        sats: [
          { name: 'AEHF-4', az: 163.4, el: 48.2, range: '36k km' },
          { name: 'AEHF-3', az: 239.4, el: 24.8, range: '36k km' },
          { name: 'AEHF-2', az: 110.0, el: 13.1, range: '37k km' }
        ]
      },
      {
        key: 'muos',
        name: 'MUOS (Narrowband)',
        band: 'UHF',
        sats: [
          { name: 'MUOS-5', az: 220.0, el: 41.7, range: '36k km' },
          { name: 'MUOS-1', az: 213.6, el: 38.0, range: '36k km' },
          { name: 'MUOS-3', az: 107.5, el: 13.7, range: '37k km' }
        ]
      },
      {
        key: 'intelsat',
        name: 'Intelsat',
        band: 'C/Ku',
        sats: [
          { name: 'IS 34', az: 144.8, el: 43.5, range: '36k km' },
          { name: 'IS 37e', az: 108.6, el: 16.5, range: '37k km' }
        ]
      }
    ],
    updated: '0m ago (cached 24h)',
    via: 'Via N2YO'
  };

  function buildTable(constellation) {
    return [
      '<div class="look-section">',
      '  <div class="look-section-header">',
      '    <div>',
      '      <div class="look-section-name">' + escapeHtml(constellation.name) + '</div>',
      '      <div class="look-section-band">' + escapeHtml(constellation.band) + '</div>',
      '    </div>',
      '    <div class="look-section-count">' + escapeHtml(constellation.sats.length + ' sats') + '</div>',
      '  </div>',
      '  <div class="look-table">',
      '    <div class="look-table-head">',
      '      <span>Sat</span><span>Az°</span><span>El°</span><span>Range</span>',
      '    </div>',
      constellation.sats.map(s => '<div class="look-row"><span>' + escapeHtml(s.name) + '</span><span>' + s.az.toFixed(1) + '</span><span>' + s.el.toFixed(1) + '</span><span>' + escapeHtml(s.range) + '</span></div>').join(''),
      '  </div>',
      '</div>'
    ].join('');
  }

  function renderLookAngles(loc) {
    const card = document.getElementById('comm-card-satangles');
    const body = document.getElementById('comm-satla-body');
    const status = document.getElementById('comm-satla-status');
    if (!card || !body) return;

    if (!loc) {
      body.innerHTML = '<p class="comm-placeholder">Select a location to load satellite look angles.</p>';
      if (status) status.textContent = 'n/a';
      return;
    }

    const weather = window.RussellTV?.CommPlanner?.getLastWeather?.();
    const wxLine = weather
      ? '<div class="look-meta">' +
        '<div class="look-meta-icon">' + getWeatherGlyph(weather.main) + '</div>' +
        '<div class="look-meta-text">' + escapeHtml((weather.desc || weather.main || 'Weather')) + ', ' +
        (weather.temp != null ? escapeHtml(weather.temp + '°F') : '--') + ', ' +
        (weather.humidity != null ? escapeHtml(weather.humidity + '%') : '--') + '</div>' +
        '</div>'
      : '';

    const locationLine = '<div class="look-location">' + escapeHtml(loc.label) + '<div class="look-coords">' + loc.coords.lat.toFixed(4) + '°, ' + loc.coords.lon.toFixed(4) + '°</div></div>';

    body.innerHTML = [
      '<div class="look-header">',
      locationLine,
      wxLine,
      '<div class="look-availability">Starlink: <span class="look-available">Available</span></div>',
      '</div>',
      '<div class="look-note">Azimuth is TRUE north (not magnetic)</div>',
      '<div class="look-grid">' + MOCK_LOOKANGLES.constellations.map(buildTable).join('') + '</div>',
      '<div class="comm-card-micro">Data: ' + escapeHtml(MOCK_LOOKANGLES.updated) + ' • ' + escapeHtml(MOCK_LOOKANGLES.via) + '</div>'
    ].join('');

    if (status) status.textContent = 'Loaded';
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function getWeatherGlyph(main) {
    const m = (main || '').toLowerCase();
    if (m.includes('rain')) return '🌧️';
    if (m.includes('snow')) return '❄️';
    if (m.includes('cloud')) return '☁️';
    if (m.includes('storm') || m.includes('thunder')) return '⛈️';
    if (m.includes('mist') || m.includes('fog')) return '🌫️';
    return '☀️';
  }

  document.addEventListener('DOMContentLoaded', () => {
    renderLookAngles(null);
    Events.on('comm:location-changed', (loc) => renderLookAngles(loc));
  });
})();
