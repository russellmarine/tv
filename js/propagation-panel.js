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

    #propagation-panel .comms-section {
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 120, 0, 0.25);
      border-radius: 10px;
      padding: 0.75rem;
      margin-top: 0.75rem;
    }

    #propagation-panel .comms-section-title {
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: rgba(255, 150, 0, 0.9);
      margin-bottom: 0.5rem;
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }

    #propagation-panel .muf-display {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 0.5rem;
    }

    #propagation-panel .muf-value {
      font-size: 1.5rem;
      font-weight: bold;
      color: #00ff88;
    }

    #propagation-panel .muf-label {
      font-size: 0.7rem;
      opacity: 0.7;
      text-transform: uppercase;
    }

    #propagation-panel .band-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
      margin-top: 0.5rem;
    }

    #propagation-panel .band-pill {
      padding: 0.2rem 0.5rem;
      border-radius: 999px;
      font-size: 0.7rem;
      font-weight: 600;
      border: 1px solid;
    }

    #propagation-panel .band-pill.excellent {
      background: rgba(0, 255, 100, 0.2);
      border-color: rgba(0, 255, 100, 0.5);
      color: #00ff88;
    }

    #propagation-panel .band-pill.good {
      background: rgba(100, 200, 255, 0.2);
      border-color: rgba(100, 200, 255, 0.5);
      color: #88ccff;
    }

    #propagation-panel .band-pill.fair {
      background: rgba(255, 200, 100, 0.2);
      border-color: rgba(255, 200, 100, 0.5);
      color: #ffcc88;
    }

    #propagation-panel .band-pill.poor {
      background: rgba(255, 100, 100, 0.15);
      border-color: rgba(255, 100, 100, 0.4);
      color: #ff8888;
    }

    #propagation-panel .satcom-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.5rem;
      margin-top: 0.5rem;
    }

    #propagation-panel .satcom-item {
      text-align: center;
      padding: 0.4rem;
      background: rgba(0, 0, 0, 0.3);
      border-radius: 6px;
    }

    #propagation-panel .satcom-item .band-label {
      font-size: 0.65rem;
      text-transform: uppercase;
      opacity: 0.7;
      margin-bottom: 0.15rem;
    }

    #propagation-panel .satcom-item .band-status {
      font-size: 0.8rem;
      font-weight: 600;
    }

    #propagation-panel .satcom-item .band-status.green { color: #00ff88; }
    #propagation-panel .satcom-item .band-status.yellow { color: #ffcc00; }
    #propagation-panel .satcom-item .band-status.orange { color: #ff8800; }
    #propagation-panel .satcom-item .band-status.red { color: #ff4444; }

    #propagation-panel .info-row {
      display: flex;
      justify-content: space-between;
      font-size: 0.8rem;
      padding: 0.25rem 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }

    #propagation-panel .info-row:last-child {
      border-bottom: none;
    }

    #propagation-panel .info-row .label {
      opacity: 0.7;
    }

    #propagation-panel .info-row .value {
      font-weight: 500;
    }

    #propagation-panel .nvis-box {
      background: rgba(100, 150, 255, 0.1);
      border: 1px solid rgba(100, 150, 255, 0.3);
      border-radius: 8px;
      padding: 0.5rem 0.75rem;
      margin-top: 0.5rem;
    }

    #propagation-panel .nvis-title {
      font-size: 0.7rem;
      text-transform: uppercase;
      color: rgba(150, 200, 255, 0.9);
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

  // ============ MUF & PROPAGATION CALCULATIONS ============

  // Estimate MUF based on time of day, season, solar activity, and latitude
  function estimateMUF(lat, lon, data) {
    const dayNight = getDayNightStatus(lat, lon);
    const now = new Date();
    const month = now.getMonth(); // 0-11
    const absLat = Math.abs(lat);
    
    // Base MUF varies by time of day
    let baseMUF;
    if (dayNight.status === 'day') {
      baseMUF = 21; // Daytime base ~21 MHz
    } else if (dayNight.status === 'greyline') {
      baseMUF = 18; // Greyline transitional
    } else {
      baseMUF = 10; // Nighttime base ~10 MHz
    }
    
    // Seasonal adjustment (higher in summer for that hemisphere)
    const isNorthernHemisphere = lat >= 0;
    const isSummer = (isNorthernHemisphere && month >= 4 && month <= 8) ||
                     (!isNorthernHemisphere && (month >= 10 || month <= 2));
    if (isSummer && dayNight.status === 'day') {
      baseMUF += 4;
    }
    
    // Latitude adjustment (lower MUF at high latitudes)
    if (absLat > 60) {
      baseMUF -= 5;
    } else if (absLat > 45) {
      baseMUF -= 2;
    }
    
    // Solar activity adjustment based on Kp
    const kp = data?.kpIndex || 0;
    if (kp >= 6) {
      baseMUF -= 4; // Storm depression
    } else if (kp >= 4) {
      baseMUF -= 2;
    }
    
    // R-scale (radio blackout) adjustment
    const rScale = data?.scales?.R || 0;
    if (rScale >= 3) {
      baseMUF -= 6; // Significant absorption
    } else if (rScale >= 2) {
      baseMUF -= 3;
    }
    
    // Clamp to reasonable range
    return Math.max(5, Math.min(35, Math.round(baseMUF)));
  }

  // Get recommended HF bands based on MUF
  function getRecommendedBands(muf, dayNight) {
    const bands = [];
    
    if (muf >= 28) bands.push({ band: '10m', freq: '28-29.7 MHz', quality: 'excellent' });
    if (muf >= 21) bands.push({ band: '15m', freq: '21-21.45 MHz', quality: muf >= 24 ? 'excellent' : 'good' });
    if (muf >= 14) bands.push({ band: '20m', freq: '14-14.35 MHz', quality: 'excellent' });
    if (muf >= 10) bands.push({ band: '30m', freq: '10.1-10.15 MHz', quality: 'good' });
    if (muf >= 7) bands.push({ band: '40m', freq: '7-7.3 MHz', quality: dayNight.status === 'night' ? 'excellent' : 'good' });
    
    // Lower bands always available but better at night
    bands.push({ band: '80m', freq: '3.5-4 MHz', quality: dayNight.status === 'night' ? 'excellent' : 'fair' });
    bands.push({ band: '160m', freq: '1.8-2 MHz', quality: dayNight.status === 'night' ? 'good' : 'poor' });
    
    return bands.slice(0, 5); // Top 5
  }

  // Calculate geomagnetic latitude (affects aurora and polar absorption)
  function getGeomagLat(lat, lon) {
    // Simplified geomagnetic latitude calculation
    // Geomagnetic north pole is approximately at 80.5°N, 72.6°W
    const geomagPoleLat = 80.5;
    const geomagPoleLon = -72.6;
    
    const rad = Math.PI / 180;
    const latRad = lat * rad;
    const lonRad = lon * rad;
    const poleLatRad = geomagPoleLat * rad;
    const poleLonRad = geomagPoleLon * rad;
    
    // Spherical law of cosines for geomagnetic latitude
    const geomagLat = Math.asin(
      Math.sin(latRad) * Math.sin(poleLatRad) +
      Math.cos(latRad) * Math.cos(poleLatRad) * Math.cos(lonRad - poleLonRad)
    ) / rad;
    
    return Math.round(geomagLat * 10) / 10;
  }

  // Get SATCOM assessment
  function getSatcomAssessment(lat, lon, data) {
    const kp = data?.kpIndex || 0;
    const gScale = data?.scales?.G || 0;
    const sScale = data?.scales?.S || 0;
    const geomagLat = getGeomagLat(lat, lon);
    const absGeomagLat = Math.abs(geomagLat);
    
    let assessment = {
      kuBand: { status: 'green', label: 'Normal', notes: '' },
      xBand: { status: 'green', label: 'Normal', notes: '' },
      cBand: { status: 'green', label: 'Normal', notes: '' },
      scintillation: 'Low',
      ionosphericDelay: 'Minimal'
    };
    
    // Scintillation risk (higher at equatorial and auroral zones)
    if (absGeomagLat < 20) {
      assessment.scintillation = 'Moderate (equatorial)';
      assessment.kuBand.notes = 'Equatorial scintillation possible post-sunset';
    } else if (absGeomagLat > 60) {
      assessment.scintillation = kp >= 5 ? 'High (auroral)' : 'Moderate (polar)';
    }
    
    // Geomagnetic storm effects
    if (gScale >= 3) {
      assessment.kuBand = { status: 'orange', label: 'Degraded', notes: 'Signal fluctuations likely' };
      assessment.ionosphericDelay = 'Elevated';
    } else if (gScale >= 2) {
      assessment.kuBand = { status: 'yellow', label: 'Minor Impact', notes: 'Possible signal variations' };
    }
    
    // Solar radiation effects on satellite hardware
    if (sScale >= 3) {
      assessment.xBand = { status: 'orange', label: 'Caution', notes: 'Solar particle event - monitor for anomalies' };
      assessment.kuBand.notes += ' Satellite charging possible.';
    }
    
    // X-band is generally more robust
    if (gScale < 4 && sScale < 4) {
      assessment.xBand = { status: 'green', label: 'Normal', notes: 'Mil-band nominal' };
    }
    
    // C-band is most robust
    assessment.cBand = { status: 'green', label: 'Normal', notes: 'Most resilient to space weather' };
    if (sScale >= 4) {
      assessment.cBand = { status: 'yellow', label: 'Monitor', notes: 'Extreme event - monitor all bands' };
    }
    
    return assessment;
  }

  // Get NVIS (Near Vertical Incidence Skywave) assessment for regional HF
  function getNvisAssessment(lat, data) {
    const muf = estimateMUF(lat, 0, data); // lon doesn't matter much for NVIS
    const dayNight = getDayNightStatus(lat, 0);
    
    // NVIS works best on 40m and 80m during day, 80m and 160m at night
    let recommended = '';
    let quality = '';
    
    if (dayNight.status === 'day') {
      if (muf >= 7) {
        recommended = '40m (7 MHz)';
        quality = 'Good';
      } else {
        recommended = '80m (3.5 MHz)';
        quality = 'Fair';
      }
    } else {
      recommended = '80m (3.5 MHz) or 160m (1.8 MHz)';
      quality = 'Good';
    }
    
    return { recommended, quality, range: '0-400 km' };
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
      const muf = estimateMUF(loc.lat, loc.lon, data);
      const recommendedBands = getRecommendedBands(muf, dayNight);
      const geomagLat = getGeomagLat(loc.lat, loc.lon);
      const satcom = getSatcomAssessment(loc.lat, loc.lon, data);
      const nvis = getNvisAssessment(loc.lat, data);

      // Build band pills HTML
      const bandPillsHtml = recommendedBands.map(b => 
        `<span class="band-pill ${b.quality}">${b.band}</span>`
      ).join('');

      locationInfoHtml = `
        <div class="location-info">
          <div class="location-info-header">
            <span class="location-name">${dayNight.icon} ${loc.label}</span>
            <span class="day-night-badge ${dayNight.status}">${dayNight.label}</span>
          </div>
          <div class="location-info-grid">
            <div class="location-info-item">
              <span class="item-label">Geographic</span>
              <span class="item-value">${loc.lat.toFixed(2)}°, ${loc.lon.toFixed(2)}°</span>
            </div>
            <div class="location-info-item">
              <span class="item-label">Geomag Lat</span>
              <span class="item-value">${geomagLat.toFixed(1)}°</span>
            </div>
            <div class="location-info-item">
              <span class="item-label">Sunrise</span>
              <span class="item-value">${sunTimes.sunrise ? formatTimeInTz(sunTimes.sunrise, loc.tz) : '--:--'} L</span>
            </div>
            <div class="location-info-item">
              <span class="item-label">Sunset</span>
              <span class="item-value">${sunTimes.sunset ? formatTimeInTz(sunTimes.sunset, loc.tz) : '--:--'} L</span>
            </div>
          </div>

          <!-- HF Section -->
          <div class="comms-section">
            <div class="comms-section-title">📻 HF Communications</div>
            <div class="muf-display">
              <div>
                <div class="muf-value">${muf} MHz</div>
                <div class="muf-label">Est. MUF</div>
              </div>
              <div style="flex: 1; font-size: 0.8rem; opacity: 0.9;">
                ${hfAssessment}
              </div>
            </div>
            <div style="font-size: 0.75rem; opacity: 0.8; margin-bottom: 0.35rem;">Recommended Bands:</div>
            <div class="band-pills">
              ${bandPillsHtml}
            </div>
            <div class="nvis-box">
              <div class="nvis-title">NVIS (Regional 0-400km)</div>
              <div style="font-size: 0.8rem;">
                <strong>${nvis.recommended}</strong> — ${nvis.quality}
              </div>
            </div>
          </div>

          <!-- SATCOM Section -->
          <div class="comms-section">
            <div class="comms-section-title">📡 SATCOM Assessment</div>
            <div class="satcom-grid">
              <div class="satcom-item">
                <div class="band-label">X-Band</div>
                <div class="band-status ${satcom.xBand.status}">${satcom.xBand.label}</div>
              </div>
              <div class="satcom-item">
                <div class="band-label">Ku-Band</div>
                <div class="band-status ${satcom.kuBand.status}">${satcom.kuBand.label}</div>
              </div>
              <div class="satcom-item">
                <div class="band-label">C-Band</div>
                <div class="band-status ${satcom.cBand.status}">${satcom.cBand.label}</div>
              </div>
            </div>
            <div style="margin-top: 0.5rem;">
              <div class="info-row">
                <span class="label">Scintillation Risk</span>
                <span class="value">${satcom.scintillation}</span>
              </div>
              <div class="info-row">
                <span class="label">Ionospheric Delay</span>
                <span class="value">${satcom.ionosphericDelay}</span>
              </div>
              ${satcom.kuBand.notes ? `<div style="font-size: 0.75rem; opacity: 0.8; margin-top: 0.35rem; font-style: italic;">${satcom.kuBand.notes}</div>` : ''}
            </div>
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
