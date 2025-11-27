/**
 * satellite-lookangles.js - Satellite Look Angles Tool
 * 
 * Provides azimuth, elevation, and range calculations for military and commercial
 * geostationary satellites from user-specified locations.
 * 
 * Features:
 * - Location autocomplete using OpenStreetMap Nominatim
 * - Multiple coordinate input formats (Lat/Long, MGRS, Maidenhead)
 * - WGS, AEHF military SATCOM constellations
 * - Commercial Ku-band satellites (Intelsat, Eutelsat, SES)
 * - Weather impact assessment for look angles
 * - Starshield/Starlink status and coverage warnings
 * - Auto-refresh every 60 seconds with manual refresh option
 * - Loading spinner during data fetch
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

  const SATELLITES = {
    wgs: {
      name: 'WGS (Wideband Global)',
      band: 'X/Ka',
      type: 'milsatcom',
      satellites: [
        { id: 32258, name: 'WGS-1', lon: -60 },
        { id: 33055, name: 'WGS-2', lon: -63 },
        { id: 34713, name: 'WGS-3', lon: -12 },
        { id: 38070, name: 'WGS-4', lon: -87 },
        { id: 39168, name: 'WGS-5', lon: -52 },
        { id: 39222, name: 'WGS-6', lon: -64 },
        { id: 40746, name: 'WGS-7', lon: 170 },
        { id: 41879, name: 'WGS-8', lon: 79 },
        { id: 42075, name: 'WGS-9', lon: -59 },
        { id: 44071, name: 'WGS-10', lon: 52 },
        { id: 53937, name: 'WGS-11', lon: 95 }
      ]
    },
    aehf: {
      name: 'AEHF (Protected)',
      band: 'EHF',
      type: 'milsatcom',
      satellites: [
        { id: 36868, name: 'AEHF-1', lon: -92 },
        { id: 38254, name: 'AEHF-2', lon: -40 },
        { id: 39256, name: 'AEHF-3', lon: 125 },
        { id: 43651, name: 'AEHF-4', lon: 45 },
        { id: 45193, name: 'AEHF-5', lon: -150 },
        { id: 46757, name: 'AEHF-6', lon: 150 }
      ]
    },
    intelsat: {
      name: 'Intelsat',
      band: 'C/Ku',
      type: 'commercial',
      satellites: [
        { id: 28358, name: 'IS 10-02', lon: -1 },
        { id: 38740, name: 'IS 20', lon: 68.5 },
        { id: 38098, name: 'IS 22', lon: 72 },
        { id: 42950, name: 'IS 37e', lon: -18 },
        { id: 40874, name: 'IS 34', lon: -55.5 },
        { id: 39476, name: 'IS 30', lon: -95 },
        { id: 42741, name: 'IS 35e', lon: 34.5 },
        { id: 40982, name: 'IS 36', lon: 68.5 },
        { id: 43823, name: 'IS 38', lon: 45 }
      ]
    },
    eutelsat: {
      name: 'Eutelsat',
      band: 'Ku/Ka',
      type: 'commercial',
      satellites: [
        { id: 40875, name: 'E 8WB', lon: -8 },
        { id: 39163, name: 'E 7B', lon: 7 },
        { id: 37836, name: 'E 16A', lon: 16 },
        { id: 38652, name: 'E 25B', lon: 25.5 },
        { id: 35953, name: 'E 36B', lon: 36 },
        { id: 40272, name: 'E 9B', lon: 9 },
        { id: 42432, name: 'E 172B', lon: 172 },
        { id: 45026, name: 'E 7C', lon: 7 }
      ]
    },
    ses: {
      name: 'SES/Astra',
      band: 'C/Ku/Ka',
      type: 'commercial',
      satellites: [
        { id: 26958, name: 'Astra 2C', lon: 19.2 },
        { id: 36831, name: 'Astra 1N', lon: 19.2 },
        { id: 38778, name: 'Astra 2E', lon: 28.2 },
        { id: 40364, name: 'Astra 2G', lon: 28.2 },
        { id: 37775, name: 'SES-4', lon: -22 },
        { id: 40946, name: 'SES-9', lon: 108.2 },
        { id: 41382, name: 'SES-10', lon: -67 },
        { id: 43157, name: 'SES-14', lon: -47.5 },
        { id: 44334, name: 'SES-17', lon: -67 }
      ]
    },
    other: {
      name: 'Other Regional',
      band: 'Various',
      type: 'commercial',
      satellites: [
        { id: 37816, name: 'Yamal 402', lon: 55 },
        { id: 40733, name: 'Turksat 4B', lon: 50 },
        { id: 42934, name: 'AsiaSat 9', lon: 122 },
        { id: 40424, name: 'ABS-3A', lon: 3 },
        { id: 39020, name: 'Yahsat 1B', lon: 47.5 },
        { id: 38245, name: 'Arabsat 6A', lon: 30.5 },
        { id: 44333, name: 'Amos 17', lon: 17 }
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
  let autoRefreshTimer = null;
  let isExpanded = false;
  let isLoading = false;
  let selectedConstellations = ['wgs', 'aehf', 'intelsat'];
  let autocompleteResults = [];
  let autocompleteTimeout = null;

  // ============ GEOCODING / AUTOCOMPLETE ============

  async function searchLocation(query) {
    if (!query || query.length < 3) {
      autocompleteResults = [];
      return [];
    }

    try {
      const url = `${NOMINATIM_URL}?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`;
      const response = await fetch(url, {
        headers: { 'User-Agent': 'RussellTV-SatLookAngles/1.0' }
      });

      if (!response.ok) throw new Error('Geocoding failed');

      const results = await response.json();
      autocompleteResults = results.map(r => ({
        name: r.display_name,
        shortName: r.name || r.display_name.split(',')[0],
        lat: parseFloat(r.lat),
        lon: parseFloat(r.lon),
        country: r.address?.country
      }));

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

    if (autocompleteResults.length === 0) {
      dropdown.style.display = 'none';
      return;
    }

    const sanitize = window.RussellTV?.sanitize || (s => s);
    dropdown.innerHTML = autocompleteResults.map((r, i) => `
      <div class="autocomplete-item" onclick="event.stopPropagation(); window.RussellTV.SatLookAngles.selectAutocomplete(${i})">
        <span class="autocomplete-name">${sanitize(r.shortName)}</span>
        <span class="autocomplete-detail">${sanitize(r.country || '')}</span>
      </div>
    `).join('');

    dropdown.style.display = 'block';
  }

  function selectAutocomplete(index) {
    const result = autocompleteResults[index];
    if (!result) return;

    currentLocation = {
      lat: result.lat,
      lon: result.lon,
      name: result.shortName,
      fullName: result.name,
      source: 'search'
    };

    const input = document.getElementById('satla-location-input');
    if (input) input.value = result.shortName;

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
      if (!response.ok) throw new Error('Weather fetch failed');

      const data = await response.json();
      if (data && data.main) {
        currentWeather = {
          main: data.weather?.[0]?.main || '',
          desc: data.weather?.[0]?.description || '',
          temp: Math.round(data.main.temp),
          humidity: Math.round(data.main.humidity),
          pressure: data.main.pressure
        };
      }
    } catch (error) {
      console.error('[SatLookAngles] Weather fetch error:', error);
      currentWeather = null;
    }
    Events.emit('satla:render');
  }

  // ============ COORDINATE CONVERSION ============

  function maidenheadToLatLon(grid) {
    grid = grid.toUpperCase().trim();
    if (!/^[A-R]{2}\d{2}([A-X]{2}(\d{2})?)?$/.test(grid)) {
      throw new Error('Invalid Maidenhead format');
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
    if (grid.length === 4) { lon += 1; lat += 0.5; }
    else if (grid.length === 6) { lon += 1/24; lat += 0.5/24; }

    return { lat, lon };
  }

  function parseCoordinates(input) {
    // Try lat/lon first
    const parts = input.split(/[,\s]+/).filter(p => p);
    if (parts.length === 2) {
      const lat = parseFloat(parts[0]);
      const lon = parseFloat(parts[1]);
      if (!isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
        return { lat, lon };
      }
    }
    // Try maidenhead
    return maidenheadToLatLon(input);
  }

  // ============ STARLINK COVERAGE ============

  function checkStarlinkCoverage(lat, lon) {
    for (const region of STARLINK_RESTRICTED.regions) {
      const [minLat, maxLat, minLon, maxLon] = region.bounds;
      if (lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon) {
        return { available: false, message: `No coverage for ${region.name}`, icon: '🚫' };
      }
    }
    if (Math.abs(lat) > 70) {
      return { available: 'limited', message: 'Polar - limited coverage', icon: '⚠️' };
    }
    return { available: true, message: 'Coverage expected', icon: '✅' };
  }

  // ============ N2YO API ============

  async function fetchSatellitePosition(noradId, lat, lon) {
    try {
      const url = `${API_PROXY}/positions/${noradId}/${lat}/${lon}/0/1`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`API error: ${response.status}`);

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      if (data.positions && data.positions.length > 0) {
        const pos = data.positions[0];
        return {
          azimuth: pos.azimuth,
          elevation: pos.elevation,
          range: calculateRange(lat, lon, pos.satlatitude, pos.satlongitude, 35786)
        };
      }
      return null;
    } catch (error) {
      console.error(`[SatLookAngles] Error fetching ${noradId}:`, error);
      return null;
    }
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

  async function fetchAllSatellites() {
    if (!currentLocation) return;

    isLoading = true;
    Events.emit('satla:render');

    const { lat, lon } = currentLocation;
    const newData = {};

    for (const [key, constellation] of Object.entries(SATELLITES)) {
      if (!selectedConstellations.includes(key)) continue;

      newData[key] = { ...constellation, satellites: [] };

      const promises = constellation.satellites.map(async (sat, index) => {
        await new Promise(resolve => setTimeout(resolve, index * 50));
        const position = await fetchSatellitePosition(sat.id, lat, lon);
        return { ...sat, position };
      });

      newData[key].satellites = await Promise.all(promises);
    }

    satelliteData = newData;
    lastFetch = new Date();
    isLoading = false;
    Events.emit('satla:render');
  }

  // ============ HELPERS ============

  function getElevationQuality(el) {
    if (el == null) return { color: '#888', icon: '❓' };
    if (el < 0) return { color: '#ff4444', icon: '🔴' };
    if (el < 5) return { color: '#ff8800', icon: '🟠' };
    if (el < 15) return { color: '#ffcc00', icon: '🟡' };
    if (el < 30) return { color: '#88ff00', icon: '🟢' };
    return { color: '#00ff88', icon: '🟢' };
  }

  function getWeatherImpact(band, wx) {
    if (!wx) return { impact: 'unknown', message: 'Weather unavailable', color: '#888' };
    const cond = (wx.main || '').toLowerCase();

    if (band === 'EHF' || band === 'Ka' || band === 'X/Ka') {
      if (cond.includes('rain') || cond.includes('thunder'))
        return { impact: 'severe', color: '#ff4444', message: 'Rain fade 10-20+ dB' };
      if (cond.includes('drizzle') || cond.includes('snow'))
        return { impact: 'moderate', color: '#ff8800', message: 'Attenuation 3-10 dB' };
    }
    if (band.includes('Ku')) {
      if (cond.includes('rain') || cond.includes('thunder'))
        return { impact: 'moderate', color: '#ff8800', message: 'Rain fade 2-8 dB' };
    }
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
                   placeholder="Search city, base, or enter coords..."
                   value="${currentLocation?.name || ''}"
                   oninput="window.RussellTV.SatLookAngles.handleSearch(this.value)"
                   onclick="event.stopPropagation()" autocomplete="off">
            <div id="satla-autocomplete" class="autocomplete-dropdown"></div>
          </div>
          <div class="search-buttons">
            <button onclick="event.stopPropagation(); window.RussellTV.SatLookAngles.usePanelLocation()" class="satla-btn secondary" title="Use propagation panel location">📍 Panel</button>
            <button onclick="event.stopPropagation(); window.RussellTV.SatLookAngles.parseManualCoords()" class="satla-btn secondary" title="Parse as coordinates">🔢</button>
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
            <strong>Starshield:</strong>
            <span>${sanitize(starlink.message)}</span>
          </div>`;
        }

        html += `<div class="satla-filters">
          ${Object.keys(SATELLITES).map(k => `
            <label onclick="event.stopPropagation()">
              <input type="checkbox" ${selectedConstellations.includes(k) ? 'checked' : ''}
                     onchange="event.stopPropagation(); window.RussellTV.SatLookAngles.toggleConstellation('${k}')">
              ${k.toUpperCase()}
            </label>
          `).join('')}
        </div>`;

        if (isLoading) {
          html += `<div class="satla-loading"><div class="loading-spinner"></div><span>Fetching satellites...</span></div>`;
        } else if (Object.keys(satelliteData).length > 0) {
          for (const [key, c] of Object.entries(satelliteData)) {
            if (!selectedConstellations.includes(key)) continue;
            const impact = getWeatherImpact(c.band, currentWeather);
            const visible = c.satellites.filter(s => s.position?.elevation >= 0).length;

            html += `<div class="satla-constellation">
              <div class="constellation-header">
                <span class="constellation-name">${sanitize(c.name)}</span>
                <span class="constellation-band">${c.band}</span>
                <span class="constellation-count">${visible}/${c.satellites.length} vis</span>
              </div>`;

            if (impact.impact !== 'none' && impact.impact !== 'unknown') {
              html += `<div class="band-weather-alert" style="border-left-color:${impact.color}">⚠️ ${impact.message}</div>`;
            }

            html += `<table class="sat-table"><thead><tr><th>Sat</th><th>Az</th><th>El</th><th>Range</th><th></th></tr></thead><tbody>`;

            const sorted = [...c.satellites].sort((a,b) => (b.position?.elevation ?? -999) - (a.position?.elevation ?? -999));
            for (const sat of sorted) {
              const p = sat.position;
              const q = getElevationQuality(p?.elevation);
              html += `<tr class="sat-row ${p?.elevation < 0 ? 'below' : ''}">
                <td class="sat-name">${sanitize(sat.name)}</td>
                <td class="sat-az">${p?.azimuth != null ? p.azimuth.toFixed(1)+'°' : '--'}</td>
                <td class="sat-el" style="color:${q.color}">${p?.elevation != null ? p.elevation.toFixed(1)+'°' : '--'}</td>
                <td class="sat-range">${p?.range ? Math.round(p.range/1000)+'k' : '--'}</td>
                <td class="sat-status">${q.icon}</td>
              </tr>`;
            }
            html += `</tbody></table></div>`;
          }

          if (lastFetch) {
            html += `<div class="satla-footer">
              <span>Updated ${lastFetch.toLocaleTimeString()}</span>
              <span>Via <a href="https://n2yo.com" target="_blank" rel="noopener noreferrer">N2YO</a></span>
            </div>`;
          }
        } else {
          html += `<div class="satla-no-data">Click 🔄 to fetch satellite data</div>`;
        }
      } else {
        html += `<div class="satla-no-location">Search for a location or click 📍 Panel</div>`;
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
    .satla-location-search { margin-bottom:1rem; }
    .search-container { position:relative; margin-bottom:0.5rem; }
    .location-search-input { width:100%; padding:0.6rem 0.8rem; border-radius:6px; border:1px solid rgba(255,255,255,0.2); background:rgba(0,0,0,0.3); color:white; font-size:0.9rem; box-sizing:border-box; }
    .location-search-input:focus { outline:none; border-color:rgba(100,150,255,0.5); }
    .autocomplete-dropdown { position:absolute; top:100%; left:0; right:0; background:rgba(20,20,30,0.98); border:1px solid rgba(100,150,255,0.3); border-radius:0 0 6px 6px; max-height:200px; overflow-y:auto; z-index:1000; display:none; }
    .autocomplete-item { padding:0.5rem 0.8rem; cursor:pointer; display:flex; justify-content:space-between; border-bottom:1px solid rgba(255,255,255,0.05); }
    .autocomplete-item:hover { background:rgba(100,150,255,0.2); }
    .autocomplete-name { font-size:0.85rem; }
    .autocomplete-detail { font-size:0.7rem; opacity:0.6; }
    .search-buttons { display:flex; gap:0.5rem; }
    .satla-btn { padding:0.4rem 0.6rem; border-radius:4px; border:1px solid rgba(100,150,255,0.5); background:rgba(100,150,255,0.2); color:white; cursor:pointer; font-size:0.75rem; }
    .satla-btn:hover { background:rgba(100,150,255,0.4); }
    .satla-btn.secondary { background:rgba(255,255,255,0.1); border-color:rgba(255,255,255,0.2); }
    .satla-current-location { display:flex; justify-content:space-between; padding:0.5rem 0.75rem; background:rgba(100,150,255,0.1); border-radius:4px; margin-bottom:0.5rem; font-size:0.8rem; }
    .satla-current-location .coords { font-family:monospace; font-size:0.75rem; opacity:0.7; }
    .satla-weather { display:flex; align-items:center; gap:0.5rem; padding:0.4rem 0.75rem; background:rgba(255,255,255,0.05); border-radius:4px; margin-bottom:0.5rem; font-size:0.8rem; }
    .satla-starlink { display:flex; align-items:center; gap:0.5rem; padding:0.4rem 0.75rem; border-radius:4px; margin-bottom:0.5rem; font-size:0.75rem; }
    .satla-starlink.available { background:rgba(0,255,100,0.1); border:1px solid rgba(0,255,100,0.3); }
    .satla-starlink.limited { background:rgba(255,200,0,0.1); border:1px solid rgba(255,200,0,0.3); }
    .satla-starlink.restricted { background:rgba(255,68,68,0.1); border:1px solid rgba(255,68,68,0.3); }
    .satla-filters { display:flex; flex-wrap:wrap; gap:0.4rem 0.8rem; padding:0.5rem 0; margin-bottom:0.5rem; border-bottom:1px solid rgba(255,255,255,0.1); font-size:0.75rem; }
    .satla-filters label { display:flex; align-items:center; gap:0.25rem; cursor:pointer; }
    .satla-loading { display:flex; align-items:center; justify-content:center; gap:0.75rem; padding:2rem; font-size:0.85rem; }
    .loading-spinner { width:20px; height:20px; border:2px solid rgba(100,150,255,0.3); border-top-color:rgba(100,150,255,1); border-radius:50%; animation:spin 1s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }
    .satla-constellation { margin-bottom:0.75rem; }
    .constellation-header { display:flex; align-items:center; gap:0.5rem; padding:0.3rem 0; border-bottom:1px solid rgba(255,255,255,0.1); margin-bottom:0.3rem; }
    .constellation-name { font-weight:bold; font-size:0.8rem; }
    .constellation-band { font-size:0.65rem; padding:0.1rem 0.3rem; background:rgba(255,120,0,0.2); border-radius:3px; color:#ffaa00; }
    .constellation-count { margin-left:auto; font-size:0.65rem; opacity:0.6; }
    .band-weather-alert { padding:0.3rem 0.5rem; background:rgba(255,255,255,0.05); border-left:3px solid #ff8800; margin-bottom:0.3rem; font-size:0.7rem; }
    .sat-table { width:100%; border-collapse:collapse; font-size:0.75rem; }
    .sat-table th { text-align:left; padding:0.2rem 0.3rem; border-bottom:1px solid rgba(255,255,255,0.2); font-size:0.65rem; text-transform:uppercase; opacity:0.7; }
    .sat-table td { padding:0.25rem 0.3rem; border-bottom:1px solid rgba(255,255,255,0.05); }
    .sat-row.below { opacity:0.5; }
    .sat-name { font-weight:500; }
    .sat-az, .sat-el, .sat-range { font-family:monospace; font-size:0.7rem; }
    .sat-status { text-align:center; }
    .satla-footer { display:flex; justify-content:space-between; padding-top:0.5rem; margin-top:0.5rem; border-top:1px solid rgba(255,255,255,0.1); font-size:0.65rem; opacity:0.6; }
    .satla-footer a { color:rgba(100,180,255,0.9); }
    .satla-no-location, .satla-no-data { text-align:center; padding:1.5rem; opacity:0.6; font-size:0.8rem; }
  `;

  // ============ PUBLIC API ============

  function toggleExpand() {
    isExpanded = !isExpanded;
    Events.emit('satla:render');
  }

  function toggleConstellation(key) {
    const idx = selectedConstellations.indexOf(key);
    if (idx >= 0) selectedConstellations.splice(idx, 1);
    else selectedConstellations.push(key);
    if (idx < 0 && currentLocation) fetchAllSatellites();
    else Events.emit('satla:render');
  }

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
      const coords = parseCoordinates(input.value.trim());
      currentLocation = { lat: coords.lat, lon: coords.lon, name: `${coords.lat.toFixed(4)}, ${coords.lon.toFixed(4)}`, source: 'manual' };
      fetchWeatherForLocation(coords.lat, coords.lon);
      fetchAllSatellites();
    } catch (e) {
      alert('Could not parse. Try "38.8977, -77.0365" or Maidenhead like "FM19la"');
    }
  }

  function refresh() {
    if (!currentLocation) { alert('Select a location first'); return; }
    fetchWeatherForLocation(currentLocation.lat, currentLocation.lon);
    fetchAllSatellites();
  }

  function handleSearch(value) { handleAutocompleteInput(value); }

  function init() {
    const styleEl = document.createElement('style');
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);

    setInterval(() => { if (currentLocation && !isLoading) fetchAllSatellites(); }, 60000);

    document.addEventListener('click', () => {
      const d = document.getElementById('satla-autocomplete');
      if (d) d.style.display = 'none';
    });

    console.log('✅ [SatLookAngles] Initialized');
  }

  Events.whenReady('core:ready', init);

  window.RussellTV = window.RussellTV || {};
  window.RussellTV.SatLookAngles = {
    render: renderSatelliteLookAngles,
    toggleExpand,
    toggleConstellation,
    usePanelLocation,
    parseManualCoords,
    refresh,
    handleSearch,
    selectAutocomplete,
    getData: () => satelliteData
  };

})();
