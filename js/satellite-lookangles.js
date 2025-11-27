/**
 * satellite-lookangles.js - Satellite Look Angles Tool
 * 
 * Provides azimuth, elevation, and range calculations for military and commercial
 * geostationary satellites from user-specified locations.
 * 
 * Features:
 * - Multiple coordinate input formats (Lat/Long, MGRS, Maidenhead)
 * - WGS, AEHF military SATCOM constellations
 * - Commercial Ku-band satellites (Intelsat, Eutelsat, SES)
 * - Weather impact assessment for look angles
 * - Starshield/Starlink status and coverage warnings
 * - Auto-refresh every 60 seconds with manual refresh option
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

  // N2YO API proxy endpoint (hides API key server-side)
  const API_PROXY = '/api/n2yo';

  // Satellite catalog - NORAD IDs and metadata
  const SATELLITES = {
    // === MILITARY SATCOM ===
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

    // === COMMERCIAL - EUCOM/CENTCOM COVERAGE ===
    intelsat: {
      name: 'Intelsat',
      band: 'C/Ku',
      type: 'commercial',
      satellites: [
        { id: 28358, name: 'Intelsat 10-02', lon: -1 },    // Europe/ME/Africa
        { id: 38740, name: 'Intelsat 20', lon: 68.5 },    // Europe/ME/Asia
        { id: 38098, name: 'Intelsat 22', lon: 72 },      // Asia/ME (UHF)
        { id: 42950, name: 'Intelsat 37e', lon: -18 },    // Americas/Europe/ME
        { id: 40874, name: 'Intelsat 34', lon: -55.5 },   // Atlantic
        { id: 39476, name: 'Intelsat 30', lon: -95 },     // Americas
        { id: 42741, name: 'Intelsat 35e', lon: 34.5 },   // Europe/Africa/ME
        { id: 40982, name: 'Intelsat 36', lon: 68.5 },    // Africa/ME
        { id: 43823, name: 'Intelsat 38', lon: 45 }       // Europe/Africa
      ]
    },
    eutelsat: {
      name: 'Eutelsat',
      band: 'Ku/Ka',
      type: 'commercial',
      satellites: [
        { id: 40875, name: 'Eutelsat 8WB', lon: -8 },     // MENA/Africa
        { id: 39163, name: 'Eutelsat 7B', lon: 7 },       // Europe/Turkey/ME
        { id: 37836, name: 'Eutelsat 16A', lon: 16 },     // Europe
        { id: 38652, name: 'Eutelsat 25B', lon: 25.5 },   // MENA
        { id: 35953, name: 'Eutelsat 36B', lon: 36 },     // Europe/Russia
        { id: 40272, name: 'Eutelsat 9B', lon: 9 },       // Europe
        { id: 42432, name: 'Eutelsat 172B', lon: 172 },   // Asia-Pacific
        { id: 45026, name: 'Eutelsat 7C', lon: 7 }        // Europe/Africa/ME
      ]
    },
    ses: {
      name: 'SES/Astra',
      band: 'C/Ku/Ka',
      type: 'commercial',
      satellites: [
        { id: 26958, name: 'Astra 2C', lon: 19.2 },       // Europe
        { id: 36831, name: 'Astra 1N', lon: 19.2 },       // Europe
        { id: 38778, name: 'Astra 2E', lon: 28.2 },       // Europe
        { id: 40364, name: 'Astra 2G', lon: 28.2 },       // Europe
        { id: 37775, name: 'SES-4', lon: -22 },           // Americas/Europe
        { id: 40946, name: 'SES-9', lon: 108.2 },         // Asia
        { id: 41382, name: 'SES-10', lon: -67 },          // Americas
        { id: 43157, name: 'SES-14', lon: -47.5 },        // Americas
        { id: 44334, name: 'SES-17', lon: -67 }           // Americas (Ka HTS)
      ]
    },
    other: {
      name: 'Other Regional',
      band: 'Various',
      type: 'commercial',
      satellites: [
        { id: 37816, name: 'Yamal 402', lon: 55 },        // Russia/ME
        { id: 40733, name: 'Turksat 4B', lon: 50 },       // Turkey/ME/Asia
        { id: 42934, name: 'AsiaSat 9', lon: 122 },       // Asia
        { id: 40424, name: 'ABS-3A', lon: 3 },            // MENA/Europe
        { id: 39020, name: 'Yahsat 1B', lon: 47.5 },      // ME/Africa/Asia
        { id: 38245, name: 'Arabsat 6A', lon: 30.5 },     // MENA
        { id: 44333, name: 'Amos 17', lon: 17 }           // Africa/Europe
      ]
    }
  };

  // Starlink/Starshield restricted countries/regions
  // Countries where Starlink does NOT officially operate
  const STARLINK_RESTRICTED = {
    countries: [
      'China', 'Russia', 'Belarus', 'North Korea', 'Iran', 'Syria', 
      'Afghanistan', 'Cuba', 'Venezuela'
    ],
    // Approximate bounding boxes for restricted areas [minLat, maxLat, minLon, maxLon]
    regions: [
      { name: 'China', bounds: [18, 54, 73, 135] },
      { name: 'Russia', bounds: [41, 82, 19, 180] },
      { name: 'Iran', bounds: [25, 40, 44, 64] },
      { name: 'North Korea', bounds: [37, 43, 124, 131] },
      { name: 'Syria', bounds: [32, 37, 35, 42] },
      { name: 'Afghanistan', bounds: [29, 38, 60, 75] },
      { name: 'Belarus', bounds: [51, 56, 23, 33] }
    ],
    // Pending regulatory approval
    pending: ['Saudi Arabia', 'India', 'Pakistan', 'UAE', 'Thailand', 'Turkey', 'Vietnam']
  };

  // ============ STATE ============

  let currentLocation = null;  // { lat, lon, name, source }
  let satelliteData = {};      // Cached satellite position data
  let lastFetch = null;
  let autoRefreshTimer = null;
  let isExpanded = false;
  let selectedConstellations = ['wgs', 'aehf', 'intelsat'];  // Default visible

  // ============ COORDINATE CONVERSION ============

  /**
   * Convert MGRS to Lat/Long
   * Simplified implementation - for production use a proper library like mgrs-js
   */
  function mgrsToLatLon(mgrs) {
    // Remove spaces and convert to uppercase
    mgrs = mgrs.replace(/\s/g, '').toUpperCase();
    
    // Basic validation
    if (!/^\d{1,2}[C-X][A-Z]{2}\d{2,10}$/.test(mgrs)) {
      throw new Error('Invalid MGRS format');
    }

    // For a proper implementation, use a library like 'mgrs'
    // This is a placeholder that would need a real converter
    // In production, you'd import: import mgrs from 'mgrs';
    // return mgrs.toPoint(mgrsString);
    
    // Placeholder - returns error prompting user to use lat/lon
    throw new Error('MGRS conversion requires mgrs library. Please use Lat/Long.');
  }

  /**
   * Convert Maidenhead Grid Locator to Lat/Long
   */
  function maidenheadToLatLon(grid) {
    grid = grid.toUpperCase().trim();
    
    if (!/^[A-R]{2}\d{2}([A-X]{2}(\d{2})?)?$/.test(grid)) {
      throw new Error('Invalid Maidenhead format (e.g., FM19la)');
    }

    let lon = -180;
    let lat = -90;

    // Field (first 2 chars)
    lon += (grid.charCodeAt(0) - 65) * 20;
    lat += (grid.charCodeAt(1) - 65) * 10;

    // Square (next 2 digits)
    lon += parseInt(grid[2]) * 2;
    lat += parseInt(grid[3]) * 1;

    // Subsquare (optional 2 chars)
    if (grid.length >= 6) {
      lon += (grid.charCodeAt(4) - 65) * (2 / 24);
      lat += (grid.charCodeAt(5) - 65) * (1 / 24);
    }

    // Extended subsquare (optional 2 digits)
    if (grid.length >= 8) {
      lon += parseInt(grid[6]) * (2 / 240);
      lat += parseInt(grid[7]) * (1 / 240);
    }

    // Center of grid square
    if (grid.length === 4) {
      lon += 1;
      lat += 0.5;
    } else if (grid.length === 6) {
      lon += 1 / 24;
      lat += 0.5 / 24;
    }

    return { lat: lat.toFixed(6), lon: lon.toFixed(6) };
  }

  /**
   * Parse coordinate input based on format
   */
  function parseCoordinates(input, format) {
    try {
      switch (format) {
        case 'latlon':
          const parts = input.split(/[,\s]+/).filter(p => p);
          if (parts.length !== 2) throw new Error('Enter lat, lon (e.g., 38.8977, -77.0365)');
          const lat = parseFloat(parts[0]);
          const lon = parseFloat(parts[1]);
          if (isNaN(lat) || isNaN(lon)) throw new Error('Invalid coordinates');
          if (lat < -90 || lat > 90) throw new Error('Latitude must be -90 to 90');
          if (lon < -180 || lon > 180) throw new Error('Longitude must be -180 to 180');
          return { lat, lon };
        
        case 'mgrs':
          return mgrsToLatLon(input);
        
        case 'maidenhead':
          return maidenheadToLatLon(input);
        
        default:
          throw new Error('Unknown coordinate format');
      }
    } catch (e) {
      throw new Error(`Coordinate error: ${e.message}`);
    }
  }

  // ============ STARLINK COVERAGE CHECK ============

  function checkStarlinkCoverage(lat, lon) {
    // Check if location is in a restricted region
    for (const region of STARLINK_RESTRICTED.regions) {
      const [minLat, maxLat, minLon, maxLon] = region.bounds;
      if (lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon) {
        return {
          available: false,
          status: 'restricted',
          message: `Starlink does not advertise coverage for ${region.name}`,
          icon: '🚫'
        };
      }
    }

    // Extreme latitudes (polar regions) - limited coverage
    if (Math.abs(lat) > 70) {
      return {
        available: 'limited',
        status: 'polar',
        message: 'Polar region - Starlink coverage may be limited or intermittent',
        icon: '⚠️'
      };
    }

    // Ocean regions far from ground stations
    // This is simplified - actual coverage depends on ground station proximity
    return {
      available: true,
      status: 'available',
      message: 'Starlink coverage expected in this region',
      icon: '✅'
    };
  }

  // ============ N2YO API ============

  /**
   * Fetch satellite position from N2YO API via proxy
   */
  async function fetchSatellitePosition(noradId, lat, lon, alt = 0) {
    try {
      // API endpoint: /positions/{id}/{observer_lat}/{observer_lng}/{observer_alt}/{seconds}
      const url = `${API_PROXY}/positions/${noradId}/${lat}/${lon}/${alt}/1`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      // N2YO returns positions array
      if (data.positions && data.positions.length > 0) {
        const pos = data.positions[0];
        return {
          satid: data.info?.satid || noradId,
          satname: data.info?.satname || 'Unknown',
          azimuth: pos.azimuth,
          elevation: pos.elevation,
          ra: pos.ra,
          dec: pos.dec,
          timestamp: pos.timestamp,
          // Calculate approximate range for GEO satellites (~35,786 km altitude)
          range: calculateRange(lat, lon, pos.satlatitude, pos.satlongitude, 35786)
        };
      }
      
      return null;
    } catch (error) {
      console.error(`[SatLookAngles] Error fetching ${noradId}:`, error);
      return null;
    }
  }

  /**
   * Calculate approximate range to satellite
   */
  function calculateRange(obsLat, obsLon, satLat, satLon, satAlt) {
    // Earth radius in km
    const R = 6371;
    
    // Convert to radians
    const lat1 = obsLat * Math.PI / 180;
    const lat2 = satLat * Math.PI / 180;
    const dLat = (satLat - obsLat) * Math.PI / 180;
    const dLon = (satLon - obsLon) * Math.PI / 180;
    
    // Haversine formula for ground distance
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const groundDist = R * c;
    
    // 3D distance including altitude
    const range = Math.sqrt(groundDist * groundDist + satAlt * satAlt);
    
    return Math.round(range);
  }

  /**
   * Fetch all satellite positions for current location
   */
  async function fetchAllSatellites() {
    if (!currentLocation) return;

    const { lat, lon } = currentLocation;
    const newData = {};

    // Fetch each constellation
    for (const [key, constellation] of Object.entries(SATELLITES)) {
      newData[key] = {
        ...constellation,
        satellites: []
      };

      // Fetch each satellite in parallel (with rate limiting consideration)
      const promises = constellation.satellites.map(async (sat, index) => {
        // Small delay to avoid rate limiting (1000 req/hr = ~17/min)
        await new Promise(resolve => setTimeout(resolve, index * 100));
        
        const position = await fetchSatellitePosition(sat.id, lat, lon);
        return {
          ...sat,
          position
        };
      });

      const results = await Promise.all(promises);
      newData[key].satellites = results;
    }

    satelliteData = newData;
    lastFetch = new Date();
    
    Events.emit('satla:data-updated', satelliteData);
    return satelliteData;
  }

  // ============ ELEVATION QUALITY ============

  function getElevationQuality(elevation) {
    if (elevation === null || elevation === undefined) {
      return { status: 'unknown', color: '#888', label: 'Unknown', icon: '❓' };
    }
    if (elevation < 0) {
      return { status: 'below', color: '#ff4444', label: 'Below Horizon', icon: '🔴' };
    }
    if (elevation < 5) {
      return { status: 'poor', color: '#ff8800', label: 'Poor', icon: '🟠' };
    }
    if (elevation < 15) {
      return { status: 'marginal', color: '#ffcc00', label: 'Marginal', icon: '🟡' };
    }
    if (elevation < 30) {
      return { status: 'good', color: '#88ff00', label: 'Good', icon: '🟢' };
    }
    return { status: 'excellent', color: '#00ff88', label: 'Excellent', icon: '🟢' };
  }

  // ============ WEATHER IMPACT ============

  function getWeatherImpact(band, weatherData) {
    if (!weatherData) {
      return { impact: 'unknown', message: 'Weather data unavailable' };
    }

    const condition = (weatherData.main || '').toLowerCase();
    const humidity = weatherData.humidity || 0;

    // EHF bands most affected
    if (band === 'EHF' || band === 'Ka') {
      if (condition.includes('rain') || condition.includes('thunder')) {
        return { 
          impact: 'severe', 
          color: '#ff4444',
          message: `Heavy rain fade expected (10-20+ dB for EHF, 5-15 dB for Ka)` 
        };
      }
      if (condition.includes('drizzle') || condition.includes('snow')) {
        return { 
          impact: 'moderate', 
          color: '#ff8800',
          message: 'Moderate attenuation possible (3-10 dB)' 
        };
      }
      if (condition.includes('fog') || condition.includes('mist')) {
        return { 
          impact: 'minor', 
          color: '#ffcc00',
          message: 'Minor absorption from water vapor (2-5 dB)' 
        };
      }
      if (humidity > 85) {
        return { 
          impact: 'minor', 
          color: '#ffcc00',
          message: `High humidity (${humidity}%) - watch for precipitation` 
        };
      }
    }

    // X/Ku bands less affected
    if (band === 'X/Ka' || band === 'Ku/Ka' || band === 'C/Ku') {
      if (condition.includes('rain') || condition.includes('thunder')) {
        return { 
          impact: 'moderate', 
          color: '#ff8800',
          message: 'Rain fade possible on Ku/Ka (2-8 dB)' 
        };
      }
    }

    // C-band most resilient
    return { 
      impact: 'none', 
      color: '#00ff88',
      message: 'Good weather conditions for satellite links' 
    };
  }

  // ============ UI RENDERING ============

  function renderSatelliteLookAngles(containerEl) {
    if (!containerEl) return;

    const sanitize = window.RussellTV?.sanitize || (s => s);

    // Get weather data for current location
    const weatherData = currentLocation?.label 
      ? window.RussellTV?.InfoBar?.getWeather?.(currentLocation.label)
      : null;

    // Check Starlink coverage
    const starlinkStatus = currentLocation 
      ? checkStarlinkCoverage(currentLocation.lat, currentLocation.lon)
      : null;

    let html = `
      <div class="satla-section ${isExpanded ? 'expanded' : 'collapsed'}">
        <div class="satla-header" onclick="window.RussellTV.SatLookAngles.toggleExpand()">
          <span class="section-title">📡 Satellite Look Angles</span>
          <span class="expand-icon">${isExpanded ? '▼' : '▶'}</span>
        </div>
    `;

    if (isExpanded) {
      html += `
        <div class="satla-content">
          <!-- Location Input -->
          <div class="satla-location-input">
            <div class="input-row">
              <select id="satla-coord-format" class="coord-format-select">
                <option value="latlon">Lat/Long</option>
                <option value="mgrs">MGRS</option>
                <option value="maidenhead">Maidenhead</option>
              </select>
              <input type="text" id="satla-coord-input" 
                     placeholder="38.8977, -77.0365" 
                     class="coord-input"
                     value="${currentLocation ? `${currentLocation.lat}, ${currentLocation.lon}` : ''}">
              <button onclick="window.RussellTV.SatLookAngles.setLocation()" class="satla-btn">Set</button>
            </div>
            <div class="input-row">
              <button onclick="window.RussellTV.SatLookAngles.useSelectedLocation()" class="satla-btn secondary">
                Use Panel Location
              </button>
              <button onclick="window.RussellTV.SatLookAngles.refresh()" class="satla-btn secondary">
                🔄 Refresh
              </button>
            </div>
          </div>
      `;

      if (currentLocation) {
        // Current location display
        html += `
          <div class="satla-current-location">
            <strong>📍 ${sanitize(currentLocation.name || 'Custom Location')}</strong>
            <span class="coords">${currentLocation.lat.toFixed(4)}°, ${currentLocation.lon.toFixed(4)}°</span>
          </div>
        `;

        // Weather impact
        if (weatherData) {
          html += `
            <div class="satla-weather">
              <span class="wx-icon">${getWeatherEmoji(weatherData.main, weatherData.desc)}</span>
              <span>${sanitize(weatherData.desc || weatherData.main)}, ${weatherData.temp}°F, ${weatherData.humidity}% RH</span>
            </div>
          `;
        }

        // Starlink/Starshield status
        if (starlinkStatus) {
          const statusClass = starlinkStatus.available === true ? 'available' : 
                             starlinkStatus.available === 'limited' ? 'limited' : 'restricted';
          html += `
            <div class="satla-starlink ${statusClass}">
              <span class="starlink-icon">${starlinkStatus.icon}</span>
              <span class="starlink-label">Starshield:</span>
              <span class="starlink-status">${sanitize(starlinkStatus.message)}</span>
            </div>
          `;
        }

        // Constellation filters
        html += `
          <div class="satla-filters">
            <label><input type="checkbox" ${selectedConstellations.includes('wgs') ? 'checked' : ''} 
                   onchange="window.RussellTV.SatLookAngles.toggleConstellation('wgs')"> WGS</label>
            <label><input type="checkbox" ${selectedConstellations.includes('aehf') ? 'checked' : ''} 
                   onchange="window.RussellTV.SatLookAngles.toggleConstellation('aehf')"> AEHF</label>
            <label><input type="checkbox" ${selectedConstellations.includes('intelsat') ? 'checked' : ''} 
                   onchange="window.RussellTV.SatLookAngles.toggleConstellation('intelsat')"> Intelsat</label>
            <label><input type="checkbox" ${selectedConstellations.includes('eutelsat') ? 'checked' : ''} 
                   onchange="window.RussellTV.SatLookAngles.toggleConstellation('eutelsat')"> Eutelsat</label>
            <label><input type="checkbox" ${selectedConstellations.includes('ses') ? 'checked' : ''} 
                   onchange="window.RussellTV.SatLookAngles.toggleConstellation('ses')"> SES</label>
            <label><input type="checkbox" ${selectedConstellations.includes('other') ? 'checked' : ''} 
                   onchange="window.RussellTV.SatLookAngles.toggleConstellation('other')"> Other</label>
          </div>
        `;

        // Satellite tables
        for (const [key, constellation] of Object.entries(satelliteData)) {
          if (!selectedConstellations.includes(key)) continue;

          const weatherImpact = getWeatherImpact(constellation.band, weatherData);
          const visibleSats = constellation.satellites.filter(s => s.position?.elevation >= 0);
          const belowHorizon = constellation.satellites.filter(s => s.position?.elevation < 0);

          html += `
            <div class="satla-constellation">
              <div class="constellation-header">
                <span class="constellation-name">${sanitize(constellation.name)}</span>
                <span class="constellation-band">${sanitize(constellation.band)}</span>
                <span class="constellation-count">${visibleSats.length}/${constellation.satellites.length} visible</span>
              </div>
          `;

          // Weather impact for this band
          if (weatherImpact.impact !== 'none') {
            html += `
              <div class="band-weather-alert" style="border-left-color: ${weatherImpact.color}">
                ⚠️ ${sanitize(weatherImpact.message)}
              </div>
            `;
          }

          // Satellite table
          html += `
              <table class="sat-table">
                <thead>
                  <tr>
                    <th>Satellite</th>
                    <th>Az</th>
                    <th>El</th>
                    <th>Range</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
          `;

          // Sort by elevation (highest first)
          const sortedSats = [...constellation.satellites].sort((a, b) => {
            const elA = a.position?.elevation ?? -999;
            const elB = b.position?.elevation ?? -999;
            return elB - elA;
          });

          for (const sat of sortedSats) {
            const pos = sat.position;
            const quality = getElevationQuality(pos?.elevation);
            
            html += `
              <tr class="sat-row ${quality.status}">
                <td class="sat-name">${sanitize(sat.name)}</td>
                <td class="sat-az">${pos?.azimuth != null ? pos.azimuth.toFixed(1) + '°' : '--'}</td>
                <td class="sat-el" style="color: ${quality.color}">${pos?.elevation != null ? pos.elevation.toFixed(1) + '°' : '--'}</td>
                <td class="sat-range">${pos?.range ? (pos.range).toLocaleString() + ' km' : '--'}</td>
                <td class="sat-status">${quality.icon}</td>
              </tr>
            `;
          }

          html += `
                </tbody>
              </table>
            </div>
          `;
        }

        // Last update time
        if (lastFetch) {
          html += `
            <div class="satla-footer">
              <span>Last updated: ${lastFetch.toLocaleTimeString()}</span>
              <span class="satla-source">Data: <a href="https://www.n2yo.com/" target="_blank" rel="noopener noreferrer">N2YO</a></span>
            </div>
          `;
        }
      } else {
        html += `
          <div class="satla-no-location">
            Enter coordinates above or select "Use Panel Location" to calculate look angles.
          </div>
        `;
      }

      html += `</div>`; // .satla-content
    }

    html += `</div>`; // .satla-section

    containerEl.innerHTML = html;
  }

  function getWeatherEmoji(main, desc) {
    const w = `${main} ${desc}`.toLowerCase();
    if (w.includes('thunder') || w.includes('storm')) return '⛈️';
    if (w.includes('rain') || w.includes('drizzle')) return '🌧️';
    if (w.includes('snow')) return '🌨️';
    if (w.includes('cloud')) return '☁️';
    if (w.includes('fog') || w.includes('mist')) return '🌫️';
    return '☀️';
  }

  // ============ STYLES ============

  const styles = `
    .satla-section {
      margin-top: 1rem;
      border: 1px solid rgba(100, 150, 255, 0.3);
      border-radius: 8px;
      overflow: hidden;
    }

    .satla-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem 1rem;
      background: rgba(100, 150, 255, 0.1);
      cursor: pointer;
      user-select: none;
    }

    .satla-header:hover {
      background: rgba(100, 150, 255, 0.2);
    }

    .satla-header .section-title {
      font-weight: bold;
      font-size: 0.9rem;
    }

    .expand-icon {
      font-size: 0.8rem;
      opacity: 0.7;
    }

    .satla-content {
      padding: 1rem;
    }

    .satla-location-input {
      margin-bottom: 1rem;
    }

    .input-row {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
    }

    .coord-format-select {
      padding: 0.4rem;
      border-radius: 4px;
      border: 1px solid rgba(255,255,255,0.2);
      background: rgba(0,0,0,0.3);
      color: white;
      font-size: 0.8rem;
    }

    .coord-input {
      flex: 1;
      padding: 0.4rem 0.6rem;
      border-radius: 4px;
      border: 1px solid rgba(255,255,255,0.2);
      background: rgba(0,0,0,0.3);
      color: white;
      font-size: 0.85rem;
    }

    .satla-btn {
      padding: 0.4rem 0.8rem;
      border-radius: 4px;
      border: 1px solid rgba(100, 150, 255, 0.5);
      background: rgba(100, 150, 255, 0.2);
      color: white;
      cursor: pointer;
      font-size: 0.8rem;
      white-space: nowrap;
    }

    .satla-btn:hover {
      background: rgba(100, 150, 255, 0.4);
    }

    .satla-btn.secondary {
      background: rgba(255,255,255,0.1);
      border-color: rgba(255,255,255,0.2);
    }

    .satla-current-location {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.5rem 0.75rem;
      background: rgba(100, 150, 255, 0.1);
      border-radius: 4px;
      margin-bottom: 0.75rem;
      font-size: 0.85rem;
    }

    .satla-current-location .coords {
      font-family: monospace;
      font-size: 0.8rem;
      opacity: 0.7;
    }

    .satla-weather {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.4rem 0.75rem;
      background: rgba(255,255,255,0.05);
      border-radius: 4px;
      margin-bottom: 0.75rem;
      font-size: 0.85rem;
    }

    .satla-weather .wx-icon {
      font-size: 1.2rem;
    }

    .satla-starlink {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0.75rem;
      border-radius: 4px;
      margin-bottom: 0.75rem;
      font-size: 0.8rem;
    }

    .satla-starlink.available {
      background: rgba(0, 255, 100, 0.1);
      border: 1px solid rgba(0, 255, 100, 0.3);
    }

    .satla-starlink.limited {
      background: rgba(255, 200, 0, 0.1);
      border: 1px solid rgba(255, 200, 0, 0.3);
    }

    .satla-starlink.restricted {
      background: rgba(255, 68, 68, 0.1);
      border: 1px solid rgba(255, 68, 68, 0.3);
    }

    .satla-starlink .starlink-label {
      font-weight: bold;
    }

    .satla-filters {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem 1rem;
      padding: 0.5rem 0;
      margin-bottom: 0.75rem;
      border-bottom: 1px solid rgba(255,255,255,0.1);
      font-size: 0.8rem;
    }

    .satla-filters label {
      display: flex;
      align-items: center;
      gap: 0.3rem;
      cursor: pointer;
    }

    .satla-constellation {
      margin-bottom: 1rem;
    }

    .constellation-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.4rem 0;
      border-bottom: 1px solid rgba(255,255,255,0.1);
      margin-bottom: 0.5rem;
    }

    .constellation-name {
      font-weight: bold;
      font-size: 0.9rem;
    }

    .constellation-band {
      font-size: 0.75rem;
      padding: 0.15rem 0.4rem;
      background: rgba(255,120,0,0.2);
      border-radius: 3px;
      color: #ffaa00;
    }

    .constellation-count {
      margin-left: auto;
      font-size: 0.75rem;
      opacity: 0.6;
    }

    .band-weather-alert {
      padding: 0.4rem 0.6rem;
      background: rgba(255,255,255,0.05);
      border-left: 3px solid #ff8800;
      margin-bottom: 0.5rem;
      font-size: 0.75rem;
    }

    .sat-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.8rem;
    }

    .sat-table th {
      text-align: left;
      padding: 0.3rem 0.5rem;
      border-bottom: 1px solid rgba(255,255,255,0.2);
      font-size: 0.7rem;
      text-transform: uppercase;
      opacity: 0.7;
    }

    .sat-table td {
      padding: 0.35rem 0.5rem;
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }

    .sat-row.below {
      opacity: 0.5;
    }

    .sat-row.poor td {
      background: rgba(255, 136, 0, 0.1);
    }

    .sat-row.marginal td {
      background: rgba(255, 204, 0, 0.05);
    }

    .sat-name {
      font-weight: 500;
    }

    .sat-az, .sat-el, .sat-range {
      font-family: monospace;
      font-size: 0.8rem;
    }

    .sat-status {
      text-align: center;
    }

    .satla-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 0.75rem;
      margin-top: 0.75rem;
      border-top: 1px solid rgba(255,255,255,0.1);
      font-size: 0.7rem;
      opacity: 0.6;
    }

    .satla-footer a {
      color: rgba(100, 180, 255, 0.9);
    }

    .satla-no-location {
      text-align: center;
      padding: 2rem;
      opacity: 0.6;
      font-size: 0.85rem;
    }
  `;

  // ============ PUBLIC API ============

  function toggleExpand() {
    isExpanded = !isExpanded;
    Events.emit('satla:render');
  }

  function toggleConstellation(key) {
    const idx = selectedConstellations.indexOf(key);
    if (idx >= 0) {
      selectedConstellations.splice(idx, 1);
    } else {
      selectedConstellations.push(key);
    }
    Events.emit('satla:render');
  }

  function setLocation() {
    const formatEl = document.getElementById('satla-coord-format');
    const inputEl = document.getElementById('satla-coord-input');
    
    if (!formatEl || !inputEl) return;

    try {
      const coords = parseCoordinates(inputEl.value, formatEl.value);
      currentLocation = {
        lat: parseFloat(coords.lat),
        lon: parseFloat(coords.lon),
        name: `${coords.lat}, ${coords.lon}`,
        source: 'manual'
      };
      
      fetchAllSatellites().then(() => {
        Events.emit('satla:render');
      });
    } catch (e) {
      alert(e.message);
    }
  }

  function useSelectedLocation() {
    // Get location from propagation panel
    const selectEl = document.getElementById('prop-location-select');
    if (!selectEl || !window.TIME_ZONES) {
      alert('No location selected in propagation panel');
      return;
    }

    const idx = parseInt(selectEl.value);
    const loc = window.TIME_ZONES[idx];
    
    if (!loc || !loc.coords) {
      alert('Selected location has no coordinates');
      return;
    }

    currentLocation = {
      lat: loc.coords.lat,
      lon: loc.coords.lon,
      name: loc.label,
      label: loc.label,
      source: 'panel'
    };

    // Update input field
    const inputEl = document.getElementById('satla-coord-input');
    if (inputEl) {
      inputEl.value = `${loc.coords.lat}, ${loc.coords.lon}`;
    }

    fetchAllSatellites().then(() => {
      Events.emit('satla:render');
    });
  }

  function refresh() {
    if (!currentLocation) {
      alert('Set a location first');
      return;
    }
    fetchAllSatellites().then(() => {
      Events.emit('satla:render');
    });
  }

  function startAutoRefresh() {
    if (autoRefreshTimer) {
      clearInterval(autoRefreshTimer);
    }
    autoRefreshTimer = setInterval(() => {
      if (currentLocation) {
        fetchAllSatellites().then(() => {
          Events.emit('satla:render');
        });
      }
    }, 60000); // Every 60 seconds
  }

  function stopAutoRefresh() {
    if (autoRefreshTimer) {
      clearInterval(autoRefreshTimer);
      autoRefreshTimer = null;
    }
  }

  // ============ INITIALIZATION ============

  function init() {
    // Inject styles
    const styleEl = document.createElement('style');
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);

    // Start auto-refresh
    startAutoRefresh();

    console.log('✅ [SatLookAngles] Initialized');
  }

  // Initialize when core is ready
  Events.whenReady('core:ready', init);

  // ============ EXPORTS ============

  window.RussellTV = window.RussellTV || {};
  window.RussellTV.SatLookAngles = {
    render: renderSatelliteLookAngles,
    toggleExpand,
    toggleConstellation,
    setLocation,
    useSelectedLocation,
    refresh,
    setCurrentLocation: (loc) => { currentLocation = loc; },
    getData: () => satelliteData,
    checkStarlinkCoverage
  };

})();
