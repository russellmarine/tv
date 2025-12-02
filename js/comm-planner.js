
/**
 * comm-planner.js
 * Lightweight Comm Planner controller for comm.html
 * - Handles location selection (search + browser location)
 * - Updates Local Weather card
 * - Renders global Space Weather summary
 */

(function () {
  'use strict';

  window.RussellTV = window.RussellTV || {};
  const Events = window.RussellTV.Events;

  let selectedLocation = null;
  let locationMode = 'search';
  let autocompleteResults = [];
  let autocompleteTimeout = null;
  let recentLocations = [];
  let lastWeather = null;
  let lastWeatherRaw = null;
  let lastForecastRaw = null;
  let lastWeatherCoords = null;
  let lastClimo = null;
  let currentDeclination = null;
  let tempUnit = 'F';
  const MAX_RECENT = 7;
  const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';
  const BACKUP_GEOCODER = 'https://geocode.maps.co/search';
  const SOLAR_CYCLE_ENDPOINT = window.SOLAR_CYCLE_ENDPOINT
    || '/api/spaceweather/json/solar-cycle/observed-solar-cycle.json';
  const SOLAR_CYCLE_FALLBACK = 'https://r.jina.ai/https://services.swpc.noaa.gov/json/solar-cycle/observed-solar-cycle.json';
  const DECLINATION_ENDPOINT = 'https://www.ngdc.noaa.gov/geomag-web/calculators/calculateDeclination?lat={lat}&lon={lon}&altitude=0&model=WMM&startYear=2025&resultFormat=json';
  const DECLINATION_FALLBACK = 'https://api.allorigins.win/raw?url=' + encodeURIComponent('https://www.ngdc.noaa.gov/geomag-web/calculators/calculateDeclination?lat={lat}&lon={lon}&altitude=0&model=WMM&startYear=2025&resultFormat=json');
  const RADAR_PROXY_BASE = window.RADAR_PROXY_BASE || '/wx-tiles/{z}/{x}/{y}.png';
  const RADAR_ZOOM_MIN = 4;
  const RADAR_ZOOM_MAX = 10;
  const PANEL_STATE_KEY = 'commPanelVisibility';
  const PANEL_IDS = [
    'comm-card-location',
    'comm-card-spacewx',
    'comm-card-overlay',
    'comm-card-weather',
    'comm-card-gps',
    'comm-card-hf',
    'comm-card-satcom',
    'comm-card-satangles',
    'comm-card-cellular'
  ];
  let masonryTimer = null;
  let resizeObserver = null;
  const ROW_HEIGHT = 4;
  let radarZoom = 6;
  let radarLayer = 'radar';
  let radarPlayTimer = null;

  // ---------- Layout helpers ----------

  function queueLayout() {
    clearTimeout(masonryTimer);
    masonryTimer = setTimeout(applyMasonry, 120);
  }

  function applyMasonry() {
    const grid = document.querySelector('#comm-planner-view .comm-layout-grid');
    if (!grid) return;
    const gap = parseFloat(getComputedStyle(grid).rowGap || '0') || 0;
    grid.querySelectorAll('.comm-card').forEach(card => {
      const span = Math.ceil((card.getBoundingClientRect().height + gap) / (ROW_HEIGHT + gap));
      card.style.setProperty('--row-span', span);
    });
  }

  function initResizeObserver() {
    const grid = document.querySelector('#comm-planner-view .comm-layout-grid');
    if (!grid || resizeObserver) return;
    resizeObserver = new ResizeObserver(() => queueLayout());
    grid.querySelectorAll('.comm-card').forEach(card => resizeObserver.observe(card));
  }

  // ---------- Storage helpers ----------

  function loadRecent() {
    try {
      const raw = localStorage.getItem('commRecentLocations');
      if (!raw) return;
      recentLocations = JSON.parse(raw).map(r => ({
        ...r,
        identifiers: r.identifiers || buildIdentifiers(r.coords)
      }));
    } catch (e) {
      recentLocations = [];
    }
  }

  function loadSelectedLocation() {
    try {
      const raw = localStorage.getItem('commSelectedLocation');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && parsed.coords) {
        parsed.identifiers = parsed.identifiers || buildIdentifiers(parsed.coords);
      }
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function saveSelectedLocation() {
    try {
      if (selectedLocation) {
        localStorage.setItem('commSelectedLocation', JSON.stringify(selectedLocation));
      } else {
        localStorage.removeItem('commSelectedLocation');
      }
    } catch (e) {
      // ignore
    }
  }

  function saveRecent() {
    try {
      localStorage.setItem('commRecentLocations', JSON.stringify(recentLocations));
    } catch (e) {
      // ignore
    }
  }

  function clearRecent() {
    recentLocations = [];
    try {
      localStorage.removeItem('commRecentLocations');
    } catch (e) {
      // ignore
    }
    renderRecentList();
  }

  function addRecent(loc) {
    if (!loc || !loc.label || !loc.coords) return;

    loc.identifiers = loc.identifiers || buildIdentifiers(loc.coords);

    // de-dupe on coords
    recentLocations = recentLocations.filter(r =>
      Math.abs(r.coords.lat - loc.coords.lat) > 0.001 ||
      Math.abs(r.coords.lon - loc.coords.lon) > 0.001
    );
    recentLocations.unshift(loc);
    if (recentLocations.length > MAX_RECENT) {
      recentLocations = recentLocations.slice(0, MAX_RECENT);
    }
    saveRecent();
    renderRecentList();
  }

  // ---------- DOM helpers ----------

  function $(sel) {
    return document.querySelector(sel);
  }

  function formatLatLon(lat, lon) {
    if (!isFinite(lat) || !isFinite(lon)) return '';
    return `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`;
  }

  function latLonToMaiden(lat, lon) {
    if (!isFinite(lat) || !isFinite(lon)) return '';
    let adjLon = lon + 180;
    let adjLat = lat + 90;
    adjLon = ((adjLon % 360) + 360) % 360;
    adjLat = Math.min(Math.max(adjLat, 0), 180);

    const FIELD = 'ABCDEFGHIJKLMNOPQR';
    const SUB = 'ABCDEFGHIJKLMNOPQRSTUVWX';

    const fieldLon = Math.floor(adjLon / 20);
    const fieldLat = Math.floor(adjLat / 10);
    const squareLon = Math.floor((adjLon % 20) / 2);
    const squareLat = Math.floor(adjLat % 10);
    const subsquareLon = Math.floor(((adjLon % 2) / 2) * 24);
    const subsquareLat = Math.floor(((adjLat % 1) / 1) * 24);

    return `${FIELD[fieldLon]}${FIELD[fieldLat]}${squareLon}${squareLat}${SUB[subsquareLon]}${SUB[subsquareLat]}`;
  }

  function latLonToMgrs(lat, lon, precision = 5) {
    if (!isFinite(lat) || !isFinite(lon)) return '';
    const a = 6378137.0;
    const f = 1 / 298.257223563;
    const k0 = 0.9996;
    const e = Math.sqrt(f * (2 - f));
    const eSq = e * e;
    const ePrimeSq = eSq / (1 - eSq);

    const zone = Math.floor((lon + 180) / 6) + 1;
    const lonOrigin = (zone - 1) * 6 - 180 + 3;
    const latRad = lat * Math.PI / 180;
    const lonRad = lon * Math.PI / 180;
    const lonOriginRad = lonOrigin * Math.PI / 180;

    const N = a / Math.sqrt(1 - eSq * Math.sin(latRad) * Math.sin(latRad));
    const T = Math.tan(latRad) ** 2;
    const C = ePrimeSq * Math.cos(latRad) ** 2;
    const A = Math.cos(latRad) * (lonRad - lonOriginRad);

    const M = a * ((1 - eSq / 4 - 3 * eSq * eSq / 64 - 5 * eSq ** 3 / 256) * latRad
      - (3 * eSq / 8 + 3 * eSq * eSq / 32 + 45 * eSq ** 3 / 1024) * Math.sin(2 * latRad)
      + (15 * eSq * eSq / 256 + 45 * eSq ** 3 / 1024) * Math.sin(4 * latRad)
      - (35 * eSq ** 3 / 3072) * Math.sin(6 * latRad));

    let easting = k0 * N * (A + (1 - T + C) * A ** 3 / 6 + (5 - 18 * T + T * T + 72 * C - 58 * ePrimeSq) * A ** 5 / 120) + 500000;
    let northing = k0 * (M + N * Math.tan(latRad) * (A * A / 2 + (5 - T + 9 * C + 4 * C * C) * A ** 4 / 24 + (61 - 58 * T + T * T + 600 * C - 330 * ePrimeSq) * A ** 6 / 720));
    if (lat < 0) northing += 10000000;

    const bandLetters = 'CDEFGHJKLMNPQRSTUVWXX';
    const bandIndex = Math.min(Math.max(Math.floor((lat + 80) / 8), 0), bandLetters.length - 1);
    const band = bandLetters[bandIndex];

    const columnSets = ['ABCDEFGH', 'JKLMNPQR', 'STUVWXYZ'];
    const rowSets = ['ABCDEFGHJKLMNPQRSTUV', 'FGHJKLMNPQRSTUVABCDE'];

    const colSet = (zone - 1) % 3;
    const rowSet = (zone % 2);

    const col = columnSets[colSet][Math.floor(easting / 100000) % 8];
    const row = rowSets[rowSet][Math.floor((northing % 2000000) / 100000) % 20];

    const accuracy = Math.min(Math.max(precision, 1), 5);
    const eastingStr = Math.floor((easting % 100000) / (10 ** (5 - accuracy))).toString().padStart(accuracy, '0');
    const northingStr = Math.floor((northing % 100000) / (10 ** (5 - accuracy))).toString().padStart(accuracy, '0');

    return `${zone}${band}${col}${row}${eastingStr}${northingStr}`;
  }

  function buildIdentifiers(coords) {
    if (!coords) return {};
    return {
      latlon: formatLatLon(coords.lat, coords.lon),
      mgrs: latLonToMgrs(coords.lat, coords.lon),
      grid: latLonToMaiden(coords.lat, coords.lon)
    };
  }

  function formatDeclination(deg) {
    if (deg === null || deg === undefined || isNaN(deg)) return '';
    const dir = deg >= 0 ? 'E' : 'W';
    return Math.abs(deg).toFixed(1) + '°' + dir;
  }

  async function fetchDeclination(lat, lon) {
    if (!isFinite(lat) || !isFinite(lon)) return null;
    const sources = [
      DECLINATION_ENDPOINT.replace('{lat}', lat).replace('{lon}', lon),
      DECLINATION_FALLBACK.replace('{lat}', lat).replace('{lon}', lon)
    ];

    for (const src of sources) {
      try {
        const res = await fetch(src, { cache: 'no-cache' });
        if (!res.ok) continue;
        const text = await res.text();
        try {
          const data = JSON.parse(text);
          const val = data.result?.[0]?.declination || data.result?.declination || data.declination;
          if (isFinite(val)) return Number(val);
        } catch (e) {
          const match = text.match(/"declination"\s*:\s*([-0-9\.]+)/i);
          if (match && isFinite(Number(match[1]))) return Number(match[1]);
        }
      } catch (e) {
        // try next
      }
    }
    return null;
  }

  function formatLocationLabel(loc) {
    if (!loc) return '';
    const base = loc.label || 'Location';
    return loc.context ? `${base} (${loc.context})` : base;
  }

  function updateLocationStatus() {
    const meta = $('#comm-location-status');
    if (!meta) return;
    if (!selectedLocation) {
      meta.textContent = 'No location selected';
    } else {
      selectedLocation.identifiers = selectedLocation.identifiers || buildIdentifiers(selectedLocation.coords);
      const ids = selectedLocation.identifiers || {};
      const decl = formatDeclination(selectedLocation.declination);
      meta.innerHTML = [
        '<div class="comm-location-lines">',
        '  <div class="loc-group">',
        '    <div class="loc-label">Location</div>',
        '    <div class="loc-primary">' + escapeHtml(formatLocationLabel(selectedLocation)) + '</div>',
        '  </div>',
        ids.latlon ? '  <div class="loc-group"><div class="loc-label">Lat/Long</div><div class="loc-value">' + escapeHtml(ids.latlon) + '</div></div>' : '',
        ids.mgrs ? '  <div class="loc-group"><div class="loc-label">MGRS</div><div class="loc-value">' + escapeHtml(ids.mgrs) + '</div></div>' : '',
        ids.grid ? '  <div class="loc-group"><div class="loc-label">Grid</div><div class="loc-value">' + escapeHtml(ids.grid) + '</div></div>' : '',
        decl ? '  <div class="loc-group"><div class="loc-label">Magnetic Declination</div><div class="loc-value">' + escapeHtml(decl) + ' (T→M)</div></div>' : '',
        '</div>'
      ].join('');
    }
  }

  // ---------- Location UI ----------

  function setLocationMode(mode) {
    locationMode = mode;
    const tabs = document.querySelectorAll('#comm-card-location .location-mode-tab');
    tabs.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    renderLocationInputArea();
  }

  function renderLocationInputArea() {
    const container = $('#comm-location-input-area');
    if (!container) return;

    let html = '';

    if (locationMode === 'search') {
      html = [
        '<div class="location-input-hint">Search by city, base name, or postal code</div>',
        '<div class="location-search-container">',
        '  <input id="comm-location-input" class="location-search-input" ',
        '         type="search" autocomplete="off" ',
        '         placeholder="Camp Lejeune, Jacksonville NC, 28542">',
        '  <div id="comm-location-autocomplete" class="location-autocomplete"></div>',
        '</div>',
        '<div id="comm-location-error" class="location-error"></div>'
      ].join('');
    } else if (locationMode === 'mgrs') {
      html = [
        '<div class="location-input-hint">Enter MGRS coordinate (zone + band + 100k grid + easting/northing)</div>',
        '<div class="location-input-row">',
        '  <div class="location-input-field" style="flex: 1;">',
        '    <input id="comm-mgrs-input" type="text" class="location-search-input"',
        '           placeholder="18SVK4083001357" style="text-transform: uppercase; font-family: monospace;">',
        '  </div>',
        '  <button type="button" id="comm-mgrs-go" class="location-go-btn">→</button>',
        '</div>',
        '<div class="location-input-hint subtle">2-10 digit coords; spaces optional.</div>',
        '<div id="comm-location-error" class="location-error"></div>'
      ].join('');
    } else if (locationMode === 'latlon') {
      html = [
        '<div class="location-input-hint">Enter latitude and longitude (decimal or DMS)</div>',
        '<div class="location-input-row">',
        '  <div class="location-input-field">',
        '    <label>Latitude</label>',
        '    <input id="comm-lat-input" type="text" placeholder="34.5042 or 34°30\'15\"N">',
        '  </div>',
        '  <div class="location-input-field">',
        '    <label>Longitude</label>',
        '    <input id="comm-lon-input" type="text" placeholder="-77.3528 or 77°21\'10\"W">',
        '  </div>',
        '  <button class="location-go-btn" id="comm-latlon-go">→</button>',
        '</div>',
        '<div class="location-input-hint subtle">DMS: 34°30\'15\"N or 34 30 15 N | Decimal: 34.5042</div>',
        '<div id="comm-location-error" class="location-error"></div>'
      ].join('');
    } else {
      html = [
        '<div class="location-input-hint">Enter Maidenhead grid locator (ham radio)</div>',
        '<div class="location-input-row">',
        '  <div class="location-input-field" style="flex: 1;">',
        '    <input id="comm-grid-input" type="text" class="location-search-input"',
        '           placeholder="FM19la or FM19" style="text-transform: uppercase;">',
        '  </div>',
        '  <button type="button" id="comm-grid-go" class="location-go-btn">→</button>',
        '</div>',
        '<div class="location-input-hint subtle">4, 6, or 8 character grid square</div>',
        '<div id="comm-location-error" class="location-error"></div>'
      ].join('');
    }

    container.innerHTML = html;

    // Wire up field listeners for current mode
    if (locationMode === 'search') {
      const input = $('#comm-location-input');
      if (input) {
        input.addEventListener('input', () => handleSearchInput(input.value));
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (autocompleteResults.length > 0) {
              applySearchResult(0);
            }
          }
        });
      }
    } else if (locationMode === 'latlon') {
      const btn = $('#comm-latlon-go');
      if (btn) {
        btn.addEventListener('click', () => {
          const latVal = $('#comm-lat-input')?.value.trim();
          const lonVal = $('#comm-lon-input')?.value.trim();
          handleLatLonSubmit(latVal, lonVal);
        });
      }
    } else if (locationMode === 'mgrs') {
      const btn = $('#comm-mgrs-go');
      if (btn) {
        btn.addEventListener('click', () => {
          const value = $('#comm-mgrs-input')?.value.trim();
          handleMgrsSubmit(value);
        });
      }
    } else if (locationMode === 'maiden') {
      const btn = $('#comm-grid-go');
      if (btn) {
        btn.addEventListener('click', () => {
          const value = $('#comm-grid-input')?.value.trim();
          handleGridSubmit(value);
        });
      }
    }

    renderRecentList();
  }

  function showLocationError(msg) {
    const el = $('#comm-location-error');
    if (!el) return;
    el.textContent = msg || '';
    el.classList.toggle('visible', !!msg);
  }

  // ---------- Search / Geocoding ----------

  function mapGeocodeResults(raw) {
    return (raw || []).map(r => {
      const addr = r.address || {};
      const city = r.name || addr.city || addr.town || addr.village || '';
      const state = addr.state || addr.county || '';
      const country = addr.country || '';
      const labelParts = [];
      if (city) labelParts.push(city);
      if (state && state !== city) labelParts.push(state);
      if (country && country !== state) labelParts.push(country);
      const label = labelParts.join(', ') || (r.display_name || '').split(',')[0];

      return {
        label,
        fullName: r.display_name || r.licence || label,
        coords: {
          lat: parseFloat(r.lat),
          lon: parseFloat(r.lon)
        }
      };
    });
  }

  async function searchLocation(query) {
    if (!query || query.length < 3) {
      autocompleteResults = [];
      renderAutocomplete();
      return;
    }

    const primaryUrl = NOMINATIM_URL + '/search'
      + '?q=' + encodeURIComponent(query)
      + '&format=json&limit=6&addressdetails=1';

    const backupUrl = BACKUP_GEOCODER + '?q=' + encodeURIComponent(query) + '&limit=6&format=json';

    try {
      const res = await fetch(primaryUrl, { headers: { 'User-Agent': 'RussellTV-CommPlanner/1.0' } });
      if (res.ok) {
        const raw = await res.json();
        autocompleteResults = mapGeocodeResults(raw);
        renderAutocomplete();
        return;
      }
      throw new Error('Geocoding failed');
    } catch (e) {
      console.warn('[CommPlanner] Geocoding error:', e);
      try {
        const res = await fetch(backupUrl);
        if (res.ok) {
          const raw = await res.json();
          autocompleteResults = mapGeocodeResults(raw);
          renderAutocomplete();
          return;
        }
      } catch (fallbackErr) {
        console.warn('[CommPlanner] Backup geocoder error:', fallbackErr);
      }

      autocompleteResults = [];
      renderAutocomplete();
      showLocationError('Geocoding failed. Try again.');
    }
  }

  function handleSearchInput(value) {
    showLocationError('');
    if (autocompleteTimeout) {
      clearTimeout(autocompleteTimeout);
    }
    autocompleteTimeout = setTimeout(() => {
      searchLocation(value);
    }, 300);
  }

  function renderAutocomplete() {
    const dropdown = $('#comm-location-autocomplete');
    if (!dropdown) return;

    if (!autocompleteResults.length) {
      dropdown.style.display = 'none';
      dropdown.innerHTML = '';
      return;
    }

    dropdown.innerHTML = autocompleteResults.map((r, idx) => (
      '<div class="location-autocomplete-item" data-idx="' + idx + '">' +
        '<span class="location-autocomplete-name">' + escapeHtml(r.label) + '</span>' +
        '<span class="location-autocomplete-detail">' + escapeHtml(r.fullName.split(',').slice(1, 3).join(', ')) + '</span>' +
      '</div>'
    )).join('');

    dropdown.style.display = 'block';

    dropdown.querySelectorAll('.location-autocomplete-item').forEach(el => {
      el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const idx = parseInt(el.dataset.idx, 10);
        applySearchResult(idx);
      });
    });
  }

  function applySearchResult(index) {
    const result = autocompleteResults[index];
    if (!result) return;
    autocompleteResults = [];
    renderAutocomplete();
    const input = $('#comm-location-input');
    if (input) input.value = result.label;
    applyLocation(result);
  }

  function handleLatLonSubmit(latVal, lonVal) {
    if (!latVal || !lonVal) {
      showLocationError('Enter both latitude and longitude');
      return;
    }
    try {
      const { lat, lon } = parseLatLonInput(latVal, lonVal);
      showLocationError('');
      const loc = {
        label: 'Custom Lat/Long',
        coords: { lat, lon }
      };
      applyLocation(loc);
    } catch (e) {
      showLocationError(e.message || 'Invalid coordinates');
    }
  }

  function handleMgrsSubmit(value) {
    if (!value) {
      showLocationError('Enter an MGRS coordinate');
      return;
    }
    try {
      const coords = mgrsToLatLon(value);
      showLocationError('');
      applyLocation({ label: value.toUpperCase(), coords });
    } catch (e) {
      showLocationError(e.message || 'Invalid MGRS coordinate');
    }
  }

  function handleGridSubmit(value) {
    if (!value) {
      showLocationError('Enter a Maidenhead grid');
      return;
    }
    try {
      const coords = maidenheadToLatLon(value);
      showLocationError('');
      applyLocation({ label: value.toUpperCase(), coords });
    } catch (e) {
      showLocationError(e.message || 'Invalid grid');
    }
  }

  const MGRS_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const UTM_ZONES_LAT = 'CDEFGHJKLMNPQRSTUVWX';

  function parseDMS(dmsStr) {
    dmsStr = dmsStr.trim().toUpperCase();

    const decimalMatch = dmsStr.match(/^(-?\d+\.?\d*)$/);
    if (decimalMatch) return parseFloat(decimalMatch[1]);

    const dmsMatch = dmsStr.match(/^(-?)(\d+)[°\s\-]+(\d+)?['\s\-]*(\d+\.?\d*)?["'\s]*([NSEW])?$/);
    if (dmsMatch) {
      const sign = (dmsMatch[1] === '-' || dmsMatch[5] === 'S' || dmsMatch[5] === 'W') ? -1 : 1;
      const deg = parseFloat(dmsMatch[2]) || 0;
      const min = parseFloat(dmsMatch[3]) || 0;
      const sec = parseFloat(dmsMatch[4]) || 0;
      return sign * (deg + min / 60 + sec / 3600);
    }

    throw new Error('Invalid coordinate format');
  }

  function parseLatLonInput(latStr, lonStr) {
    const lat = parseDMS(latStr);
    const lon = parseDMS(lonStr);

    if (!isFinite(lat) || lat < -90 || lat > 90) {
      throw new Error('Latitude must be between -90 and 90');
    }
    if (!isFinite(lon) || lon < -180 || lon > 180) {
      throw new Error('Longitude must be between -180 and 180');
    }

    return { lat, lon };
  }

  function utmToLatLon(zone, isSouthern, easting, northing) {
    const a = 6378137, f = 1 / 298.257223563, k0 = 0.9996;
    const e = Math.sqrt(2 * f - f * f), e2 = e * e;
    const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));

    const x = easting - 500000;
    const y = isSouthern ? northing - 10000000 : northing;
    const M = y / k0;
    const mu = M / (a * (1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * e2 * e2 * e2 / 256));

    const phi1 = mu + (3 * e1 / 2 - 27 * e1 * e1 * e1 / 32) * Math.sin(2 * mu)
      + (21 * e1 * e1 / 16 - 55 * e1 * e1 * e1 * e1 / 32) * Math.sin(4 * mu)
      + (151 * e1 * e1 * e1 / 96) * Math.sin(6 * mu);

    const N1 = a / Math.sqrt(1 - e2 * Math.sin(phi1) * Math.sin(phi1));
    const T1 = Math.tan(phi1) * Math.tan(phi1);
    const C1 = (e2 / (1 - e2)) * Math.cos(phi1) * Math.cos(phi1);
    const R1 = a * (1 - e2) / Math.pow(1 - e2 * Math.sin(phi1) * Math.sin(phi1), 1.5);
    const D = x / (N1 * k0);

    let lat = phi1 - (N1 * Math.tan(phi1) / R1) * (
      D * D / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * (e2 / (1 - e2))) * D * D * D * D / 24
      + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * (e2 / (1 - e2)) - 3 * C1 * C1) * D * D * D * D * D * D / 720
    );

    let lon = (D - (1 + 2 * T1 + C1) * D * D * D / 6
      + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * (e2 / (1 - e2)) + 24 * T1 * T1) * D * D * D * D * D / 120)
      / Math.cos(phi1);

    const lon0 = (zone - 1) * 6 - 180 + 3;
    return { lat: lat * 180 / Math.PI, lon: lon0 + lon * 180 / Math.PI };
  }

  function mgrsToLatLon(mgrs) {
    mgrs = mgrs.replace(/\s/g, '').toUpperCase();

    const match = mgrs.match(/^(\d{1,2})([C-X])([A-HJ-NP-Z]{2})(\d+)$/);
    if (!match) {
      throw new Error('Invalid MGRS format. Example: 18SVK4083001357');
    }

    const zone = parseInt(match[1]);
    const latBand = match[2];
    const gridLetters = match[3];
    const coords = match[4];

    if (zone < 1 || zone > 60) throw new Error('Invalid UTM zone (1-60)');

    const len = coords.length;
    if (len % 2 !== 0 || len < 2 || len > 10) {
      throw new Error('MGRS easting/northing must be 2, 4, 6, 8, or 10 digits');
    }

    const half = len / 2;
    const precision = Math.pow(10, 5 - half);
    let easting = parseInt(coords.substring(0, half)) * precision;
    let northing = parseInt(coords.substring(half)) * precision;

    easting += precision / 2;
    northing += precision / 2;

    const col = gridLetters[0];
    const row = gridLetters[1];

    const setNumber = ((zone - 1) % 6);
    const colOrigin = setNumber * 8 % 24;
    let colIndex = MGRS_LETTERS.indexOf(col) - colOrigin;
    if (colIndex < 0) colIndex += 24;
    easting += (colIndex + 1) * 100000;

    const rowSet = (zone - 1) % 2;
    const rowOrigin = rowSet === 0 ? 'A' : 'F';
    let rowIndex = MGRS_LETTERS.indexOf(row) - MGRS_LETTERS.indexOf(rowOrigin);
    if (rowIndex < 0) rowIndex += 20;

    const latBandIndex = UTM_ZONES_LAT.indexOf(latBand);
    const bandNorthing = (latBandIndex - 10) * 8 * 111000;

    let baseNorthing = rowIndex * 100000;
    while (baseNorthing < bandNorthing - 500000) baseNorthing += 2000000;
    northing += baseNorthing;

    return utmToLatLon(zone, latBand < 'N', easting, northing);
  }

  function maidenheadToLatLon(grid) {
    grid = grid.toUpperCase().trim();
    if (!/^[A-R]{2}\d{2}([A-X]{2}(\d{2})?)?$/.test(grid)) {
      throw new Error('Invalid Maidenhead format. Examples: FM19, FM19la, FM19la52');
    }

    let lon = -180, lat = -90;
    lon += (grid.charCodeAt(0) - 65) * 20;
    lat += (grid.charCodeAt(1) - 65) * 10;
    lon += parseInt(grid[2]) * 2;
    lat += parseInt(grid[3]) * 1;

    if (grid.length >= 6) {
      lon += (grid.charCodeAt(4) - 65) * (2 / 24);
      lat += (grid.charCodeAt(5) - 65) * (1 / 24);
    }
    if (grid.length === 8) {
      lon += parseInt(grid[6]) * (2 / 240);
      lat += parseInt(grid[7]) * (1 / 240);
    }

    if (grid.length === 4) { lon += 1; lat += 0.5; }
    else if (grid.length === 6) { lon += 1 / 24; lat += 0.5 / 24; }
    else if (grid.length === 8) { lon += 1 / 240; lat += 0.5 / 240; }

    return { lat, lon };
  }

  function calculateSunTimes(lat, lon, date = new Date()) {
    const rad = Math.PI / 180;
    const dayOfYear = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 86400000);
    const declination = -23.45 * Math.cos(rad * (360 / 365) * (dayOfYear + 10));
    const latRad = lat * rad;
    const decRad = declination * rad;
    const cosHourAngle = (Math.sin(-0.833 * rad) - Math.sin(latRad) * Math.sin(decRad)) /
      (Math.cos(latRad) * Math.cos(decRad));

    if (cosHourAngle > 1) return { polarNight: true };
    if (cosHourAngle < -1) return { polarDay: true };

    const hourAngle = Math.acos(cosHourAngle) / rad;
    const solarNoon = 12 - lon / 15;
    const sunriseUTC = solarNoon - hourAngle / 15;
    const sunsetUTC = solarNoon + hourAngle / 15;

    const sunrise = new Date(date);
    sunrise.setUTCHours(Math.floor(sunriseUTC), Math.round((sunriseUTC % 1) * 60), 0, 0);
    const sunset = new Date(date);
    sunset.setUTCHours(Math.floor(sunsetUTC), Math.round((sunsetUTC % 1) * 60), 0, 0);

    return { sunrise, sunset, solarNoon };
  }

  function getDayNightStatus(lat, lon) {
    const now = new Date();
    const sunTimes = calculateSunTimes(lat, lon, now);

    if (sunTimes.polarDay) return { status: 'day', label: 'Polar Day', icon: '☀️' };
    if (sunTimes.polarNight) return { status: 'night', label: 'Polar Night', icon: '🌙' };

    const { sunrise, sunset } = sunTimes;
    const nowTime = now.getTime();
    const greylineWindow = 30 * 60 * 1000;

    if (Math.abs(nowTime - sunrise.getTime()) < greylineWindow) {
      return { status: 'greyline', label: 'Greyline (Sunrise)', icon: '🌅', sunTimes };
    }
    if (Math.abs(nowTime - sunset.getTime()) < greylineWindow) {
      return { status: 'greyline', label: 'Greyline (Sunset)', icon: '🌇', sunTimes };
    }
    if (nowTime > sunrise.getTime() && nowTime < sunset.getTime()) {
      return { status: 'day', label: 'Daytime', icon: '☀️', sunTimes };
    }
    return { status: 'night', label: 'Nighttime', icon: '🌙', sunTimes };
  }

  function estimateMUF(lat, lon, data) {
    const dayNight = getDayNightStatus(lat, lon);
    const now = new Date();
    const month = now.getMonth();
    const absLat = Math.abs(lat);

    let baseMUF = dayNight.status === 'day' ? 21 : dayNight.status === 'greyline' ? 18 : 10;

    const isNorthernHemisphere = lat >= 0;
    const isSummer = (isNorthernHemisphere && month >= 4 && month <= 8) ||
      (!isNorthernHemisphere && (month >= 10 || month <= 2));
    if (isSummer && dayNight.status === 'day') baseMUF += 4;

    if (absLat > 60) baseMUF -= 5;
    else if (absLat > 45) baseMUF -= 2;

    const kp = data?.kpIndex || 0;
    if (kp >= 6) baseMUF -= 4;
    else if (kp >= 4) baseMUF -= 2;

    const rScale = data?.scales?.R || 0;
    if (rScale >= 3) baseMUF -= 6;
    else if (rScale >= 2) baseMUF -= 3;

    return Math.max(5, Math.min(35, Math.round(baseMUF)));
  }

  function getRecommendedBands(muf, dayNight) {
    const bands = [];
    if (muf >= 28) bands.push({ band: '10m', freq: '28 MHz', quality: 'excellent' });
    if (muf >= 21) bands.push({ band: '15m', freq: '21 MHz', quality: muf >= 24 ? 'excellent' : 'good' });
    if (muf >= 14) bands.push({ band: '20m', freq: '14 MHz', quality: 'excellent' });
    if (muf >= 10) bands.push({ band: '30m', freq: '10 MHz', quality: 'good' });
    if (muf >= 7) bands.push({ band: '40m', freq: '7 MHz', quality: dayNight.status === 'night' ? 'excellent' : 'good' });
    bands.push({ band: '80m', freq: '3.5 MHz', quality: dayNight.status === 'night' ? 'excellent' : 'fair' });
    bands.push({ band: '160m', freq: '1.8 MHz', quality: dayNight.status === 'night' ? 'good' : 'poor' });
    return bands.slice(0, 6);
  }

  function getGeomagLat(lat, lon) {
    const rad = Math.PI / 180;
    const geomagPoleLat = 80.5 * rad;
    const geomagPoleLon = -72.6 * rad;
    const latRad = lat * rad;
    const lonRad = lon * rad;

    const geomagLat = Math.asin(
      Math.sin(latRad) * Math.sin(geomagPoleLat) +
      Math.cos(latRad) * Math.cos(geomagPoleLat) * Math.cos(lonRad - geomagPoleLon)
    ) / rad;

    return Math.round(geomagLat * 10) / 10;
  }

  function getNvisAssessment(lat, data) {
    const muf = estimateMUF(lat, 0, data);
    const dayNight = getDayNightStatus(lat, 0);

    if (dayNight.status === 'day') {
      return muf >= 7
        ? { recommended: '40m (7 MHz)', quality: 'Good', range: '0-400 km' }
        : { recommended: '80m (3.5 MHz)', quality: 'Fair', range: '0-400 km' };
    }
    return { recommended: '80m / 160m', quality: 'Good', range: '0-400 km' };
  }

  function getHfAssessment(lat, lon, data) {
    const dayNight = getDayNightStatus(lat, lon);
    const kp = data?.kpIndex || 0;
    const rScale = data?.scales?.R || 0;
    const absLat = Math.abs(lat);

    let assessment = '';

    if (dayNight.status === 'greyline') {
      assessment = '🎯 Excellent DX window! Greyline propagation enhances long-distance paths on 20m-40m.';
    } else if (dayNight.status === 'day') {
      assessment = 'Daytime favors higher bands (10m-20m). ';
      if (rScale >= 2) assessment += '⚠️ D-layer absorption elevated - expect fadeouts on lower frequencies.';
      else assessment += 'F2 layer supporting normal skip distances.';
    } else {
      assessment = 'Nighttime favors lower bands (40m-160m). F2 layer may support 20m long-path DX.';
    }

    if (absLat > 55 && kp >= 5) {
      assessment += ' 🌌 Aurora conditions - polar HF disrupted, VHF scatter possible.';
    } else if (absLat > 55 && kp >= 4) {
      assessment += ' Monitor for polar cap absorption (PCA).';
    }
    return assessment;
  }

  function getSatcomAssessment(lat, lon, data) {
    const kp = data?.kpIndex || 0;
    const gScale = data?.scales?.G || 0;
    const sScale = data?.scales?.S || 0;
    const geomagLat = getGeomagLat(lat, lon);
    const absGeomagLat = Math.abs(geomagLat);

    const weather = lastWeather;

    let assessment = {
      ehf: { status: 'green', label: 'Normal', freq: '30-300 GHz', notes: '' },
      ka: { status: 'green', label: 'Normal', freq: '26.5-40 GHz', notes: '' },
      ku: { status: 'green', label: 'Normal', freq: '12-18 GHz', notes: '' },
      x: { status: 'green', label: 'Normal', freq: '8-12 GHz', notes: '' },
      c: { status: 'green', label: 'Normal', freq: '4-8 GHz', notes: '' },
      uhf: { status: 'green', label: 'Normal', freq: '300-3000 MHz', notes: '' },
      gps: { status: 'green', label: 'Normal', freq: 'L1/L2/L5', notes: '' },
      scintillation: 'Low',
      ionosphericDelay: 'Minimal',
      weather
    };

    if (weather) {
      const condition = (weather.main || '').toLowerCase();
      const desc = (weather.desc || '').toLowerCase();
      const humidity = weather.humidity || 0;

      if (condition.includes('rain') || condition.includes('thunder') || desc.includes('rain') || desc.includes('storm')) {
        assessment.ehf = {
          status: 'red', label: 'Rain Fade', freq: '30-300 GHz',
          notes: `Heavy attenuation (10-20+ dB). ${weather.desc || 'Rain.'}`
        };
        assessment.ka = {
          status: 'orange', label: 'Degraded', freq: '26.5-40 GHz',
          notes: 'Significant rain fade (5-15 dB). Monitor link margins.'
        };
        assessment.ku = {
          status: 'yellow', label: 'Minor', freq: '12-18 GHz',
          notes: 'Some rain attenuation possible (2-5 dB).'
        };
      } else if (condition.includes('drizzle')) {
        assessment.ehf = {
          status: 'orange', label: 'Light Rain', freq: '30-300 GHz',
          notes: 'Moderate attenuation (3-10 dB).'
        };
        assessment.ka = {
          status: 'yellow', label: 'Minor', freq: '26.5-40 GHz',
          notes: 'Light rain fade possible.'
        };
      } else if (condition.includes('snow')) {
        assessment.ehf = {
          status: 'orange', label: 'Snow', freq: '30-300 GHz',
          notes: 'Wet snow causes higher attenuation. Check antenna.'
        };
        assessment.ka = {
          status: 'yellow', label: 'Monitor', freq: '26.5-40 GHz',
          notes: 'Wet snow may cause fade.'
        };
      } else if (condition.includes('fog') || condition.includes('mist')) {
        assessment.ehf = {
          status: 'yellow', label: 'Fog', freq: '30-300 GHz',
          notes: 'Suspended water droplets cause 2-5 dB absorption.'
        };
      } else if (humidity > 85) {
        assessment.ehf = {
          status: 'yellow', label: 'High RH', freq: '30-300 GHz',
          notes: `High humidity (${humidity}%). Water vapor absorption possible.`
        };
      } else {
        assessment.ehf = {
          status: 'green', label: 'Normal', freq: '30-300 GHz',
          notes: `${humidity ? humidity + '% RH.' : 'Good conditions.'}`
        };
        assessment.ka = { status: 'green', label: 'Normal', freq: '26.5-40 GHz', notes: 'Good conditions.' };
      }
    } else {
      assessment.ehf = { status: 'green', label: 'Normal', freq: '30-300 GHz', notes: 'Clear-to-moderate conditions.' };
    }

    if (absGeomagLat < 20) {
      assessment.scintillation = 'Moderate (equatorial)';
      assessment.uhf = {
        status: 'yellow', label: 'Scint Risk', freq: '300-3000 MHz',
        notes: 'Equatorial scintillation, esp. post-sunset.'
      };
      assessment.gps = {
        status: 'yellow', label: 'Scint Risk', freq: 'L1/L2/L5',
        notes: 'Equatorial scintillation may affect accuracy.'
      };
    } else if (absGeomagLat > 60) {
      assessment.scintillation = kp >= 5 ? 'High (auroral)' : 'Moderate (polar)';
      if (kp >= 5) {
        assessment.uhf = {
          status: 'orange', label: 'Auroral', freq: '300-3000 MHz',
          notes: 'Auroral scintillation active. Expect fading.'
        };
      }
    }

    if (gScale >= 3) {
      assessment.ku = {
        status: 'orange', label: 'Degraded', freq: '12-18 GHz',
        notes: 'Signal fluctuations likely.'
      };
      assessment.ionosphericDelay = 'Elevated';
      assessment.gps = {
        status: 'orange', label: 'Degraded', freq: 'L1/L2/L5',
        notes: 'Accuracy reduced. Use dual-freq if available.'
      };
    } else if (gScale >= 2) {
      assessment.ku = {
        status: 'yellow', label: 'Minor', freq: '12-18 GHz',
        notes: 'Possible signal variations.'
      };
    }

    if (sScale >= 3) {
      assessment.x = {
        status: 'orange', label: 'Caution', freq: '8-12 GHz',
        notes: 'Solar particle event. Monitor for anomalies.'
      };
      assessment.gps = {
        status: 'orange', label: 'Degraded', freq: 'L1/L2/L5',
        notes: 'Solar radiation affecting GPS accuracy.'
      };
    }

    if (sScale >= 2 || gScale >= 2) {
      if (assessment.gps.status === 'green') {
        assessment.gps = {
          status: 'yellow', label: 'Monitor', freq: 'L1/L2/L5',
          notes: 'Minor degradation possible.'
        };
      }
    }

    if (sScale >= 4) {
      assessment.c = {
        status: 'yellow', label: 'Monitor', freq: '4-8 GHz',
        notes: 'Extreme event. Monitor all bands.'
      };
    } else {
      assessment.c = {
        status: 'green', label: 'Nominal', freq: '4-8 GHz',
        notes: 'Most resilient band.'
      };
    }

    if (assessment.x.status === 'green') {
      assessment.x = {
        status: 'green', label: 'Nominal', freq: '8-12 GHz',
        notes: 'Mil-spec SATCOM operating normally.'
      };
    }

    if (assessment.uhf.status === 'green') {
      assessment.uhf = {
        status: 'green', label: 'Nominal', freq: '300-3000 MHz',
        notes: 'MUOS/Legacy UHF operating normally.'
      };
    }

    return assessment;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function toTitleCase(str) {
    if (!str) return '';
    return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
  }

  function hasSelectedLocation() {
    return !!(selectedLocation && selectedLocation.coords && typeof selectedLocation.coords.lat === 'number' && typeof selectedLocation.coords.lon === 'number');
  }

  // ---------- Location application & weather ----------

  async function applyLocation(loc) {
    selectedLocation = {
      label: loc.label,
      coords: {
        lat: loc.coords.lat,
        lon: loc.coords.lon
      },
      identifiers: loc.identifiers || buildIdentifiers(loc.coords)
    };
    updateLocationStatus();
    await resolveLocationContext(selectedLocation);
    selectedLocation.declination = await fetchDeclination(selectedLocation.coords.lat, selectedLocation.coords.lon);
    currentDeclination = selectedLocation.declination;
    addRecent(selectedLocation);
    saveSelectedLocation();
    lastWeather = null;
    queueLayout();
    const swData = window.RussellTV?.SpaceWeather?.getCurrentData?.();
    if (swData) {
      const updated = window.RussellTV?.SpaceWeather?.getLastUpdate?.();
      const updatedText = updated ? 'Last Updated: ' + formatUserStamp(updated) + ' (local) • ' + formatUtcStamp(updated) + 'Z' : 'Live NOAA SWPC';
      updatePropagationCards(swData, updatedText);
    }
    const weatherMeta = $('#comm-weather-meta');
    if (weatherMeta) {
      weatherMeta.textContent = 'Loading weather…';
    }
    const weatherCard = $('#comm-card-weather');
    if (weatherCard) {
      weatherCard.style.removeProperty('--card-accent');
      weatherCard.style.removeProperty('--card-glow');
    }
    fetchLocalWeather(selectedLocation.coords.lat, selectedLocation.coords.lon);

    if (Events && Events.emit) {
      Events.emit('comm:location-changed', selectedLocation);
    }
  }

  async function resolveLocationContext(loc) {
    if (!loc || !loc.coords) return;
    try {
      const url = `${NOMINATIM_URL}/reverse?format=jsonv2&lat=${loc.coords.lat}&lon=${loc.coords.lon}&zoom=8&addressdetails=1`;
      const res = await fetch(url, { headers: { 'User-Agent': 'RussellTV-CommPlanner/1.0' } });
      if (!res.ok) return;
      const data = await res.json();
      const addr = data.address || {};
      const city = addr.city || addr.town || addr.village || addr.hamlet || '';
      const state = addr.state || addr.county || '';
      const country = addr.country || '';
      loc.countryCode = (addr.country_code || '').toUpperCase();
      const parts = [city, state, country].filter(Boolean);
      const ctx = parts.join(', ');
      if (ctx) {
        loc.context = ctx;
        updateLocationStatus();
        saveSelectedLocation();
        renderRecentList();
      }
    } catch (e) {
      // ignore context failures
    }
  }

  function renderRecentList() {
    const container = $('#comm-recent-list');
    const clearBtn = $('#comm-clear-recents');
    if (!container) return;
    if (!recentLocations.length) {
      container.innerHTML = '';
      if (clearBtn) clearBtn.style.display = 'none';
      return;
    }

    if (clearBtn) clearBtn.style.display = '';
    container.innerHTML = recentLocations.map((r, idx) => {
      const ids = r.identifiers || buildIdentifiers(r.coords);
      const subParts = [];
      if (ids.latlon) subParts.push('Lat/Long: ' + ids.latlon);
      if (ids.mgrs) subParts.push('MGRS: ' + ids.mgrs);
      if (ids.grid) subParts.push('Grid: ' + ids.grid);
      const sub = subParts.join(' • ');
      return '<button type="button" class="recent-location-pill" data-idx="' + idx + '">' +
        '<span class="recent-label">' + escapeHtml(formatLocationLabel(r)) + '</span>' +
        (sub ? '<span class="recent-sub">' + escapeHtml(sub) + '</span>' : '') +
      '</button>';
    }).join('');

    container.querySelectorAll('.recent-location-pill').forEach(el => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.dataset.idx, 10);
        const r = recentLocations[idx];
        if (r) {
          applyLocation(r);
        }
      });
    });
  }

  async function fetchLocalWeather(lat, lon) {
    const body = $('#comm-weather-body');
    const meta = $('#comm-weather-meta');
    const card = $('#comm-card-weather');
    if (!body) return;

    body.innerHTML = '<p class="comm-placeholder">Loading detailed weather for selected location…</p>';
    if (meta) meta.innerHTML = '<span class="status-pill severity-fair">Loading…</span>';
    if (card) {
      card.style.removeProperty('--card-accent');
      card.style.removeProperty('--card-glow');
    }

    lastWeatherCoords = { lat, lon };

    try {
      const res = await fetch('/weather?lat=' + lat + '&lon=' + lon);
      if (!res.ok) throw new Error('Weather HTTP ' + res.status);
      const wx = await res.json();

      let forecast = null;
      let climate = null;
      try {
        const unitParam = tempUnit === 'C' ? 'celsius' : 'fahrenheit';
        const forecastRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max,windspeed_10m_max,sunrise,sunset&temperature_unit=${unitParam}&windspeed_unit=mph&forecast_days=9&timezone=auto`);
        if (forecastRes.ok) {
          forecast = await forecastRes.json();
        }
      } catch (err) {
        console.warn('[CommPlanner] Forecast fetch failed', err);
      }

      try {
        const unitParam = tempUnit === 'C' ? 'celsius' : 'fahrenheit';
        const month = (new Date()).getMonth() + 1;
        const climateRes = await fetch(`https://climate-api.open-meteo.com/v1/climate?latitude=${lat}&longitude=${lon}&start_year=1991&end_year=2020&month=${month}&daily=temperature_2m_max_mean,temperature_2m_min_mean,temperature_2m_max_max,temperature_2m_min_min&temperature_unit=${unitParam}`);
        if (climateRes.ok) {
          climate = await climateRes.json();
          lastClimo = climate;
        }
      } catch (err) {
        console.warn('[CommPlanner] Climate normals fetch failed', err);
      }

      lastWeatherRaw = wx;
      lastForecastRaw = forecast;
      renderWeather(wx, forecast, lat, lon, climate);
    } catch (e) {
      console.warn('[CommPlanner] Weather fetch failed:', e);
      lastWeather = null;
      lastWeatherRaw = null;
      lastForecastRaw = null;
      body.textContent = 'Unable to load weather for this location. Ensure the weather proxy is running with an OpenWeather API key.';
      if (meta) meta.textContent = 'Weather proxy not reachable';
    }
  }

  function renderWeather(wx, forecast, lat, lon, climate) {
    const body = $('#comm-weather-body');
    const meta = $('#comm-weather-meta');
    const card = $('#comm-card-weather');
    if (!body || !wx || !wx.main) return;

    const main = (wx.weather && wx.weather[0]) || {};
    const wind = wx.wind || {};
    const visibility = wx.visibility;
    const tempF = wx.main && wx.main.temp != null ? Math.round(wx.main.temp) : null;
    const feelsF = wx.main && wx.main.feels_like != null ? Math.round(wx.main.feels_like) : null;
    const humidity = wx.main ? wx.main.humidity : null;
    const pressure = wx.main ? wx.main.pressure : null;
    const clouds = wx.clouds ? wx.clouds.all : null;
    const sunrise = wx.sys ? wx.sys.sunrise : null;
    const sunset = wx.sys ? wx.sys.sunset : null;
    const timezone = wx.timezone || 0;
    const sunCalc = calculateSunTimes(lat, lon, new Date());
    const sunriseCalc = sunCalc?.sunrise ? Math.round(sunCalc.sunrise.getTime() / 1000) : null;
    const sunsetCalc = sunCalc?.sunset ? Math.round(sunCalc.sunset.getTime() / 1000) : null;
    const sunriseIso = forecast?.daily?.sunrise?.[0];
    const sunsetIso = forecast?.daily?.sunset?.[0];
    const updatedLocal = wx.dt ? 'Last Updated: ' + formatUserStamp(wx.dt * 1000) + ' (local) • ' + formatUtcStamp(wx.dt * 1000) + 'Z' : 'Last Updated: --';
    const localTime = formatLocalClock(Date.now() / 1000, timezone, false) + 'L';
    const localDate = formatLocalDate(Date.now() / 1000, timezone);
    const weatherSeverity = getWeatherSeverityClass(main.main, humidity);

    lastWeather = {
      main: main.main,
      desc: main.description,
      humidity,
      temp: tempF,
      feels: feelsF
    };

    const accent = tempToAccent(tempF);
    if (card && accent) {
      card.style.setProperty('--card-accent', accent);
      card.style.setProperty('--card-glow', colorMixWithTransparency(accent, 0.45));
    }

    const heroClass = accent ? 'comm-weather-hero accented' : 'comm-weather-hero';
    const summaryLine = [];
    if (wx.main && wx.main.temp_max != null && wx.main.temp_min != null) {
      summaryLine.push('High/Low ' + formatTempDisplay(wx.main.temp_max) + ' / ' + formatTempDisplay(wx.main.temp_min));
    }
    if (clouds != null) {
      summaryLine.push('Clouds ' + clouds + '%');
    }

    const climoDaily = climate?.daily || lastClimo?.daily || {};
    const avgHigh = firstNumber(climoDaily.temperature_2m_max_mean);
    const avgLow = firstNumber(climoDaily.temperature_2m_min_mean);
    const recHigh = firstNumber(climoDaily.temperature_2m_max_max);
    const recLow = firstNumber(climoDaily.temperature_2m_min_min);

    const climateRow = (avgHigh != null || avgLow != null || recHigh != null || recLow != null)
      ? '<div class="comm-weather-climo">'
        + '<div><span>Avg Hi/Lo</span><strong>' + escapeHtml(formatTempDisplay(avgHigh)) + ' / ' + escapeHtml(formatTempDisplay(avgLow)) + '</strong></div>'
        + '<div><span>Record Hi/Lo</span><strong>' + escapeHtml(formatTempDisplay(recHigh)) + ' / ' + escapeHtml(formatTempDisplay(recLow)) + '</strong></div>'
        + '</div>'
      : '';

    const windDirection = degreesToCardinal(wind.deg);
    const metrics = [];
    if (humidity !== null) metrics.push(metricHtml('Humidity', humidity + '%', null, getWeatherMetricIcon('Humidity')));
    if (pressure !== null) metrics.push(metricHtml('Pressure', pressure + ' hPa', null, getWeatherMetricIcon('Pressure')));
    if (wind.speed != null) metrics.push(metricHtml('Wind', Math.round(wind.speed) + ' mph' + (windDirection ? ' ' + windDirection : ''), null, getWeatherMetricIcon('Wind')));
    if (visibility != null) metrics.push(metricHtml('Visibility', (visibility / 1609).toFixed(1) + ' mi', null, getWeatherMetricIcon('Visibility')));
    metrics.push(metricHtml('Local Time', localTime, null, getWeatherMetricIcon('Local Time')));
    metrics.push(metricHtml('UTC Time', formatUtcClock(false) + 'Z', null, getWeatherMetricIcon('Time')));
    metrics.push(metricHtml('Local Date', localDate, null, getWeatherMetricIcon('Date')));
    const sunriseTs = parseIsoToEpoch(sunriseIso) || sunriseCalc || sunrise;
    const sunsetTs = parseIsoToEpoch(sunsetIso) || sunsetCalc || sunset;
    const sunriseLabel = sunriseIso ? formatIsoLocalClock(sunriseIso) : (sunriseTs ? formatLocalTime(sunriseTs, timezone) : '');
    const sunsetLabel = sunsetIso ? formatIsoLocalClock(sunsetIso) : (sunsetTs ? formatLocalTime(sunsetTs, timezone) : '');
    if (sunriseLabel) metrics.push(metricHtml('Sunrise', sunriseLabel, null, getWeatherMetricIcon('Sunrise')));
    if (sunsetLabel) metrics.push(metricHtml('Sunset', sunsetLabel, null, getWeatherMetricIcon('Sunset')));

    const radarBlock = buildRadarBlock(lat, lon);
    const forecastBlock = buildForecastHtml(forecast);

    if (meta) meta.innerHTML = '<div class="weather-meta-bar"><span class="status-pill ' + weatherSeverity + '">' + escapeHtml(toTitleCase(main.description || main.main || 'Weather')) + '</span><button type="button" id="temp-unit-toggle" class="temp-toggle">°' + (tempUnit === 'F' ? 'C' : 'F') + '</button></div>';

    body.innerHTML = [
      '<div class="comm-weather-body">',
      '  <div class="' + heroClass + '" style="--weather-accent:' + (accent || '') + ';">',
      '    <div class="comm-weather-left">',
      '      <div class="comm-weather-location">' + escapeHtml(selectedLocation ? formatLocationLabel(selectedLocation) : 'Selected location') + '</div>',
      '      <div class="comm-weather-temp-row">',
      '        <div class="comm-weather-icon">' + getWeatherGlyph(main.main) + '</div>',
      '        <div class="comm-weather-mainline">',
      '          <div class="comm-weather-temp">' + formatTempDisplay(tempF) + '</div>',
      '          <div class="comm-weather-desc">' + escapeHtml(main.description || main.main || 'Weather') + '</div>',
      '          <div class="comm-weather-feels">Feels like ' + formatTempDisplay(feelsF) + '</div>',
      '        </div>',
      '      </div>',
      summaryLine.length ? '      <div class="comm-weather-summary-row">' + summaryLine.map(escapeHtml).join('<span>•</span>') + '</div>' : '',
      climateRow,
      '    </div>',
      '  </div>',
      metrics.length ? '  <div class="comm-weather-grid">' + metrics.join('') + '</div>' : '',
      (radarBlock || forecastBlock) ? '  <div class="weather-extended">' + radarBlock + forecastBlock + '</div>' : '',
      '<div class="comm-card-micro comm-card-footer weather-footer">Source: <a class="inline-link" href="https://openweathermap.org/" target="_blank" rel="noopener noreferrer">OpenWeather</a> • ' + escapeHtml(updatedLocal) + '</div>',
      '</div>'
    ].join('');

    const swRefresh = window.RussellTV?.SpaceWeather?.getCurrentData?.();
    if (swRefresh) {
      const updatedSw = window.RussellTV?.SpaceWeather?.getLastUpdate?.();
    const updatedLabel = updatedSw ? 'Last Updated: ' + formatUserStamp(updatedSw) + ' (local) • ' + formatUtcStamp(updatedSw) + 'Z' : 'Live NOAA SWPC';
      updatePropagationCards(swRefresh, updatedLabel);
    }

    const toggle = document.getElementById('temp-unit-toggle');
    if (toggle) {
      toggle.addEventListener('click', () => {
        tempUnit = tempUnit === 'F' ? 'C' : 'F';
        if (lastWeatherRaw && lastWeatherCoords) {
          renderWeather(lastWeatherRaw, lastForecastRaw, lastWeatherCoords.lat, lastWeatherCoords.lon, lastClimo);
        }
      });
    }

    const radarFrame = body.querySelector('.weather-radar-frame');
    wireRadarFrame(radarFrame);

    queueLayout();
  }

  // ---------- Space weather card ----------

  function getScaleColor(v) {
    if (v >= 4) return '#ff4444';
    if (v >= 3) return '#ff8800';
    if (v >= 2) return '#ffcc00';
    if (v >= 1) return '#88cc44';
    return '#44cc44';
  }

  function getSpacewxOverall(data) {
    const r = data?.scales?.R || 0;
    const s = data?.scales?.S || 0;
    const g = data?.scales?.G || 0;
    const kp = data?.kpIndex || 0;

    const kpScore = kp >= 7 ? 4 : kp >= 6 ? 3 : kp >= 5 ? 2 : kp >= 4 ? 1 : 0;
    const severityScore = Math.max(r, s, g, kpScore);

    if (severityScore >= 4) {
      return {
        className: 'severity-poor',
        label: 'Severe',
        desc: 'Strong storms in progress. Expect widespread HF absorption and SATCOM scintillation.'
      };
    }
    if (severityScore >= 3) {
      return {
        className: 'severity-watch',
        label: 'Watch',
        desc: 'Active disturbances. Monitor HF MUF/LUF shifts and increased SATCOM fading.'
      };
    }
    if (severityScore >= 2) {
      return {
        className: 'severity-fair',
        label: 'Elevated',
        desc: 'Minor solar activity; slight HF degradation or positioning jitter possible.'
      };
    }
    return {
      className: 'severity-good',
      label: 'Calm',
      desc: 'Nominal conditions. Routine HF, SATCOM, and GPS performance expected.'
    };
  }

  function getScaleDescription(type, value) {
    const desc = {
      R: ['None', 'Minor', 'Moderate', 'Strong', 'Severe', 'Extreme'],
      S: ['None', 'Minor', 'Moderate', 'Strong', 'Severe', 'Extreme'],
      G: ['Quiet', 'Minor', 'Moderate', 'Strong', 'Severe', 'Extreme']
    };
    return (desc[type] && desc[type][value]) || 'Unknown';
  }

  function getHfSeverityDetails(severity) {
    switch (severity) {
      case 'Severe disruption':
        return { className: 'severity-poor', desc: 'Major flare or geomagnetic storm in progress. HF unreliable and regional blackouts likely.' };
      case 'Degraded':
        return { className: 'severity-watch', desc: 'Storm conditions are elevating absorption. Expect fades on mid/high bands; lean on lower bands.' };
      case 'Fair':
        return { className: 'severity-fair', desc: 'Space weather is unsettled. Some absorption or noise is possible during disturbed periods.' };
      default:
        return { className: 'severity-good', desc: 'Quiet ionosphere. Most amateur and HF bands should be usable with normal reliability.' };
    }
  }

  function getSatSeverityDetails(risk) {
    switch (risk) {
      case 'High scintillation risk':
        return { className: 'severity-poor', desc: 'High geomagnetic activity. Expect scintillation, loss of lock, and degraded GEO links.' };
      case 'Moderate risk':
        return { className: 'severity-watch', desc: 'Disturbances may cause fades or pointing errors, especially near auroral/low-latitude regions.' };
      case 'Watch':
        return { className: 'severity-fair', desc: 'Elevated Kp—keep an eye on outages in polar and equatorial anomaly regions.' };
      default:
        return { className: 'severity-good', desc: 'Nominal space weather. Routine SATCOM and GPS performance expected.' };
    }
  }

  function bandQualityClass(quality) {
    if (quality === 'excellent') return 'severity-good';
    if (quality === 'good') return 'severity-fair';
    if (quality === 'fair') return 'severity-watch';
    return 'severity-poor';
  }

  function getDayPhaseIcon(status) {
    if (status === 'night') {
      return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 3a7 7 0 1 0 9 9.5A9 9 0 1 1 12 3Z" fill="currentColor" opacity="0.9"/></svg>';
    }
    if (status === 'greyline') {
      return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><linearGradient id="gl" x1="0" y1="0" x2="24" y2="0" gradientUnits="userSpaceOnUse"><stop stop-color="currentColor" stop-opacity="0.4"/><stop offset="1" stop-color="currentColor" stop-opacity="0.9"/></linearGradient><path d="M3 12h18" stroke="url(#gl)" stroke-width="2.5" stroke-linecap="round"/><path d="M6 8c1.5-2 3.8-3 6-3 4.9 0 9 4.1 9 9 0 2.2-0.8 4.3-2 6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';
    }
    return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="5.5" stroke="currentColor" stroke-width="2"/><path d="m12 1.75 0 3.5M12 18.75l0 3.5M4.22 4.22l2.47 2.47m11.14 11.12 2.47 2.47M1.75 12h3.5m13.5 0h3.5M4.22 19.78l2.47-2.47m11.14-11.12 2.47-2.47" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
  }

  function satBandClass(status) {
    if (status === 'green') return 'severity-good';
    if (status === 'yellow') return 'severity-fair';
    if (status === 'orange') return 'severity-watch';
    if (status === 'red') return 'severity-poor';
    return 'severity-good';
  }

  function renderGpsCard(satAssessment, sourceText, gpsBody, gpsStatus, kp) {
    if (!gpsBody || !gpsStatus) return;

    if (!hasSelectedLocation()) {
      gpsBody.innerHTML = '<p class="comm-placeholder">Select a location to see GPS/PNT conditions.</p>';
      gpsStatus.textContent = 'n/a';
      gpsStatus.className = '';
      return;
    }

    const gps = satAssessment?.gps || {};
    const scint = satAssessment?.scintillation || 'Low';
    const iono = satAssessment?.ionosphericDelay || 'Minimal';
    const jam = satAssessment?.jamming || gps.notes || 'Monitoring normal operations.';

    const baseStatus = gps.status || 'green';
    const kpLevel = kp || 0;
    function bandStatus(level) {
      if (kpLevel >= 7) return 'red';
      if (kpLevel >= 6) return 'orange';
      if (kpLevel >= 5) return 'yellow';
      return level || baseStatus;
    }

    const bands = [
      { name: 'L1 C/A', status: baseStatus, notes: 'Standard positioning & timing.' },
      { name: 'L2 P(Y)', status: bandStatus(baseStatus), notes: 'Military precision; iono corrections.' },
      { name: 'L5', status: bandStatus(baseStatus), notes: 'Modern safety-of-life; strongest against interference.' },
      { name: 'Galileo E1/E5', status: bandStatus(baseStatus), notes: 'Multi-frequency EU PNT; strong multipath rejection.' },
      { name: 'BeiDou B1/B2/B3', status: bandStatus(baseStatus), notes: 'BDS global + regional beams; monitor local interference.' }
    ];

    const bandChips = bands.map(b => '<span class="gps-band-chip ' + satBandClass(b.status) + '"><span>' + escapeHtml(b.name)
      + '</span><small>' + escapeHtml(toTitleCase(b.status)) + '</small></span>').join('');
    const bandRows = bands.map(b => '<div class="gps-band-row ' + satBandClass(b.status) + '">' +
      '<div class="band-name">' + escapeHtml(b.name) + '</div>' +
      '<div class="band-label">' + escapeHtml(toTitleCase(b.status)) + '</div>' +
      '<div class="band-notes">' + escapeHtml(b.notes) + '</div>' +
      '</div>').join('');

    const bandDefinition = '<details class="comm-definition"><summary>Band health & constellations</summary>'
      + '<div class="gps-band-grid">' + bandRows + '</div>'
      + '<div class="gnss-constellations">' + [
        { name: 'GPS (USA)', status: baseStatus, notes: 'Baseline PNT.' },
        { name: 'Galileo (EU)', status: bandStatus(baseStatus), notes: 'High-accuracy E1/E5.' },
        { name: 'BeiDou (BDS)', status: bandStatus(baseStatus), notes: 'Global + APAC beams.' },
        { name: 'GLONASS', status: bandStatus(baseStatus), notes: 'Complementary visibility.' }
      ].map(c => '<div class="gnss-row ' + satBandClass(c.status) + '"><span>' + escapeHtml(c.name) + '</span><span>' + escapeHtml(c.notes) + '</span></div>').join('') + '</div>'
      + '<ul class="definition-list">'
      + '  <li><strong>Nominal:</strong> Normal PNT performance.</li>'
      + '  <li><strong>Watch:</strong> Mild geomagnetic or scintillation risk; monitor timing.</li>'
      + '  <li><strong>Degraded:</strong> Expect dropouts or reduced accuracy; use multi-frequency if possible.</li>'
      + '  <li><strong>Severe:</strong> High interference/jamming risk; fallback to alternate nav sources.</li>'
      + '</ul>'
      + '</details>';

    const scintDefinition = '<details class="comm-definition"><summary>Ionospheric Scintillation</summary>'
      + '<p>Ionospheric scintillation is the rapid fluctuation of radio waves caused by small-scale electron density structures. '
      + 'Strong scintillation can prevent GPS/GNSS receivers from locking signals; mild scintillation reduces accuracy. Severity '
      + 'depends on local time, season, geomagnetic activity, solar cycle, and atmospheric waves.</p>'
      + '<p>Scintillation impacts both signal power (S4) and phase (σφ). It is more common at low/high latitudes but can appear at mid-latitudes during disturbed periods.</p>'
      + '<div class="gps-stratum"><strong>Timing reference:</strong> USNO (Stratum-0) feeds GPS time; field receivers typically discipline to Stratum-1/2 sources.</div>'
      + '</details>';

    const usnoTime = formatUtcClock(true);

    gpsBody.innerHTML = [
      '<div class="comm-prop-status ' + satBandClass(baseStatus) + '">',
      '  <div class="status-heading">',
      '    <span class="status-label">GPS/GNSS</span>',
      '    <span class="status-value">' + escapeHtml(gps.label || 'Normal') + '</span>',
      '  </div>',
      '  <p class="status-desc">Scintillation: ' + escapeHtml(scint) + ' · Iono Delay: ' + escapeHtml(iono) + '</p>',
      '</div>',
      '<div class="gps-meta-row"><div><span class="label">USNO (UTC)</span><div>' + escapeHtml(usnoTime) + ' UTC</div></div>' +
      '<div><span class="label">Jamming/Interference</span><div>' + escapeHtml(jam) + '</div></div></div>',
      '<div class="gps-chip-row">' + bandChips + '</div>',
      '<div class="gps-meta">Key bands colored by current space-weather risk.</div>',
      bandDefinition,
      scintDefinition,
      '<div class="comm-card-micro comm-card-footer">Source: <a class="inline-link" href="https://www.swpc.noaa.gov/" target="_blank" rel="noopener noreferrer">SWPC</a> · <a class="inline-link" href="https://gpsjam.org" target="_blank" rel="noopener noreferrer">GPSJam</a> · <a class="inline-link" href="https://www.navcen.uscg.gov/" target="_blank" rel="noopener noreferrer">NAVCEN</a> • ' + escapeHtml(sourceText) + '</div>'
    ].join('');

    gpsStatus.textContent = gps.label || 'Normal';
    gpsStatus.className = 'status-pill ' + satBandClass(baseStatus);
  }

  let sunspotSeries = [];
  let sunspotPromise = null;

  function mapSunspots(data) {
    return (data || []).map(entry => {
      const dateRaw = entry.time_tag || entry.date || entry.timestamp || entry[0];
      const valueRaw = entry.ssn ?? entry.sunspot_number ?? entry.smoothed_ssn ?? entry.observed_ssn ?? entry[1];
      const value = Number(valueRaw);
      if (!dateRaw || !isFinite(value)) return null;
      return { date: new Date(dateRaw), value };
    }).filter(Boolean).sort((a, b) => a.date - b.date);
  }

  async function fetchSunspotSeries(url) {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) return [];
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return await res.json();
    }
    const text = await res.text();
    const start = text.indexOf('[');
    const end = text.lastIndexOf(']');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch (e) {
        return [];
      }
    }
    return [];
  }

  async function ensureSunspotSeries() {
    if (sunspotSeries.length) return sunspotSeries;
    if (sunspotPromise) return sunspotPromise;

    sunspotPromise = (async () => {
      const sources = [
        SOLAR_CYCLE_ENDPOINT,
        SOLAR_CYCLE_FALLBACK
      ];

      for (const src of sources) {
        try {
          const raw = await fetchSunspotSeries(src);
          const mapped = mapSunspots(raw);
          if (mapped.length) {
            sunspotSeries = mapped.slice(-48);
            return sunspotSeries;
          }
        } catch (e) {
          // try next source
        }
      }
      return [];
    })();

    return sunspotPromise;
  }

  function renderSunspotSparkline(series) {
    if (!series || !series.length) return '';
    const values = series.map(p => p.value).filter(v => isFinite(v));
    if (!values.length) return '';

    const recent = values.slice(-32);
    const width = 160;
    const height = 46;
    const max = Math.max(...recent);
    const min = Math.min(...recent);
    const span = Math.max(max - min, 1);
    const step = recent.length > 1 ? (width / (recent.length - 1)) : width;

    const points = recent.map((v, idx) => {
      const x = idx * step;
      const y = height - ((v - min) / span) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

    return '<svg class="sunspot-spark" viewBox="0 0 ' + width + ' ' + height + '" preserveAspectRatio="none">'
      + '<defs><linearGradient id="sunspotGrad" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#ffa94d" stop-opacity="0.9"/><stop stop-color="#ff7f32" stop-opacity="0.25"/></linearGradient></defs>'
      + '<polyline points="' + points + '" fill="none" stroke="url(#sunspotGrad)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />'
      + '</svg>';
  }

  async function updateSpaceWeatherCard() {
    const card = $('#comm-card-spacewx');
    if (!card || !window.RussellTV.SpaceWeather || !window.SPACE_WEATHER_CONFIG) return;

    const data = window.RussellTV.SpaceWeather.getCurrentData();
    if (!data) return;

    const body = card.querySelector('.comm-card-body');
    const meta = $('#comm-spacewx-meta');
    if (!body) return;

    const kpColor = data.kpIndex >= 5 ? '#ff8800' : (data.kpIndex >= 4 ? '#ffcc00' : '#44cc44');

    const updated = window.RussellTV.SpaceWeather.getLastUpdate();
    const updatedText = updated ? 'Last Updated: ' + formatUserStamp(updated) + ' (local) • ' + formatUtcStamp(updated) + 'Z' : 'Live NOAA SWPC';
    const kpCondition = data.kpIndex >= 5 ? 'Storm' : data.kpIndex >= 4 ? 'Unsettled' : 'Quiet';

    const spacewxOverall = getSpacewxOverall(data);
    const scaleLinks = {
      R: 'https://www.swpc.noaa.gov/noaa-scales-explanation',
      S: 'https://www.swpc.noaa.gov/noaa-scales-explanation',
      G: 'https://www.swpc.noaa.gov/noaa-scales-explanation'
    };
    const scaleTooltips = {
      R: 'R-scale: HF radio blackouts driven by X-ray flares (R1 minor → R5 extreme).',
      S: 'S-scale: Solar radiation storms. Energetic protons causing HF disruption at high latitudes.',
      G: 'G-scale: Geomagnetic storms from CMEs/solar wind. Can trigger aurora, absorption, and scintillation.'
    };
    const scaleCards = ['R', 'S', 'G'].map(key => (
      '<a class="spacewx-scale-card tooltip-target" href="' + scaleLinks[key] + '" target="_blank" rel="noopener noreferrer" data-tooltip="' + escapeHtml(scaleTooltips[key]) + '">' +
        '<div class="label">' + (key === 'R' ? 'Radio' : key === 'S' ? 'Solar' : 'Geomag') + '</div>' +
        '<div class="value" style="color:' + getScaleColor(data.scales[key]) + '">' + key + data.scales[key] + '</div>' +
        '<div class="desc">' + getScaleDescription(key, data.scales[key]) + '</div>' +
      '</a>'
    )).join('');
    const scaleRow = '<div class="spacewx-scales-row">' + scaleCards + '</div>';

    const sunspots = await ensureSunspotSeries();
    const latestSunspot = sunspots.length ? Math.round(sunspots[sunspots.length - 1].value) : null;
    const sunspotSpark = renderSunspotSparkline(sunspots);
    const kpTooltip = 'Planetary K index (0–9) measures geomagnetic disturbance. Kp≥5 is storm level.';
    const kpScale = [
      { label: 'Kp < 3', desc: 'Quiet', color: '#44cc44' },
      { label: 'Kp = 3', desc: 'Unsettled', color: '#88cc44' },
      { label: 'Kp = 4', desc: 'Active', color: '#ffcc00' },
      { label: 'Kp = 5', desc: 'Minor storm', color: '#ff9900' },
      { label: 'Kp ≥ 6', desc: 'Storm/Severe', color: '#ff4444' }
    ].map(item => '<div class="kp-segment" style="--kp-color:' + item.color + '"><span>' + escapeHtml(item.label)
      + '</span><small>' + escapeHtml(item.desc) + '</small></div>').join('');
    const kpDefinition = '<details class="comm-definition"><summary>What is Kp?</summary>'
      + '<div class="definition-body">'
      + '  <div class="kp-scale" aria-label="Kp scale">' + kpScale + '</div>'
      + '  <p>The K-index and Planetary K-index (Kp) characterize geomagnetic storm magnitude. Kp is used to decide when to issue alerts for users impacted by geomagnetic disturbances.</p>'
      + '  <p>Primary users affected include power-grid operators, spacecraft controllers, HF/VHF radio users, and aurora observers. Higher Kp indicates stronger geomagnetic activity and greater disruption risk.</p>'
      + '  <div class="spacewx-footnote">R = HF Radio Blackouts · S = Solar Radiation · G = Geomagnetic Storms</div>'
      + '</div>'
      + '</details>';

    const sunspotBlock = sunspotSpark
      ? '<div class="spacewx-sunspot-block">'
        + '  <div class="sunspot-meta">'
        + '    <div class="sunspot-label">Sunspot Number</div>'
        + '    <div class="sunspot-value">' + escapeHtml(latestSunspot ?? '—') + '</div>'
        + '  </div>'
        + '  <div class="sunspot-chart">' + sunspotSpark + '</div>'
        + '</div>'
      : '';

    if (meta) {
      meta.innerHTML = '<span class="spacewx-pill ' + spacewxOverall.className + '">' + escapeHtml(spacewxOverall.label) + '</span>';
    }

    body.innerHTML = [
      '<div class="spacewx-summary-row">'
      + '  <div class="spacewx-summary-desc">' + escapeHtml(spacewxOverall.desc) + '</div>'
      + '</div>',
      scaleRow,
      '<a class="spacewx-kp-row tooltip-target" href="https://www.swpc.noaa.gov/products/planetary-k-index" target="_blank" rel="noopener noreferrer" data-tooltip="' + escapeHtml(kpTooltip) + '">',
      '  <span class="label">Kp Index</span>',
      '  <span class="value" style="color:' + kpColor + ';">' + data.kpIndex.toFixed(2) + '</span>',
      '  <span class="status">' + kpCondition + '</span>',
      '</a>',
      sunspotBlock,
      kpDefinition,
      '<div class="comm-card-micro comm-card-footer">Source: <a class="inline-link" href="https://www.swpc.noaa.gov" target="_blank" rel="noopener noreferrer">NOAA SWPC</a> · <a class="inline-link" href="https://www.swpc.noaa.gov/products/space-weather-scales" target="_blank" rel="noopener noreferrer">NOAA Scales</a> · <a class="inline-link" href="https://www.swpc.noaa.gov/products/planetary-k-index" target="_blank" rel="noopener noreferrer">Kp Source</a> • ' + escapeHtml(updatedText) + '</div>'
    ].join('');

    updatePropagationCards(data, updatedText);

    queueLayout();
  }

  function updatePropagationCards(data, sourceText) {
    const hfBody = $('#comm-hf-body');
    const satBody = $('#comm-sat-body');
    const hfStatus = $('#comm-hf-status');
    const satStatus = $('#comm-sat-status');
    if (!data) return;

    const r = data.scales.R;
    const g = data.scales.G;
    const kp = data.kpIndex;

    if (!hasSelectedLocation()) {
      if (hfBody) {
        hfBody.innerHTML = '<p class="comm-placeholder">Select a location to see HF propagation.</p>';
      }
      if (satBody) {
        satBody.innerHTML = '<p class="comm-placeholder">Select a location to see SATCOM weather guidance.</p>';
      }
      const gpsBody = $('#comm-gps-body');
      const gpsStatus = $('#comm-gps-status');
      if (gpsBody) gpsBody.innerHTML = '<p class="comm-placeholder">Select a location to see GPS/PNT conditions.</p>';
      if (gpsStatus) { gpsStatus.textContent = 'n/a'; gpsStatus.className = ''; }
      if (hfStatus) hfStatus.textContent = 'n/a';
      if (satStatus) satStatus.textContent = 'n/a';
      return;
    }

    const loc = selectedLocation.coords;
    const dayNight = getDayNightStatus(loc.lat, loc.lon);
    const muf = estimateMUF(loc.lat, loc.lon, data);
    const bands = getRecommendedBands(muf, dayNight);
    const nvis = getNvisAssessment(loc.lat, data);
    const hfAssessment = getHfAssessment(loc.lat, loc.lon, data);
    const dayTooltip = 'Today: ' + (dayNight.label || 'Current sun/geomagnetic state')
      + '. Adjusted for Kp ' + data.kpIndex.toFixed(1)
      + ' and solar R' + data.scales.R + ' background.';

    const hfSeverity = (r >= 4 || g >= 5) ? 'Severe disruption' :
      (r >= 3 || g >= 4 || kp >= 6) ? 'Degraded' :
        (r >= 2 || g >= 3 || kp >= 5) ? 'Fair' : 'Good';
    const hfInfo = getHfSeverityDetails(hfSeverity);

    const dayPhaseClass = dayNight.status === 'night' ? 'dayphase-night' : dayNight.status === 'greyline' ? 'dayphase-grey' : 'dayphase-day';
    const dayPhaseIcon = getDayPhaseIcon(dayNight.status);

    if (hfBody) {
      hfBody.innerHTML = [
        '<div class="muf-row compact">',
        '  <div class="muf-value-box tooltip-target" data-tooltip="' + escapeHtml(dayTooltip) + '">',
        '    <div class="muf-label">Est. MUF</div>',
        '    <div class="muf-value">' + escapeHtml(muf + ' MHz') + '</div>',
        '  </div>',
        '  <div class="muf-tag ' + hfInfo.className + ' ' + dayPhaseClass + '">' + dayPhaseIcon + '<span>' + escapeHtml(dayNight.label || '') + '</span></div>',
        '</div>',
        '<div class="muf-definition tooltip-target" data-tooltip="Maximum Usable Frequency (MUF) is the highest HF frequency likely to refract via the F-layer for this path and time.">MUF is the highest HF frequency likely to refract via the F-layer right now.</div>',
        '<div class="muf-desc-row">' + escapeHtml(hfAssessment) + '</div>',
        '<div class="comm-prop-row accent hf-band-block">',
        '  <div class="hf-band-header">Recommended Bands (VOACAP)</div>',
        '  <div class="comm-prop-chiprow tight">' + bands.map(b => '<span class="comm-prop-chip ' + bandQualityClass(b.quality) + '">' + escapeHtml(b.band) + '<span class="chip-sub">' + escapeHtml(b.freq) + '</span></span>').join('') + '</div>',
        '</div>',
        '<div class="comm-prop-row">',
        '  <span class="label">NVIS (0-400 km)</span>',
        '  <span class="hint">' + escapeHtml(nvis.recommended + ' — ' + nvis.quality) + '</span>',
        '</div>',
        '<div class="comm-card-micro comm-card-footer">Source: <a class="inline-link" href="https://www.swpc.noaa.gov/products/space-weather-scales" target="_blank" rel="noopener noreferrer">SWPC HF</a> • ' + escapeHtml(sourceText) + '</div>'
      ].join('');
    }

    if (hfStatus) {
      hfStatus.textContent = hfSeverity;
      hfStatus.className = 'status-pill ' + hfInfo.className;
    }

    const satRisk = kp >= 7 ? 'High scintillation risk' : kp >= 6 ? 'Moderate risk' : kp >= 5 ? 'Watch' : 'Nominal';
    const satInfo = getSatSeverityDetails(satRisk);
    const satAssessment = getSatcomAssessment(loc.lat, loc.lon, data);

    const weatherLine = lastWeather
      ? '<div class="satcom-weather"><div class="weather-icon">' + getWeatherGlyph(lastWeather.main) + '</div><div class="weather-meta"><div>' + escapeHtml(toTitleCase(lastWeather.desc || lastWeather.main || 'Weather')) + '</div><div class="weather-sub">' + (lastWeather.temp != null ? escapeHtml(formatTempDisplay(lastWeather.temp)) : '--') + (lastWeather.humidity != null ? ' • ' + escapeHtml(lastWeather.humidity + '% RH') : '') + '</div></div></div>'
      : '<div class="satcom-weather"><div class="weather-meta">Space weather driven assessment</div></div>';

    const bandOrder = ['aehf', 'ehf', 'ka', 'ku', 'x', 'c', 'uhf'];
    const bandTooltips = {
      aehf: 'AEHF protected EHF links for survivable comms.',
      ehf: '30-300 GHz: high capacity, heavy rain fade sensitivity.',
      ka: '26.5-40 GHz: broadband SATCOM, moderate rain fade risk.',
      ku: '12-18 GHz: commercial/mil GEO links, some rain attenuation.',
      x: '8-12 GHz: military hardened band with stable performance.',
      c: '4-8 GHz: resilient to weather, reliable GEO services.',
      uhf: '300-3000 MHz: MUOS/legacy narrowband, best foliage penetration.'
    };
    const bandRows = bandOrder.map(key => {
      const band = satAssessment[key];
      if (!band) return '';
      const tip = bandTooltips[key] || '';
      return '<div class="sat-band-row ' + satBandClass(band.status) + ' tooltip-target"' + (tip ? ' data-tooltip="' + escapeHtml(tip) + '"' : '') + '>' +
        '<div class="band-name">' + escapeHtml(key.toUpperCase()) + '</div>' +
        '<div class="band-freq">' + escapeHtml(band.freq || '') + '</div>' +
        '<div class="band-label">' + escapeHtml(band.label || '') + '</div>' +
        '<div class="band-notes">' + escapeHtml(band.notes || '') + '</div>' +
      '</div>';
    }).join('');

    if (satBody) {
      satBody.innerHTML = [
        weatherLine,
        '<div class="comm-prop-status ' + satInfo.className + '">',
        '  <div class="status-heading">',
        '    <span class="status-label">Overall</span>',
        '    <span class="status-value">' + escapeHtml(satRisk) + '</span>',
        '  </div>',
        '  <p class="status-desc">' + escapeHtml(satInfo.desc) + '</p>',
        '</div>',
        '<div class="sat-band-heading">Band Status &amp; Remarks</div>',
        '<div class="sat-band-grid">' + bandRows + '</div>',
        '<div class="comm-card-micro comm-card-footer">Source: <a class="inline-link" href="https://www.swpc.noaa.gov/products/goes-energetic-particle" target="_blank" rel="noopener noreferrer">SWPC</a> · <a class="inline-link" href="https://gpsjam.org" target="_blank" rel="noopener noreferrer">GPSJam Map</a> · <a class="inline-link" href="https://www.flightradar24.com/blog/gnss-interference-dashboard/" target="_blank" rel="noopener noreferrer">FR24 Interference</a> · <a class="inline-link" href="https://www.navcen.uscg.gov/" target="_blank" rel="noopener noreferrer">NAVCEN GUIDE</a> • ' + escapeHtml(sourceText) + '</div>'
      ].join('');
    }

    if (satStatus) {
      satStatus.textContent = satRisk;
      satStatus.className = 'status-pill ' + satInfo.className;
    }

    const gpsBody = $('#comm-gps-body');
    const gpsStatus = $('#comm-gps-status');
    renderGpsCard(satAssessment, sourceText, gpsBody, gpsStatus, kp);

    queueLayout();
  }

  // ---------- Init ----------

  function initLocationCard() {
    const card = $('#comm-card-location');
    if (!card) return;

    loadRecent();
    renderRecentList();
    renderLocationInputArea();
    updateLocationStatus();

    const clearBtn = $('#comm-clear-recents');
    if (clearBtn) {
      clearBtn.addEventListener('click', clearRecent);
    }

    // Tabs
    const tabs = card.querySelectorAll('.location-mode-tab');
    tabs.forEach(btn => {
      btn.addEventListener('click', () => {
        setLocationMode(btn.dataset.mode);
      });
    });

    const persisted = loadSelectedLocation();
    if (persisted && persisted.coords) {
      applyLocation(persisted);
    }
  }

  function initSpaceWeatherCard() {
    updateSpaceWeatherCard();
    if (Events && Events.on) {
      Events.on('spaceweather:data-updated', updateSpaceWeatherCard);
    }
  }

  async function exportPptx() {
    if (!window.PptxGenJS || !window.html2canvas) {
      alert('Export libraries not loaded.');
      return;
    }

    const cards = Array.from(document.querySelectorAll('#comm-planner-view .comm-card'))
      .filter(card => !card.classList.contains('comm-hidden'));
    if (!cards.length) return;

    const pptx = new PptxGenJS();
    pptx.layout = '16x9';
    const slideMargin = 0.3;
    const colWidth = 4.4;
    const rowHeight = 2.7;
    let slide = pptx.addSlide();
    let x = slideMargin;
    let y = slideMargin;

    for (const card of cards) {
      try {
        const canvas = await window.html2canvas(card, { backgroundColor: '#0b0b0d', scale: 2, logging: false });
        const data = canvas.toDataURL('image/png');
        slide.addImage({ data, x, y, w: colWidth });
        x += colWidth + 0.25;
        if (x + colWidth > 10) {
          x = slideMargin;
          y += rowHeight;
        }
        if (y + rowHeight > 7) {
          slide = pptx.addSlide();
          x = slideMargin;
          y = slideMargin;
        }
      } catch (e) {
        console.warn('[CommPlanner] PPTX export skipped card', e);
      }
    }

    await pptx.writeFile({ fileName: 'comm-dashboard.pptx' });
  }

  function init() {
    if (!document.querySelector('.comm-layout-grid')) return;
    initPanelToggles();
    initLocationCard();
    initSpaceWeatherCard();
    const exportBtn = document.getElementById('comm-export-pptx');
    if (exportBtn) exportBtn.addEventListener('click', exportPptx);
    initResizeObserver();
    queueLayout();
    window.addEventListener('resize', queueLayout);
    window.addEventListener('load', queueLayout);
    console.log('[CommPlanner] Dashboard initialized');
  }

  window.RussellTV.CommPlanner = {
    getLastWeather: () => lastWeather,
    getSelectedLocation: () => selectedLocation,
    getDeclination: () => currentDeclination,
    queueLayout
  };

  document.addEventListener('DOMContentLoaded', init);

  function metricHtml(label, value, hint, icon) {
    return '<div class="comm-weather-metric">' +
      '<span class="icon">' + (icon || '') + '</span>' +
      '<div class="metric-text">' +
      '  <span class="label">' + escapeHtml(label) + '</span>' +
      '  <span class="value">' + escapeHtml(value) + '</span>' +
      (hint ? '  <span class="hint">' + escapeHtml(hint) + '</span>' : '') +
      '</div>' +
      '</div>';
  }

  function getWeatherMetricIcon(label) {
    const l = (label || '').toLowerCase();
    if (l.includes('humidity')) {
      return '<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="humGradient" x1="0" x2="1" y1="0" y2="1"><stop offset="0%" stop-color="#6bd9ff"/><stop offset="60%" stop-color="#2ac6ff"/><stop offset="100%" stop-color="#0fa3b1"/></linearGradient></defs><path d="M12 3s-5.5 6.1-5.5 10A5.5 5.5 0 0 0 12 18.5 5.5 5.5 0 0 0 17.5 13C17.5 9.1 12 3 12 3Z" fill="url(#humGradient)" stroke="#a7f0ff" stroke-width="0.6"/><path d="M8.2 13.4c-.4 1.6.9 3.4 2.7 3.4 1.7 0 3-1.6 2.6-3.2" stroke="#e8ffff" stroke-width="0.7" stroke-linecap="round"/><circle cx="9.3" cy="11.9" r="0.9" fill="#dff8ff"/><circle cx="14" cy="14.6" r="1.05" fill="#c7f3ff"/><circle cx="11.1" cy="16.5" r="0.7" fill="#b9ecff"/></svg>';
    }
    if (l.includes('pressure')) {
      return '<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="8" stroke="#ffc46b" stroke-width="1.7" fill="rgba(255,200,120,0.12)"/><path d="M12 6v6l3 2" stroke="#ffdba3" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    }
    if (l.includes('wind')) {
      return '<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M4 9.5h10a2.2 2.2 0 1 0-2.2-2.2" stroke="#7fd3ff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M3.5 14h11a2.7 2.7 0 1 1-2.7 2.7" stroke="#ffe27a" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    }
    if (l.includes('visibility')) {
      return '<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M3 12s3.6-5.2 9-5.2S21 12 21 12s-3.6 5.2-9 5.2S3 12 3 12Z" fill="rgba(255,255,255,0.08)" stroke="#b8f0ff" stroke-width="1.5"/><circle cx="12" cy="12" r="2.6" fill="#12202d" stroke="#7fd3ff" stroke-width="1.4"/></svg>';
    }
    if (l.includes('sunrise')) {
      return '<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M5 15h14" stroke="#ffb347" stroke-width="1.8" stroke-linecap="round"/><path d="M7 15a5 5 0 0 1 10 0" stroke="#ffe5a3" stroke-width="1.6"/><path d="m12 6 0-3" stroke="#ffd580" stroke-width="1.6" stroke-linecap="round"/><path d="m5.5 8 2 2M18.5 8l-2 2" stroke="#ffc066" stroke-width="1.6" stroke-linecap="round"/></svg>';
    }
    if (l.includes('sunset')) {
      return '<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M5 15h14" stroke="#ff7b54" stroke-width="1.8" stroke-linecap="round"/><path d="M7 15a5 5 0 0 1 10 0" stroke="#ffd4a3" stroke-width="1.6"/><path d="m12 3 0 3" stroke="#ff9f68" stroke-width="1.6" stroke-linecap="round"/><path d="m5.5 10 2-2M18.5 10l-2-2" stroke="#ffb487" stroke-width="1.6" stroke-linecap="round"/></svg>';
    }
    if (l.includes('date')) {
      return '<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="6" width="16" height="14" rx="2.5" fill="rgba(255,200,160,0.12)" stroke="#ffd6a3" stroke-width="1.6"/><path d="M4 10h16" stroke="#ffc285" stroke-width="1.6"/><path d="M8 4v4M16 4v4" stroke="#ffd6a3" stroke-width="1.8" stroke-linecap="round"/></svg>';
    }
    if (l.includes('time')) {
      return '<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="8" stroke="#ffd9a0" stroke-width="1.6" fill="rgba(255,200,120,0.08)"/><path d="M12 8v4l2.5 1.5" stroke="#ffe9c7" stroke-width="1.6" stroke-linecap="round"/></svg>';
    }
    return '<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M4 12h16" stroke="#ffcba4" stroke-width="1.6" stroke-linecap="round"/></svg>';
  }

  function parseIsoToEpoch(isoString) {
    if (!isoString) return null;
    const ts = Date.parse(isoString);
    return Number.isFinite(ts) ? Math.round(ts / 1000) : null;
  }

  function formatIsoLocalClock(isoString) {
    if (!isoString) return '';
    const d = new Date(isoString);
    const opts = { hour: '2-digit', minute: '2-digit', hour12: false };
    return d.toLocaleTimeString(undefined, opts).replace(/:/g, '') + 'L';
  }

  function formatLocalTime(epochSeconds, offsetSeconds, includeDate) {
    if (!epochSeconds && epochSeconds !== 0) return '';
    const tzOffset = offsetSeconds || 0;
    const date = new Date((epochSeconds + tzOffset) * 1000);
    const opts = { hour: '2-digit', minute: '2-digit', hour12: false };
    const time = date.toLocaleTimeString(undefined, opts).replace(/:/g, '');
    if (!includeDate) return time + 'L';
    const month = date.toLocaleDateString(undefined, { month: 'short' });
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear().toString().slice(-2);
    return `${time}L ${day} ${month} ${year}`;
  }

  function formatLocalClock(epochSeconds, offsetSeconds, includeSeconds) {
    if (!epochSeconds && epochSeconds !== 0) return '';
    const tzOffset = offsetSeconds || 0;
    const date = new Date((epochSeconds + tzOffset) * 1000);
    const opts = { hour: '2-digit', minute: '2-digit', hour12: false };
    if (includeSeconds) opts.second = '2-digit';
    return date.toLocaleTimeString(undefined, opts).replace(/:/g, '');
  }

  function formatUtcClock(includeSeconds) {
    const now = new Date();
    const opts = { hour: '2-digit', minute: '2-digit', hour12: false };
    if (includeSeconds) opts.second = '2-digit';
    return now.toLocaleTimeString('en-GB', opts).replace(/:/g, '');
  }

  function formatLocalDate(epochSeconds, offsetSeconds) {
    if (!epochSeconds && epochSeconds !== 0) return '';
    const tzOffset = offsetSeconds || 0;
    const date = new Date((epochSeconds + tzOffset) * 1000);
    const month = date.toLocaleDateString(undefined, { month: 'short' });
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear().toString().slice(-2);
    return `${day} ${month} ${year}`;
  }

  function convertTempToUnit(tempF) {
    if (tempF === null || tempF === undefined || isNaN(tempF)) return null;
    return tempUnit === 'C' ? ((tempF - 32) * 5) / 9 : tempF;
  }

  function firstNumber(arr) {
    if (!Array.isArray(arr) || !arr.length) return null;
    const val = Number(arr[0]);
    return Number.isFinite(val) ? val : null;
  }

  function formatTempDisplay(tempF) {
    const v = convertTempToUnit(tempF);
    return v === null ? '--' : `${Math.round(v)}°${tempUnit}`;
  }

  function formatUserClock(dateVal, includeSeconds) {
    const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
    const opts = { hour: '2-digit', minute: '2-digit', hour12: false };
    if (includeSeconds) opts.second = '2-digit';
    return d.toLocaleTimeString(undefined, opts).replace(/:/g, '');
  }

  function formatUserStamp(dateVal) {
    if (!dateVal && dateVal !== 0) return '';
    const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
    const time = formatUserClock(d, false);
    const day = String(d.getDate()).padStart(2, '0');
    const month = d.toLocaleDateString(undefined, { month: 'short' });
    const year = d.getFullYear().toString().slice(-2);
    return `${time} ${day} ${month} ${year}`;
  }

  function formatUtcStamp(dateVal) {
    if (!dateVal && dateVal !== 0) return '';
    const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
    const opts = { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hour12: false };
    const time = d.toLocaleTimeString('en-GB', opts).replace(/:/g, '');
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = d.toLocaleDateString('en-GB', { timeZone: 'UTC', month: 'short' });
    const year = d.getUTCFullYear().toString().slice(-2);
    return `${time} ${day} ${month} ${year}`;
  }

  function tempToAccent(tempF) {
    if (tempF === null || tempF === undefined || isNaN(tempF)) return '';
    const clamped = Math.max(-10, Math.min(110, tempF));
    const norm = (clamped + 10) / 120; // 0..1
    const hue = 210 - (norm * 190); // blue to warm
    return `hsl(${hue}deg 90% 60%)`;
  }

  function colorMixWithTransparency(color, alpha) {
    return color.replace('hsl', 'hsla').replace(')', ` / ${alpha})`);
  }

  function degreesToCardinal(deg) {
    if (deg === null || deg === undefined || isNaN(deg)) return '';
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const idx = Math.round(deg / 45) % 8;
    return dirs[idx];
  }

  function formatBearingWithMag(bearing) {
    if (bearing === null || bearing === undefined || isNaN(bearing)) return '—';
    const trueDeg = ((bearing % 360) + 360) % 360;
    if (!isFinite(currentDeclination)) return Math.round(trueDeg) + '°T';
    const mag = ((trueDeg - currentDeclination) % 360 + 360) % 360;
    return Math.round(trueDeg) + '°T / ' + Math.round(mag) + '°M';
  }

  function getWeatherGlyph(main) {
    const m = (main || '').toLowerCase();
    let icon = 'wind';

    if (m.includes('thunder')) icon = 'storm';
    else if (m.includes('rain') || m.includes('drizzle')) icon = 'rain';
    else if (m.includes('snow')) icon = 'snow';
    else if (m.includes('cloud')) icon = 'cloudy';
    else if (m.includes('mist') || m.includes('fog') || m.includes('haze')) icon = 'fog';
    else if (m.includes('clear')) icon = 'sunny';

    const alt = (main || 'Weather') + ' icon';
    return '<img class="weather-icon-img weather-' + icon + '" src="/icons/weather/' + icon + '.svg" alt="' + escapeHtml(alt) + '" loading="lazy" />';
  }

  function weatherCodeToMain(code) {
    const c = Number(code);
    if ([71, 73, 75, 77, 85, 86].includes(c)) return 'snow';
    if ([51, 53, 55, 56, 57].includes(c)) return 'drizzle';
    if ([61, 63, 65, 80, 81, 82].includes(c)) return 'rain';
    if ([45, 48].includes(c)) return 'fog';
    if ([95, 96, 99].includes(c)) return 'thunderstorm';
    if (c === 0) return 'clear';
    if ([1, 2, 3].includes(c)) return 'clouds';
    return 'clouds';
  }

  function buildForecastHtml(forecast) {
    if (!forecast || !forecast.daily || !forecast.daily.time) return '';
    const days = forecast.daily.time;
    const highs = forecast.daily.temperature_2m_max || [];
    const lows = forecast.daily.temperature_2m_min || [];
    const codes = forecast.daily.weathercode || [];
    const pop = forecast.daily.precipitation_probability_max || [];
    const winds = forecast.daily.windspeed_10m_max || [];

    const items = days.slice(0, 9).map((dateStr, idx) => {
      const dt = new Date(dateStr);
      const label = dt.toLocaleDateString(undefined, { weekday: 'short' });
      const main = weatherCodeToMain(codes[idx]);
      const icon = getWeatherGlyph(main);
      const high = highs[idx] != null ? formatTempDisplay(highs[idx]) : '—';
      const low = lows[idx] != null ? formatTempDisplay(lows[idx]) : '—';
      const popLabel = pop[idx] != null ? pop[idx] + '% rain' : '';
      const windLabel = winds[idx] != null ? Math.round(winds[idx]) + ' mph wind' : '';
      const detail = [popLabel, windLabel].filter(Boolean).join(' · ');

      return '<div class="forecast-card">'
        + '  <div class="forecast-day">' + escapeHtml(label) + '</div>'
        + '  <div class="forecast-icon">' + icon + '</div>'
        + '  <div class="forecast-temps"><span>' + escapeHtml(high) + '</span><span>' + escapeHtml(low) + '</span></div>'
        + (detail ? '  <div class="forecast-detail">' + escapeHtml(detail) + '</div>' : '')
        + '</div>';
    }).join('');

    if (!items) return '';
    return '<div class="weather-forecast"><div class="forecast-head">9-Day Outlook</div><div class="forecast-row">' + items + '</div></div>';
  }

  function clampZoom(z) {
    const zoomNum = Number.isFinite(z) ? Math.round(z) : radarZoom;
    return Math.min(Math.max(zoomNum || 6, RADAR_ZOOM_MIN), RADAR_ZOOM_MAX);
  }

  let radarId = 0;

  function getRadarTileTemplate(layer) {
    const layerKey = layer === 'clouds' ? 'clouds_new' : 'precipitation_new';
    if (RADAR_PROXY_BASE) {
      if (RADAR_PROXY_BASE.includes('{layer}')) return RADAR_PROXY_BASE.replace('{layer}', layerKey);
      if (layer === 'clouds' && RADAR_PROXY_BASE.includes('{z}') && (window.OPENWEATHER_TILE_KEY || window.OPENWEATHER_API_KEY)) {
        const key = window.OPENWEATHER_TILE_KEY || window.OPENWEATHER_API_KEY;
        return `https://tile.openweathermap.org/map/${layerKey}/{z}/{x}/{y}.png?appid=${key}`;
      }
      return RADAR_PROXY_BASE;
    }
    if (window.OPENWEATHER_TILE_KEY || window.OPENWEATHER_API_KEY) {
      const key = window.OPENWEATHER_TILE_KEY || window.OPENWEATHER_API_KEY;
      return `https://tile.openweathermap.org/map/${layerKey}/{z}/{x}/{y}.png?appid=${key}`;
    }
    return '';
  }

  function buildRadarBlock(lat, lon) {
    if (lat == null || lon == null) return '';
    const radarMapId = 'radar-map-' + (++radarId);
    return [
      '<div class="weather-radar">',
      '  <div class="weather-radar-head">Local Radar<div class="radar-layer-toggle"><button type="button" class="radar-layer-btn active" data-layer="radar">Precip</button><button type="button" class="radar-layer-btn" data-layer="clouds">Clouds</button></div></div>',
      '  <div class="weather-radar-frame" data-lat="' + escapeHtml(lat) + '" data-lon="' + escapeHtml(lon) + '" data-zoom="' + radarZoom + '" data-layer="' + radarLayer + '">',
      '    <div class="radar-leaflet" id="' + radarMapId + '"></div>',
      '    <div class="radar-overlay"></div>',
      '    <div class="radar-caption"><span class="dot"></span><span>Live sweep</span></div>',
      '    <div class="radar-zoom-controls">',
      '      <button type="button" class="radar-zoom-btn" data-direction="out" aria-label="Zoom out">−</button>',
      '      <button type="button" class="radar-zoom-btn" data-direction="in" aria-label="Zoom in">+</button>',
      '    </div>',
      '    <div class="radar-fallback">Radar preview unavailable — ensure the /wx-tiles proxy or OpenWeather tiles are reachable.</div>',
      '  </div>',
      '  <div class="radar-play-row"><button type="button" class="radar-play-btn" aria-pressed="false">▶ Play</button></div>',
      '</div>'
    ].join('');
  }

  function wireRadarFrame(container) {
    if (!container || typeof L === 'undefined') return;
    const mapEl = container.querySelector('.radar-leaflet');
    if (!mapEl) return;

    if (radarPlayTimer) {
      clearInterval(radarPlayTimer);
      radarPlayTimer = null;
    }

    const lat = Number(container.dataset.lat);
    const lon = Number(container.dataset.lon);
    const fallback = selectedLocation?.coords || lastWeatherCoords || { lat: 38.9, lon: -77.0 };
    const viewLat = Number.isFinite(lat) ? lat : fallback.lat;
    const viewLon = Number.isFinite(lon) ? lon : fallback.lon;
    const layerButtons = container.parentElement?.querySelectorAll('.radar-layer-btn');

    const map = L.map(mapEl, { zoomControl: false, attributionControl: false, scrollWheelZoom: true });
    const base = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      minZoom: RADAR_ZOOM_MIN,
      maxZoom: RADAR_ZOOM_MAX,
      crossOrigin: true
    });
    base.addTo(map);

    let overlay = null;
    let overlayTemplate = null;

    function setLayer(layerName) {
      if (overlay) overlay.remove();
      const tpl = getRadarTileTemplate(layerName);
      overlayTemplate = tpl;
      if (!tpl) return;
      overlay = L.tileLayer(tpl, { opacity: 0.68, crossOrigin: true, tileSize: 256, maxZoom: RADAR_ZOOM_MAX, maxNativeZoom: RADAR_ZOOM_MAX });
      overlay.addTo(map);
      container.dataset.layer = layerName;
      radarLayer = layerName;
    }

    function refreshOverlaySource() {
      if (!overlay || !overlayTemplate) return;
      const bust = (overlayTemplate.includes('?') ? '&' : '?') + 't=' + Date.now();
      const nextUrl = overlayTemplate + bust;
      overlay.setUrl(nextUrl);
    }

    function refreshZoom(next) {
      const z = clampZoom(next ?? map.getZoom());
      map.setZoom(z);
      container.dataset.zoom = String(z);
      radarZoom = z;
    }

    map.setView([viewLat, viewLon], clampZoom(Number(container.dataset.zoom) || radarZoom));
    setLayer(container.dataset.layer || radarLayer);

    map.whenReady(() => {
      map.invalidateSize();
      queueLayout();
    });

    map.on('moveend zoomend', () => queueLayout());

    container.addEventListener('wheel', (ev) => {
      ev.preventDefault();
      const delta = ev.deltaY > 0 ? -1 : 1;
      refreshZoom((map.getZoom() || radarZoom) + delta);
    });

    container.querySelectorAll('.radar-zoom-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const dir = btn.dataset.direction === 'in' ? 1 : -1;
        refreshZoom((map.getZoom() || radarZoom) + dir);
      });
    });

    if (layerButtons) {
      layerButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          layerButtons.forEach(b => b.classList.toggle('active', b === btn));
          setLayer(btn.dataset.layer);
        });
      });
    }

    const playBtn = container.parentElement?.querySelector('.radar-play-btn');
    if (playBtn) {
      playBtn.addEventListener('click', () => {
        const playing = playBtn.getAttribute('aria-pressed') === 'true';
        if (playing) {
          playBtn.textContent = '▶ Play';
          playBtn.setAttribute('aria-pressed', 'false');
          if (radarPlayTimer) { clearInterval(radarPlayTimer); radarPlayTimer = null; }
        } else {
          playBtn.textContent = '⏸ Pause';
          playBtn.setAttribute('aria-pressed', 'true');
          refreshOverlaySource();
          radarPlayTimer = setInterval(refreshOverlaySource, 8000);
        }
      });
    }
  }

  function loadPanelState() {
    try {
      const raw = localStorage.getItem(PANEL_STATE_KEY);
      if (!raw) return {};
      return JSON.parse(raw) || {};
    } catch (e) {
      return {};
    }
  }

  function savePanelState(state) {
    try { localStorage.setItem(PANEL_STATE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }

  function initPanelToggles() {
    const bar = $('#comm-panel-toggle-bar');
    if (!bar) return;
    const state = PANEL_IDS.reduce((acc, id) => {
      const card = document.getElementById(id);
      acc[id] = card ? !card.classList.contains('comm-hidden') : true;
      return acc;
    }, {});
    const saved = loadPanelState();
    Object.assign(state, saved);

    function apply() {
      PANEL_IDS.forEach(id => {
        const on = state[id] !== false;
        const card = document.getElementById(id);
        const btn = bar.querySelector('[data-target="' + id + '"]');
        if (card) card.classList.toggle('comm-hidden', !on);
        if (btn) btn.classList.toggle('active', on);
      });
      queueLayout();
      savePanelState(state);
    }

    bar.querySelectorAll('.panel-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.target;
        if (!id) return;
        state[id] = !(state[id] !== false);
        apply();
      });
    });

    apply();
  }

  function getWeatherSeverityClass(main, humidity) {
    const m = (main || '').toLowerCase();
    if (m.includes('thunder') || m.includes('storm')) return 'severity-poor';
    if (m.includes('rain') || m.includes('snow') || (humidity || 0) >= 85) return 'severity-watch';
    if (m.includes('cloud')) return 'severity-fair';
    return 'severity-good';
  }

})();
