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

  function getDeclination() {
    return window.RussellTV?.CommPlanner?.getDeclination?.();
  }

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

  function buildMapLink(lat, lon) {
    if (lat == null || lon == null) return '';
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}&basemap=satellite`;
    return `<a class="cell-map" href="${url}" target="_blank" rel="noopener noreferrer">Map</a>`;
  }

  function summarizeCoverage(data) {
    const total = data?.summary?.total || (Array.isArray(data?.towers) ? data.towers.length : 0) || 0;
    const grade = total === 0 ? 'Unavailable' : (data?.summary?.coverage || 'Unknown');
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
    const plmnRaw = carrier.plmn || carrier.mccmnc || (carrier.mcc && carrier.mnc ? `${carrier.mcc}${carrier.mnc}` : '');
    const plmn = plmnRaw ? String(plmnRaw).replace(/-/g, '') : '—';
    const mccmncRaw = carrier.mccmnc || (carrier.mcc && carrier.mnc ? `${carrier.mcc}${carrier.mnc}` : '');
    const mccmnc = mccmncRaw ? String(mccmncRaw).replace(/-/g, '') : '—';
    const decl = getDeclination();
    const rows = towers.map(t => {
      const mapLink = buildMapLink(t.lat, t.lon);
      const bearing = t.bearingDeg || t.bearing;
      const bearingText = bearing != null && decl != null
        ? `${Math.round(bearing)}°T / ${Math.round(((bearing - decl) % 360 + 360) % 360)}°M`
        : (bearing != null ? Math.round(bearing) + '°T' : '—');
      return `<div class="cell-near-row"><span>${escapeHtml(t.tech || 'Tech')}</span><span>${t.distance ? escapeHtml(Math.round(t.distance) + 'm') : '—'}</span><span>${escapeHtml(bearingText)}</span><span>${mapLink}</span></div>`;
    }).join('');
    const bandBadges = (carrier.bands || []).sort((a, b) => TECH_PRIORITY.indexOf(a.split(' ')[0]) - TECH_PRIORITY.indexOf(b.split(' ')[0])).map(b => `<span class="cell-band ${TECH_COLORS[b.split(' ')[0]] || ''}">${escapeHtml(b)}</span>`).join('');
    return [
      '<div class="cell-carrier">',
      '  <div class="cell-carrier-head">',
      '    <div class="cell-carrier-name">' + escapeHtml(carrier.flag ? carrier.flag + ' ' : '') + escapeHtml(carrier.name || 'Carrier') + '</div>',
      '    <div class="cell-carrier-meta">MCC/MNC: ' + escapeHtml(mccmnc) + ' · PLMN: ' + escapeHtml(plmn) + (carrier.towers ? ' · Towers: ' + carrier.towers.length : '') + '</div>',
      '  </div>',
      rows ? '  <div class="cell-nearest">' + rows + '</div>' : '',
      bandBadges ? '  <div class="cell-bands">Bands: ' + bandBadges + '</div>' : '',
      '</div>'
    ].join('');
  }

  function renderTowerTable(towers) {
    if (!towers || !towers.length) return '';
    const decl = getDeclination();
    const rows = towers.slice(0, 10).map(t => {
      const map = buildMapLink(t.lat, t.lon);
      const bearing = t.bearingDeg != null ? t.bearingDeg : t.bearing;
      const magnetic = bearing != null && decl != null ? Math.round(((bearing - decl) % 360 + 360) % 360) : null;
      const bearingText = bearing != null ? `${Math.round(bearing)}°T${magnetic != null ? ' / ' + magnetic + '°M' : ''}` : '—';
      return '<div class="cell-tower-row">'
        + '<span class="cell-tower-carrier">' + escapeHtml((t.flag ? t.flag + ' ' : '') + (t.carrier || 'Carrier')) + '</span>'
        + '<span>' + escapeHtml(t.technology || t.radio || 'Tech') + '</span>'
        + '<span>' + escapeHtml(Math.round(t.distance || 0) + 'm') + '</span>'
        + '<span>' + escapeHtml(bearingText) + '</span>'
        + '<span>' + map + '</span>'
        + '</div>';
    }).join('');

    return '<div class="cell-tower-section"><div class="cell-tower-head">Nearest Towers (TRUE / MAG bearings)</div>' + rows + '</div>';
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

    const coverage = summarizeCoverage(cellData || {});
    const coverageCls = coverageClass(coverage.grade);
    const coverageLabel = coverage.grade ? coverage.grade.charAt(0).toUpperCase() + coverage.grade.slice(1) : 'Unknown';
    const carrierEntriesRaw = Array.isArray(cellData?.carriers)
      ? cellData.carriers
      : (cellData?.carriers && typeof cellData.carriers === 'object' ? Object.values(cellData.carriers) : []);
    const carrierEntries = Array.isArray(carrierEntriesRaw) ? carrierEntriesRaw : [];
    const carriers = carrierEntries.map(renderCarrier).join('');
    const towers = renderTowerTable(Array.isArray(cellData?.towers) ? cellData.towers : []);

    body.innerHTML = [
      '<div class="cell-summary">',
      '  <div class="cell-grade ' + coverageCls + '">' + escapeHtml(coverageLabel) + '</div>',
      '  <div class="cell-towers">' + escapeHtml(coverage.text) + '</div>',
      '</div>',
      towers,
      carriers ? '<div class="cell-carrier-section">' + carriers + '</div>' : '<p class="comm-placeholder">' + (isLoading ? 'Loading towers…' : 'No towers reported in range.') + '</p>',
      '<div class="cell-legend">Azimuth shown as TRUE / MAG (declination applied from NOAA WMM)</div>',
      '<div class="cell-legend">Verify PLMN/MCC values if operating near borders to avoid unplanned roaming.</div>',
      '<div class="cell-legend comm-card-footer">Source: OpenCellID • Last Updated: ' + escapeHtml(formatUserStamp(Date.now())) + '</div>'
    ].join('');

    if (status) status.innerHTML = '<span class="status-pill ' + coverageCls + '">' + escapeHtml(coverage.grade) + '</span>';

    window.RussellTV?.CommPlanner?.queueLayout?.();
  }

  async function fetchCellular(loc) {
    if (!loc) { renderCellular(null); return; }
    if (Math.abs(loc.coords.lat) > 85) {
      cellData = { carriers: [], towers: [], summary: { total: 0, coverage: 'Unavailable' } };
      renderCellular(loc);
      return;
    }
    cellData = { carriers: [], towers: [], summary: { total: 0, coverage: 'Unknown' } };
    isLoading = true;
    renderCellular(loc);
    try {
      const res = await fetch(`${CELL_API_URL}?lat=${loc.coords.lat}&lon=${loc.coords.lon}&range=${SEARCH_RADIUS_METERS}`);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      cellData = await res.json();
    } catch (e) {
      cellData = cellData || { carriers: [], towers: [], summary: { total: 0, coverage: 'Unavailable' } };
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

