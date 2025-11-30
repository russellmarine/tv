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

  function formatUserClock(dateVal, includeSeconds) {
    const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
    const opts = { hour: '2-digit', minute: '2-digit', hour12: false };
    if (includeSeconds) opts.second = '2-digit';
    return d.toLocaleTimeString(undefined, opts).replace(/:/g, '');
  }

  function formatUserStamp(dateVal) {
    const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
    const time = formatUserClock(d, false);
    const date = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return `${time} • ${date}`;
  }

  function buildMapLink(lat, lon) {
    if (lat == null || lon == null) return '';
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}&basemap=satellite`;
    return `<a class="cell-map" href="${url}" target="_blank" rel="noopener noreferrer">Map</a>`;
  }

  function summarizeCoverage(data) {
    const total = data?.summary?.total || data?.towers?.length || 0;
    const grade = data?.summary?.coverage || 'Unknown';
    const nearest = data?.summary?.nearestTower || null;
    const nearestText = nearest ? `Nearest: ${Math.round(nearest)}m` : '';
    return { grade, text: `${total} towers within ${SEARCH_RADIUS_METERS}m${nearestText ? ' · ' + nearestText : ''}` };
  }

  function coverageClass(grade) {
    const g = (grade || '').toLowerCase();
    if (g.includes('excellent') || g.includes('good')) return 'severity-good';
    if (g.includes('moderate')) return 'severity-fair';
    if (g.includes('limited')) return 'severity-watch';
    return 'severity-poor';
  }

  function renderCarrier(carrier) {
    const towers = carrier.towers || [];
    const plmn = carrier.plmn || carrier.mccmnc || (carrier.mcc && carrier.mnc ? `${carrier.mcc}/${carrier.mnc}` : '—');
    const mccmnc = carrier.mccmnc || (carrier.mcc && carrier.mnc ? `${carrier.mcc}-${carrier.mnc}` : '—');
    const rows = towers.map(t => {
      const mapLink = buildMapLink(t.lat, t.lon);
      const bearing = t.bearingDeg || t.bearing;
      return `<div class="cell-near-row"><span>${escapeHtml(t.tech || 'Tech')}</span><span>${t.distance ? escapeHtml(Math.round(t.distance) + 'm') : '—'}</span><span>${bearing ? escapeHtml(Math.round(bearing) + '°T') : '—'}</span><span>${mapLink}</span></div>`;
    }).join('');
    const bandBadges = (carrier.bands || []).sort((a, b) => TECH_PRIORITY.indexOf(a.split(' ')[0]) - TECH_PRIORITY.indexOf(b.split(' ')[0])).map(b => `<span class="cell-band ${TECH_COLORS[b.split(' ')[0]] || ''}">${escapeHtml(b)}</span>`).join('');
    return [
      '<div class="cell-carrier">',
      '  <div class="cell-carrier-head">',
      '    <div class="cell-carrier-name">' + escapeHtml(carrier.flag ? carrier.flag + ' ' : '') + escapeHtml(carrier.name || 'Carrier') + '</div>',
      '    <div class="cell-carrier-meta">MCC/MNC: ' + escapeHtml(mccmnc) + ' · PLMN: ' + escapeHtml(plmn) + (carrier.towers ? ' · Towers: ' + carrier.towers.length : '') + '</div>',
      '  </div>',
      rows ? '  <div class="cell-nearest">' + rows + '</div>' : '',
      bandBadges ? '  <div class="cell-bands">Typical Bands: ' + bandBadges + '</div>' : '',
      '</div>'
    ].join('');
  }

  function renderTowerTable(towers) {
    if (!towers || !towers.length) return '';
    const rows = towers.slice(0, 10).map(t => {
      const map = buildMapLink(t.lat, t.lon);
      return '<div class="cell-tower-row">'
        + '<span class="cell-tower-carrier">' + escapeHtml((t.flag ? t.flag + ' ' : '') + (t.carrier || 'Carrier')) + '</span>'
        + '<span>' + escapeHtml(t.technology || t.radio || 'Tech') + '</span>'
        + '<span>' + escapeHtml(Math.round(t.distance || 0) + 'm') + '</span>'
        + '<span>' + escapeHtml((t.bearingDeg != null ? Math.round(t.bearingDeg) : Math.round(t.bearing || 0)) + '°T') + '</span>'
        + '<span>' + map + '</span>'
        + '</div>';
    }).join('');

    return '<div class="cell-tower-section"><div class="cell-tower-head">Nearest Towers (TRUE north bearings)</div>' + rows + '</div>';
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
    const coverageCls = coverageClass(coverage.grade);
    const coverageLabel = coverage.grade ? coverage.grade.charAt(0).toUpperCase() + coverage.grade.slice(1) : 'Unknown';
    const carriers = (cellData?.carriers || []).map(renderCarrier).join('');
    const towers = renderTowerTable(cellData?.towers || []);

    body.innerHTML = [
      header,
      '<div class="cell-summary">',
      '  <div class="cell-grade ' + coverageCls + '">' + escapeHtml(coverageLabel) + '</div>',
      '  <div class="cell-towers">' + escapeHtml(coverage.text) + '</div>',
      '</div>',
      towers,
      carriers ? '<div class="cell-carrier-section">' + carriers + '</div>' : '<p class="comm-placeholder">' + (isLoading ? 'Loading towers…' : 'No towers reported in range.') + '</p>',
      '<div class="cell-legend">Azimuth is TRUE north (not magnetic)</div>',
      '<div class="cell-legend">Source: OpenCellID • Cached ' + escapeHtml(formatUserStamp(Date.now())) + '</div>'
    ].join('');

    if (status) status.innerHTML = '<span class="status-pill ' + coverageCls + '">' + escapeHtml(coverage.grade) + '</span>';
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

