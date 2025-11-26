/**
 * propagation-panel.js - Detailed propagation forecast panel
 * 
 * Events Emitted:
 * - 'propagation:ready' (sticky) - Panel exists in DOM
 * 
 * Events Listened:
 * - 'spaceweather:ready' - Create panel when indicators exist
 * - 'spaceweather:data-updated' - Refresh panel data
 * - 'feature:toggle' - Show/hide based on feature state
 */

(function() {
  'use strict';

  const Events = window.RussellTV?.Events;
  if (!Events) {
    console.error('[Propagation] RussellTV.Events not found. Load russelltv-core.js first.');
    return;
  }

  // ============ STYLES ============

  const styles = `
    #propagation-panel {
      position: fixed;
      top: 80px;
      right: 20px;
      width: 400px;
      max-height: 85vh;
      overflow-y: auto;
      background: linear-gradient(145deg, rgba(10, 5, 0, 0.98) 0%, rgba(25, 12, 0, 0.98) 100%);
      border: 2px solid rgba(255, 120, 0, 0.5);
      border-radius: 16px;
      z-index: 10000;
      display: none;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.9), 0 0 30px rgba(255, 100, 0, 0.2);
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    #propagation-panel .panel-header {
      padding: 1rem 1.25rem;
      background: rgba(255, 80, 0, 0.15);
      border-bottom: 1px solid rgba(255, 120, 0, 0.3);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    #propagation-panel .panel-title {
      font-weight: bold;
      font-size: 1.1rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    #propagation-panel .panel-close {
      background: none;
      border: none;
      color: white;
      font-size: 1.5rem;
      cursor: pointer;
      line-height: 1;
      opacity: 0.7;
      transition: opacity 0.2s;
    }

    #propagation-panel .panel-close:hover {
      opacity: 1;
    }

    #propagation-panel .panel-content {
      padding: 1rem 1.25rem;
    }

    #propagation-panel .location-selector {
      margin-bottom: 1rem;
    }

    #propagation-panel .location-selector label {
      display: block;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 1px;
      opacity: 0.7;
      margin-bottom: 0.4rem;
    }

    #propagation-panel .location-select {
      width: 100%;
      padding: 0.5rem 0.75rem;
      background: rgba(0, 0, 0, 0.5);
      border: 1px solid rgba(255, 120, 0, 0.4);
      border-radius: 8px;
      color: white;
      font-size: 0.9rem;
      cursor: pointer;
      transition: all 0.2s;
    }

    #propagation-panel .location-select:hover {
      border-color: rgba(255, 120, 0, 0.7);
    }

    #propagation-panel .location-select:focus {
      outline: none;
      border-color: rgba(255, 120, 0, 0.9);
      box-shadow: 0 0 8px rgba(255, 120, 0, 0.3);
    }

    #propagation-panel .location-select option {
      background: #1a1a1a;
      color: white;
    }

    #propagation-panel .location-info {
      background: rgba(0, 0, 0, 0.4);
      border: 1px solid rgba(255, 120, 0, 0.3);
      border-radius: 12px;
      padding: 0.75rem 1rem;
      margin-bottom: 1rem;
    }

    #propagation-panel .location-info-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.75rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid rgba(255, 120, 0, 0.2);
    }

    #propagation-panel .location-info-header .location-name {
      font-weight: 600;
      font-size: 0.95rem;
    }

    #propagation-panel .location-info-header .day-night-badge {
      margin-left: auto;
      padding: 0.2rem 0.5rem;
      border-radius: 999px;
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
    }

    #propagation-panel .location-info-header .day-night-badge.day {
      background: rgba(255, 200, 0, 0.3);
      color: #ffd700;
    }

    #propagation-panel .location-info-header .day-night-badge.night {
      background: rgba(100, 100, 200, 0.3);
      color: #aaaaff;
    }

    #propagation-panel .location-info-header .day-night-badge.greyline {
      background: rgba(255, 100, 100, 0.3);
      color: #ff9999;
    }

    #propagation-panel .location-info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.5rem;
    }

    #propagation-panel .location-info-item {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
    }

    #propagation-panel .location-info-item .item-label {
      font-size: 0.65rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      opacity: 0.6;
    }

    #propagation-panel .location-info-item .item-value {
      font-size: 0.85rem;
      font-weight: 500;
    }

    #propagation-panel .hf-assessment {
      background: rgba(0, 0, 0, 0.3);
      border-radius: 8px;
      padding: 0.6rem 0.75rem;
      margin-top: 0.75rem;
      font-size: 0.8rem;
      line-height: 1.4;
    }

    #propagation-panel .hf-assessment-title {
      font-weight: 600;
      color: rgba(255, 150, 0, 0.9);
      margin-bottom: 0.25rem;
    }

    #propagation-panel .status-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.75rem;
      margin-bottom: 1.25rem;
    }

    #propagation-panel .status-card {
      background: rgba(0, 0, 0, 0.4);
      border: 1px solid rgba(255, 120, 0, 0.3);
      border-radius: 12px;
      padding: 0.75rem;
      text-align: center;
    }

    #propagation-panel .status-card-label {
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 1px;
      opacity: 0.7;
      margin-bottom: 0.25rem;
    }

    #propagation-panel .status-card-value {
      font-size: 1.5rem;
      font-weight: bold;
    }

    #propagation-panel .section {
      margin-bottom: 1.25rem;
    }

    #propagation-panel .section-title {
      font-size: 0.8rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: rgba(255, 150, 0, 0.9);
      margin-bottom: 0.75rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid rgba(255, 120, 0, 0.2);
    }

    #propagation-panel .band-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.6rem 0.75rem;
      background: rgba(255, 255, 255, 0.03);
      border-radius: 8px;
      margin-bottom: 0.5rem;
    }

    #propagation-panel .band-info {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    #propagation-panel .band-icon {
      font-size: 1.1rem;
    }

    #propagation-panel .band-name {
      font-weight: 500;
    }

    #propagation-panel .band-status {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      font-weight: 600;
      font-size: 0.85rem;
    }

    #propagation-panel .status-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }

    #propagation-panel .panel-footer {
      padding: 0.75rem 1.25rem;
      border-top: 1px solid rgba(255, 120, 0, 0.2);
      font-size: 0.7rem;
      color: rgba(255, 255, 255, 0.5);
      text-align: center;
    }

    #propagation-panel .panel-footer a {
      color: rgba(255, 150, 0, 0.8);
      text-decoration: none;
    }

    #propagation-panel .panel-footer a:hover {
      text-decoration: underline;
    }
  `;

  // ============ STATE ============

  let panel = null;
  let selectedLocation = null;

  // ============ SUN CALCULATIONS ============

  // Calculate sunrise/sunset times for a given lat/lon and date
  function calculateSunTimes(lat, lon, date = new Date()) {
    const rad = Math.PI / 180;
    const dayOfYear = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 86400000);
    
    // Solar declination
    const declination = -23.45 * Math.cos(rad * (360 / 365) * (dayOfYear + 10));
    
    // Hour angle
    const latRad = lat * rad;
    const decRad = declination * rad;
    
    // Sunrise/sunset hour angle (standard: -0.833 degrees for atmospheric refraction)
    const cosHourAngle = (Math.sin(-0.833 * rad) - Math.sin(latRad) * Math.sin(decRad)) / 
                          (Math.cos(latRad) * Math.cos(decRad));
    
    // Check for polar day/night
    if (cosHourAngle > 1) {
      return { polarNight: true };
    }
    if (cosHourAngle < -1) {
      return { polarDay: true };
    }
    
    const hourAngle = Math.acos(cosHourAngle) / rad;
    
    // Solar noon (in hours UTC)
    const solarNoon = 12 - lon / 15;
    
    // Sunrise and sunset in UTC hours
    const sunriseUTC = solarNoon - hourAngle / 15;
    const sunsetUTC = solarNoon + hourAngle / 15;
    
    // Convert to Date objects
    const sunrise = new Date(date);
    sunrise.setUTCHours(Math.floor(sunriseUTC), Math.round((sunriseUTC % 1) * 60), 0, 0);
    
    const sunset = new Date(date);
    sunset.setUTCHours(Math.floor(sunsetUTC), Math.round((sunsetUTC % 1) * 60), 0, 0);
    
    return { sunrise, sunset, solarNoon };
  }

  // Determine if location is in day, night, or greyline
  function getDayNightStatus(lat, lon) {
    const now = new Date();
    const sunTimes = calculateSunTimes(lat, lon, now);
    
    if (sunTimes.polarDay) {
      return { status: 'day', label: 'Polar Day', icon: '☀️' };
    }
    if (sunTimes.polarNight) {
      return { status: 'night', label: 'Polar Night', icon: '🌙' };
    }
    
    const { sunrise, sunset } = sunTimes;
    const nowTime = now.getTime();
    const sunriseTime = sunrise.getTime();
    const sunsetTime = sunset.getTime();
    
    // Greyline is ~30 minutes around sunrise/sunset
    const greylineWindow = 30 * 60 * 1000; // 30 minutes in ms
    
    if (Math.abs(nowTime - sunriseTime) < greylineWindow) {
      return { status: 'greyline', label: 'Greyline (Sunrise)', icon: '🌅', sunTimes };
    }
    if (Math.abs(nowTime - sunsetTime) < greylineWindow) {
      return { status: 'greyline', label: 'Greyline (Sunset)', icon: '🌇', sunTimes };
    }
    
    if (nowTime > sunriseTime && nowTime < sunsetTime) {
      return { status: 'day', label: 'Daytime', icon: '☀️', sunTimes };
    }
    
    return { status: 'night', label: 'Nighttime', icon: '🌙', sunTimes };
  }

  // Get HF propagation assessment for location
  function getHfAssessment(lat, lon, data) {
    const dayNight = getDayNightStatus(lat, lon);
    const kp = data?.kpIndex || 0;
    const rScale = data?.scales?.R || 0;
    
    let assessment = '';
    
    if (dayNight.status === 'greyline') {
      assessment = '🎯 Excellent DX conditions! Greyline enhancement active. ';
      assessment += 'Long-path propagation may be possible on 20m-40m bands. ';
    } else if (dayNight.status === 'day') {
      assessment = 'Daytime propagation favors higher HF bands (15m-10m). ';
      if (rScale >= 2) {
        assessment += '⚠️ Solar flare activity may cause HF fadeouts on sunlit paths. ';
      }
    } else {
      assessment = 'Nighttime propagation favors lower HF bands (40m-80m-160m). ';
      assessment += 'F2 layer skip possible on 20m for long-path DX. ';
    }
    
    // Geomagnetic effects based on latitude
    const absLat = Math.abs(lat);
    if (absLat > 55) {
      if (kp >= 5) {
        assessment += '🌌 Aurora likely visible! HF may be disrupted on polar paths but VHF aurora scatter possible. ';
      } else if (kp >= 4) {
        assessment += '📍 High-latitude location: Monitor for aurora and polar cap absorption. ';
      }
    } else if (absLat > 40 && kp >= 6) {
      assessment += '📍 Mid-latitude auroral effects possible with current Kp. ';
    }
    
    return assessment;
  }

  // Format time in location's timezone
  function formatTimeInTz(date, tz) {
    if (!date) return '--:--';
    try {
      return date.toLocaleTimeString('en-US', { 
        timeZone: tz, 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      });
    } catch {
      return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      });
    }
  }

  // ============ PANEL CREATION ============

  function createPanel() {
    if (document.getElementById('propagation-panel')) return;

    // Add styles
    const styleEl = document.createElement('style');
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);

    // Build location options from TIME_ZONES
    const locations = window.TIME_ZONES || [];
    let locationOptions = '<option value="">-- Select Location --</option>';
    locations.forEach((loc, idx) => {
      if (loc.label === 'Zulu') return; // Skip Zulu
      locationOptions += `<option value="${idx}">${loc.label}</option>`;
    });

    panel = document.createElement('div');
    panel.id = 'propagation-panel';
    panel.innerHTML = `
      <div class="panel-header">
        <span class="panel-title">📡 Propagation Forecast</span>
        <button class="panel-close">&times;</button>
      </div>
      <div class="panel-content">
        <div class="location-selector">
          <label>Location</label>
          <select class="location-select" id="prop-location-select">
            ${locationOptions}
          </select>
        </div>
        <div id="prop-location-info"></div>
        <div class="status-grid" id="prop-status-grid"></div>
        <div class="section">
          <div class="section-title">Band Conditions</div>
          <div id="prop-band-list"></div>
        </div>
        <div class="section">
          <div class="section-title">Forecast</div>
          <div id="prop-forecast"></div>
        </div>
      </div>
      <div class="panel-footer">
        Data: <a href="https://www.swpc.noaa.gov/" target="_blank">NOAA SWPC</a>
        <span id="prop-last-update"></span>
      </div>
    `;

    document.body.appendChild(panel);

    // Close button
    panel.querySelector('.panel-close').addEventListener('click', () => {
      panel.style.display = 'none';
    });

    // Load saved location
    const savedIdx = window.RussellTV?.Storage?.load?.('propLocationIdx');
    if (savedIdx !== null && savedIdx !== '' && window.TIME_ZONES?.[savedIdx]) {
      selectedLocation = window.TIME_ZONES[parseInt(savedIdx)];
    }

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (panel.style.display !== 'none' &&
          !e.target.closest('#propagation-panel') &&
          !e.target.closest('#propagation-panel-btn')) {
        panel.style.display = 'none';
      }
    });

    updatePanelContent();
  }

  function updatePanelContent() {
    if (!panel) return;

    const data = window.RussellTV?.SpaceWeather?.getCurrentData();
    const config = window.SPACE_WEATHER_CONFIG;

    const contentEl = panel.querySelector('.panel-content');
    if (!contentEl) return;

    // Build location options (in case panel was recreated)
    const locations = window.TIME_ZONES || [];
    let locationOptions = '<option value="">-- Select Location --</option>';
    locations.forEach((loc, idx) => {
      if (loc.label === 'Zulu') return;
      const selected = selectedLocation && selectedLocation.label === loc.label ? 'selected' : '';
      locationOptions += `<option value="${idx}" ${selected}>${loc.label}</option>`;
    });

    // If no data yet, show loading
    if (!data || !config) {
      contentEl.innerHTML = `
        <div class="location-selector">
          <label>Location</label>
          <select class="location-select" id="prop-location-select">
            ${locationOptions}
          </select>
        </div>
        <div id="prop-location-info"></div>
        <div class="status-grid" id="prop-status-grid">
          <div style="grid-column: 1 / -1; text-align: center; padding: 1rem; opacity: 0.7;">
            Loading...
          </div>
        </div>
        <div class="section">
          <div class="section-title">Band Conditions</div>
          <div id="prop-band-list" style="text-align: center; padding: 1rem; opacity: 0.7;">Loading...</div>
        </div>
        <div class="section">
          <div class="section-title">Forecast</div>
          <div id="prop-forecast" style="text-align: center; padding: 1rem; opacity: 0.7;">Loading...</div>
        </div>
      `;
      attachLocationListener();
      return;
    }

    // Build location info HTML
    let locationInfoHtml = '';
    if (selectedLocation) {
      const loc = selectedLocation;
      const dayNight = getDayNightStatus(loc.lat, loc.lon);
      const sunTimes = dayNight.sunTimes || calculateSunTimes(loc.lat, loc.lon);
      const hfAssessment = getHfAssessment(loc.lat, loc.lon, data);

      locationInfoHtml = `
        <div class="location-info">
          <div class="location-info-header">
            <span class="location-name">${dayNight.icon} ${loc.label}</span>
            <span class="day-night-badge ${dayNight.status}">${dayNight.label}</span>
          </div>
          <div class="location-info-grid">
            <div class="location-info-item">
              <span class="item-label">Latitude</span>
              <span class="item-value">${loc.lat.toFixed(2)}°</span>
            </div>
            <div class="location-info-item">
              <span class="item-label">Longitude</span>
              <span class="item-value">${loc.lon.toFixed(2)}°</span>
            </div>
            <div class="location-info-item">
              <span class="item-label">Sunrise</span>
              <span class="item-value">${sunTimes.sunrise ? formatTimeInTz(sunTimes.sunrise, loc.tz) : '--:--'} local</span>
            </div>
            <div class="location-info-item">
              <span class="item-label">Sunset</span>
              <span class="item-value">${sunTimes.sunset ? formatTimeInTz(sunTimes.sunset, loc.tz) : '--:--'} local</span>
            </div>
          </div>
          <div class="hf-assessment">
            <div class="hf-assessment-title">📻 HF Propagation Assessment</div>
            ${hfAssessment}
          </div>
        </div>
      `;
    }

    // Full content HTML
    contentEl.innerHTML = `
      <div class="location-selector">
        <label>Location</label>
        <select class="location-select" id="prop-location-select">
          ${locationOptions}
        </select>
      </div>
      <div id="prop-location-info">${locationInfoHtml}</div>
      <div class="status-grid" id="prop-status-grid"></div>
      <div class="section">
        <div class="section-title">Band Conditions</div>
        <div id="prop-band-list"></div>
      </div>
      <div class="section">
        <div class="section-title">Forecast</div>
        <div id="prop-forecast"></div>
      </div>
    `;

    // Re-attach location listener
    attachLocationListener();

    // Get elements
    const gridEl = panel.querySelector('#prop-status-grid');
    const bandListEl = panel.querySelector('#prop-band-list');
    const forecastEl = panel.querySelector('#prop-forecast');
    const lastUpdateEl = panel.querySelector('#prop-last-update');

    // Status grid
    const gridHtml = `
      <div class="status-card">
        <div class="status-card-label">Radio</div>
        <div class="status-card-value" style="color: ${getScaleColor(data.scales.R)}">R${data.scales.R}</div>
      </div>
      <div class="status-card">
        <div class="status-card-label">Solar</div>
        <div class="status-card-value" style="color: ${getScaleColor(data.scales.S)}">S${data.scales.S}</div>
      </div>
      <div class="status-card">
        <div class="status-card-label">Geomag</div>
        <div class="status-card-value" style="color: ${getScaleColor(data.scales.G)}">G${data.scales.G}</div>
      </div>
    `;
    gridEl.innerHTML = gridHtml;

    // Band list
    let bandHtml = '';
    for (const [key, band] of Object.entries(config.bands)) {
      const status = data.status[key];
      const statusInfo = config.statusLevels[status];
      
      bandHtml += `
        <div class="band-row">
          <div class="band-info">
            <span class="band-icon">${band.icon}</span>
            <span class="band-name">${band.label}</span>
          </div>
          <div class="band-status">
            <span class="status-dot" style="background: ${statusInfo?.color || '#888'}; box-shadow: 0 0 6px ${statusInfo?.color || '#888'};"></span>
            <span style="color: ${statusInfo?.color || '#888'}">${statusInfo?.label || 'Unknown'}</span>
          </div>
        </div>
      `;
    }
    bandListEl.innerHTML = bandHtml;

    // Forecast section
    const kp = data.kpIndex;
    let forecastHtml = `
      <div style="background: rgba(0,0,0,0.3); padding: 0.75rem; border-radius: 8px; margin-bottom: 0.5rem;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
          <span style="opacity: 0.8;">Kp Index:</span>
          <span style="font-weight: bold; color: ${getKpColor(kp)}">${kp.toFixed(1)}</span>
        </div>
        <div style="font-size: 0.8rem; opacity: 0.7;">
          ${getKpDescription(kp)}
        </div>
      </div>
    `;

    // HF conditions summary
    const hfStatus = data.status.hf;
    forecastHtml += `
      <div style="background: rgba(0,0,0,0.3); padding: 0.75rem; border-radius: 8px;">
        <div style="font-weight: 600; margin-bottom: 0.5rem;">HF Radio Outlook</div>
        <div style="font-size: 0.85rem; opacity: 0.9; line-height: 1.4;">
          ${getHfOutlook(hfStatus, data.scales.R)}
        </div>
      </div>
    `;

    forecastEl.innerHTML = forecastHtml;

    // Last update
    const lastUpdate = window.RussellTV?.SpaceWeather?.getLastUpdate();
    if (lastUpdate && lastUpdateEl) {
      const ago = formatTimeAgo(lastUpdate);
      lastUpdateEl.textContent = ` • Updated ${ago}`;
    }
  }

  function attachLocationListener() {
    const locationSelect = panel?.querySelector('#prop-location-select');
    if (!locationSelect) return;
    
    // Remove old listeners by replacing element
    const newSelect = locationSelect.cloneNode(true);
    locationSelect.parentNode.replaceChild(newSelect, locationSelect);
    
    newSelect.addEventListener('change', (e) => {
      const idx = e.target.value;
      if (idx === '') {
        selectedLocation = null;
      } else {
        selectedLocation = window.TIME_ZONES[parseInt(idx)];
      }
      // Save selection
      if (window.RussellTV?.Storage?.save) {
        window.RussellTV.Storage.save('propLocationIdx', idx);
      }
      updatePanelContent();
    });
  }

  // ============ HELPERS ============

  function getScaleColor(scale) {
    if (scale >= 4) return '#ff4444';
    if (scale >= 3) return '#ff8800';
    if (scale >= 2) return '#ffcc00';
    if (scale >= 1) return '#88cc44';
    return '#44cc44';
  }

  function getKpColor(kp) {
    if (kp >= 7) return '#ff4444';
    if (kp >= 5) return '#ff8800';
    if (kp >= 4) return '#ffcc00';
    return '#44cc44';
  }

  function getKpDescription(kp) {
    if (kp >= 8) return 'Severe geomagnetic storm. Significant HF disruption likely.';
    if (kp >= 7) return 'Strong geomagnetic storm. HF propagation degraded.';
    if (kp >= 5) return 'Minor to moderate storm. Some HF disruption possible.';
    if (kp >= 4) return 'Unsettled conditions. Generally normal propagation.';
    return 'Quiet conditions. Good propagation expected.';
  }

  function getHfOutlook(status, rScale) {
    if (rScale >= 4) {
      return 'Major HF blackout in progress. Dayside communications severely impacted. Consider alternate frequencies or SATCOM.';
    }
    if (rScale >= 3) {
      return 'Significant HF degradation. Wide-area blackout possible on sunlit side. Monitor conditions closely.';
    }
    if (rScale >= 2) {
      return 'Limited HF blackout. Lower frequencies may be affected. Higher frequencies should remain usable.';
    }
    if (rScale >= 1) {
      return 'Minor HF degradation possible. Most frequencies operating normally.';
    }
    return 'Normal HF propagation. All frequencies should be operating well. Good conditions for long-distance communications.';
  }

  function formatTimeAgo(date) {
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return date.toLocaleDateString();
  }

  // ============ INITIALIZATION ============

  function init() {
    createPanel();

    // Update when new data arrives
    Events.on('spaceweather:data-updated', () => {
      console.log('[Propagation] Data updated, refreshing panel');
      updatePanelContent();
    });

    // Handle feature toggles
    Events.on('feature:toggle', ({ feature, enabled }) => {
      if (feature === 'propagation-panel' && !enabled && panel) {
        panel.style.display = 'none';
      }
    });

    // Try to update content now in case data is already loaded
    updatePanelContent();
    
    // Retry a few times in case data is still loading
    setTimeout(updatePanelContent, 500);
    setTimeout(updatePanelContent, 1500);
    setTimeout(updatePanelContent, 3000);

    Events.emit('propagation:ready', null, { sticky: true });

    console.log('✅ [Propagation] Panel initialized');
  }

  // Wait for space weather indicators to be ready
  Events.whenReady('spaceweather:ready', init);

})();
