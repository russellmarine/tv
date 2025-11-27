/**
 * satellite-lookangles.js - Satellite Look Angles Tool
 * 
 * Features:
 * - Location autocomplete with state/country detail
 * - MGRS, Lat/Long, and Maidenhead coordinate support
 * - True azimuth with magnetic declination note
 * - Filter to show only good look angles (>5° elevation)
 * - Loading spinner during data fetch
 * - Weather impact assessment
 * - Starlink coverage warnings
 * - 24-hour localStorage caching
 * 
 * Requires: N2YO API proxy at /api/n2yo
 */

(function() {
  'use strict';

  const Events = window.RussellTV?.Events;
  if (!Events) {
    console.warn('[SatLookAngles] RussellTV.Events not found');
    return;
  }

  // ============ CONFIGURATION ============

  const API_PROXY = '/api/n2yo';
  const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
  const MIN_ELEVATION_FILTER = 5;

  const SATELLITES = {
    // === MILITARY SATCOM ===
    wgs: {
      name: 'WGS (Wideband Global)',
      band: 'X/Ka',
      type: 'milsatcom',
      satellites: [
        { id: 32258, name: 'WGS-1' },
        { id: 33055, name: 'WGS-2' },
        { id: 34713, name: 'WGS-3' },
        { id: 38070, name: 'WGS-4' },
        { id: 39168, name: 'WGS-5' },
        { id: 39222, name: 'WGS-6' },
        { id: 40746, name: 'WGS-7' },
        { id: 41879, name: 'WGS-8' },
        { id: 42075, name: 'WGS-9' },
        { id: 44071, name: 'WGS-10' },
        { id: 53937, name: 'WGS-11' }
      ]
    },
    aehf: {
      name: 'AEHF (Protected)',
      band: 'EHF',
      type: 'milsatcom',
      satellites: [
        { id: 36868, name: 'AEHF-1' },
        { id: 38254, name: 'AEHF-2' },
        { id: 39256, name: 'AEHF-3' },
        { id: 43651, name: 'AEHF-4' },
        { id: 45193, name: 'AEHF-5' },
        { id: 46757, name: 'AEHF-6' }
      ]
    },
    muos: {
      name: 'MUOS (Narrowband)',
      band: 'UHF',
      type: 'milsatcom',
      satellites: [
        { id: 38093, name: 'MUOS-1' },
        { id: 39206, name: 'MUOS-2' },
        { id: 40374, name: 'MUOS-3' },
        { id: 40887, name: 'MUOS-4' },
        { id: 41622, name: 'MUOS-5' }
      ]
    },

    // === COMMERCIAL - GLOBAL COVERAGE ===
    intelsat: {
      name: 'Intelsat',
      band: 'C/Ku',
      type: 'commercial',
      satellites: [
        { id: 28358, name: 'IS 10-02' },
        { id: 38740, name: 'IS 20' },
        { id: 38098, name: 'IS 22' },
        { id: 42950, name: 'IS 37e' },
        { id: 40874, name: 'IS 34' },
        { id: 39476, name: 'IS 30' },
        { id: 42741, name: 'IS 35e' },
        { id: 40982, name: 'IS 36' },
        { id: 43823, name: 'IS 38' },
        { id: 44476, name: 'IS 39' }
      ]
    },
    eutelsat: {
      name: 'Eutelsat',
      band: 'Ku/Ka',
      type: 'commercial',
      satellites: [
        { id: 40875, name: 'E 8WB' },
        { id: 39163, name: 'E 7B' },
        { id: 37836, name: 'E 16A' },
        { id: 38652, name: 'E 25B' },
        { id: 35953, name: 'E 36B' },
        { id: 40272, name: 'E 9B' },
        { id: 42432, name: 'E 172B' },
        { id: 45026, name: 'E 7C' },
        { id: 44334, name: 'E KONNECT' }
      ]
    },
    ses: {
      name: 'SES/Astra',
      band: 'C/Ku/Ka',
      type: 'commercial',
      satellites: [
        { id: 26958, name: 'Astra 2C' },
        { id: 36831, name: 'Astra 1N' },
        { id: 38778, name: 'Astra 2E' },
        { id: 40364, name: 'Astra 2G' },
        { id: 37775, name: 'SES-4' },
        { id: 40946, name: 'SES-9' },
        { id: 41382, name: 'SES-10' },
        { id: 43157, name: 'SES-14' },
        { id: 44334, name: 'SES-17' },
        { id: 41903, name: 'SES-15' }
      ]
    },
    telesat: {
      name: 'Telesat',
      band: 'C/Ku',
      type: 'commercial',
      satellites: [
        { id: 42951, name: 'Telstar 19V' },
        { id: 43562, name: 'Telstar 18V' },
        { id: 26824, name: 'Telstar 11N' },
        { id: 37602, name: 'Telstar 14R' }
      ]
    },
    mena: {
      name: 'MENA Regional',
      band: 'C/Ku/Ka',
      type: 'commercial',
      satellites: [
        { id: 37816, name: 'Yamal 402' },
        { id: 40733, name: 'Turksat 4B' },
        { id: 39020, name: 'Yahsat 1B' },
        { id: 41036, name: 'Yahsat 1C' },
        { id: 37777, name: 'Arabsat 5C' },
        { id: 40878, name: 'Arabsat 6B' },
        { id: 43039, name: 'Al Yah 3' },
        { id: 44333, name: 'Amos 17' },
        { id: 41028, name: 'Amos 5' }
      ]
    },
    asia: {
      name: 'Asia-Pacific',
      band: 'C/Ku',
      type: 'commercial',
      satellites: [
        { id: 42934, name: 'AsiaSat 9' },
        { id: 40424, name: 'ABS-3A' },
        { id: 41589, name: 'ABS-2A' },
        { id: 37933, name: 'Apstar 7' },
        { id: 43875, name: 'Apstar 5C' },
        { id: 40425, name: 'JCSAT-14' },
        { id: 41729, name: 'JCSAT-16' },
        { id: 40271, name: 'Thaicom 6' },
        { id: 39500, name: 'Thaicom 7' }
      ]
    }
  };

  const STARLINK_RESTRICTED = {
    regions: [
      { name: 'China', bounds: [18, 54, 73, 135] },
      { name: 'Russia', bounds: [41, 82, 19, 180] },
      { name: 'Iran', bounds: [25, 40, 44, 64] },
      { name: 'North Korea', bounds: [37, 43, 124, 131] },
      { name: 'Syria', bounds: [32, 37, 35, 42] },
      { name: 'Afghanistan', bounds: [29, 38, 60, 75] },
      { name: 'Belarus', bounds: [51, 56, 23, 33] }
    ]
  };

  // ============ STATE ============

  let currentLocation = null;
  let currentWeather = null;
  let satelliteData = {};
  let lastFetch = null;
  let isExpanded = false;
  let isLoading = false;
  let selectedConstellations = ['wgs', 'aehf', 'muos', 'intelsat'];
  let autocompleteResults = [];
  let autocompleteTimeout = null;
  let showOnlyGoodAngles = true;

  // ============ MGRS CONVERSION ============

  const MGRS_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const UTM_ZONES_LAT = 'CDEFGHJKLMNPQRSTUVWX';

  function mgrsToLatLon(mgrs) {
    mgrs = mgrs.replace(/\s/g, '').toUpperCase();
    const match = mgrs.match(/^(\d{1,2})([C-X])([A-Z]{2})(\d+)$/);
    if (!match) throw new Error('Invalid MGRS format. Example: 33TWN8412520648');

    const zone = parseInt(match[1]);
    const latBand = match[2];
    const gridLetters = match[3];
    const coords = match[4];

    if (zone < 1 || zone > 60) throw new Error('Invalid UTM zone (must be 1-60)');

    const len = coords.length;
    if (len % 2 !== 0 || len < 2 || len > 10) throw new Error('Invalid MGRS coordinates length');

    const half = len / 2;
    const precision = Math.pow(10, 5 - half);
    let easting = parseInt(coords.substring(0, half)) * precision;
    let northing = parseInt(coords.substring(half)) * precision;

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

  function utmToLatLon(zone, isSouthern, easting, northing) {
    const a = 6378137, f = 1 / 298.257223563, k0 = 0.9996;
    const e = Math.sqrt(2 * f - f * f), e2 = e * e;
    const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));

    const x = easting - 500000;
    const y = isSouthern ? northing - 10000000 : northing;
    const M = y / k0;
    const mu = M / (a * (1 - e2/4 - 3*e2*e2/64 - 5*e2*e2*e2/256));

    const phi1 = mu + (3*e1/2 - 27*e1*e1*e1/32) * Math.sin(2*mu)
                    + (21*e1*e1/16 - 55*e1*e1*e1*e1/32) * Math.sin(4*mu)
                    + (151*e1*e1*e1/96) * Math.sin(6*mu);

    const N1 = a / Math.sqrt(1 - e2 * Math.sin(phi1) * Math.sin(phi1));
    const T1 = Math.tan(phi1) * Math.tan(phi1);
    const C1 = (e2 / (1 - e2)) * Math.cos(phi1) * Math.cos(phi1);
    const R1 = a * (1 - e2) / Math.pow(1 - e2 * Math.sin(phi1) * Math.sin(phi1), 1.5);
    const D = x / (N1 * k0);

    let lat = phi1 - (N1 * Math.tan(phi1) / R1) * (
      D*D/2 - (5 + 3*T1 + 10*C1 - 4*C1*C1 - 9*(e2/(1-e2))) * D*D*D*D/24
      + (61 + 90*T1 + 298*C1 + 45*T1*T1 - 252*(e2/(1-e2)) - 3*C1*C1) * D*D*D*D*D*D/720
    );

    let lon = (D - (1 + 2*T1 + C1) * D*D*D/6
              + (5 - 2*C1 + 28*T1 - 3*C1*C1 + 8*(e2/(1-e2)) + 24*T1*T1) * D*D*D*D*D/120)
              / Math.cos(phi1);

    const lon0 = (zone - 1) * 6 - 180 + 3;
    return { lat: lat * 180 / Math.PI, lon: lon0 + lon * 180 / Math.PI };
  }

  // ============ GEOCODING / AUTOCOMPLETE ============

  async function searchLocation(query) {
    if (!query || query.length < 3) { autocompleteResults = []; return []; }

    try {
      const url = `${NOMINATIM_URL}?q=${encodeURIComponent(query)}&format=json&limit=6&addressdetails=1`;
      const response = await fetch(url, { headers: { 'User-Agent': 'RussellTV-SatLookAngles/1.0' } });
      if (!response.ok) throw new Error('Geocoding failed');

      const results = await response.json();
      autocompleteResults = results.map(r => {
        const addr = r.address || {};
        const city = r.name || addr.city || addr.town || addr.village || '';
        const state = addr.state || addr.county || addr.region || '';
        const country = addr.country || '';
        const postcode = addr.postcode || '';

        let detail = '';
        if (state) detail += state;
        if (postcode) detail += (detail ? ', ' : '') + postcode;
        if (country && country !== state) detail += (detail ? ', ' : '') + country;

        return { name: r.display_name, shortName: city || r.display_name.split(',')[0], detail, lat: parseFloat(r.lat), lon: parseFloat(r.lon), country };
      });
      return autocompleteResults;
    } catch (error) {
      console.error('[SatLookAngles] Geocoding error:', error);
      autocompleteResults = [];
      return [];
    }
  }

  function handleAutocompleteInput(value) {
    if (autocompleteTimeout) clearTimeout(autocompleteTimeout);
    autocompleteTimeout = setTimeout(async () => {
      await searchLocation(value);
      renderAutocompleteDropdown();
    }, 300);
  }

  function renderAutocompleteDropdown() {
    const dropdown = document.getElementById('satla-autocomplete');
    if (!dropdown) return;
    if (autocompleteResults.length === 0) { dropdown.style.display = 'none'; return; }

    const sanitize = window.RussellTV?.sanitize || (s => s);
    dropdown.innerHTML = autocompleteResults.map((r, i) => `
      <div class="autocomplete-item" onmousedown="event.preventDefault(); window.RussellTV.SatLookAngles.selectAutocomplete(${i})">
        <span class="autocomplete-name">${sanitize(r.shortName)}</span>
        <span class="autocomplete-detail">${sanitize(r.detail)}</span>
      </div>
    `).join('');
    dropdown.style.display = 'block';
  }

  function selectAutocomplete(index) {
    const result = autocompleteResults[index];
    if (!result) return;

    currentLocation = {
      lat: result.lat, lon: result.lon,
      name: result.shortName + (result.detail ? `, ${result.detail.split(',')[0]}` : ''),
      fullName: result.name, source: 'search'
    };

    const input = document.getElementById('satla-location-input');
    if (input) input.value = currentLocation.name;

    autocompleteResults = [];
    const dropdown = document.getElementById('satla-autocomplete');
    if (dropdown) dropdown.style.display = 'none';

    fetchWeatherForLocation(currentLocation.lat, currentLocation.lon);
    fetchAllSatellites();
  }

  // ============ WEATHER FETCHING ============

  async function fetchWeatherForLocation(lat, lon) {
    try {
      const response = await fetch(`/weather?lat=${lat}&lon=${lon}`);
      if (response.ok) {
        const data = await response.json();
        if (data && data.main) {
          currentWeather = {
            main: data.weather?.[0]?.main || '',
            desc: data.weather?.[0]?.description || '',
            temp: Math.round(data.main.temp),
            humidity: Math.round(data.main.humidity)
          };
          Events.emit('satla:render');
          return;
        }
      }
    } catch (e) { /* Silent fail */ }
    currentWeather = null;
    Events.emit('satla:render');
  }

  // ============ COORDINATE PARSING ============

  function maidenheadToLatLon(grid) {
    grid = grid.toUpperCase().trim();
    if (!/^[A-R]{2}\d{2}([A-X]{2}(\d{2})?)?$/.test(grid)) throw new Error('Invalid Maidenhead format');

    let lon = -180, lat = -90;
    lon += (grid.charCodeAt(0) - 65) * 20;
    lat += (grid.charCodeAt(1) - 65) * 10;
    lon += parseInt(grid[2]) * 2;
    lat += parseInt(grid[3]) * 1;
    if (grid.length >= 6) {
      lon += (grid.charCodeAt(4) - 65) * (2 / 24);
      lat += (grid.charCodeAt(5) - 65) * (1 / 24);
    }
    if (grid.length === 4) { lon += 1; lat += 0.5; }
    else if (grid.length === 6) { lon += 1/24; lat += 0.5/24; }
    return { lat, lon };
  }

  function parseCoordinates(input) {
    input = input.trim();
    const latLonMatch = input.match(/^(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)$/);
    if (latLonMatch) {
      const lat = parseFloat(latLonMatch[1]), lon = parseFloat(latLonMatch[2]);
      if (!isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180)
        return { lat, lon, type: 'latlon' };
    }
    const mgrsClean = input.replace(/\s/g, '').toUpperCase();
    if (/^\d{1,2}[C-X][A-Z]{2}\d{2,10}$/.test(mgrsClean))
      return { ...mgrsToLatLon(mgrsClean), type: 'mgrs' };
    if (/^[A-Ra-r]{2}\d{2}([A-Xa-x]{2})?$/i.test(input))
      return { ...maidenheadToLatLon(input), type: 'maidenhead' };
    throw new Error('Could not parse. Try: "38.89, -77.03" or MGRS "33TWN84125" or Grid "FM19la"');
  }

  // ============ STARLINK COVERAGE ============

  function checkStarlinkCoverage(lat, lon) {
    for (const region of STARLINK_RESTRICTED.regions) {
      const [minLat, maxLat, minLon, maxLon] = region.bounds;
      if (lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon)
        return { available: false, message: `No coverage - ${region.name}`, icon: '🚫' };
    }
    if (Math.abs(lat) > 70) return { available: 'limited', message: 'Polar - limited', icon: '⚠️' };
    return { available: true, message: 'Available', icon: '✅' };
  }

  // ============ N2YO API ============

  async function fetchSatellitePosition(noradId, lat, lon) {
    try {
      const url = `${API_PROXY}/positions/${noradId}/${lat}/${lon}/0/1`;
      const response = await fetch(url);
      if (!response.ok) { console.warn(`[SatLookAngles] HTTP ${response.status} for NORAD ${noradId}`); return null; }
      const data = await response.json();
      if (data.error) { console.warn(`[SatLookAngles] API error for ${noradId}:`, data.error); return null; }
      if (data.positions && data.positions.length > 0) {
        const pos = data.positions[0];
        return { azimuth: pos.azimuth, elevation: pos.elevation, range: calculateRange(lat, lon, pos.satlatitude, pos.satlongitude, pos.sataltitude || 35786) };
      }
      return null;
    } catch (error) { console.error(`[SatLookAngles] Fetch error for ${noradId}:`, error.message); return null; }
  }

  function calculateRange(obsLat, obsLon, satLat, satLon, satAlt) {
    const R = 6371;
    const lat1 = obsLat * Math.PI / 180;
    const dLat = (satLat - obsLat) * Math.PI / 180;
    const dLon = (satLon - obsLon) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1) * Math.cos(satLat * Math.PI/180) * Math.sin(dLon/2)**2;
    const groundDist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return Math.round(Math.sqrt(groundDist**2 + satAlt**2));
  }

  async function fetchAllSatellites(forceRefresh = false) {
    if (!currentLocation) return;
    const { lat, lon } = currentLocation;

    if (!forceRefresh) {
      const cached = loadFromCache(lat, lon);
      if (cached) {
        satelliteData = cached.data;
        lastFetch = new Date(cached.timestamp);
        console.log('[SatLookAngles] Loaded from cache, age:', Math.round((Date.now() - cached.timestamp) / 60000), 'minutes');
        Events.emit('satla:render');
        return;
      }
    }

    isLoading = true;
    Events.emit('satla:render');

    const newData = {};
    for (const [key, constellation] of Object.entries(SATELLITES)) {
      if (!selectedConstellations.includes(key)) continue;
      newData[key] = { ...constellation, satellites: [] };
      const promises = constellation.satellites.map(async (sat, index) => {
        await new Promise(resolve => setTimeout(resolve, index * 200));
        const position = await fetchSatellitePosition(sat.id, lat, lon);
        return { ...sat, position };
      });
      newData[key].satellites = await Promise.all(promises);
    }

    satelliteData = newData;
    lastFetch = new Date();
    isLoading = false;
    saveToCache(lat, lon, newData);
    Events.emit('satla:render');
  }

  // ============ HELPERS ============

  function getElevationQuality(el) {
    if (el == null) return { color: '#888', icon: '❓', status: 'unknown' };
    if (el < 0) return { color: '#ff4444', icon: '🔴', status: 'below' };
    if (el < 5) return { color: '#ff8800', icon: '🟠', status: 'poor' };
    if (el < 15) return { color: '#ffcc00', icon: '🟡', status: 'marginal' };
    if (el < 30) return { color: '#88ff00', icon: '🟢', status: 'good' };
    return { color: '#00ff88', icon: '🟢', status: 'excellent' };
  }

  function getWeatherImpact(band, wx) {
    if (!wx) return { impact: 'unknown', message: 'Weather N/A', color: '#888' };
    const cond = (wx.main || '').toLowerCase();
    const b = (band || '').toUpperCase();

    // EHF most affected
    if (b.includes('EHF') || b === 'KA') {
      if (cond.includes('rain') || cond.includes('thunder')) return { impact: 'severe', color: '#ff4444', message: 'Rain fade 10-20+ dB' };
      if (cond.includes('drizzle') || cond.includes('snow')) return { impact: 'moderate', color: '#ff8800', message: 'Atten 3-10 dB' };
    }
    // Ka/X bands
    if (b.includes('KA') || b.includes('X/KA') || b.includes('KU/KA')) {
      if (cond.includes('rain') || cond.includes('thunder')) return { impact: 'moderate', color: '#ff8800', message: 'Rain fade 5-15 dB' };
      if (cond.includes('snow')) return { impact: 'minor', color: '#ffcc00', message: 'Atten 2-5 dB' };
    }
    // Ku band
    if (b.includes('KU') || b.includes('C/KU')) {
      if (cond.includes('rain') || cond.includes('thunder')) return { impact: 'moderate', color: '#ff8800', message: 'Rain fade 2-8 dB' };
    }
    // C-band and UHF most resilient
    return { impact: 'none', color: '#00ff88', message: 'Good' };
  }

  function getWeatherEmoji(main) {
    const m = (main || '').toLowerCase();
    if (m.includes('thunder')) return '⛈️';
    if (m.includes('rain')) return '🌧️';
    if (m.includes('snow')) return '🌨️';
    if (m.includes('cloud')) return '☁️';
    if (m.includes('fog') || m.includes('mist')) return '🌫️';
    return '☀️';
  }

  // ============ UI RENDERING ============

  function renderSatelliteLookAngles(containerEl) {
    if (!containerEl) return;
    const sanitize = window.RussellTV?.sanitize || (s => s);
    const starlink = currentLocation ? checkStarlinkCoverage(currentLocation.lat, currentLocation.lon) : null;

    let html = `
      <div class="satla-section">
        <div class="satla-header" onclick="event.stopPropagation(); window.RussellTV.SatLookAngles.toggleExpand()">
          <span class="section-title">📡 Satellite Look Angles</span>
          <span class="expand-icon">${isExpanded ? '▼' : '▶'}</span>
        </div>`;

    if (isExpanded) {
      html += `<div class="satla-content" onclick="event.stopPropagation()">
        <div class="satla-location-search">
          <div class="search-container">
            <input type="text" id="satla-location-input" class="location-search-input"
                   placeholder="Search city, MGRS, or coords..."
                   value="${currentLocation?.name || ''}"
                   oninput="window.RussellTV.SatLookAngles.handleSearch(this.value)"
                   autocomplete="off">
            <div id="satla-autocomplete" class="autocomplete-dropdown"></div>
          </div>
          <div class="search-buttons">
            <button onclick="event.stopPropagation(); window.RussellTV.SatLookAngles.usePanelLocation()" class="satla-btn secondary" title="Use propagation panel location">📍</button>
            <button onclick="event.stopPropagation(); window.RussellTV.SatLookAngles.parseManualCoords()" class="satla-btn secondary" title="Parse as MGRS/coords">🔢</button>
            <button onclick="event.stopPropagation(); window.RussellTV.SatLookAngles.refresh()" class="satla-btn" title="Refresh">🔄</button>
          </div>
        </div>`;

      if (currentLocation) {
        html += `<div class="satla-current-location">
          <strong>📍 ${sanitize(currentLocation.name)}</strong>
          <span class="coords">${currentLocation.lat.toFixed(4)}°, ${currentLocation.lon.toFixed(4)}°</span>
        </div>`;

        if (currentWeather) {
          html += `<div class="satla-weather">
            <span>${getWeatherEmoji(currentWeather.main)}</span>
            <span>${sanitize(currentWeather.desc || currentWeather.main)}, ${currentWeather.temp}°F, ${currentWeather.humidity}%</span>
          </div>`;
        }

        if (starlink) {
          const cls = starlink.available === true ? 'available' : starlink.available === 'limited' ? 'limited' : 'restricted';
          html += `<div class="satla-starlink ${cls}">
            <span>${starlink.icon}</span>
            <strong>Starlink:</strong>
            <span>${sanitize(starlink.message)}</span>
          </div>`;
        }

        // Constellation checkboxes - fixed click handling
        html += `<div class="satla-filters">
          ${Object.keys(SATELLITES).map(k => `
            <label class="satla-checkbox-label">
              <input type="checkbox" ${selectedConstellations.includes(k) ? 'checked' : ''}
                     onchange="window.RussellTV.SatLookAngles.toggleConstellation('${k}')">
              <span>${k.toUpperCase()}</span>
            </label>
          `).join('')}
          <label class="satla-checkbox-label filter-toggle">
            <input type="checkbox" ${showOnlyGoodAngles ? 'checked' : ''}
                   onchange="window.RussellTV.SatLookAngles.toggleGoodAnglesFilter()">
            <span>El&gt;5°</span>
          </label>
        </div>`;

        html += `<div class="satla-az-note">📐 Azimuth is TRUE north (not magnetic)</div>`;

        if (isLoading) {
          html += `<div class="satla-loading"><div class="loading-spinner"></div><span>Fetching satellites...</span></div>`;
        } else if (Object.keys(satelliteData).length > 0) {
          for (const [key, c] of Object.entries(satelliteData)) {
            if (!selectedConstellations.includes(key)) continue;

            const impact = getWeatherImpact(c.band, currentWeather);
            const filteredSats = c.satellites.filter(s => {
              if (!s.position || s.position.elevation == null) return false;
              if (showOnlyGoodAngles) return s.position.elevation >= MIN_ELEVATION_FILTER;
              return s.position.elevation >= 0;
            });
            const sortedSats = [...filteredSats].sort((a,b) => (b.position?.elevation ?? -999) - (a.position?.elevation ?? -999));

            if (sortedSats.length === 0) continue;

            html += `<div class="satla-constellation">
              <div class="constellation-header">
                <span class="constellation-name">${sanitize(c.name)}</span>
                <span class="constellation-band">${c.band}</span>
                <span class="constellation-count">${sortedSats.length} sats</span>
              </div>`;

            if (impact.impact !== 'none' && impact.impact !== 'unknown') {
              html += `<div class="band-weather-alert" style="border-left-color:${impact.color}">⚠️ ${impact.message}</div>`;
            }

            html += `<table class="sat-table"><thead><tr><th>Sat</th><th>Az°</th><th>El°</th><th>Range</th></tr></thead><tbody>`;
            for (const sat of sortedSats) {
              const p = sat.position;
              const q = getElevationQuality(p?.elevation);
              html += `<tr class="sat-row">
                <td class="sat-name">${sanitize(sat.name)}</td>
                <td class="sat-az">${p?.azimuth != null ? p.azimuth.toFixed(1) : '--'}</td>
                <td class="sat-el" style="color:${q.color}">${p?.elevation != null ? p.elevation.toFixed(1) : '--'}</td>
                <td class="sat-range">${p?.range ? Math.round(p.range/1000)+'k km' : '--'}</td>
              </tr>`;
            }
            html += `</tbody></table></div>`;
          }

          if (lastFetch) {
            const ageMinutes = Math.round((Date.now() - lastFetch.getTime()) / 60000);
            const ageText = ageMinutes < 60 ? `${ageMinutes}m ago` : `${Math.round(ageMinutes/60)}h ago`;
            html += `<div class="satla-footer">
              <span>Data: ${ageText} (cached 24h)</span>
              <span>Via <a href="https://n2yo.com" target="_blank" rel="noopener noreferrer">N2YO</a></span>
            </div>`;
          }
        } else {
          html += `<div class="satla-no-data">Click 🔄 to fetch satellite data</div>`;
        }
      } else {
        html += `<div class="satla-no-location">Search for a location, enter MGRS/coords, or click 📍</div>`;
      }
      html += `</div>`;
    }
    html += `</div>`;
    containerEl.innerHTML = html;
  }

  // ============ STYLES ============

  const styles = `
    .satla-section { margin-top:1rem; border:1px solid rgba(100,150,255,0.3); border-radius:8px; overflow:hidden; }
    .satla-header { display:flex; justify-content:space-between; align-items:center; padding:0.75rem 1rem; background:rgba(100,150,255,0.1); cursor:pointer; user-select:none; }
    .satla-header:hover { background:rgba(100,150,255,0.2); }
    .satla-header .section-title { font-weight:bold; font-size:0.9rem; }
    .expand-icon { font-size:0.8rem; opacity:0.7; }
    .satla-content { padding:1rem; }
    .satla-location-search { margin-bottom:0.75rem; }
    .search-container { position:relative; margin-bottom:0.5rem; }
    .location-search-input { width:100%; padding:0.5rem 0.7rem; border-radius:6px; border:1px solid rgba(255,255,255,0.2); background:rgba(0,0,0,0.3); color:white; font-size:0.85rem; box-sizing:border-box; }
    .location-search-input:focus { outline:none; border-color:rgba(100,150,255,0.5); }
    .autocomplete-dropdown { position:absolute; top:100%; left:0; right:0; background:rgba(20,20,30,0.98); border:1px solid rgba(100,150,255,0.3); border-radius:0 0 6px 6px; max-height:220px; overflow-y:auto; z-index:1000; display:none; }
    .autocomplete-item { padding:0.5rem 0.8rem; cursor:pointer; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.05); }
    .autocomplete-item:hover { background:rgba(100,150,255,0.2); }
    .autocomplete-name { font-size:0.85rem; font-weight:500; }
    .autocomplete-detail { font-size:0.7rem; opacity:0.7; max-width:50%; text-align:right; }
    .search-buttons { display:flex; gap:0.4rem; }
    .satla-btn { padding:0.35rem 0.5rem; border-radius:4px; border:1px solid rgba(100,150,255,0.5); background:rgba(100,150,255,0.2); color:white; cursor:pointer; font-size:0.8rem; }
    .satla-btn:hover { background:rgba(100,150,255,0.4); }
    .satla-btn.secondary { background:rgba(255,255,255,0.1); border-color:rgba(255,255,255,0.2); }
    .satla-current-location { display:flex; justify-content:space-between; padding:0.4rem 0.6rem; background:rgba(100,150,255,0.1); border-radius:4px; margin-bottom:0.4rem; font-size:0.8rem; }
    .satla-current-location .coords { font-family:monospace; font-size:0.7rem; opacity:0.7; }
    .satla-weather { display:flex; align-items:center; gap:0.4rem; padding:0.35rem 0.6rem; background:rgba(255,255,255,0.05); border-radius:4px; margin-bottom:0.4rem; font-size:0.75rem; }
    .satla-starlink { display:flex; align-items:center; gap:0.4rem; padding:0.35rem 0.6rem; border-radius:4px; margin-bottom:0.4rem; font-size:0.7rem; }
    .satla-starlink.available { background:rgba(0,255,100,0.1); border:1px solid rgba(0,255,100,0.3); }
    .satla-starlink.limited { background:rgba(255,200,0,0.1); border:1px solid rgba(255,200,0,0.3); }
    .satla-starlink.restricted { background:rgba(255,68,68,0.1); border:1px solid rgba(255,68,68,0.3); }
    .satla-filters { display:flex; flex-wrap:wrap; gap:0.3rem 0.6rem; padding:0.4rem 0; margin-bottom:0.4rem; border-bottom:1px solid rgba(255,255,255,0.1); font-size:0.7rem; }
    .satla-checkbox-label { display:flex; align-items:center; gap:0.25rem; cursor:pointer; padding:0.15rem 0.3rem; border-radius:3px; }
    .satla-checkbox-label:hover { background:rgba(255,255,255,0.1); }
    .satla-checkbox-label input[type="checkbox"] { cursor:pointer; margin:0; }
    .satla-checkbox-label span { cursor:pointer; }
    .satla-filters .filter-toggle { margin-left:auto; color:#88ff88; }
    .satla-az-note { font-size:0.65rem; opacity:0.6; margin-bottom:0.5rem; font-style:italic; }
    .satla-loading { display:flex; align-items:center; justify-content:center; gap:0.6rem; padding:1.5rem; font-size:0.8rem; }
    .loading-spinner { width:18px; height:18px; border:2px solid rgba(100,150,255,0.3); border-top-color:rgba(100,150,255,1); border-radius:50%; animation:spin 1s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }
    .satla-constellation { margin-bottom:0.6rem; }
    .constellation-header { display:flex; align-items:center; gap:0.4rem; padding:0.25rem 0; border-bottom:1px solid rgba(255,255,255,0.1); margin-bottom:0.2rem; }
    .constellation-name { font-weight:bold; font-size:0.75rem; }
    .constellation-band { font-size:0.6rem; padding:0.1rem 0.25rem; background:rgba(255,120,0,0.2); border-radius:3px; color:#ffaa00; }
    .constellation-count { margin-left:auto; font-size:0.6rem; opacity:0.6; }
    .band-weather-alert { padding:0.25rem 0.4rem; background:rgba(255,255,255,0.05); border-left:3px solid #ff8800; margin-bottom:0.25rem; font-size:0.65rem; }
    .sat-table { width:100%; border-collapse:collapse; font-size:0.7rem; }
    .sat-table th { text-align:left; padding:0.15rem 0.25rem; border-bottom:1px solid rgba(255,255,255,0.2); font-size:0.6rem; text-transform:uppercase; opacity:0.7; }
    .sat-table td { padding:0.2rem 0.25rem; border-bottom:1px solid rgba(255,255,255,0.05); }
    .sat-name { font-weight:500; }
    .sat-az, .sat-el, .sat-range { font-family:monospace; font-size:0.7rem; }
    .satla-footer { display:flex; justify-content:space-between; padding-top:0.4rem; margin-top:0.4rem; border-top:1px solid rgba(255,255,255,0.1); font-size:0.6rem; opacity:0.6; }
    .satla-footer a { color:rgba(100,180,255,0.9); }
    .satla-no-location, .satla-no-data { text-align:center; padding:1.2rem; opacity:0.6; font-size:0.75rem; }
  `;

  // ============ PUBLIC API ============

  function toggleExpand() { isExpanded = !isExpanded; Events.emit('satla:render'); }

  function toggleConstellation(key) {
    const idx = selectedConstellations.indexOf(key);
    if (idx >= 0) selectedConstellations.splice(idx, 1);
    else selectedConstellations.push(key);
    if (idx < 0 && currentLocation) fetchAllSatellites();
    else Events.emit('satla:render');
  }

  function toggleGoodAnglesFilter() { showOnlyGoodAngles = !showOnlyGoodAngles; Events.emit('satla:render'); }

  function usePanelLocation() {
    const loc = window.RussellTV?.Propagation?.getSelectedLocation?.();
    if (loc?.coords) {
      currentLocation = { lat: loc.coords.lat, lon: loc.coords.lon, name: loc.label, source: 'panel' };
      const input = document.getElementById('satla-location-input');
      if (input) input.value = loc.label;
      fetchWeatherForLocation(loc.coords.lat, loc.coords.lon);
      fetchAllSatellites();
    } else {
      alert('Select a location in the propagation panel dropdown first.');
    }
  }

  function parseManualCoords() {
    const input = document.getElementById('satla-location-input');
    if (!input) return;
    try {
      const result = parseCoordinates(input.value.trim());
      const typeName = result.type === 'mgrs' ? 'MGRS' : result.type === 'maidenhead' ? 'Grid' : 'Coords';
      currentLocation = { lat: result.lat, lon: result.lon, name: `${typeName}: ${result.lat.toFixed(4)}, ${result.lon.toFixed(4)}`, source: result.type };
      fetchWeatherForLocation(result.lat, result.lon);
      fetchAllSatellites();
    } catch (e) { alert(e.message); }
  }

  function refresh() {
    if (!currentLocation) { alert('Select a location first'); return; }
    fetchWeatherForLocation(currentLocation.lat, currentLocation.lon);
    fetchAllSatellites(true);
  }

  function handleSearch(value) { handleAutocompleteInput(value); }

  // ============ CACHING ============

  function getCacheKey(lat, lon) { return `satla_${lat.toFixed(2)}_${lon.toFixed(2)}`; }

  function saveToCache(lat, lon, data) {
    try {
      const key = getCacheKey(lat, lon);
      localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now(), lat, lon }));
    } catch (e) { console.warn('[SatLookAngles] Cache save failed:', e); }
  }

  function loadFromCache(lat, lon) {
    try {
      const key = getCacheKey(lat, lon);
      const cached = localStorage.getItem(key);
      if (!cached) return null;
      const entry = JSON.parse(cached);
      if (Date.now() - entry.timestamp > 24 * 60 * 60 * 1000) { localStorage.removeItem(key); return null; }
      return entry;
    } catch (e) { return null; }
  }

  function init() {
    const styleEl = document.createElement('style');
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);

    document.addEventListener('click', () => {
      const d = document.getElementById('satla-autocomplete');
      if (d) d.style.display = 'none';
    });

    console.log('✅ [SatLookAngles] Initialized with MGRS support and 24h caching');
  }

  Events.whenReady('core:ready', init);

  window.RussellTV = window.RussellTV || {};
  window.RussellTV.SatLookAngles = {
    render: renderSatelliteLookAngles,
    toggleExpand, toggleConstellation, toggleGoodAnglesFilter,
    usePanelLocation, parseManualCoords, refresh, handleSearch, selectAutocomplete,
    getData: () => satelliteData
  };

})();
