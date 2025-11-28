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
      background: linear-gradient(145deg, rgba(10, 5, 0, 0.98) 0%, rgba(25, 12, 0, 0.98) 100%);
      border: 2px solid rgba(255, 120, 0, 0.5);
      border-radius: 16px;
      z-index: 10000;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.9), 0 0 30px rgba(255, 100, 0, 0.2);
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: none;
      flex-direction: column;
      overflow: hidden;
    }

    #propagation-panel[style*="display: block"],
    #propagation-panel[style*="display:block"],
    #propagation-panel.visible {
      display: flex !important;
    }

    #propagation-panel input,
    #propagation-panel button,
    #propagation-panel select,
    #propagation-panel a {
      cursor: pointer;
    }

    #propagation-panel input[type="text"],
    #propagation-panel input[type="search"] {
      cursor: text;
    }

    #propagation-panel .panel-header {
      padding: 0.75rem 1rem;
      background: rgba(255, 80, 0, 0.15);
      border-bottom: 1px solid rgba(255, 120, 0, 0.3);
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: grab;
      user-select: none;
      flex-shrink: 0;
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
      overflow-y: auto;
      flex: 1;
      min-height: 0;
    }

    /* Satellite look angles header inside propagation panel */
    #propagation-panel .satla-header {
      cursor: pointer !important;
    }

    #propagation-panel .satla-header * {
      pointer-events: none;
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

    /* Location input mode tabs */
    #propagation-panel .location-mode-tabs {
      display: flex;
      gap: 0.25rem;
      margin-bottom: 0.5rem;
    }

    #propagation-panel .location-mode-tab {
      flex: 1;
      padding: 0.35rem 0.25rem;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 6px;
      color: rgba(255, 255, 255, 0.7);
      font-size: 0.65rem;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s;
    }

    #propagation-panel .location-mode-tab:hover {
      background: rgba(255, 120, 0, 0.15);
      border-color: rgba(255, 120, 0, 0.4);
    }

    #propagation-panel .location-mode-tab.active {
      background: rgba(255, 120, 0, 0.25);
      border-color: rgba(255, 120, 0, 0.6);
      color: #ffcc88;
      font-weight: 600;
    }

    #propagation-panel .location-input-area {
      margin-bottom: 0.5rem;
    }

    #propagation-panel .location-input-hint {
      font-size: 0.65rem;
      color: rgba(255, 200, 150, 0.7);
      margin-bottom: 0.35rem;
      font-style: italic;
    }

    #propagation-panel .location-input-row {
      display: flex;
      gap: 0.5rem;
      align-items: flex-start;
    }

    #propagation-panel .location-input-field {
      flex: 1;
    }

    #propagation-panel .location-input-field label {
      display: block;
      font-size: 0.6rem;
      opacity: 0.6;
      margin-bottom: 0.2rem;
      text-transform: uppercase;
    }

    #propagation-panel .location-input-field input {
      width: 100%;
      padding: 0.4rem 0.5rem;
      background: rgba(0, 0, 0, 0.5);
      border: 1px solid rgba(255, 120, 0, 0.4);
      border-radius: 6px;
      color: white;
      font-size: 0.85rem;
      box-sizing: border-box;
    }

    #propagation-panel .location-input-field input:focus {
      outline: none;
      border-color: rgba(255, 120, 0, 0.8);
    }

    #propagation-panel .location-input-field input::placeholder {
      color: rgba(255, 255, 255, 0.35);
      font-size: 0.75rem;
    }

    #propagation-panel .location-go-btn {
      padding: 0.4rem 0.75rem;
      background: rgba(255, 120, 0, 0.3);
      border: 1px solid rgba(255, 120, 0, 0.6);
      border-radius: 6px;
      color: #ffcc88;
      font-size: 0.8rem;
      cursor: pointer;
      margin-top: 1rem;
      transition: all 0.2s;
    }

    #propagation-panel .location-go-btn:hover {
      background: rgba(255, 120, 0, 0.5);
    }

    #propagation-panel .location-error {
      font-size: 0.7rem;
      color: #ff6666;
      margin-top: 0.35rem;
      padding: 0.3rem 0.5rem;
      background: rgba(255, 50, 50, 0.1);
      border-radius: 4px;
      display: none;
    }

    #propagation-panel .location-error.visible {
      display: block;
    }

    #propagation-panel .location-result {
      margin-top: 0.5rem;
      padding: 0.5rem 0.6rem;
      background: rgba(0, 255, 100, 0.08);
      border: 1px solid rgba(0, 255, 100, 0.3);
      border-radius: 6px;
      display: none;
    }

    #propagation-panel .location-result.visible {
      display: block;
    }

    #propagation-panel .location-result-name {
      font-weight: 600;
      font-size: 0.85rem;
      color: #88ffaa;
    }

    #propagation-panel .location-result-coords {
      font-family: monospace;
      font-size: 0.7rem;
      opacity: 0.8;
      margin-top: 0.2rem;
    }

    #propagation-panel .location-result-use {
      margin-top: 0.4rem;
      padding: 0.3rem 0.6rem;
      background: rgba(0, 255, 100, 0.2);
      border: 1px solid rgba(0, 255, 100, 0.4);
      border-radius: 4px;
      color: #88ffaa;
      font-size: 0.75rem;
      cursor: pointer;
    }

    #propagation-panel .location-result-use:hover {
      background: rgba(0, 255, 100, 0.35);
    }

    /* Recent searches */
    #propagation-panel .recent-searches {
      margin-top: 0.5rem;
    }

    #propagation-panel .recent-searches-header {
      font-size: 0.65rem;
      opacity: 0.6;
      margin-bottom: 0.3rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    #propagation-panel .recent-searches-clear {
      font-size: 0.6rem;
      color: rgba(255, 150, 100, 0.7);
      cursor: pointer;
    }

    #propagation-panel .recent-searches-clear:hover {
      color: #ff9966;
      text-decoration: underline;
    }

    #propagation-panel .recent-search-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.35rem 0.5rem;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 4px;
      margin-bottom: 0.25rem;
      cursor: pointer;
      font-size: 0.75rem;
      transition: all 0.15s;
    }

    #propagation-panel .recent-search-item:hover {
      background: rgba(255, 120, 0, 0.15);
      border-color: rgba(255, 120, 0, 0.3);
    }

    #propagation-panel .recent-search-name {
      font-weight: 500;
    }

    #propagation-panel .recent-search-coords {
      font-family: monospace;
      font-size: 0.65rem;
      opacity: 0.6;
    }

    #propagation-panel .location-search-container {
      position: relative;
    }

    #propagation-panel .location-search-input {
      width: 100%;
      padding: 0.5rem 0.75rem;
      background: rgba(0, 0, 0, 0.5);
      border: 1px solid rgba(255, 120, 0, 0.4);
      border-radius: 8px;
      color: white;
      font-size: 0.9rem;
      box-sizing: border-box;
    }

    #propagation-panel .location-search-input:focus {
      outline: none;
      border-color: rgba(255, 120, 0, 0.8);
    }

    #propagation-panel .location-search-input::placeholder {
      color: rgba(255, 255, 255, 0.4);
    }

    #propagation-panel .location-autocomplete {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: rgba(20, 20, 30, 0.98);
      border: 1px solid rgba(255, 120, 0, 0.4);
      border-top: none;
      border-radius: 0 0 8px 8px;
      max-height: 250px;
      overflow-y: auto;
      z-index: 1001;
      display: none;
    }

    #propagation-panel .location-autocomplete-item {
      padding: 0.5rem 0.75rem;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }

    #propagation-panel .location-autocomplete-item:hover {
      background: rgba(255, 120, 0, 0.2);
    }

    #propagation-panel .location-autocomplete-item:last-child {
      border-bottom: none;
    }

    #propagation-panel .location-autocomplete-name {
      font-size: 0.85rem;
      font-weight: 500;
    }

    #propagation-panel .location-autocomplete-detail {
      font-size: 0.7rem;
      opacity: 0.6;
      max-width: 50%;
      text-align: right;
    }

    #propagation-panel .location-current {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 0.5rem;
      padding: 0.4rem 0.6rem;
      background: rgba(255, 120, 0, 0.1);
      border-radius: 6px;
      font-size: 0.75rem;
    }

    #propagation-panel .location-current-coords {
      font-family: monospace;
      font-size: 0.7rem;
      opacity: 0.7;
    }

    #propagation-panel .saved-locations-toggle {
      font-size: 0.7rem;
      color: rgba(255, 180, 100, 0.8);
      cursor: pointer;
      margin-top: 0.4rem;
      display: inline-block;
    }

    #propagation-panel .saved-locations-toggle:hover {
      color: rgba(255, 180, 100, 1);
      text-decoration: underline;
    }

    #propagation-panel .saved-locations-dropdown {
      margin-top: 0.4rem;
      display: none;
    }

    #propagation-panel .saved-locations-dropdown.visible {
      display: block;
    }

    #propagation-panel .saved-location-btn {
      display: block;
      width: 100%;
      padding: 0.4rem 0.6rem;
      margin-bottom: 0.25rem;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 4px;
      color: white;
      font-size: 0.75rem;
      cursor: pointer;
      text-align: left;
    }

    #propagation-panel .saved-location-btn:hover {
      background: rgba(255, 120, 0, 0.2);
      border-color: rgba(255, 120, 0, 0.4);
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
      flex-shrink: 0;
      background: rgba(10, 5, 0, 0.95);
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
    
    // Try InfoBar weather first (for predefined locations), then custom location weather
    const weather = window.RussellTV?.InfoBar?.getWeather?.(locationLabel) || customLocationWeather;
    
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

  function initDrag(panelEl) {
    const headerEl = panelEl.querySelector('.panel-header');
    if (!headerEl) return;

    // Only allow dragging from the header
    headerEl.addEventListener('mousedown', (e) => {
      // Don't drag if clicking on the close button
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

  // Geocoding state
  let autocompleteResults = [];
  let autocompleteTimeout = null;
  let locationInputMode = 'search'; // 'search', 'mgrs', 'latlon', 'maidenhead'
  let recentSearches = [];
  let pendingLocation = null; // For preview before confirming
  const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
  const NOMINATIM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse';
  const MAX_RECENT_SEARCHES = 8;

  // ============ COORDINATE PARSING ============

  const MGRS_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const UTM_ZONES_LAT = 'CDEFGHJKLMNPQRSTUVWX';

  function mgrsToLatLon(mgrs) {
    // Clean input - remove spaces, convert to uppercase
    mgrs = mgrs.replace(/\s/g, '').toUpperCase();
    
    // Match pattern: 1-2 digit zone, lat band letter, 2 grid letters, 2-10 digit coords
    const match = mgrs.match(/^(\d{1,2})([C-X])([A-HJ-NP-Z]{2})(\d+)$/);
    if (!match) {
      throw new Error('Invalid MGRS format. Example: 18SVK4083001357 (no spaces required)');
    }

    const zone = parseInt(match[1]);
    const latBand = match[2];
    const gridLetters = match[3];
    const coords = match[4];

    if (zone < 1 || zone > 60) throw new Error('Invalid UTM zone (must be 1-60)');

    const len = coords.length;
    if (len % 2 !== 0 || len < 2 || len > 10) {
      throw new Error('MGRS coordinates must be even length (2, 4, 6, 8, or 10 digits)');
    }

    const half = len / 2;
    const precision = Math.pow(10, 5 - half);
    let easting = parseInt(coords.substring(0, half)) * precision;
    let northing = parseInt(coords.substring(half)) * precision;

    // Add offset to center of grid square
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

    // Add offset to center of grid square
    if (grid.length === 4) { lon += 1; lat += 0.5; }
    else if (grid.length === 6) { lon += 1/24; lat += 0.5/24; }
    else if (grid.length === 8) { lon += 1/240; lat += 0.5/240; }

    return { lat, lon };
  }

  function parseDMS(dmsStr) {
    // Parse degrees/minutes/seconds format
    // Accepts: 34°30'15"N, 34 30 15 N, 34-30-15N, 34.5042 (decimal)
    dmsStr = dmsStr.trim().toUpperCase();
    
    // Try decimal first
    const decimalMatch = dmsStr.match(/^(-?\d+\.?\d*)$/);
    if (decimalMatch) {
      return parseFloat(decimalMatch[1]);
    }

    // Try DMS format
    const dmsMatch = dmsStr.match(/^(-?)(\d+)[°\s\-]+(\d+)?['\s\-]*(\d+\.?\d*)?["'\s]*([NSEW])?$/);
    if (dmsMatch) {
      const sign = (dmsMatch[1] === '-' || dmsMatch[5] === 'S' || dmsMatch[5] === 'W') ? -1 : 1;
      const deg = parseFloat(dmsMatch[2]) || 0;
      const min = parseFloat(dmsMatch[3]) || 0;
      const sec = parseFloat(dmsMatch[4]) || 0;
      return sign * (deg + min/60 + sec/3600);
    }

    throw new Error('Invalid coordinate format');
  }

  function parseLatLonInput(latStr, lonStr) {
    try {
      const lat = parseDMS(latStr);
      const lon = parseDMS(lonStr);
      
      if (lat < -90 || lat > 90) throw new Error('Latitude must be between -90 and 90');
      if (lon < -180 || lon > 180) throw new Error('Longitude must be between -180 and 180');
      
      return { lat, lon };
    } catch (e) {
      throw new Error(`Invalid coordinates: ${e.message}`);
    }
  }

  // ============ REVERSE GEOCODING ============

  async function reverseGeocode(lat, lon) {
    try {
      const url = `${NOMINATIM_REVERSE_URL}?lat=${lat}&lon=${lon}&format=json&addressdetails=1`;
      const response = await fetch(url, { headers: { 'User-Agent': 'RussellTV-PropPanel/1.0' } });
      if (!response.ok) return null;
      
      const data = await response.json();
      if (!data || data.error) return null;
      
      const addr = data.address || {};
      const city = addr.city || addr.town || addr.village || addr.hamlet || addr.county || '';
      const state = addr.state || addr.region || '';
      const country = addr.country || '';
      
      let name = city;
      if (state && state !== city) name += name ? `, ${state}` : state;
      if (country && country !== state) name += name ? `, ${country}` : country;
      
      return name || data.display_name?.split(',').slice(0, 2).join(',') || `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
    } catch (e) {
      console.warn('[Propagation] Reverse geocoding failed:', e);
      return null;
    }
  }

  // ============ RECENT SEARCHES ============

  function loadRecentSearches() {
    try {
      const saved = window.RussellTV?.Storage?.load?.('propRecentSearches');
      if (saved) {
        recentSearches = JSON.parse(saved);
      }
    } catch (e) {
      recentSearches = [];
    }
  }

  function saveRecentSearches() {
    try {
      if (window.RussellTV?.Storage?.save) {
        window.RussellTV.Storage.save('propRecentSearches', JSON.stringify(recentSearches));
      }
    } catch (e) {
      console.warn('[Propagation] Failed to save recent searches:', e);
    }
  }

  function addToRecentSearches(location) {
    if (!location || !location.label || !location.coords) return;
    
    // Remove duplicate if exists
    recentSearches = recentSearches.filter(r => 
      r.label !== location.label && 
      !(Math.abs(r.coords.lat - location.coords.lat) < 0.001 && Math.abs(r.coords.lon - location.coords.lon) < 0.001)
    );
    
    // Add to front
    recentSearches.unshift({
      label: location.label,
      coords: location.coords,
      source: location.source || 'search'
    });
    
    // Trim to max
    if (recentSearches.length > MAX_RECENT_SEARCHES) {
      recentSearches = recentSearches.slice(0, MAX_RECENT_SEARCHES);
    }
    
    saveRecentSearches();
  }

  function clearRecentSearches() {
    recentSearches = [];
    saveRecentSearches();
    renderLocationInputArea();
  }

  function selectRecentSearch(idx) {
    const recent = recentSearches[idx];
    if (!recent) return;
    
    applyLocation(recent.label, recent.coords.lat, recent.coords.lon, recent.source || 'recent');
  }

  // ============ LOCATION APPLICATION ============

  async function applyLocation(label, lat, lon, source) {
    selectedLocation = {
      label: label,
      coords: { lat, lon },
      source: source || 'manual'
    };

    // Add to recent searches
    addToRecentSearches(selectedLocation);

    // Save to storage
    if (window.RussellTV?.Storage?.save) {
      window.RussellTV.Storage.save('propLocation', JSON.stringify(selectedLocation));
    }

    // Fetch weather for custom location
    if (source !== 'saved') {
      fetchWeatherForCustomLocation(lat, lon).then(() => {
        updatePanelContent();
      });
    }

    // Emit event
    Events.emit('propagation:location-changed', selectedLocation);

    // Hide error, clear preview
    pendingLocation = null;
    const errorEl = document.getElementById('prop-location-error');
    if (errorEl) errorEl.classList.remove('visible');
    const resultEl = document.getElementById('prop-location-result');
    if (resultEl) resultEl.classList.remove('visible');

    updatePanelContent();
  }

  // ============ INPUT MODE HANDLERS ============

  function setLocationInputMode(mode) {
    locationInputMode = mode;
    renderLocationInputArea();
  }

  async function handleCoordinateSubmit() {
    const errorEl = document.getElementById('prop-location-error');
    const resultEl = document.getElementById('prop-location-result');
    
    const showError = (msg) => {
      if (errorEl) {
        errorEl.textContent = msg;
        errorEl.classList.add('visible');
      }
      if (resultEl) resultEl.classList.remove('visible');
    };

    const showResult = (name, lat, lon, inputValue, inputType) => {
      if (resultEl) {
        let displayName = name;
        // For MGRS/Grid/LatLon, show both the input and the nearby location
        if (inputType === 'mgrs' && inputValue) {
          displayName = `📍 Near: ${name}`;
          resultEl.querySelector('.location-result-name').innerHTML = 
            `<div style="font-family:monospace;color:#ffcc00;margin-bottom:0.2rem;">MGRS: ${inputValue.toUpperCase()}</div>` +
            `<div style="font-size:0.8rem;opacity:0.85;">${displayName}</div>`;
        } else if (inputType === 'maidenhead' && inputValue) {
          displayName = `📍 Near: ${name}`;
          resultEl.querySelector('.location-result-name').innerHTML = 
            `<div style="font-family:monospace;color:#ffcc00;margin-bottom:0.2rem;">Grid: ${inputValue.toUpperCase()}</div>` +
            `<div style="font-size:0.8rem;opacity:0.85;">${displayName}</div>`;
        } else if (inputType === 'latlon') {
          displayName = `📍 Near: ${name}`;
          resultEl.querySelector('.location-result-name').innerHTML = 
            `<div style="font-size:0.8rem;opacity:0.85;">${displayName}</div>`;
        } else {
          resultEl.querySelector('.location-result-name').textContent = name;
        }
        resultEl.querySelector('.location-result-coords').innerHTML = 
          `<span style="color:#88ffaa;">Exact coords:</span> ${lat.toFixed(6)}°, ${lon.toFixed(6)}°`;
        resultEl.classList.add('visible');
      }
      if (errorEl) errorEl.classList.remove('visible');
      pendingLocation = { name, lat, lon, inputValue, inputType };
    };

    try {
      let lat, lon, name;

      if (locationInputMode === 'mgrs') {
        const mgrsInput = document.getElementById('prop-mgrs-input')?.value?.trim();
        if (!mgrsInput) {
          showError('Please enter an MGRS coordinate');
          return;
        }
        const result = mgrsToLatLon(mgrsInput);
        lat = result.lat;
        lon = result.lon;
        const nearbyName = await reverseGeocode(lat, lon);
        name = nearbyName || 'Unknown area';
        showResult(name, lat, lon, mgrsInput, 'mgrs');
        return;
        
      } else if (locationInputMode === 'latlon') {
        const latInput = document.getElementById('prop-lat-input')?.value?.trim();
        const lonInput = document.getElementById('prop-lon-input')?.value?.trim();
        if (!latInput || !lonInput) {
          showError('Please enter both latitude and longitude');
          return;
        }
        const result = parseLatLonInput(latInput, lonInput);
        lat = result.lat;
        lon = result.lon;
        const nearbyName = await reverseGeocode(lat, lon);
        name = nearbyName || 'Unknown area';
        showResult(name, lat, lon, null, 'latlon');
        return;
        
      } else if (locationInputMode === 'maidenhead') {
        const gridInput = document.getElementById('prop-grid-input')?.value?.trim();
        if (!gridInput) {
          showError('Please enter a Maidenhead grid square');
          return;
        }
        const result = maidenheadToLatLon(gridInput);
        lat = result.lat;
        lon = result.lon;
        const nearbyName = await reverseGeocode(lat, lon);
        name = nearbyName || 'Unknown area';
        showResult(name, lat, lon, gridInput, 'maidenhead');
        return;
      }

      showResult(name, lat, lon, null, null);
      
    } catch (e) {
      showError(e.message);
    }
  }

  function confirmPendingLocation() {
    if (!pendingLocation) return;
    
    // Create a label that includes the input type for MGRS/Grid
    let label = pendingLocation.name;
    if (pendingLocation.inputType === 'mgrs' && pendingLocation.inputValue) {
      label = `${pendingLocation.inputValue.toUpperCase()} (${pendingLocation.name})`;
    } else if (pendingLocation.inputType === 'maidenhead' && pendingLocation.inputValue) {
      label = `${pendingLocation.inputValue.toUpperCase()} (${pendingLocation.name})`;
    }
    
    applyLocation(label, pendingLocation.lat, pendingLocation.lon, locationInputMode);
  }

  function renderLocationInputArea() {
    const container = document.getElementById('prop-location-input-area');
    if (!container) return;

    // Update tab active states
    document.querySelectorAll('.location-mode-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.mode === locationInputMode);
    });

    let html = '';

    if (locationInputMode === 'search') {
      html = `
        <div class="location-input-hint">Search by city name, address, base name, or postal code</div>
        <div class="location-search-container">
          <input type="text" 
                 id="prop-location-input" 
                 class="location-search-input"
                 placeholder="e.g., Jacksonville NC, Camp Lejeune, 28540"
                 oninput="window.RussellTV.Propagation.handleLocationInput(this.value)"
                 autocomplete="off">
          <div id="prop-location-autocomplete" class="location-autocomplete"></div>
        </div>
      `;
    } else if (locationInputMode === 'mgrs') {
      html = `
        <div class="location-input-hint">Enter MGRS coordinate (spaces optional)</div>
        <div class="location-input-row">
          <div class="location-input-field" style="flex: 1;">
            <input type="text" id="prop-mgrs-input" 
                   placeholder="e.g., 18SVK4083001357"
                   style="text-transform: uppercase; font-family: monospace;">
          </div>
          <button class="location-go-btn" onclick="window.RussellTV.Propagation.handleCoordinateSubmit()">→</button>
        </div>
        <div class="location-input-hint" style="margin-top: 0.3rem; font-size: 0.6rem; opacity: 0.5;">
          Format: Zone + Band + Grid + Easting/Northing (2-10 digits)
        </div>
      `;
    } else if (locationInputMode === 'latlon') {
      html = `
        <div class="location-input-hint">Enter latitude and longitude (decimal or DMS)</div>
        <div class="location-input-row">
          <div class="location-input-field">
            <label>Latitude</label>
            <input type="text" id="prop-lat-input" placeholder="e.g., 34.5042 or 34°30'15&quot;N">
          </div>
          <div class="location-input-field">
            <label>Longitude</label>
            <input type="text" id="prop-lon-input" placeholder="e.g., -77.3528 or 77°21'10&quot;W">
          </div>
          <button class="location-go-btn" onclick="window.RussellTV.Propagation.handleCoordinateSubmit()">→</button>
        </div>
        <div class="location-input-hint" style="margin-top: 0.3rem; font-size: 0.6rem; opacity: 0.5;">
          DMS format: 34°30'15"N or 34 30 15 N | Decimal: 34.5042
        </div>
      `;
    } else if (locationInputMode === 'maidenhead') {
      html = `
        <div class="location-input-hint">Enter Maidenhead grid locator (ham radio)</div>
        <div class="location-input-row">
          <div class="location-input-field" style="flex: 1;">
            <input type="text" id="prop-grid-input" 
                   placeholder="e.g., FM19la or FM19"
                   style="text-transform: uppercase;">
          </div>
          <button class="location-go-btn" onclick="window.RussellTV.Propagation.handleCoordinateSubmit()">→</button>
        </div>
        <div class="location-input-hint" style="margin-top: 0.3rem; font-size: 0.6rem; opacity: 0.5;">
          4, 6, or 8 character grid square (e.g., FM19, FM19la, FM19la52)
        </div>
      `;
    }

    // Add error display
    html += `<div id="prop-location-error" class="location-error"></div>`;

    // Add result preview
    html += `
      <div id="prop-location-result" class="location-result">
        <div class="location-result-name"></div>
        <div class="location-result-coords"></div>
        <button class="location-result-use" onclick="window.RussellTV.Propagation.confirmPendingLocation()">
          ✓ Use this location
        </button>
      </div>
    `;

    // Add recent searches (for search mode)
    if (locationInputMode === 'search' && recentSearches.length > 0) {
      html += `
        <div class="recent-searches">
          <div class="recent-searches-header">
            <span>📍 Recent</span>
            <span class="recent-searches-clear" onclick="window.RussellTV.Propagation.clearRecentSearches()">Clear</span>
          </div>
          ${recentSearches.map((r, i) => `
            <div class="recent-search-item" onclick="window.RussellTV.Propagation.selectRecentSearch(${i})">
              <span class="recent-search-name">${escapeHtml(r.label)}</span>
              <span class="recent-search-coords">${r.coords.lat.toFixed(2)}°, ${r.coords.lon.toFixed(2)}°</span>
            </div>
          `).join('')}
        </div>
      `;
    }

    container.innerHTML = html;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  async function searchLocation(query) {
    if (!query || query.length < 3) { autocompleteResults = []; return []; }

    try {
      const url = `${NOMINATIM_URL}?q=${encodeURIComponent(query)}&format=json&limit=6&addressdetails=1`;
      const response = await fetch(url, { headers: { 'User-Agent': 'RussellTV-PropPanel/1.0' } });
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

        return { 
          name: r.display_name, 
          shortName: city || r.display_name.split(',')[0], 
          detail, 
          lat: parseFloat(r.lat), 
          lon: parseFloat(r.lon), 
          country 
        };
      });
      return autocompleteResults;
    } catch (error) {
      console.error('[Propagation] Geocoding error:', error);
      autocompleteResults = [];
      return [];
    }
  }

  function handleLocationInput(value) {
    if (autocompleteTimeout) clearTimeout(autocompleteTimeout);
    autocompleteTimeout = setTimeout(async () => {
      await searchLocation(value);
      renderLocationAutocomplete();
    }, 300);
  }

  function renderLocationAutocomplete() {
    const dropdown = document.getElementById('prop-location-autocomplete');
    if (!dropdown) return;
    
    if (autocompleteResults.length === 0) { 
      dropdown.style.display = 'none'; 
      return; 
    }

    const sanitize = window.RussellTV?.sanitize || (s => s);
    dropdown.innerHTML = autocompleteResults.map((r, i) => `
      <div class="location-autocomplete-item" onmousedown="event.preventDefault(); window.RussellTV.Propagation.selectLocation(${i})">
        <span class="location-autocomplete-name">${sanitize(r.shortName)}</span>
        <span class="location-autocomplete-detail">${sanitize(r.detail)}</span>
      </div>
    `).join('');
    dropdown.style.display = 'block';
  }

  // Weather cache for custom locations
  let customLocationWeather = null;

  async function fetchWeatherForCustomLocation(lat, lon) {
    try {
      const response = await fetch(`/weather?lat=${lat}&lon=${lon}`);
      if (response.ok) {
        const data = await response.json();
        if (data && data.main) {
          customLocationWeather = {
            main: data.weather?.[0]?.main || '',
            desc: data.weather?.[0]?.description || '',
            temp: Math.round(data.main.temp),
            humidity: Math.round(data.main.humidity)
          };
          console.log('[Propagation] Fetched weather for custom location:', customLocationWeather);
          return customLocationWeather;
        }
      }
    } catch (e) {
      console.warn('[Propagation] Weather fetch failed:', e);
    }
    customLocationWeather = null;
    return null;
  }

  function selectLocationFromAutocomplete(index) {
    const result = autocompleteResults[index];
    if (!result) return;

    selectedLocation = {
      label: result.shortName + (result.detail ? `, ${result.detail.split(',')[0]}` : ''),
      coords: { lat: result.lat, lon: result.lon },
      fullName: result.name,
      source: 'search'
    };

    const input = document.getElementById('prop-location-input');
    if (input) input.value = selectedLocation.label;

    autocompleteResults = [];
    const dropdown = document.getElementById('prop-location-autocomplete');
    if (dropdown) dropdown.style.display = 'none';

    // Add to recent searches
    addToRecentSearches(selectedLocation);

    // Save to storage
    if (window.RussellTV?.Storage?.save) {
      window.RussellTV.Storage.save('propLocation', JSON.stringify(selectedLocation));
    }

    // Fetch weather for this custom location, then update panel
    fetchWeatherForCustomLocation(result.lat, result.lon).then(() => {
      updatePanelContent();
    });

    // Emit event for satellite look angles and other listeners
    Events.emit('propagation:location-changed', selectedLocation);

    // Re-render location area to update recent searches display
    renderLocationInputArea();

    updatePanelContent();
  }

  function selectSavedLocation(idx) {
    const loc = window.TIME_ZONES?.[idx];
    if (!loc || !loc.coords) return;

    selectedLocation = loc;

    const input = document.getElementById('prop-location-input');
    if (input) input.value = loc.label;

    // Hide saved locations dropdown
    const savedDropdown = document.getElementById('prop-saved-locations');
    if (savedDropdown) savedDropdown.classList.remove('visible');

    // Save to storage
    if (window.RussellTV?.Storage?.save) {
      window.RussellTV.Storage.save('propLocation', JSON.stringify(selectedLocation));
    }

    Events.emit('propagation:location-changed', selectedLocation);
    updatePanelContent();
  }

  function toggleSavedLocations() {
    const dropdown = document.getElementById('prop-saved-locations');
    if (dropdown) dropdown.classList.toggle('visible');
  }

  function createPanel() {
    if (document.getElementById('propagation-panel')) return;

    const styleEl = document.createElement('style');
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);

    // Build saved locations buttons
    const locations = window.TIME_ZONES || [];
    let savedLocationsHtml = '';
    locations.forEach((loc, idx) => {
      if (loc.label === 'Zulu' || !loc.coords) return;
      savedLocationsHtml += `<button class="saved-location-btn" onclick="window.RussellTV.Propagation.selectSavedLocation(${idx})">${loc.label}</button>`;
    });

    // Load recent searches
    loadRecentSearches();

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
          <div class="location-mode-tabs">
            <div class="location-mode-tab active" data-mode="search" onclick="window.RussellTV.Propagation.setLocationMode('search')">🔍 Search</div>
            <div class="location-mode-tab" data-mode="mgrs" onclick="window.RussellTV.Propagation.setLocationMode('mgrs')">🎯 MGRS</div>
            <div class="location-mode-tab" data-mode="latlon" onclick="window.RussellTV.Propagation.setLocationMode('latlon')">📍 Lat/Lon</div>
            <div class="location-mode-tab" data-mode="maidenhead" onclick="window.RussellTV.Propagation.setLocationMode('maidenhead')">📻 Grid</div>
          </div>
          <div id="prop-location-input-area" class="location-input-area"></div>
          <span class="saved-locations-toggle" onclick="window.RussellTV.Propagation.toggleSavedLocations()">📍 Preset locations</span>
          <div id="prop-saved-locations" class="saved-locations-dropdown">
            ${savedLocationsHtml}
          </div>
        </div>
        <div id="prop-content"></div>
      </div>
      <div class="panel-footer">
        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
          <span>Space Wx: <a href="${LINKS.noaaScales}" target="_blank" rel="noopener noreferrer">NOAA SWPC</a> · Weather: <a href="https://openweathermap.org/" target="_blank" rel="noopener noreferrer">OpenWeather</a></span>
          <span id="prop-last-update" style="opacity: 0.7;"></span>
        </div>
      </div>
    `;

    document.body.appendChild(panel);

    // Initialize drag
    initDrag(panel);

    // Close button
    panel.querySelector('.panel-close').addEventListener('click', () => {
      panel.classList.remove('visible');
    });

    // Close autocomplete on outside click
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#prop-location-autocomplete') && !e.target.closest('#prop-location-input')) {
        const dropdown = document.getElementById('prop-location-autocomplete');
        if (dropdown) dropdown.style.display = 'none';
      }
    });

    // Render the initial location input area
    renderLocationInputArea();

    // Load saved location
    loadSavedLocation();
    updatePanelContent();
  }

  function loadSavedLocation() {
    try {
      const saved = window.RussellTV?.Storage?.load?.('propLocation');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Validate that we have valid coordinates
        const lat = parsed.coords?.lat ?? parsed.lat;
        const lon = parsed.coords?.lon ?? parsed.lon;
        if (lat != null && lon != null && !isNaN(lat) && !isNaN(lon)) {
          selectedLocation = parsed;
          const input = document.getElementById('prop-location-input');
          if (input && selectedLocation?.label) {
            input.value = selectedLocation.label;
          }
          
          // If this is a custom/search location (not a predefined TIME_ZONE), fetch weather
          if (parsed.source === 'search' || !window.RussellTV?.InfoBar?.getWeather?.(parsed.label)) {
            fetchWeatherForCustomLocation(lat, lon).then(() => {
              updatePanelContent();
            });
          }
        } else {
          // Invalid saved location, clear it
          selectedLocation = null;
          window.RussellTV?.Storage?.save?.('propLocation', '');
        }
      }
    } catch (e) {
      console.warn('[Propagation] Failed to load saved location:', e);
      selectedLocation = null;
    }
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
          <a href="${LINKS.noaaScales}" target="_blank" rel="noopener noreferrer" class="section-link">NOAA Scales →</a>
        </div>
        <div class="scale-grid">
          <a href="${LINKS.radioBlackouts}" target="_blank" rel="noopener noreferrer" style="text-decoration: none; color: inherit;">
            <div class="scale-card">
              <div class="scale-card-label">Radio</div>
              <div class="scale-card-value" style="color: ${getScaleColor(data.scales.R)}">R${data.scales.R}</div>
              <div class="scale-card-desc">${getScaleDescription('R', data.scales.R)}</div>
            </div>
          </a>
          <a href="${LINKS.solarRadiation}" target="_blank" rel="noopener noreferrer" style="text-decoration: none; color: inherit;">
            <div class="scale-card">
              <div class="scale-card-label">Solar</div>
              <div class="scale-card-value" style="color: ${getScaleColor(data.scales.S)}">S${data.scales.S}</div>
              <div class="scale-card-desc">${getScaleDescription('S', data.scales.S)}</div>
            </div>
          </a>
          <a href="${LINKS.geomagStorms}" target="_blank" rel="noopener noreferrer" style="text-decoration: none; color: inherit;">
            <div class="scale-card">
              <div class="scale-card-label">Geomag</div>
              <div class="scale-card-value" style="color: ${getScaleColor(data.scales.G)}">G${data.scales.G}</div>
              <div class="scale-card-desc">${getScaleDescription('G', data.scales.G)}</div>
            </div>
          </a>
        </div>
        <div class="info-grid">
          <div class="info-item">
            <span class="label"><a href="${LINKS.kpIndex}" target="_blank" rel="noopener noreferrer" class="inline-link">Kp Index</a></span>
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
    if (selectedLocation && (selectedLocation.coords || (selectedLocation.lat != null && selectedLocation.lon != null))) {
      // Normalize location structure - handle both old format (lat/lon) and new format (coords.lat/lon)
      const lat = selectedLocation.coords?.lat ?? selectedLocation.lat;
      const lon = selectedLocation.coords?.lon ?? selectedLocation.lon;
      
      console.log('[Propagation] Location debug:', { selectedLocation, lat, lon });
      
      // Skip if we don't have valid coordinates
      if (lat == null || lon == null || isNaN(lat) || isNaN(lon)) {
        console.warn('[Propagation] Invalid coordinates, skipping location section');
        // Don't show location section if no valid location
      } else {
        const loc = {
          label: selectedLocation.label || 'Unknown',
          lat: parseFloat(lat),
          lon: parseFloat(lon),
          tz: selectedLocation.tz || 'UTC'
        };
        
        console.log('[Propagation] Using loc:', loc);
        
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
              <span class="label"><a href="${LINKS.aurora}" target="_blank" rel="noopener noreferrer" class="inline-link">Geomag Lat</a></span>
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
        `<a href="${LINKS.voacap}" target="_blank" rel="noopener noreferrer" style="text-decoration: none;">
          <span class="band-pill ${b.quality}" title="${b.freq}">${b.band}</span>
        </a>`
      ).join('');

      html += `
        <div class="section">
          <div class="section-header">
            <span class="section-title">📻 HF Communications</span>
            <a href="${LINKS.hfPropagation}" target="_blank" rel="noopener noreferrer" class="section-link">SWPC HF →</a>
          </div>
          <div class="muf-row">
            <div>
              <div class="muf-value">${muf} MHz</div>
              <div class="muf-label"><a href="${LINKS.muf}" target="_blank" rel="noopener noreferrer" class="inline-link">Est. MUF</a></div>
            </div>
            <div style="flex: 1; font-size: 0.75rem; opacity: 0.85; line-height: 1.35;">
              ${hfAssessment}
            </div>
          </div>
          <div style="font-size: 0.7rem; opacity: 0.7; margin-bottom: 0.3rem;">
            Recommended Bands <a href="${LINKS.voacap}" target="_blank" rel="noopener noreferrer" class="inline-link" style="font-size: 0.65rem;">(VOACAP)</a>
          </div>
          <div class="band-pills">${bandPills}</div>
          <div class="nvis-box">
            <div class="nvis-title">NVIS (Regional ${nvis.range})</div>
            <div style="font-size: 0.8rem;"><strong>${nvis.recommended}</strong> — ${nvis.quality}</div>
          </div>
          ${data.scales.R >= 2 ? `
            <div class="alert-box orange">
              <strong>⚠️ D-RAP Alert:</strong> D-layer absorption elevated. 
              <a href="${LINKS.drap}" target="_blank" rel="noopener noreferrer" class="inline-link">View absorption map →</a>
            </div>
          ` : ''}
        </div>
      `;

      // ===== SECTION 4: SATCOM & GPS =====
      html += `
        <div class="section">
          <div class="section-header">
            <span class="section-title">📡 SATCOM & GPS</span>
            <a href="${LINKS.satcom}" target="_blank" rel="noopener noreferrer" class="section-link">SWPC →</a>
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
              <a href="${LINKS.gpsJam}" target="_blank" rel="noopener noreferrer" class="inline-link">GPSJam Map</a>
              <span style="opacity: 0.4;">·</span>
              <a href="${LINKS.flightradarGps}" target="_blank" rel="noopener noreferrer" class="inline-link">FR24 Interference</a>
              <span style="opacity: 0.4;">·</span>
              <a href="${LINKS.navcenGuide}" target="_blank" rel="noopener noreferrer" class="inline-link">NAVCEN GUIDE</a>
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

      // ===== SECTION 5: SATELLITE LOOK ANGLES =====
      html += `<div id="satla-container"></div>`;

      // ===== SECTION 6: CELLULAR COVERAGE =====
      html += `<div id="cell-container"></div>`;
      }  // End of valid coordinates check
    } else {
      html += `
        <div style="text-align: center; padding: 1.5rem; opacity: 0.6; font-size: 0.9rem;">
          👆 Select a location above for detailed HF and SATCOM assessment
        </div>
      `;
    }

    contentEl.innerHTML = html;

    // Render satellite look angles section if available
    if (selectedLocation && window.RussellTV?.SatLookAngles) {
      const satlaContainer = contentEl.querySelector('#satla-container');
      if (satlaContainer) {
        window.RussellTV.SatLookAngles.render(satlaContainer);
      }
    }

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

    // Listen for satellite look angles render requests
    Events.on('satla:render', () => {
      if (selectedLocation) {
        const satlaContainer = panel?.querySelector('#satla-container');
        if (satlaContainer && window.RussellTV?.SatLookAngles) {
          window.RussellTV.SatLookAngles.render(satlaContainer);
        }
      }
    });

    Events.on('feature:toggle', ({ feature, enabled }) => {
      if (feature === 'propagation-panel' && !enabled && panel) {
        panel.classList.remove('visible');
      }
    });

    updatePanelContent();
    setTimeout(updatePanelContent, 1000);
    setTimeout(updatePanelContent, 3000);

    Events.emit('propagation:ready', null, { sticky: true });
    console.log('✅ [Propagation] Panel initialized');
  }

  Events.whenReady('spaceweather:ready', init);

  // ============ PANEL VISIBILITY ============
  
  function showPanel() {
    if (panel) {
      panel.style.display = '';  // Clear any inline style
      panel.classList.add('visible');
    }
  }

  function hidePanel() {
    if (panel) {
      panel.classList.remove('visible');
    }
  }

  function togglePanel() {
    if (panel) {
      if (panel.classList.contains('visible')) {
        hidePanel();
      } else {
        showPanel();
      }
    }
  }

  function isPanelVisible() {
    return panel?.classList.contains('visible') || false;
  }

  // ============ PUBLIC API ============
  window.RussellTV = window.RussellTV || {};
  window.RussellTV.Propagation = {
    getSelectedLocation: () => selectedLocation,
    getPanel: () => panel,
    showPanel,
    hidePanel,
    togglePanel,
    isPanelVisible,
    handleLocationInput,
    selectLocation: selectLocationFromAutocomplete,
    selectSavedLocation,
    toggleSavedLocations,
    setLocationMode: setLocationInputMode,
    handleCoordinateSubmit,
    confirmPendingLocation,
    selectRecentSearch,
    clearRecentSearches
  };

})();
