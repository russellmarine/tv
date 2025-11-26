/**
 * propagation-panel.js - Comm Planner Propagation Forecast Panel
 * 
 * Reorganized for logical flow:
 * 1. Location Selection & Current Conditions
 * 2. Space Weather Overview (R/S/G scales with explanations)
 * 3. HF Communications Section
 * 4. SATCOM Section
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

  // ============ REFERENCE LINKS ============
  
  const LINKS = {
    noaaScales: 'https://www.swpc.noaa.gov/noaa-scales-explanation',
    radioBlackouts: 'https://www.swpc.noaa.gov/phenomena/radio-blackouts',
    solarRadiation: 'https://www.swpc.noaa.gov/phenomena/solar-radiation-storm',
    geomagStorms: 'https://www.swpc.noaa.gov/phenomena/geomagnetic-storms',
    kpIndex: 'https://www.swpc.noaa.gov/products/planetary-k-index',
    hfPropagation: 'https://www.swpc.noaa.gov/communities/radio-communications',
    drap: 'https://www.swpc.noaa.gov/products/d-region-absorption-predictions-d-rap',
    muf: 'https://prop.kc2g.com/',
    voacap: 'https://www.voacap.com/prediction.html',
    gps: 'https://www.swpc.noaa.gov/communities/space-weather-impacts-gps',
    satcom: 'https://www.swpc.noaa.gov/communities/satellite-operators',
    solarWind: 'https://www.swpc.noaa.gov/products/real-time-solar-wind',
    aurora: 'https://www.swpc.noaa.gov/products/aurora-30-minute-forecast',
    forecast3day: 'https://www.swpc.noaa.gov/products/3-day-forecast',
    // GPS Interference sources
    gpsJam: 'https://gpsjam.org/',
    gpsWise: 'https://gpswise.aero/',
    navcenGuide: 'https://www.navcen.uscg.gov/guide-tool',
    navcenReports: 'https://www.navcen.uscg.gov/gps-problem-report-status',
    flightradarGps: 'https://www.flightradar24.com/data/gps-jamming'
  };

  // ============ STYLES ============

  const styles = `
    #propagation-panel {
      position: fixed;
      top: 80px;
      right: 20px;
      width: 420px;
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
      padding: 0.75rem 1rem;
      background: rgba(255, 80, 0, 0.15);
      border-bottom: 1px solid rgba(255, 120, 0, 0.3);
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: move;
      user-select: none;
    }

    #propagation-panel .panel-header:active {
      cursor: grabbing;
    }

    #propagation-panel .panel-title {
      font-weight: bold;
      font-size: 1rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    #propagation-panel .panel-title-drag-hint {
      font-size: 0.65rem;
      opacity: 0.5;
      font-weight: normal;
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
      padding: 0 0.25rem;
    }

    #propagation-panel .panel-close:hover {
      opacity: 1;
    }

    #propagation-panel .panel-content {
      padding: 1rem;
    }

    /* Location selector */
    #propagation-panel .location-selector {
      margin-bottom: 1rem;
    }

    #propagation-panel .location-selector label {
      display: block;
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 1px;
      opacity: 0.7;
      margin-bottom: 0.3rem;
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
    }

    #propagation-panel .location-select:focus {
      outline: none;
      border-color: rgba(255, 120, 0, 0.8);
    }

    #propagation-panel .location-select option {
      background: #1a1a1a;
    }

    /* Section styling */
    #propagation-panel .section {
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 120, 0, 0.25);
      border-radius: 12px;
      padding: 0.75rem 1rem;
      margin-bottom: 0.75rem;
    }

    #propagation-panel .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.75rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid rgba(255, 120, 0, 0.2);
    }

    #propagation-panel .section-title {
      font-size: 0.85rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: rgba(255, 150, 0, 0.95);
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }

    #propagation-panel .section-link {
      font-size: 0.7rem;
      color: rgba(255, 150, 0, 0.7);
      text-decoration: none;
      opacity: 0.8;
      transition: opacity 0.2s;
    }

    #propagation-panel .section-link:hover {
      opacity: 1;
      text-decoration: underline;
    }

    /* Scale cards */
    #propagation-panel .scale-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.5rem;
      margin-bottom: 0.75rem;
    }

    #propagation-panel .scale-card {
      background: rgba(0, 0, 0, 0.4);
      border: 1px solid rgba(255, 120, 0, 0.2);
      border-radius: 8px;
      padding: 0.5rem;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s;
    }

    #propagation-panel .scale-card:hover {
      border-color: rgba(255, 120, 0, 0.5);
      background: rgba(255, 120, 0, 0.1);
    }

    #propagation-panel .scale-card-label {
      font-size: 0.6rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      opacity: 0.7;
      margin-bottom: 0.2rem;
    }

    #propagation-panel .scale-card-value {
      font-size: 1.4rem;
      font-weight: bold;
    }

    #propagation-panel .scale-card-desc {
      font-size: 0.65rem;
      opacity: 0.7;
      margin-top: 0.2rem;
    }

    /* Location info grid */
    #propagation-panel .info-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 0.4rem 1rem;
      margin-bottom: 0.5rem;
    }

    #propagation-panel .info-item {
      display: flex;
      justify-content: space-between;
      font-size: 0.8rem;
    }

    #propagation-panel .info-item .label {
      opacity: 0.7;
    }

    #propagation-panel .info-item .value {
      font-weight: 500;
    }

    /* Day/Night badge */
    #propagation-panel .condition-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      padding: 0.25rem 0.6rem;
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 600;
    }

    #propagation-panel .condition-badge.day {
      background: rgba(255, 200, 0, 0.2);
      color: #ffd700;
    }

    #propagation-panel .condition-badge.night {
      background: rgba(100, 100, 200, 0.25);
      color: #aabbff;
    }

    #propagation-panel .condition-badge.greyline {
      background: rgba(255, 100, 100, 0.25);
      color: #ffaaaa;
    }

    /* MUF display */
    #propagation-panel .muf-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 0.5rem;
    }

    #propagation-panel .muf-value {
      font-size: 1.6rem;
      font-weight: bold;
      color: #00ff88;
    }

    #propagation-panel .muf-label {
      font-size: 0.65rem;
      opacity: 0.6;
      text-transform: uppercase;
    }

    /* Band pills */
    #propagation-panel .band-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 0.3rem;
    }

    #propagation-panel .band-pill {
      padding: 0.2rem 0.5rem;
      border-radius: 999px;
      font-size: 0.7rem;
      font-weight: 600;
      border: 1px solid;
      cursor: pointer;
      transition: all 0.2s;
    }

    #propagation-panel .band-pill:hover {
      transform: scale(1.05);
    }

    #propagation-panel .band-pill.excellent {
      background: rgba(0, 255, 100, 0.15);
      border-color: rgba(0, 255, 100, 0.4);
      color: #00ff88;
    }

    #propagation-panel .band-pill.good {
      background: rgba(100, 200, 255, 0.15);
      border-color: rgba(100, 200, 255, 0.4);
      color: #88ccff;
    }

    #propagation-panel .band-pill.fair {
      background: rgba(255, 200, 100, 0.15);
      border-color: rgba(255, 200, 100, 0.4);
      color: #ffcc88;
    }

    #propagation-panel .band-pill.poor {
      background: rgba(255, 100, 100, 0.1);
      border-color: rgba(255, 100, 100, 0.3);
      color: #ff8888;
    }

    /* Assessment box */
    #propagation-panel .assessment-box {
      background: rgba(0, 0, 0, 0.3);
      border-radius: 8px;
      padding: 0.6rem 0.75rem;
      font-size: 0.8rem;
      line-height: 1.4;
      margin-top: 0.5rem;
    }

    /* SATCOM grid */
    #propagation-panel .satcom-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 0.4rem;
    }

    #propagation-panel .satcom-item {
      text-align: center;
      padding: 0.4rem 0.25rem;
      background: rgba(0, 0, 0, 0.3);
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s;
    }

    #propagation-panel .satcom-item:hover {
      background: rgba(255, 120, 0, 0.15);
    }

    #propagation-panel .satcom-item .band-label {
      font-size: 0.6rem;
      text-transform: uppercase;
      opacity: 0.7;
    }

    #propagation-panel .satcom-item .band-status {
      font-size: 0.75rem;
      font-weight: 600;
      margin-top: 0.15rem;
    }

    #propagation-panel .satcom-item .band-status.green { color: #00ff88; }
    #propagation-panel .satcom-item .band-status.yellow { color: #ffcc00; }
    #propagation-panel .satcom-item .band-status.orange { color: #ff8800; }
    #propagation-panel .satcom-item .band-status.red { color: #ff4444; }

    /* Weather row */
    #propagation-panel .weather-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.4rem 0.6rem;
      background: rgba(0, 0, 0, 0.25);
      border-radius: 6px;
      margin-bottom: 0.5rem;
      font-size: 0.85rem;
    }

    #propagation-panel .weather-row .weather-icon {
      font-size: 1.2rem;
    }

    /* Alert box */
    #propagation-panel .alert-box {
      padding: 0.5rem 0.75rem;
      border-radius: 6px;
      font-size: 0.75rem;
      line-height: 1.4;
      margin-top: 0.5rem;
      border-left: 3px solid;
    }

    #propagation-panel .alert-box.green {
      background: rgba(0, 255, 100, 0.1);
      border-color: #00ff88;
    }

    #propagation-panel .alert-box.yellow {
      background: rgba(255, 220, 0, 0.1);
      border-color: #ffcc00;
    }

    #propagation-panel .alert-box.orange {
      background: rgba(255, 150, 0, 0.1);
      border-color: #ff9900;
    }

    #propagation-panel .alert-box.red {
      background: rgba(255, 80, 80, 0.1);
      border-color: #ff4444;
    }

    /* Footer */
    #propagation-panel .panel-footer {
      padding: 0.5rem 1rem;
      border-top: 1px solid rgba(255, 120, 0, 0.2);
      font-size: 0.65rem;
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

    /* NVIS box */
    #propagation-panel .nvis-box {
      background: rgba(100, 150, 255, 0.08);
      border: 1px solid rgba(100, 150, 255, 0.25);
      border-radius: 6px;
      padding: 0.4rem 0.6rem;
      margin-top: 0.5rem;
    }

    #propagation-panel .nvis-title {
      font-size: 0.65rem;
      text-transform: uppercase;
      color: rgba(150, 200, 255, 0.9);
      margin-bottom: 0.15rem;
    }

    /* Inline link styling */
    #propagation-panel .inline-link {
      color: rgba(255, 150, 0, 0.85);
      text-decoration: none;
      border-bottom: 1px dotted rgba(255, 150, 0, 0.4);
      transition: all 0.2s;
    }

    #propagation-panel .inline-link:hover {
      color: #ff9900;
      border-bottom-color: #ff9900;
    }
  `;

  // ============ STATE ============

  let panel = null;
  let selectedLocation = null;
  let isDragging = false;
  let dragOffset = { x: 0, y: 0 };

  // ============ SUN CALCULATIONS ============

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

  // ============ PROPAGATION CALCULATIONS ============

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

  // ============ SATCOM ASSESSMENT ============

  function getSatcomAssessment(lat, lon, data, locationLabel) {
    const kp = data?.kpIndex || 0;
    const gScale = data?.scales?.G || 0;
    const sScale = data?.scales?.S || 0;
    const geomagLat = getGeomagLat(lat, lon);
    const absGeomagLat = Math.abs(geomagLat);
    const weather = window.RussellTV?.InfoBar?.getWeather?.(locationLabel);
    
    let assessment = {
      // Bands ordered by frequency (high to low)
      ehf: { status: 'green', label: 'Normal', freq: '30-300 GHz', notes: '' },
      ka: { status: 'green', label: 'Normal', freq: '26.5-40 GHz', notes: '' },
      ku: { status: 'green', label: 'Normal', freq: '12-18 GHz', notes: '' },
      x: { status: 'green', label: 'Normal', freq: '8-12 GHz', notes: '' },
      c: { status: 'green', label: 'Normal', freq: '4-8 GHz', notes: '' },
      uhf: { status: 'green', label: 'Normal', freq: '300-3000 MHz', notes: '' },
      gps: { status: 'green', label: 'Normal', freq: 'L1/L2/L5', notes: '' },
      scintillation: 'Low',
      ionosphericDelay: 'Minimal',
      weather: weather
    };
    
    // Weather-based assessment for high frequency bands
    if (weather) {
      const condition = (weather.main || '').toLowerCase();
      const desc = (weather.desc || '').toLowerCase();
      const humidity = weather.humidity || 0;
      
      // Rain/precipitation - affects EHF most, then Ka, then Ku
      if (condition.includes('rain') || condition.includes('thunder') || desc.includes('rain') || desc.includes('storm')) {
        assessment.ehf = { 
          status: 'red', label: 'Rain Fade', freq: '30-300 GHz',
          notes: `Heavy attenuation (10-20+ dB). ${weather.desc}.`
        };
        assessment.ka = { 
          status: 'orange', label: 'Degraded', freq: '26.5-40 GHz',
          notes: `Significant rain fade (5-15 dB). Monitor link margins.`
        };
        assessment.ku = { 
          status: 'yellow', label: 'Minor', freq: '12-18 GHz',
          notes: `Some rain attenuation possible (2-5 dB).`
        };
      } else if (condition.includes('drizzle')) {
        assessment.ehf = { 
          status: 'orange', label: 'Light Rain', freq: '30-300 GHz',
          notes: `Moderate attenuation (3-10 dB).`
        };
        assessment.ka = { 
          status: 'yellow', label: 'Minor', freq: '26.5-40 GHz',
          notes: `Light rain fade possible.`
        };
      } else if (condition.includes('snow')) {
        assessment.ehf = { 
          status: 'orange', label: 'Snow', freq: '30-300 GHz',
          notes: `Wet snow causes higher attenuation. Check antenna.`
        };
        assessment.ka = { 
          status: 'yellow', label: 'Monitor', freq: '26.5-40 GHz',
          notes: `Wet snow may cause fade.`
        };
      } else if (condition.includes('fog') || condition.includes('mist')) {
        assessment.ehf = { 
          status: 'yellow', label: 'Fog', freq: '30-300 GHz',
          notes: `Suspended water droplets cause 2-5 dB absorption.`
        };
      } else if (humidity > 85) {
        // Very high humidity without precip - minor concern
        assessment.ehf = { 
          status: 'yellow', label: 'High RH', freq: '30-300 GHz',
          notes: `High humidity (${humidity}%). Water vapor absorption possible. Watch for fog/precip.`
        };
      } else {
        // Clouds/overcast alone don't affect EHF significantly
        assessment.ehf = { 
          status: 'green', label: 'Normal', freq: '30-300 GHz',
          notes: `${condition.includes('cloud') || desc.includes('cloud') ? 'Clouds minimal impact. ' : ''}${humidity}% RH.`
        };
        assessment.ka = { 
          status: 'green', label: 'Normal', freq: '26.5-40 GHz',
          notes: `Good conditions.`
        };
      }
    } else {
      assessment.ehf = { 
        status: 'yellow', label: 'No Wx', freq: '30-300 GHz',
        notes: 'Weather data unavailable. Verify local conditions.'
      };
    }
    
    // Scintillation - affects UHF, L-band (GPS) more at equatorial/auroral zones
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
    
    // Geomagnetic storm effects
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
    
    // Solar radiation storm effects
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
    
    // GPS space weather effects
    if (sScale >= 2 || gScale >= 2) {
      if (assessment.gps.status === 'green') {
        assessment.gps = {
          status: 'yellow', label: 'Monitor', freq: 'L1/L2/L5',
          notes: 'Minor degradation possible.'
        };
      }
    }
    
    // C-band most robust to weather and space weather
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
    
    // X-band generally robust
    if (assessment.x.status === 'green') {
      assessment.x = { 
        status: 'green', label: 'Nominal', freq: '8-12 GHz',
        notes: 'Mil-spec SATCOM operating normally.'
      };
    }
    
    // UHF default
    if (assessment.uhf.status === 'green') {
      assessment.uhf = { 
        status: 'green', label: 'Nominal', freq: '300-3000 MHz',
        notes: 'MUOS/Legacy UHF operating normally.'
      };
    }
    
    return assessment;
  }

  // ============ HELPERS ============

  function getWeatherIcon(main) {
    if (!main) return '🌡️';
    const m = main.toLowerCase();
    if (m.includes('thunder') || m.includes('storm')) return '⛈️';
    if (m.includes('rain')) return '🌧️';
    if (m.includes('drizzle')) return '🌦️';
    if (m.includes('snow')) return '🌨️';
    if (m.includes('cloud')) return '☁️';
    if (m.includes('fog') || m.includes('mist')) return '🌫️';
    if (m.includes('clear') || m.includes('sun')) return '☀️';
    return '🌤️';
  }

  function getScaleColor(scale) {
    if (scale >= 4) return '#ff4444';
    if (scale >= 3) return '#ff8800';
    if (scale >= 2) return '#ffcc00';
    if (scale >= 1) return '#88cc44';
    return '#44cc44';
  }

  function getScaleDescription(type, value) {
    const descriptions = {
      R: ['None', 'Minor', 'Moderate', 'Strong', 'Severe', 'Extreme'],
      S: ['None', 'Minor', 'Moderate', 'Strong', 'Severe', 'Extreme'],
      G: ['Quiet', 'Minor', 'Moderate', 'Strong', 'Severe', 'Extreme']
    };
    return descriptions[type]?.[value] || 'Unknown';
  }

  function formatTimeInTz(date, tz) {
    if (!date) return '--:--';
    try {
      return date.toLocaleTimeString('en-US', { 
        timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false 
      });
    } catch {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    }
  }

  function formatTimeAgo(date) {
    const diff = Math.floor((new Date() - date) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  }

  function renderBandRow(name, band) {
    const statusColors = {
      green: '#00ff88',
      yellow: '#ffcc00',
      orange: '#ff8800',
      red: '#ff4444'
    };
    const bgColors = {
      green: 'rgba(0,255,100,0.08)',
      yellow: 'rgba(255,200,0,0.08)',
      orange: 'rgba(255,150,0,0.1)',
      red: 'rgba(255,80,80,0.12)'
    };
    const color = statusColors[band.status] || '#888';
    const bg = bgColors[band.status] || 'transparent';
    
    return `
      <div style="display: flex; align-items: center; padding: 0.4rem 0.6rem; background: ${bg}; border-bottom: 1px solid rgba(255,255,255,0.05);">
        <span style="width: 45px; font-weight: 600; font-size: 0.8rem;">${name}</span>
        <span style="width: 55px; font-size: 0.65rem; opacity: 0.6;">${band.freq}</span>
        <span style="width: 65px; color: ${color}; font-weight: 600; font-size: 0.75rem;">${band.label}</span>
        <span style="flex: 1; font-size: 0.7rem; opacity: 0.85;">${band.notes}</span>
      </div>
    `;
  }

  // ============ DRAG FUNCTIONALITY ============

  function initDrag(panelEl, headerEl) {
    headerEl.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('panel-close')) return;
      isDragging = true;
      const rect = panelEl.getBoundingClientRect();
      dragOffset.x = e.clientX - rect.left;
      dragOffset.y = e.clientY - rect.top;
      panelEl.style.transition = 'none';
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const x = e.clientX - dragOffset.x;
      const y = e.clientY - dragOffset.y;
      panelEl.style.left = `${Math.max(0, Math.min(window.innerWidth - panelEl.offsetWidth, x))}px`;
      panelEl.style.top = `${Math.max(0, Math.min(window.innerHeight - panelEl.offsetHeight, y))}px`;
      panelEl.style.right = 'auto';
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        panelEl.style.transition = '';
      }
    });
  }

  // ============ PANEL CREATION ============

  function createPanel() {
    if (document.getElementById('propagation-panel')) return;

    const styleEl = document.createElement('style');
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);

    const locations = window.TIME_ZONES || [];
    let locationOptions = '<option value="">-- Select Location --</option>';
    locations.forEach((loc, idx) => {
      if (loc.label === 'Zulu') return;
      locationOptions += `<option value="${idx}">${loc.label}</option>`;
    });

    panel = document.createElement('div');
    panel.id = 'propagation-panel';
    panel.innerHTML = `
      <div class="panel-header">
        <span class="panel-title">
          📡 Propagation Forecast
          <span class="panel-title-drag-hint">(drag to move)</span>
        </span>
        <button class="panel-close">&times;</button>
      </div>
      <div class="panel-content">
        <div class="location-selector">
          <label>Location</label>
          <select class="location-select" id="prop-location-select">${locationOptions}</select>
        </div>
        <div id="prop-content"></div>
      </div>
      <div class="panel-footer">
        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
          <span>Space Wx: <a href="${LINKS.noaaScales}" target="_blank">NOAA SWPC</a> · Weather: <a href="https://openweathermap.org/" target="_blank">OpenWeather</a></span>
          <span id="prop-last-update" style="opacity: 0.7;"></span>
        </div>
      </div>
    `;

    document.body.appendChild(panel);

    // Initialize drag
    initDrag(panel, panel.querySelector('.panel-header'));

    // Close button
    panel.querySelector('.panel-close').addEventListener('click', () => {
      panel.style.display = 'none';
    });

    // Load saved location
    const savedIdx = window.RussellTV?.Storage?.load?.('propLocationIdx');
    if (savedIdx !== null && savedIdx !== '' && window.TIME_ZONES?.[savedIdx]) {
      selectedLocation = window.TIME_ZONES[parseInt(savedIdx)];
      panel.querySelector('#prop-location-select').value = savedIdx;
    }

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (panel.style.display !== 'none' &&
          !e.target.closest('#propagation-panel') &&
          !e.target.closest('#propagation-panel-btn')) {
        panel.style.display = 'none';
      }
    });

    attachLocationListener();
    updatePanelContent();
  }

  function attachLocationListener() {
    const select = panel?.querySelector('#prop-location-select');
    if (!select || select._hasListener) return;
    select._hasListener = true;
    
    select.addEventListener('change', (e) => {
      const idx = e.target.value;
      selectedLocation = idx === '' ? null : window.TIME_ZONES[parseInt(idx)];
      if (window.RussellTV?.Storage?.save) {
        window.RussellTV.Storage.save('propLocationIdx', idx);
      }
      updatePanelContent();
    });
  }

  // ============ CONTENT RENDERING ============

  function updatePanelContent() {
    if (!panel) return;
    
    const contentEl = panel.querySelector('#prop-content');
    if (!contentEl) return;

    const data = window.RussellTV?.SpaceWeather?.getCurrentData();
    const config = window.SPACE_WEATHER_CONFIG;

    if (!data || !config) {
      contentEl.innerHTML = '<div style="text-align: center; padding: 2rem; opacity: 0.7;">Loading space weather data...</div>';
      return;
    }

    let html = '';

    // ===== SECTION 1: SPACE WEATHER OVERVIEW =====
    html += `
      <div class="section">
        <div class="section-header">
          <span class="section-title">🌡️ Space Weather Overview</span>
          <a href="${LINKS.noaaScales}" target="_blank" class="section-link">NOAA Scales →</a>
        </div>
        <div class="scale-grid">
          <a href="${LINKS.radioBlackouts}" target="_blank" style="text-decoration: none; color: inherit;">
            <div class="scale-card">
              <div class="scale-card-label">Radio</div>
              <div class="scale-card-value" style="color: ${getScaleColor(data.scales.R)}">R${data.scales.R}</div>
              <div class="scale-card-desc">${getScaleDescription('R', data.scales.R)}</div>
            </div>
          </a>
          <a href="${LINKS.solarRadiation}" target="_blank" style="text-decoration: none; color: inherit;">
            <div class="scale-card">
              <div class="scale-card-label">Solar</div>
              <div class="scale-card-value" style="color: ${getScaleColor(data.scales.S)}">S${data.scales.S}</div>
              <div class="scale-card-desc">${getScaleDescription('S', data.scales.S)}</div>
            </div>
          </a>
          <a href="${LINKS.geomagStorms}" target="_blank" style="text-decoration: none; color: inherit;">
            <div class="scale-card">
              <div class="scale-card-label">Geomag</div>
              <div class="scale-card-value" style="color: ${getScaleColor(data.scales.G)}">G${data.scales.G}</div>
              <div class="scale-card-desc">${getScaleDescription('G', data.scales.G)}</div>
            </div>
          </a>
        </div>
        <div class="info-grid">
          <div class="info-item">
            <span class="label"><a href="${LINKS.kpIndex}" target="_blank" class="inline-link">Kp Index</a></span>
            <span class="value" style="color: ${data.kpIndex >= 5 ? '#ff8800' : '#44cc44'}">${data.kpIndex.toFixed(1)}</span>
          </div>
          <div class="info-item">
            <span class="label">Conditions</span>
            <span class="value">${data.kpIndex >= 5 ? 'Stormy' : data.kpIndex >= 4 ? 'Unsettled' : 'Quiet'}</span>
          </div>
        </div>
        <div style="font-size: 0.7rem; opacity: 0.7; margin-top: 0.5rem; line-height: 1.4;">
          <strong>R</strong> = HF Radio Blackouts (X-ray flares) · 
          <strong>S</strong> = Solar Radiation (energetic particles) · 
          <strong>G</strong> = Geomagnetic Storms (CME/solar wind)
        </div>
      </div>
    `;

    // ===== LOCATION-SPECIFIC SECTIONS =====
    if (selectedLocation) {
      const loc = selectedLocation;
      const dayNight = getDayNightStatus(loc.lat, loc.lon);
      const sunTimes = dayNight.sunTimes || calculateSunTimes(loc.lat, loc.lon);
      const muf = estimateMUF(loc.lat, loc.lon, data);
      const bands = getRecommendedBands(muf, dayNight);
      const geomagLat = getGeomagLat(loc.lat, loc.lon);
      const nvis = getNvisAssessment(loc.lat, data);
      const hfAssessment = getHfAssessment(loc.lat, loc.lon, data);
      const satcom = getSatcomAssessment(loc.lat, loc.lon, data, loc.label);

      // ===== SECTION 2: LOCATION CONDITIONS =====
      html += `
        <div class="section">
          <div class="section-header">
            <span class="section-title">📍 ${loc.label}</span>
            <span class="condition-badge ${dayNight.status}">${dayNight.icon} ${dayNight.label}</span>
          </div>
          <div class="info-grid">
            <div class="info-item">
              <span class="label">Coordinates</span>
              <span class="value">${loc.lat.toFixed(2)}°, ${loc.lon.toFixed(2)}°</span>
            </div>
            <div class="info-item">
              <span class="label"><a href="${LINKS.aurora}" target="_blank" class="inline-link">Geomag Lat</a></span>
              <span class="value">${geomagLat.toFixed(1)}°</span>
            </div>
            <div class="info-item">
              <span class="label">Sunrise</span>
              <span class="value">${sunTimes.sunrise ? formatTimeInTz(sunTimes.sunrise, loc.tz) + ' L' : 'N/A'}</span>
            </div>
            <div class="info-item">
              <span class="label">Sunset</span>
              <span class="value">${sunTimes.sunset ? formatTimeInTz(sunTimes.sunset, loc.tz) + ' L' : 'N/A'}</span>
            </div>
          </div>
        </div>
      `;

      // ===== SECTION 3: HF COMMUNICATIONS =====
      const bandPills = bands.map(b => 
        `<a href="${LINKS.voacap}" target="_blank" style="text-decoration: none;">
          <span class="band-pill ${b.quality}" title="${b.freq}">${b.band}</span>
        </a>`
      ).join('');

      html += `
        <div class="section">
          <div class="section-header">
            <span class="section-title">📻 HF Communications</span>
            <a href="${LINKS.hfPropagation}" target="_blank" class="section-link">SWPC HF →</a>
          </div>
          <div class="muf-row">
            <div>
              <div class="muf-value">${muf} MHz</div>
              <div class="muf-label"><a href="${LINKS.muf}" target="_blank" class="inline-link">Est. MUF</a></div>
            </div>
            <div style="flex: 1; font-size: 0.75rem; opacity: 0.85; line-height: 1.35;">
              ${hfAssessment}
            </div>
          </div>
          <div style="font-size: 0.7rem; opacity: 0.7; margin-bottom: 0.3rem;">
            Recommended Bands <a href="${LINKS.voacap}" target="_blank" class="inline-link" style="font-size: 0.65rem;">(VOACAP)</a>
          </div>
          <div class="band-pills">${bandPills}</div>
          <div class="nvis-box">
            <div class="nvis-title">NVIS (Regional ${nvis.range})</div>
            <div style="font-size: 0.8rem;"><strong>${nvis.recommended}</strong> — ${nvis.quality}</div>
          </div>
          ${data.scales.R >= 2 ? `
            <div class="alert-box orange">
              <strong>⚠️ D-RAP Alert:</strong> D-layer absorption elevated. 
              <a href="${LINKS.drap}" target="_blank" class="inline-link">View absorption map →</a>
            </div>
          ` : ''}
        </div>
      `;

      // ===== SECTION 4: SATCOM & GPS =====
      html += `
        <div class="section">
          <div class="section-header">
            <span class="section-title">📡 SATCOM & GPS</span>
            <a href="${LINKS.satcom}" target="_blank" class="section-link">SWPC →</a>
          </div>
          ${satcom.weather ? `
            <div class="weather-row">
              <span class="weather-icon">${getWeatherIcon(satcom.weather.main)}</span>
              <span style="flex: 1;">${satcom.weather.desc || satcom.weather.main}</span>
              <span>${satcom.weather.temp}°F</span>
              <span style="opacity: 0.7; font-size: 0.8rem;">${satcom.weather.humidity}%</span>
            </div>
          ` : ''}
          
          <!-- Band Status Table -->
          <div style="font-size: 0.7rem; opacity: 0.6; margin-bottom: 0.3rem; text-transform: uppercase;">Band Status & Remarks</div>
          <div style="background: rgba(0,0,0,0.2); border-radius: 8px; overflow: hidden;">
            ${renderBandRow('EHF', satcom.ehf)}
            ${renderBandRow('Ka', satcom.ka)}
            ${renderBandRow('Ku', satcom.ku)}
            ${renderBandRow('X', satcom.x)}
            ${renderBandRow('C', satcom.c)}
            ${renderBandRow('UHF', satcom.uhf)}
          </div>

          <!-- GPS Section -->
          <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid rgba(255,120,0,0.2);">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.4rem;">
              <span style="font-size: 0.75rem; font-weight: 600;">🛰️ GPS/GNSS</span>
              <span class="band-status ${satcom.gps.status}" style="font-size: 0.8rem;">${satcom.gps.label}</span>
            </div>
            ${satcom.gps.notes ? `<div style="font-size: 0.75rem; opacity: 0.85; margin-bottom: 0.4rem;">${satcom.gps.notes}</div>` : ''}
            <div style="display: flex; flex-wrap: wrap; gap: 0.4rem; font-size: 0.7rem;">
              <a href="${LINKS.gpsJam}" target="_blank" class="inline-link">GPSJam Map</a>
              <span style="opacity: 0.4;">·</span>
              <a href="${LINKS.flightradarGps}" target="_blank" class="inline-link">FR24 Interference</a>
              <span style="opacity: 0.4;">·</span>
              <a href="${LINKS.navcenGuide}" target="_blank" class="inline-link">NAVCEN GUIDE</a>
            </div>
          </div>

          <div class="info-grid" style="margin-top: 0.5rem;">
            <div class="info-item">
              <span class="label">Scintillation</span>
              <span class="value">${satcom.scintillation}</span>
            </div>
            <div class="info-item">
              <span class="label">Iono Delay</span>
              <span class="value">${satcom.ionosphericDelay}</span>
            </div>
          </div>
        </div>
      `;
    } else {
      html += `
        <div style="text-align: center; padding: 1.5rem; opacity: 0.6; font-size: 0.9rem;">
          👆 Select a location above for detailed HF and SATCOM assessment
        </div>
      `;
    }

    contentEl.innerHTML = html;

    // Update footer
    const lastUpdate = window.RussellTV?.SpaceWeather?.getLastUpdate();
    const lastUpdateEl = panel.querySelector('#prop-last-update');
    if (lastUpdate && lastUpdateEl) {
      lastUpdateEl.textContent = ` · Updated ${formatTimeAgo(lastUpdate)}`;
    }
  }

  // ============ INITIALIZATION ============

  function init() {
    createPanel();

    Events.on('spaceweather:data-updated', () => {
      updatePanelContent();
    });

    Events.on('feature:toggle', ({ feature, enabled }) => {
      if (feature === 'propagation-panel' && !enabled && panel) {
        panel.style.display = 'none';
      }
    });

    updatePanelContent();
    setTimeout(updatePanelContent, 1000);
    setTimeout(updatePanelContent, 3000);

    Events.emit('propagation:ready', null, { sticky: true });
    console.log('✅ [Propagation] Panel initialized');
  }

  Events.whenReady('spaceweather:ready', init);

})();
