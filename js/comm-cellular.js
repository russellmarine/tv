(function () {
  'use strict';

  const Events = window.RussellTV?.Events;
  if (!Events) return;

  const MOCK_CELL = {
    summary: {
      grade: 'Good',
      towers: '4 towers within 0.5km · Nearest: 295m'
    },
    carriers: [
      {
        name: 'AT&T (AT&T Mobility)',
        flag: '🇺🇸',
        towers: 3,
        mccmnc: '310/410',
        plmn: '310410',
        nearest: [
          { tech: 'LTE', distance: '📍 295m · 🔴 1', bearing: '62°T' },
          { tech: 'UMTS', distance: '📍 323m · 🔴 1', bearing: '127°T' },
          { tech: 'LTE', distance: '📍 505m · 🔴 1', bearing: '44°T' }
        ],
        bands: ['GSM 850', 'GSM 1900', 'UMTS 850', 'UMTS 1900']
      },
      {
        name: 'Verizon (Verizon Wireless)',
        flag: '🇺🇸',
        towers: 1,
        mccmnc: '311/480',
        plmn: '311480',
        nearest: [
          { tech: 'LTE', distance: '📍 362m · 🔴 1', bearing: '46°T' }
        ],
        bands: ['LTE 700']
      }
    ],
    bandLegend: ['LTE / 4G bands (Bxx)', 'UMTS / 3G bands', 'GSM / 2G bands (often 900 / 1800 MHz)', '5G NR bands (nxx)']
  };

  function renderCellular(loc) {
    const body = document.getElementById('comm-cell-body');
    const status = document.getElementById('comm-cell-status');
    if (!body) return;

    if (!loc) {
      body.innerHTML = '<p class="comm-placeholder">Select a location to load nearby cellular coverage.</p>';
      if (status) status.textContent = 'n/a';
      return;
    }

    const header = '<div class="cell-header"><div class="cell-location">' + escapeHtml(loc.label) + '</div><div class="cell-coords">' + loc.coords.lat.toFixed(4) + '°, ' + loc.coords.lon.toFixed(4) + '°</div></div>';

    const carriersHtml = MOCK_CELL.carriers.map(c => (
      '<div class="cell-carrier">' +
      '  <div class="cell-carrier-head">' +
      '    <div class="cell-carrier-name">' + escapeHtml(c.flag + ' ' + c.name) + '</div>' +
      '    <div class="cell-carrier-meta">Towers: ' + c.towers + ' · MCC/MNC: ' + escapeHtml(c.mccmnc) + ' · PLMN: ' + escapeHtml(c.plmn) + '</div>' +
      '  </div>' +
      '  <div class="cell-nearest">' + c.nearest.map(n => '<div class="cell-near-row"><span>' + escapeHtml(n.tech) + '</span><span>' + escapeHtml(n.distance) + '</span><span>' + escapeHtml(n.bearing) + '</span></div>').join('') + '</div>' +
      '  <div class="cell-bands">Typical Bands: ' + c.bands.map(escapeHtml).join(' · ') + '</div>' +
      '</div>'
    )).join('');

    body.innerHTML = [
      header,
      '<div class="cell-summary">',
      '  <div class="cell-grade">' + escapeHtml(MOCK_CELL.summary.grade) + '</div>',
      '  <div class="cell-towers">' + escapeHtml(MOCK_CELL.summary.towers) + '</div>',
      '</div>',
      '<div class="cell-carrier-section">' + carriersHtml + '</div>',
      '<div class="cell-legend">Band Legend: ' + MOCK_CELL.bandLegend.map(escapeHtml).join(' · ') + '</div>',
      '<div class="comm-card-micro">Source: Cell lookup cache</div>'
    ].join('');

    if (status) status.textContent = MOCK_CELL.summary.grade;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    renderCellular(null);
    Events.on('comm:location-changed', (loc) => renderCellular(loc));
  });
})();
