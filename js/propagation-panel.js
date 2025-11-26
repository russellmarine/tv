/**
 * propagation-panel.js - Enhanced HF/SATCOM Propagation Panel
 * FIXED VERSION - Uses centralized SpaceWeather data for consistency
 * - Draggable
 * - Location-aware (uses selected time zone)
 * - Weather-aware SATCOM predictions
 */

window.RussellTV = window.RussellTV || {};

window.RussellTV.PropagationPanel = (function() {
  'use strict';

  let panelVisible = false;
  let solarData = null;
  let isDragging = false;
  let dragOffset = { x: 0, y: 0 };
  let selectedLocation = null;

  async function fetchSolarData() {
    try {
      const solarResponse = await fetch('/api/spaceweather/text/daily-solar-indices.txt');
      const solarText = await solarResponse.text();
      
      const lines = solarText.trim().split('\n');
      const dataLine = lines[lines.length - 1];
      const parts = dataLine.split(/\s+/);
      
      // FIX: Don't store kIndex here - we'll get it from centralized SpaceWeather
      solarData = {
        solarFlux: parseFloat(parts[3]) || 150,
        sunspotNumber: parseInt(parts[1]) || 50,
        aIndex: parseFloat(parts[4]) || 10
        // kIndex removed - will use SpaceWeather.getCurrentData().kpIndex instead
      };
      
      console.log('☀️ Solar data fetched:', solarData);
      return solarData;
    } catch (error) {
      console.warn('Could not fetch solar data, using defaults:', error);
      solarData = {
        solarFlux: 150,
        sunspotNumber: 50,
        aIndex: 10
      };
      return solarData;
    }
  }

  // FIX: Helper function to get Kp index from centralized source
  function getKpIndex() {
    const swData = window.RussellTV?.SpaceWeather?.getCurrentData();
    if (swData && typeof swData.kpIndex === 'number' && !isNaN(swData.kpIndex)) {
      return swData.kpIndex;
    }
    // Fallback to a reasonable default
    console.warn('⚠️ SpaceWeather data not available, using default Kp');
    return 3;
  }

  // Calculate solar elevation angle for twilight determination
  function calculateSolarElevation(date, latitude, longitude) {
    // Convert to radians
    const lat = latitude * Math.PI / 180;
    const lon = longitude * Math.PI / 180;
    
    // Days since J2000.0
    const JD = date.getTime() / 86400000 + 2440587.5;
    const n = JD - 2451545.0;
    
    // Mean solar longitude
    const L = (280.460 + 0.9856474 * n) % 360;
    
    // Mean anomaly
    const g = (357.528 + 0.9856003 * n) % 360;
    const gRad = g * Math.PI / 180;
    
    // Ecliptic longitude
    const lambda = (L + 1.915 * Math.sin(gRad) + 0.020 * Math.sin(2 * gRad)) % 360;
    const lambdaRad = lambda * Math.PI / 180;
    
    // Obliquity of ecliptic
    const epsilon = (23.439 - 0.0000004 * n) * Math.PI / 180;
    
    // Declination
    const delta = Math.asin(Math.sin(epsilon) * Math.sin(lambdaRad));
    
    // Right ascension
    const RA = Math.atan2(Math.cos(epsilon) * Math.sin(lambdaRad), Math.cos(lambdaRad));
    
    // Greenwich Mean Sidereal Time
    const GMST = (280.460 + 360.9856474 * n) % 360;
    const GMSTRad = GMST * Math.PI / 180;
    
    // Local Hour Angle
    const LHA = GMSTRad + lon - RA;
    
    // Solar elevation angle
    const sinAlt = Math.sin(lat) * Math.sin(delta) + Math.cos(lat) * Math.cos(delta) * Math.cos(LHA);
    const elevation = Math.asin(sinAlt) * 180 / Math.PI;
    
    return elevation;
  }

  // Get twilight phase based on solar elevation
  function getTwilightPhase(elevation) {
    if (elevation > 0) {
      return { phase: 'Day', icon: '☀️', isDay: true };
    } else if (elevation > -6) {
      return { phase: 'Civil Twilight', icon: '🌆', isDay: true };
    } else if (elevation > -12) {
      return { phase: 'Nautical Twilight', icon: '⛵', isDay: false };
    } else if (elevation > -18) {
      return { phase: 'Astronomical Twilight', icon: '🌌', isDay: false };
    } else {
      return { phase: 'Night', icon: '🌙', isDay: false };
    }
  }

  function calculateMUF(solarFlux, isDay, latitude, kpIndex) {
    const solarZenithFactor = isDay ? 1.0 : 0.5;
    const absLat = Math.abs(latitude);
    let latitudeFactor;
    
    if (absLat < 15) {
      latitudeFactor = 1.15;
    } else if (absLat < 30) {
      latitudeFactor = 1.1;
    } else if (absLat < 50) {
      latitudeFactor = 1.0;
    } else if (absLat < 60) {
      latitudeFactor = 0.9;
    } else {
      latitudeFactor = 0.75;
    }
    
    let kpFactor = 1.0;
    if (kpIndex >= 7) {
      kpFactor = 0.7;
    } else if (kpIndex >= 5) {
      kpFactor = 0.8;
    } else if (kpIndex >= 4) {
      kpFactor = 0.9;
    }
    
    const ssn = (solarFlux - 60) / 0.9;
    const foF2_base = Math.sqrt(0.9 * (Math.max(ssn, 0) + 100));
    const foF2 = foF2_base * solarZenithFactor * latitudeFactor * kpFactor;
    const mFactor = 3.5;
    const muf3000 = foF2 * mFactor;
    
    return {
      muf: muf3000,
      foF2: foF2,
      latitudeFactor: latitudeFactor,
      kpFactor: kpFactor,
      conditions: getConditionDescription(latitude, kpIndex, isDay)
    };
  }

  function getConditionDescription(latitude, kpIndex, isDay) {
    const absLat = Math.abs(latitude);
    let desc = [];
    
    if (absLat < 15) {
      desc.push('Equatorial enhancement');
    } else if (absLat > 55) {
      desc.push('High-latitude variability');
      if (kpIndex >= 4) {
        desc.push('auroral absorption likely');
      }
    }
    
    if (kpIndex >= 5) {
      desc.push('geomagnetic storm degradation');
    }
    
    if (!isDay && absLat > 60) {
      desc.push('polar darkness - very limited propagation');
    }
    
    return desc.length > 0 ? desc.join(', ') : 'nominal conditions';
  }

  function getBestBands(mufData, conditions) {
    const bands = [];
    const muf = mufData.muf;
    
    if (!conditions.isDay && muf > 5) {
      bands.push({ band: '80m', freq: '3.5-4.0 MHz', quality: 'good', note: 'Night DX' });
    }
    
    if (muf > 8) {
      bands.push({ 
        band: '40m', 
        freq: '7.0-7.3 MHz', 
        quality: conditions.isDay ? 'fair' : 'excellent', 
        note: conditions.isDay ? 'NVIS/Regional' : 'Long DX' 
      });
    }
    
    if (muf > 12) {
      bands.push({ band: '30m', freq: '10.1-10.15 MHz', quality: 'good', note: 'Digital modes' });
    }
    
    if (muf > 18 && conditions.isDay) {
      bands.push({ band: '20m', freq: '14.0-14.35 MHz', quality: 'excellent', note: 'Best DX' });
    } else if (muf > 18) {
      bands.push({ band: '20m', freq: '14.0-14.35 MHz', quality: 'good', note: 'DX possible' });
    }
    
    if (muf > 22 && conditions.isDay) {
      bands.push({ band: '17m', freq: '18.068-18.168 MHz', quality: 'good', note: 'Day DX' });
    }
    
    if (muf > 25 && conditions.isDay && conditions.solarFlux > 120) {
      bands.push({ band: '15m', freq: '21.0-21.45 MHz', quality: 'excellent', note: 'High activity' });
    }
    
    if (muf > 28 && conditions.isDay && conditions.solarFlux > 140) {
      bands.push({ band: '12m', freq: '24.89-24.99 MHz', quality: 'good', note: 'Peak times' });
    }
    
    if (muf > 32 && conditions.solarFlux > 150) {
      bands.push({ band: '10m', freq: '28.0-29.7 MHz', quality: 'fair', note: 'Solar max' });
    }
    
    if (bands.length === 0) {
      bands.push({ band: '40m', freq: '7.0-7.3 MHz', quality: 'fair', note: 'Poor conditions' });
    }
    
    return bands;
  }

  function getCurrentLocation() {
    if (selectedLocation) return selectedLocation;
    
    const infoBlocks = document.querySelectorAll('.info-block');
    for (const block of infoBlocks) {
      const text = block.textContent;
      if (!text.includes('Zulu') && text.includes('°')) {
        const match = text.match(/^([^0-9]+)/);
        if (match) {
          return match[1].trim();
        }
      }
    }
    return null;
  }

  function getAvailableLocations() {
    const locations = [];
    
    if (window.TIME_ZONES) {
      window.TIME_ZONES.forEach(tz => {
        if (!/zulu/i.test(tz.label)) {
          locations.push(tz.label);
        }
      });
    }
    
    if (locations.length === 0) {
      const infoBlocks = document.querySelectorAll('.info-block');
      for (const block of infoBlocks) {
        const text = block.textContent;
        if (!text.includes('Zulu') && text.includes('°')) {
          const match = text.match(/^([^0-9]+)/);
          if (match) {
            const location = match[1].trim();
            if (!locations.includes(location)) {
              locations.push(location);
            }
          }
        }
      }
    }
    
    return locations;
  }

  function getLocationWeather(locationName) {
    const blocks = document.querySelectorAll('.info-block.has-tooltip');
    for (const block of blocks) {
      if (block.textContent.includes(locationName)) {
        const tooltip = block.getAttribute('data-tooltip');
        if (tooltip) {
          const conditionsMatch = tooltip.match(/Conditions: ([^(]+) \(([^)]+)\)/);
          if (conditionsMatch) {
            return {
              main: conditionsMatch[1].trim(),
              desc: conditionsMatch[2].trim()
            };
          }
        }
      }
    }
    return null;
  }

  function assessSATCOM(weather, spaceWeatherStatus) {
    const issues = [];
    let quality = 'excellent';

    if (weather) {
      const w = weather.main.toLowerCase() + ' ' + weather.desc.toLowerCase();
      
      if (w.includes('rain') || w.includes('storm') || w.includes('thunder')) {
        issues.push('☔ Rain fade affects Ka-band (20+ GHz)');
        quality = 'degraded';
      }
      
      if (w.includes('snow') || w.includes('sleet')) {
        issues.push('❄️ Snow/ice affects Ku/Ka-band');
        quality = 'degraded';
      }
      
      if (w.includes('fog') || w.includes('mist')) {
        issues.push('🌫️ Fog can affect Ka-band');
        if (quality === 'excellent') quality = 'fair';
      }
      
      if (w.includes('cloud') && w.includes('overcast')) {
        issues.push('☁️ Heavy clouds may attenuate Ka-band');
        if (quality === 'excellent') quality = 'good';
      }
    }

    if (spaceWeatherStatus === 'red' || spaceWeatherStatus === 'orange') {
      issues.push('⚠️ Solar activity may affect satellite links');
      if (quality === 'excellent') quality = 'good';
    }

    return { quality, issues };
  }

  function createPanel() {
    if (document.getElementById('propagation-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'propagation-panel';
    panel.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      width: 400px;
      max-height: 80vh;
      overflow-y: auto;
      background: rgba(0, 0, 0, 0.95);
      border: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: 12px;
      padding: 0;
      z-index: 9999;
      display: none;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.8);
      color: white;
      font-size: 0.9rem;
      cursor: default;
    `;

    panel.innerHTML = `
      <div id="prop-panel-header" style="
        padding: 1rem;
        background: rgba(255, 255, 255, 0.05);
        border-bottom: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 12px 12px 0 0;
        cursor: move;
        user-select: none;
      ">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
          <h3 style="margin: 0; font-size: 1.1rem;">📡 HF/SATCOM Propagation</h3>
          <button id="close-prop-panel" style="
            background: none;
            border: none;
            color: white;
            font-size: 1.5rem;
            cursor: pointer;
            padding: 0;
            width: 30px;
            height: 30px;
            line-height: 1;
          ">&times;</button>
        </div>
        <select id="location-selector" style="
          width: 100%;
          padding: 0.4rem;
          background: rgba(0, 0, 0, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.3);
          border-radius: 4px;
          color: white;
          font-size: 0.85rem;
          cursor: pointer;
        ">
          <option value="">📍 Auto-detect location</option>
        </select>
      </div>
      
      <div id="prop-content" style="padding: 1rem;">
        <div style="text-align: center; padding: 2rem; opacity: 0.7;">
          Loading conditions...
        </div>
      </div>
    `;

    document.body.appendChild(panel);

    const locationSelector = document.getElementById('location-selector');
    const locations = getAvailableLocations();
    locations.forEach(loc => {
      const option = document.createElement('option');
      option.value = loc;
      option.textContent = loc;
      locationSelector.appendChild(option);
    });

    locationSelector.addEventListener('change', (e) => {
      selectedLocation = e.target.value || null;
      updatePanelContent();
    });

    const header = document.getElementById('prop-panel-header');
    
    header.addEventListener('mousedown', (e) => {
      if (e.target.id === 'close-prop-panel' || 
          e.target.id === 'location-selector' ||
          e.target.closest('#location-selector')) {
        return;
      }
      isDragging = true;
      const rect = panel.getBoundingClientRect();
      dragOffset.x = e.clientX - rect.left;
      dragOffset.y = e.clientY - rect.top;
      header.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      
      const newLeft = e.clientX - dragOffset.x;
      const newTop = e.clientY - dragOffset.y;
      
      const maxX = window.innerWidth - panel.offsetWidth;
      const maxY = window.innerHeight - panel.offsetHeight;
      
      panel.style.left = Math.max(0, Math.min(newLeft, maxX)) + 'px';
      panel.style.top = Math.max(0, Math.min(newTop, maxY)) + 'px';
      panel.style.right = 'auto';
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        header.style.cursor = 'move';
      }
    });

    document.getElementById('close-prop-panel').addEventListener('click', hide);

    document.addEventListener('click', (e) => {
      if (panelVisible && !panel.contains(e.target) && !e.target.closest('#propagation-panel-btn')) {
        hide();
      }
    });

    updatePanelContent();
  }

  async function updatePanelContent() {
    if (!solarData) {
      await fetchSolarData();
    }

    const content = document.getElementById('prop-content');
    if (!content) return;

    const locationName = getCurrentLocation();
    const weather = locationName ? getLocationWeather(locationName) : null;

    let isDay = false;
    let localTime = 'Unknown';
    let twilightPhase = { phase: 'Unknown', icon: '❓', isDay: false };
    let latitude = 35.0;
    let longitude = 0.0;
    
    if (locationName && window.TIME_ZONES) {
      const tzInfo = window.TIME_ZONES.find(tz => tz.label === locationName);
      if (tzInfo) {
        const now = new Date();
        const localTimeStr = now.toLocaleString("en-US", {
          timeZone: tzInfo.tz,
          hour12: false,
          hour: "2-digit",
          minute: "2-digit"
        });
        localTime = localTimeStr;
        
        // Get coordinates
        if (tzInfo.lat) latitude = tzInfo.lat;
        if (tzInfo.lon) longitude = tzInfo.lon;
        
        // Calculate solar elevation for precise twilight
        const solarElevation = calculateSolarElevation(now, latitude, longitude);
        twilightPhase = getTwilightPhase(solarElevation);
        isDay = twilightPhase.isDay;
      }
    } else {
      // Fallback to UTC
      const now = new Date();
      const hour = now.getUTCHours();
      isDay = hour >= 6 && hour < 18;
      twilightPhase = { phase: isDay ? 'Day' : 'Night', icon: isDay ? '☀️' : '🌙', isDay };
      localTime = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }) + ' UTC';
    }

    // FIX: Get Kp index from centralized SpaceWeather data
    const swData = window.RussellTV?.SpaceWeather?.getCurrentData();
    const kpIndex = getKpIndex(); // Use helper function for consistent Kp

    const mufData = calculateMUF(solarData.solarFlux, isDay, latitude, kpIndex);
    
    const conditions = {
      isDay,
      solarFlux: solarData.solarFlux,
      sunspotNumber: solarData.sunspotNumber,
      kIndex: kpIndex,
      rScale: swData?.scales?.R || 0
    };

    const bestBands = getBestBands(mufData, conditions);

    const satcomStatus = swData?.status?.satcom || 'green';
    const satcom = assessSATCOM(weather, satcomStatus);

    // FIX: Show data source info for debugging
    const dataSourceInfo = swData 
      ? `Real-time (${formatTimeAgo(swData.timestamp)})`
      : 'Default values';

    let html = `
      ${locationName ? `
      <div style="background: rgba(100, 150, 255, 0.15); border-left: 3px solid rgba(100, 150, 255, 0.6); padding: 0.75rem; margin-bottom: 1rem; border-radius: 4px;">
        <div style="font-weight: bold; margin-bottom: 0.25rem;">📍 ${locationName} (${latitude.toFixed(1)}°${latitude >= 0 ? 'N' : 'S'})</div>
        <div style="font-size: 0.85rem; opacity: 0.9;">Local Time: ${localTime} ${twilightPhase.icon} ${twilightPhase.phase}</div>
        ${weather ? `<div style="font-size: 0.85rem; opacity: 0.9;">Weather: ${weather.main} (${weather.desc})</div>` : ''}
      </div>
      ` : ''}

      <div style="background: rgba(255, 255, 255, 0.05); border-radius: 8px; padding: 0.75rem; margin-bottom: 1rem;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; font-size: 0.85rem;">
          <div>
            <div style="opacity: 0.7; font-size: 0.75rem;">Solar Flux</div>
            <div style="font-size: 1.1rem; font-weight: bold; color: #ff9900;">${solarData.solarFlux.toFixed(0)} sfu</div>
          </div>
          <div>
            <div style="opacity: 0.7; font-size: 0.75rem;">Sunspot #</div>
            <div style="font-size: 1.1rem; font-weight: bold;">${solarData.sunspotNumber}</div>
          </div>
          <div>
            <div style="opacity: 0.7; font-size: 0.75rem;">MUF (3000km)</div>
            <div style="font-size: 1.1rem; font-weight: bold; color: #00ff00;">${mufData.muf.toFixed(1)} MHz</div>
          </div>
          <div>
            <div style="opacity: 0.7; font-size: 0.75rem;">foF2 Critical</div>
            <div style="font-size: 1.1rem; font-weight: bold; color: #00ccff;">${mufData.foF2.toFixed(1)} MHz</div>
          </div>
        </div>
        <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid rgba(255,255,255,0.1); font-size: 0.75rem; opacity: 0.9;">
          <strong>Ionospheric Factors:</strong>
          <div style="margin-top: 0.25rem;">
            Latitude (${latitude.toFixed(1)}°): ${(mufData.latitudeFactor * 100).toFixed(0)}% | 
            Geomagnetic (Kp ${kpIndex.toFixed(1)}): ${(mufData.kpFactor * 100).toFixed(0)}%
          </div>
          ${mufData.conditions !== 'nominal conditions' ? `
            <div style="margin-top: 0.25rem; color: #ffaa00;">⚠️ ${mufData.conditions}</div>
          ` : ''}
        </div>
        <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid rgba(255,255,255,0.1); font-size: 0.8rem; opacity: 0.8;">
          <strong>Current Conditions:</strong>
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.25rem;">
            <span style="background: ${isDay ? 'rgba(255,200,0,0.2)' : 'rgba(0,100,255,0.2)'}; padding: 0.25rem 0.5rem; border-radius: 4px;">
              ${isDay ? '☀️ Daytime' : '🌙 Nighttime'}
            </span>
            <span style="background: rgba(255,255,255,0.1); padding: 0.25rem 0.5rem; border-radius: 4px;">
              ${solarData.solarFlux > 150 ? '📈 High' : solarData.solarFlux > 100 ? '📊 Moderate' : '📉 Low'} Solar Activity
            </span>
            ${conditions.rScale > 0 ? `
              <span style="background: rgba(255,0,0,0.3); padding: 0.25rem 0.5rem; border-radius: 4px;">
                ⚠️ R${conditions.rScale} Blackout
              </span>
            ` : ''}
          </div>
        </div>
      </div>

      <div style="margin-bottom: 1rem;">
        <div style="font-weight: bold; margin-bottom: 0.5rem; font-size: 0.95rem;">📡 SATCOM Status (${locationName || 'Global'}):</div>
        <div style="background: rgba(255,255,255,0.05); border-left: 3px solid ${satcom.quality === 'excellent' ? '#00ff00' : satcom.quality === 'good' ? '#ffff00' : satcom.quality === 'fair' ? '#ff9900' : '#ff0000'}; padding: 0.5rem; border-radius: 4px;">
          <div style="font-weight: bold; text-transform: capitalize; margin-bottom: 0.25rem;">
            ${satcom.quality === 'excellent' ? '✅' : satcom.quality === 'degraded' ? '⚠️' : '🟡'} ${satcom.quality}
          </div>
          ${satcom.issues.length > 0 ? `
            <div style="font-size: 0.8rem; opacity: 0.9;">
              ${satcom.issues.map(issue => `<div style="margin-top: 0.25rem;">${issue}</div>`).join('')}
            </div>
          ` : '<div style="font-size: 0.8rem; opacity: 0.9;">✅ No weather impacts detected</div>'}
          <div style="font-size: 0.75rem; opacity: 0.7; margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid rgba(255,255,255,0.1);">
            <strong>Band Sensitivity:</strong><br>
            C-band (4-8 GHz): Rain resistant<br>
            Ku-band (12-18 GHz): Moderate rain fade<br>
            Ka-band (26-40 GHz): High rain fade<br>
            X-band (8-12 GHz): Military, rain resistant
          </div>
        </div>
      </div>

      <div style="margin-bottom: 1rem;">
        <div style="font-weight: bold; margin-bottom: 0.5rem; font-size: 0.95rem;">📻 Best HF Bands Now:</div>
        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
    `;

    bestBands.forEach(band => {
      const qualityColor = {
        'excellent': '#00ff00',
        'good': '#ffff00',
        'fair': '#ff9900'
      }[band.quality] || '#888';

      html += `
        <div style="background: rgba(255,255,255,0.05); border-left: 3px solid ${qualityColor}; padding: 0.5rem; border-radius: 4px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
            <span style="font-weight: bold; font-size: 0.95rem;">${band.band}</span>
            <span style="color: ${qualityColor}; font-size: 0.8rem; text-transform: uppercase;">${band.quality}</span>
          </div>
          <div style="font-size: 0.8rem; opacity: 0.8;">${band.freq}</div>
          <div style="font-size: 0.75rem; opacity: 0.7; margin-top: 0.25rem;">${band.note}</div>
        </div>
      `;
    });

    html += `
        </div>
      </div>

      <div style="background: rgba(255,255,255,0.05); border-radius: 8px; padding: 0.75rem; font-size: 0.8rem;">
        <div style="font-weight: bold; margin-bottom: 0.5rem;">External Resources:</div>
        <a href="https://weatherspotter.net/propagation.php" target="_blank" 
           style="color: #ff9900; text-decoration: none; display: block; margin-bottom: 0.3rem;"
           onmouseover="this.style.color='#ffbb00'" onmouseout="this.style.color='#ff9900'">
          📊 Live Propagation Maps →
        </a>
        <a href="https://www.voacap.com/prediction.html" target="_blank"
           style="color: #ff9900; text-decoration: none; display: block; margin-bottom: 0.3rem;"
           onmouseover="this.style.color='#ffbb00'" onmouseout="this.style.color='#ff9900'">
          📡 VOACAP Path Predictions →
        </a>
        <a href="https://www.hamqsl.com/solar.html" target="_blank"
           style="color: #ff9900; text-decoration: none; display: block;"
           onmouseover="this.style.color='#ffbb00'" onmouseout="this.style.color='#ff9900'">
          ☀️ Solar Data & Charts →
        </a>
      </div>

      <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.2); font-size: 0.75rem; opacity: 0.6; text-align: center;">
        Updated: ${new Date().toLocaleTimeString()} | Data: ${dataSourceInfo}<br>
        <span style="font-size: 0.7rem; opacity: 0.7;">💡 Drag header to move panel</span>
      </div>
    `;

    content.innerHTML = html;
  }

  // FIX: Helper to format time ago
  function formatTimeAgo(date) {
    if (!date) return 'unknown';
    const now = new Date();
    const diff = Math.floor((now - new Date(date)) / 60000);
    if (diff < 1) return 'just now';
    if (diff < 60) return `${diff}m ago`;
    const hours = Math.floor(diff / 60);
    if (hours < 24) return `${hours}h ago`;
    return new Date(date).toLocaleString();
  }

  function show() {
    const panel = document.getElementById('propagation-panel');
    if (!panel) {
      createPanel();
      return;
    }

    const locationSelector = document.getElementById('location-selector');
    if (locationSelector) {
      while (locationSelector.options.length > 1) {
        locationSelector.remove(1);
      }
      
      const locations = getAvailableLocations();
      locations.forEach(loc => {
        const option = document.createElement('option');
        option.value = loc;
        option.textContent = loc;
        locationSelector.appendChild(option);
      });
      
      if (selectedLocation) {
        locationSelector.value = selectedLocation;
      }
    }

    panel.style.display = 'block';
    panelVisible = true;
    updatePanelContent();
    
    console.log('📡 Propagation panel opened');
  }

  function hide() {
    const panel = document.getElementById('propagation-panel');
    if (panel) {
      panel.style.display = 'none';
      panelVisible = false;
    }
  }

  function toggle() {
    if (panelVisible) {
      hide();
    } else {
      show();
    }
  }

  // FIX: Listen for centralized space weather updates
  window.addEventListener('spaceweather:updated', (e) => {
    if (panelVisible) {
      console.log('📡 Propagation panel received space weather update');
      updatePanelContent();
    }
  });

  setInterval(() => {
    if (panelVisible) {
      updatePanelContent();
    }
  }, 60 * 1000);

  setInterval(() => {
    if (panelVisible) {
      fetchSolarData().then(updatePanelContent);
    }
  }, 15 * 60 * 1000);

  window.addEventListener('load', () => {
    createPanel();
    fetchSolarData();
  });

  return {
    show,
    hide,
    toggle,
    update: updatePanelContent
  };
})();
