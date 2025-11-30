(function () {
  'use strict';

  const Events = window.RussellTV?.Events;
  if (!Events) return;

  const CELL_API_URL = '/cell';
  const SEARCH_RADIUS_METERS = 500;

  const TECH_PRIORITY = ['5G', 'LTE', 'NR', 'UMTS', 'HSPA', 'GSM', 'CDMA'];
  const TECH_COLORS = {
    '5G': 'severity-good',
    'NR': 'severity-good',
    'LTE': 'severity-fair',
    'HSPA': 'severity-watch',
    'UMTS': 'severity-watch',
    'GSM': 'severity-poor',
    'CDMA': 'severity-poor'
  };

  let cellData = null;
  let isLoading = false;

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function formatUserClock(dateVal) {
    const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).replace(/:/g, '');
  }

  function buildMapLink(lat, lon) {
    if (lat == null || lon == null) return '';
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}&basemap=satellite`;
    return `<a class="cell-map" href="${url}" target="_blank" rel="noopener noreferrer">Map</a>`;
  }

  function summarizeCoverage(data) {
    const total = data?.summary?.total || data?.towers?.length || 0;
    const grade = data?.summary?.coverage || 'Unknown';
    const nearest = data?.summary?.nearest || null;
    const nearestText = nearest ? `Nearest: ${Math.round(nearest)}m` : '';
    return { grade, text: `${total} towers within ${SEARCH_RADIUS_METERS}m${nearestText ? ' · ' + nearestText : ''}` };
  }

  function renderCarrier(carrier) {
    const towers = carrier.towers || [];
    const rows = towers.map(t => {
      const mapLink = buildMapLink(t.lat, t.lon);
      return `<div class="cell-near-row"><span>${escapeHtml(t.tech || 'Tech')}</span><span>${t.distance ? escapeHtml(Math.round(t.distance) + 'm') : '—'}</span><span>${t.bearing ? escapeHtml(Math.round(t.bearing) + '°T') : '—'}</span><span>${mapLink}</span></div>`;
    }).join('');
    const bandBadges = (carrier.bands || []).sort((a, b) => TECH_PRIORITY.indexOf(a.split(' ')[0]) - TECH_PRIORITY.indexOf(b.split(' ')[0])).map(b => `<span class="cell-band ${TECH_COLORS[b.split(' ')[0]] || ''}">${escapeHtml(b)}</span>`).join('');
    return [
      '<div class="cell-carrier">',
      '  <div class="cell-carrier-head">',
      '    <div class="cell-carrier-name">' + escapeHtml(carrier.flag ? carrier.flag + ' ' : '') + escapeHtml(carrier.name || 'Carrier') + '</div>',
      '    <div class="cell-carrier-meta">MCC/MNC: ' + escapeHtml(carrier.mccmnc || carrier.plmn || '—') + (carrier.towers ? ' · Towers: ' + carrier.towers.length : '') + '</div>',
      '  </div>',
      rows ? '  <div class="cell-nearest">' + rows + '</div>' : '',
      bandBadges ? '  <div class="cell-bands">Typical Bands: ' + bandBadges + '</div>' : '',
      '</div>'
    ].join('');
  }

  function renderCellular(loc) {
    const body = document.getElementById('comm-cell-body');
    const status = document.getElementById('comm-cell-status');
    if (!body) return;

    if (!loc) {
      body.innerHTML = '<p class="comm-placeholder">Select a location to load nearby cellular coverage.</p>';
      if (status) status.textContent = 'n/a';
      return;
    }

    const header = `<div class="cell-header"><div class="cell-location">${escapeHtml(loc.label)}</div><div class="cell-coords">${loc.coords.lat.toFixed(4)}°, ${loc.coords.lon.toFixed(4)}°</div></div>`;
    const coverage = summarizeCoverage(cellData || {});
    const carriers = (cellData?.carriers || []).map(renderCarrier).join('');

    body.innerHTML = [
      header,
      '<div class="cell-summary">',
      '  <div class="cell-grade">' + escapeHtml(coverage.grade) + '</div>',
      '  <div class="cell-towers">' + escapeHtml(coverage.text) + '</div>',
      '</div>',
      carriers ? '<div class="cell-carrier-section">' + carriers + '</div>' : '<p class="comm-placeholder">' + (isLoading ? 'Loading towers…' : 'No towers reported in range.') + '</p>',
      '<div class="cell-legend">Source: OpenCellID • Cached ' + escapeHtml(formatUserClock(Date.now())) + '</div>'
    ].join('');

    if (status) status.textContent = coverage.grade;
  }

  async function fetchCellular(loc) {
    if (!loc) { renderCellular(null); return; }
    isLoading = true;
    renderCellular(loc);
    try {
      const res = await fetch(`${CELL_API_URL}?lat=${loc.coords.lat}&lon=${loc.coords.lon}&range=${SEARCH_RADIUS_METERS}`);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      cellData = await res.json();
    } catch (e) {
      cellData = cellData || { carriers: [] };
    }
    isLoading = false;
    renderCellular(loc);
  }

  document.addEventListener('DOMContentLoaded', () => {
    renderCellular(null);
    Events.on('comm:location-changed', (loc) => {
      fetchCellular(loc);
    });
  });
})();

