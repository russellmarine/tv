/**
 * propagation-panel.js - Enhanced HF/SATCOM Propagation Panel
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
  let selectedLocation = null; // Track selected location

  async function fetchSolarData() {
    try {
      const solarResponse = await fetch('/api/spaceweather/text/daily-solar-indices.txt');
      const solarText = await solarResponse.text();
      
      const lines = solarText.trim().split('\n');
      const dataLine = lines[lines.length - 1];
      const parts = dataLine.split(/\s+/);
      
      solarData = {
        solarFlux: parseFloat(parts[3]) || 150,
        sunspotNumber: parseInt(parts[1]) || 50,
        aIndex: parseFloat(parts[4]) || 10,
        kIndex: parseFloat(parts[5]) || 2
      };
      
      console.log('☀️ Solar data fetched:', solarData);
      return solarData;
    } catch (error) {
      console.warn('Could not fetch solar data, using defaults:', error);
      solarData = {
        solarFlux: 150,
        sunspotNumber: 50,
        aIndex: 10,
        kIndex: 2
      };
      return solarData;
    }
  }

  // Enhanced MUF calculation with latitude and geomagnetic factors
  function calculateMUF(solarFlux, isDay, latitude, kpIndex) {
    // Critical frequency of F2 layer (foF2) - the foundation of MUF
    // Based on empirical models (simplified URSI coefficients)
    
    // Solar zenith angle factor (simplified - based on day/night)
    const solarZenithFactor = isDay ? 1.0 : 0.5;
    
    // Latitude factor - ionosphere varies by latitude
    // Equatorial: Higher electron density, higher MUF
    // Mid-latitude: Moderate
    // High-latitude (auroral zone): Lower, more variable
    const absLat = Math.abs(latitude);
    let latitudeFactor;
    
    if (absLat < 15) {
      // Equatorial zone - enhanced ionization
      latitudeFactor = 1.15;
    } else if (absLat < 30) {
      // Low-mid latitude - good conditions
      latitudeFactor = 1.1;
    } else if (absLat < 50) {
      // Mid-latitude - standard
      latitudeFactor = 1.0;
    } else if (absLat < 60) {
      // High-mid latitude - auroral effects start
      latitudeFactor = 0.9;
    } else {
      // High latitude/polar - auroral zone, unstable
      latitudeFactor = 0.75;
    }
    
    // Geomagnetic activity factor (Kp index impact)
    // Higher Kp = disturbed ionosphere = lower MUF
    let kpFactor = 1.0;
    if (kpIndex >= 7) {
      kpFactor = 0.7; // Severe storm
    } else if (kpIndex >= 5) {
      kpFactor = 0.8; // Minor/moderate storm
    } else if (kpIndex >= 4) {
      kpFactor = 0.9; // Active conditions
    }
    
    // Critical frequency foF2 (in MHz)
    // Empirical formula based on solar flux (SSN proxy)
    // foF2 ≈ sqrt(0.9 * (SSN + 100)) for mid-latitudes at noon
    const ssn = (solarFlux - 60) / 0.9; // Convert SFU to approximate SSN
    const foF2_base = Math.sqrt(0.9 * (Math.max(ssn, 0) + 100));
    
    // Apply all factors
    const foF2 = foF2_base * solarZenithFactor * latitudeFactor * kpFactor;
    
    // MUF calculation
    // For 3000 km path (typical DX): MUF ≈ foF2 * M-factor
    // M-factor depends on skip distance (simplified to 3.5 for DX)
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

  // Get current location from selected dropdown or auto-detect
  function getCurrentLocation() {
    // If user selected a location, use that
    if (selectedLocation) return selectedLocation;
    
    // Otherwise auto-detect from info bar (look for first non-Zulu with weather)
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

  // Get all available locations from weather config
  function getAvailableLocations() {
    const locations = [];
    
    // Get from TIME_ZONES config
    if (window.TIME_ZONES) {
      window.TIME_ZONES.forEach(tz => {
        // Skip Zulu
        if (!/zulu/i.test(tz.label)) {
          locations.push(tz.label);
        }
      });
    }
    
    // Fallback: parse from DOM if config not available
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

  // Get weather for location to assess SATCOM
  function getLocationWeather(locationName) {
    const blocks = document.querySelectorAll('.info-block.has-tooltip');
    for (const block of blocks) {
      if (block.textContent.includes(locationName)) {
        const tooltip = block.getAttribute('data-tooltip');
        if (tooltip) {
          // Parse weather from tooltip
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

  // Assess SATCOM quality based on weather and space weather
  function assessSATCOM(weather, spaceWeatherStatus) {
    const issues = [];
    let quality = 'excellent';

    // Weather impacts
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

    // Space weather impacts
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

    // Populate location selector
    const locationSelector = document.getElementById('location-selector');
    const locations = getAvailableLocations();
    locations.forEach(loc => {
      const option = document.createElement('option');
      option.value = loc;
      option.textContent = loc;
      locationSelector.appendChild(option);
    });

    // Handle location selection
    locationSelector.addEventListener('change', (e) => {
      selectedLocation = e.target.value || null;
      updatePanelContent();
    });

    // Make header draggable (but not the dropdown)
    const header = document.getElementById('prop-panel-header');
    
    header.addEventListener('mousedown', (e) => {
      // Don't drag if clicking close button or dropdown
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
      
      // Keep within viewport
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

    // Close button
    document.getElementById('close-prop-panel').addEventListener('click', hide);

    // Close when clicking outside
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

    // Get current location
    const locationName = getCurrentLocation();
    const weather = locationName ? getLocationWeather(locationName) : null;

    // Get timezone for selected location
    let isDay = false;
    let localTime = 'Unknown';
    
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
        
        // Get hour in local timezone
        const localHour = parseInt(now.toLocaleString("en-US", {
          timeZone: tzInfo.tz,
          hour12: false,
          hour: "2-digit"
        }));
        
        // Day = 6am to 6pm local time
        isDay = localHour >= 6 && localHour < 18;
      }
    } else {
      // Fallback to UTC
      const now = new Date();
      const hour = now.getUTCHours();
      isDay = hour >= 6 && hour < 18;
      localTime = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }) + ' UTC';
    }

    // Get latitude for selected location
    let latitude = 35.0; // Default to mid-latitude
    
    if (locationName && window.TIME_ZONES) {
      const tzInfo = window.TIME_ZONES.find(tz => tz.label === locationName);
      if (tzInfo && tzInfo.lat) {
        latitude = tzInfo.lat;
      }
    }

    // Get space weather data for Kp index
    const swData = window.RussellTV?.SpaceWeather?.getCurrentData();
    const kpIndex = swData?.kpIndex || solarData.kIndex || 3;

    // Calculate MUF with latitude and geomagnetic factors
    const mufData = calculateMUF(solarData.solarFlux, isDay, latitude, kpIndex);
    
    // Determine conditions
    const conditions = {
      isDay,
      solarFlux: solarData.solarFlux,
      sunspotNumber: solarData.sunspotNumber,
      kIndex: kpIndex,
      rScale: swData?.scales.R || 0
    };

    // Get best HF bands
    const bestBands = getBestBands(mufData, conditions);

    // Assess SATCOM
    const satcomStatus = swData?.status.satcom || 'green';
    const satcom = assessSATCOM(weather, satcomStatus);

    // Build HTML
    let html = `
      ${locationName ? `
      <div style="background: rgba(100, 150, 255, 0.15); border-left: 3px solid rgba(100, 150, 255, 0.6); padding: 0.75rem; margin-bottom: 1rem; border-radius: 4px;">
        <div style="font-weight: bold; margin-bottom: 0.25rem;">📍 ${locationName}</div>
        <div style="font-size: 0.85rem; opacity: 0.9;">Local Time: ${localTime} ${isDay ? '☀️' : '🌙'}</div>
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
            <div style="opacity: 0.7; font-size: 0.75rem;">Kp Index</div>
            <div style="font-size: 1.1rem; font-weight: bold;">${conditions.kIndex.toFixed(1)}</div>
          </div>
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
        Updated: ${new Date().toLocaleTimeString()}<br>
        <span style="font-size: 0.7rem; opacity: 0.7;">💡 Drag header to move panel</span>
      </div>
    `;

    content.innerHTML = html;
  }

  function show() {
    const panel = document.getElementById('propagation-panel');
    if (!panel) {
      createPanel();
      return;
    }

    // Repopulate location selector in case locations changed
    const locationSelector = document.getElementById('location-selector');
    if (locationSelector) {
      // Clear existing options except first
      while (locationSelector.options.length > 1) {
        locationSelector.remove(1);
      }
      
      // Add all locations
      const locations = getAvailableLocations();
      locations.forEach(loc => {
        const option = document.createElement('option');
        option.value = loc;
        option.textContent = loc;
        locationSelector.appendChild(option);
      });
      
      // Restore selected location if any
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

  // Auto-update every minute for real-time HF band changes
  setInterval(() => {
    if (panelVisible) {
      updatePanelContent(); // Update more frequently to show day/night transitions
    }
  }, 60 * 1000); // Every 1 minute

  // Fetch fresh solar data every 15 minutes
  setInterval(() => {
    if (panelVisible) {
      fetchSolarData().then(updatePanelContent);
    }
  }, 15 * 60 * 1000);

  // Initialize
  window.addEventListener('load', () => {
    createPanel();
    fetchSolarData();
  });

  // Public API
  return {
    show,
    hide,
    toggle,
    update: updatePanelContent
  };
})();
