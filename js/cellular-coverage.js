/**
 * cellular-coverage.js - Cell Tower Coverage Panel for RussellTV
 * 
 * Displays cellular coverage information based on location:
 * - Nearby carriers and their technologies (5G, LTE, 3G)
 * - Tower density and coverage quality assessment
 * - Band information for US carriers
 * - Technology definitions
 * 
 * Data source: OpenCelliD (https://opencellid.org)
 */

(function() {
  'use strict';

  const Events = window.RussellTV?.Events;
  if (!Events) {
    console.warn('[Cellular] Events system not found, delaying init');
    setTimeout(() => location.reload(), 2000);
    return;
  }

  // ============ CONFIGURATION ============
  
  const CELL_API_URL = '/cell'; // Proxied through cell-proxy.js or nginx
  const SEARCH_RADIUS = 500; // 500m search radius (API limit is ~2km box)
  const CACHE_TTL = 60 * 60 * 1000; // 1 hour cache

  // Coverage quality colors
  const COVERAGE_COLORS = {
    excellent: '#00ff88',
    good: '#88cc44',
    moderate: '#ffcc00',
    limited: '#ff8800',
    none: '#ff4444',
    unknown: '#888888'
  };

  // Technology colors and definitions
  const TECH_INFO = {
    '5G': { 
      color: '#00ffcc', 
      name: '5G NR',
      desc: '5th Gen New Radio — Ultra-fast speeds (100+ Mbps), low latency (<10ms)'
    },
    'LTE': { 
      color: '#44cc44', 
      name: 'LTE/4G',
      desc: 'Long Term Evolution — Fast data (10-50 Mbps), good for video/VoIP'
    },
    'UMTS': { 
      color: '#ffaa00', 
      name: 'UMTS/3G',
      desc: 'Universal Mobile Telecom System — Moderate speeds (1-5 Mbps), reliable voice'
    },
    'GSM': { 
      color: '#ff6644', 
      name: 'GSM/2G',
      desc: 'Global System for Mobile — Basic voice/SMS, slow data (up to 200 Kbps)'
    },
    'CDMA': { 
      color: '#cc66ff', 
      name: 'CDMA',
      desc: 'Code Division Multiple Access — Legacy US carrier tech (Verizon/Sprint)'
    }
  };

  // ============ STATE ============
  
  let currentLocation = null;
  let cellData = null;
  let lastFetch = null;
  let lastFetchLocation = null; // Track which location the cached data is for
  let isExpanded = false;
  let isLoading = false;
  let showTechInfo = false; // Toggle for technology definitions

  // ============ STYLES ============
  
  const styles = `
    .cell-section { 
      margin-top: 1rem; 
      border: 1px solid rgba(150,100,255,0.3); 
      border-radius: 8px; 
      overflow: hidden;
    }
    .cell-header { 
      display: flex; 
      justify-content: space-between; 
      align-items: center; 
      padding: 0.75rem 1rem; 
      background: rgba(150,100,255,0.1); 
      cursor: pointer; 
      user-select: none; 
      transition: background 0.15s; 
    }
    .cell-header:hover { background: rgba(150,100,255,0.25); }
    .cell-header:active { background: rgba(150,100,255,0.35); }
    .cell-header .section-title { font-weight: bold; font-size: 0.9rem; pointer-events: none; }
    .cell-header .expand-icon { font-size: 0.8rem; opacity: 0.7; pointer-events: none; }
    
    .cell-content { 
      padding: 1rem; 
    }
    
    .cell-summary { display: flex; align-items: center; gap: 0.6rem; padding: 0.5rem 0.6rem; background: rgba(150,100,255,0.08); border-radius: 6px; margin-bottom: 0.6rem; }
    .cell-summary-badge { padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; }
    .cell-summary-text { font-size: 0.8rem; }
    
    .cell-location { display: flex; justify-content: space-between; padding: 0.4rem 0.6rem; background: rgba(150,100,255,0.1); border-radius: 4px; margin-bottom: 0.5rem; font-size: 0.8rem; }
    .cell-location .coords { font-family: monospace; font-size: 0.7rem; opacity: 0.7; }
    
    .cell-carriers { margin-bottom: 0.6rem; }
    .cell-carriers-title { font-size: 0.7rem; text-transform: uppercase; opacity: 0.6; margin-bottom: 0.3rem; letter-spacing: 0.5px; }
    .cell-carrier { display: flex; justify-content: space-between; align-items: center; padding: 0.4rem 0.6rem; background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.05); }
    .cell-carrier:last-child { border-bottom: none; }
    .cell-carrier-name { font-weight: 500; font-size: 0.8rem; }
    .cell-carrier-tech { display: flex; gap: 0.3rem; }
    .cell-carrier-tech span { padding: 0.1rem 0.3rem; border-radius: 3px; font-size: 0.6rem; font-weight: 600; }
    
    .cell-tech-summary { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 0.6rem; }
    .cell-tech-badge { display: flex; align-items: center; gap: 0.25rem; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.7rem; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); cursor: help; }
    .cell-tech-badge .count { opacity: 0.7; }
    
    .cell-tech-info { 
      margin-bottom: 0.6rem; 
      padding: 0.5rem 0.6rem; 
      background: rgba(100,150,255,0.08); 
      border: 1px solid rgba(100,150,255,0.2); 
      border-radius: 6px; 
    }
    .cell-tech-info-title { 
      font-size: 0.7rem; 
      font-weight: 600; 
      margin-bottom: 0.4rem; 
      display: flex; 
      justify-content: space-between; 
      align-items: center; 
    }
    .cell-tech-info-toggle { 
      font-size: 0.65rem; 
      color: rgba(150,180,255,0.9); 
      cursor: pointer; 
      text-decoration: underline; 
    }
    .cell-tech-def { 
      display: flex; 
      align-items: flex-start; 
      gap: 0.4rem; 
      padding: 0.3rem 0; 
      border-bottom: 1px solid rgba(255,255,255,0.05); 
      font-size: 0.7rem; 
    }
    .cell-tech-def:last-child { border-bottom: none; }
    .cell-tech-def-name { font-weight: 600; min-width: 55px; }
    .cell-tech-def-desc { opacity: 0.85; line-height: 1.3; }
    
    .cell-towers-nearby { margin-bottom: 0.6rem; }
    .cell-towers-title { font-size: 0.7rem; text-transform: uppercase; opacity: 0.6; margin-bottom: 0.3rem; letter-spacing: 0.5px; display: flex; justify-content: space-between; align-items: center; }
    .cell-tower { display: grid; grid-template-columns: 70px 1fr 60px 70px; gap: 0.3rem; padding: 0.3rem 0.5rem; background: rgba(255,255,255,0.02); border-bottom: 1px solid rgba(255,255,255,0.03); font-size: 0.7rem; }
    .cell-tower:nth-child(odd) { background: rgba(255,255,255,0.04); }
    .cell-tower-header { font-weight: 600; opacity: 0.6; text-transform: uppercase; font-size: 0.6rem; }
    .cell-tower-distance, .cell-tower-bearing { font-family: monospace; }
    .cell-tower-signal { font-family: monospace; font-size: 0.65rem; }
    .cell-tower-signal.strong { color: #00ff88; }
    .cell-tower-signal.good { color: #88cc44; }
    .cell-tower-signal.fair { color: #ffcc00; }
    .cell-tower-signal.weak { color: #ff6644; }
    
    .cell-bands { 
      margin: 0.15rem 0 0.4rem 0;
      padding: 0.35rem 0.6rem;
      background: rgba(100,150,255,0.08);
      border-radius: 4px;
    }
    .cell-bands-title { 
      font-size: 0.65rem; 
      text-transform: uppercase; 
      opacity: 0.6; 
      margin-bottom: 0.25rem; 
    }
    .cell-bands-list { 
      display: flex; 
      flex-wrap: wrap; 
      gap: 0.25rem; 
    }
    .cell-band { 
      padding: 0.1rem 0.3rem; 
      border-radius: 3px; 
      font-size: 0.6rem; 
      font-family: monospace; 
      background: rgba(100,150,255,0.2);
    }
    .cell-band.nr { 
      background: rgba(0,255,200,0.2); 
      color: #00ffcc; 
    }
    .cell-band.lte {
      background: rgba(68,204,68,0.20);
      color: #44cc44;     /* LTE / 4G green */
    }
    .cell-band.umts {
      background: rgba(255,170,0,0.20);
      color: #ffaa00;     /* UMTS / 3G yellow/orange */
    }
    .cell-band.gsm {
      background: rgba(255,102,68,0.20);
      color: #ff6644;     /* GSM / 2G red */
    }

    .cell-band-legend {
      margin-top: 0.5rem;
      padding: 0.4rem 0.6rem;
      background: rgba(255,255,255,0.03);
      border-radius: 4px;
      border: 1px solid rgba(255,255,255,0.08);
      font-size: 0.65rem;
    }
    .cell-band-legend-title {
      text-transform: uppercase;
      opacity: 0.6;
      margin-bottom: 0.3rem;
      letter-spacing: 0.5px;
    }
    .cell-band-legend-items {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .cell-band-legend-items span {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      opacity: 0.9;
    }
    .cell-band-legend-dot {
      width: 8px;
      height: 8px;
      border-radius: 999px;
      display: inline-block;
    }
    .cell-band-legend-dot.lte { background: #44cc44; }     /* LTE / 4G (green) */
    .cell-band-legend-dot.umts { background: #ffaa00; }   /* UMTS / 3G (yellow/orange) */
    .cell-band-legend-dot.gsm { background: #ff6644; }    /* GSM / 2G (red) */
    .cell-band-legend-dot.nr { background: #00ffcc; }     /* 5G NR (cyan) */
    
    .cell-loading { display: flex; align-items: center; justify-content: center; gap: 0.6rem; padding: 1.5rem; font-size: 0.8rem; }
    .cell-loading-spinner { width: 18px; height: 18px; border: 2px solid rgba(150,100,255,0.3); border-top-color: rgba(150,100,255,1); border-radius: 50%; animation: cell-spin 1s linear infinite; }
    @keyframes cell-spin { to { transform: rotate(360deg); } }
    
    .cell-no-data { text-align: center; padding: 1.2rem; opacity: 0.6; font-size: 0.75rem; }
    
    .cell-footer { display: flex; justify-content: space-between; padding-top: 0.4rem; margin-top: 0.4rem; border-top: 1px solid rgba(255,255,255,0.1); font-size: 0.6rem; opacity: 0.6; }
    .cell-footer a { color: rgba(150,180,255,0.9); }
    
    .cell-btn { padding: 0.25rem 0.4rem; border-radius: 4px; border: 1px solid rgba(150,100,255,0.5); background: rgba(150,100,255,0.2); color: white; cursor: pointer; font-size: 0.7rem; }
    .cell-btn:hover { background: rgba(150,100,255,0.4); }
    
    .cell-roaming-warning { display: flex; align-items: flex-start; gap: 0.5rem; padding: 0.6rem; background: rgba(255,100,100,0.15); border: 1px solid rgba(255,100,100,0.4); border-radius: 6px; margin-bottom: 0.6rem; }
    .cell-roaming-icon { font-size: 1.2rem; }
    .cell-roaming-text { font-size: 0.75rem; line-height: 1.4; }
    .cell-roaming-text small { opacity: 0.8; }
    
    .cell-signal-stats { padding: 0.5rem 0.6rem; background: rgba(100,200,255,0.08); border-radius: 6px; margin-bottom: 0.6rem; }
    .cell-signal-title { font-size: 0.7rem; font-weight: 600; margin-bottom: 0.4rem; }
    .cell-signal-bar { height: 8px; background: rgba(255,255,255,0.1); border-radius: 4px; overflow: hidden; margin-bottom: 0.3rem; }
    .cell-signal-fill { height: 100%; border-radius: 4px; transition: width 0.3s; }
    .cell-signal-details { display: flex; gap: 0.8rem; font-size: 0.65rem; opacity: 0.85; }
    
    .cell-signal-legend { 
      display: flex; 
      flex-wrap: wrap; 
      gap: 0.5rem; 
      margin-top: 0.4rem; 
      padding-top: 0.4rem; 
      border-top: 1px solid rgba(255,255,255,0.1); 
      font-size: 0.6rem; 
      opacity: 0.7; 
    }
    .cell-signal-legend span { display: flex; align-items: center; gap: 0.2rem; }
  `;

  // ============ DATA FETCHING ============
  
  async function fetchCellData(lat, lon) {
    // Check if we have valid cached data for THIS EXACT location
    const isSameLocation = lastFetchLocation && 
      Math.abs(lastFetchLocation.lat - lat) < 0.001 && 
      Math.abs(lastFetchLocation.lon - lon) < 0.001;
    
    if (cellData && lastFetch && isSameLocation && (Date.now() - lastFetch < CACHE_TTL)) {
      console.log('[Cellular] Using cached data for', lat.toFixed(4), lon.toFixed(4));
      Events.emit('cell:render');
      return;
    }
    
    // Clear old data when fetching for new location
    if (!isSameLocation) {
      console.log('[Cellular] Location changed, clearing cache');
      cellData = null;
      lastFetch = null;
      lastFetchLocation = null;
    }
    
    isLoading = true;
    Events.emit('cell:render');
    
    try {
      const url = `${CELL_API_URL}?lat=${lat}&lon=${lon}&range=${SEARCH_RADIUS}`;
      console.log(`[Cellular] Fetching: ${url}`);
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      cellData = data;
      lastFetch = Date.now();
      lastFetchLocation = { lat, lon }; // Track which location this data is for
      
      console.log(`[Cellular] Received ${data.summary?.total || 0} towers for ${lat.toFixed(4)}, ${lon.toFixed(4)}, coverage: ${data.summary?.coverage}`);
      
    } catch (error) {
      console.error('[Cellular] Fetch error:', error);
      cellData = {
        towers: [],
        carriers: [],
        technologies: {},
        summary: { total: 0, coverage: 'unknown' },
        error: error.message
      };
      lastFetchLocation = { lat, lon }; // Still track location even on error
    }
    
    isLoading = false;
    Events.emit('cell:render');
  }

  // ============ SIGNAL STRENGTH HELPERS ============
  
  function getSignalClass(dbm) {
    if (dbm == null || isNaN(dbm)) return '';
    if (dbm >= -70) return 'strong';
    if (dbm >= -85) return 'good';
    if (dbm >= -100) return 'fair';
    return 'weak';
  }

  function formatSignal(signal) {
    // Handle various signal formats from API
    if (signal == null || signal === '' || signal === 0) {
      return { display: '—', class: '' };
    }
    
    let dbm = signal;
    
    // If it's a string, try to parse
    if (typeof signal === 'string') {
      dbm = parseInt(signal, 10);
    }
    
    // OpenCelliD sometimes returns signal as positive number or range values
    // Valid dBm for cellular is typically -30 to -120
    if (dbm > 0) {
      // Might be ASU (Arbitrary Strength Unit) - convert to dBm
      // ASU for GSM: dBm = 2 × ASU − 113
      if (dbm <= 31) {
        dbm = 2 * dbm - 113;
      } else if (dbm <= 97) {
        // LTE RSRP ASU: dBm = ASU - 140
        dbm = dbm - 140;
      } else {
        // Unknown format, return as-is with question
        return { display: `${signal}?`, class: '' };
      }
    }
    
    // Validate range
    if (dbm < -140 || dbm > -20) {
      return { display: '—', class: '' };
    }
    
    return { 
      display: `${dbm} dBm`, 
      class: getSignalClass(dbm) 
    };
  }

  // ============ UI RENDERING ============
  
  function renderCellularCoverage(containerEl) {
    if (!containerEl) return;

    let html = `
      <div class="cell-section">
        <div class="cell-header" onclick="window.RussellTV.CellCoverage.toggleExpand()">
          <span class="section-title">📶 Cellular Coverage</span>
          <span class="expand-icon">${isExpanded ? '▼' : '▶'}</span>
        </div>`;

    if (isExpanded) {
      html += `<div class="cell-content">`;

      if (!currentLocation) {
        html += `<div class="cell-no-data">Select a location above to view cellular coverage</div>`;
      } else if (isLoading) {
        html += `
          <div class="cell-loading">
            <div class="cell-loading-spinner"></div>
            <span>Scanning cell towers...</span>
          </div>`;
      } else if (cellData) {
        // Location display
        html += `
          <div class="cell-location">
            <span>${escapeHtml(currentLocation.name || 'Selected Location')}</span>
            <span class="coords">${currentLocation.lat.toFixed(4)}°, ${currentLocation.lon.toFixed(4)}°</span>
          </div>`;

        // Coverage summary
        const coverage = cellData.summary?.coverage || 'unknown';
        const coverageColor = COVERAGE_COLORS[coverage] || COVERAGE_COLORS.unknown;
        const coverageLabel = coverage.charAt(0).toUpperCase() + coverage.slice(1);
        const countryFlag = cellData.summary?.expectedCountryFlag || '';
        
        html += `
          <div class="cell-summary">
            <span class="cell-summary-badge" style="background:${coverageColor}22; color:${coverageColor}; border:1px solid ${coverageColor}44;">
              ${coverageLabel}
            </span>
            <span class="cell-summary-text">
              ${countryFlag} ${cellData.summary?.total || 0} towers within ${SEARCH_RADIUS/1000}km
              ${cellData.summary?.nearestTower ? ` · Nearest: ${cellData.summary.nearestTower}m` : ''}
            </span>
          </div>`;

        // Roaming warning
        if (cellData.summary?.roamingWarning && cellData.summary?.roamingCountries?.length > 0) {
          const roamingFlags = cellData.summary.roamingCountries.map(c => c.flag).join(' ');
          html += `
            <div class="cell-roaming-warning">
              <span class="cell-roaming-icon">⚠️</span>
              <span class="cell-roaming-text">
                <strong>Roaming Alert:</strong> Towers from other countries detected nearby: ${roamingFlags}
                <br><small>Your device may connect to foreign networks, potentially incurring roaming charges.</small>
              </span>
            </div>`;
        }

        // Signal strength stats
        if (cellData.summary?.signalStats) {
          const stats = cellData.summary.signalStats;
          const signalColor = stats.quality === 'excellent' ? '#00ff88' : 
                              stats.quality === 'good' ? '#88cc44' : 
                              stats.quality === 'fair' ? '#ffcc00' : '#ff6644';
          html += `
            <div class="cell-signal-stats">
              <div class="cell-signal-title">📶 Signal Strength</div>
              <div class="cell-signal-bar">
                <div class="cell-signal-fill" style="width:${Math.min(100, (140 + stats.avg) / 1.4)}%; background:${signalColor};"></div>
              </div>
              <div class="cell-signal-details">
                <span style="color:${signalColor};">${stats.quality.toUpperCase()}</span>
                <span>Avg: ${stats.avg} dBm</span>
                <span>Range: ${stats.min} to ${stats.max} dBm</span>
              </div>
              <div class="cell-signal-legend">
                <span><span style="color:#00ff88;">●</span> Strong (≥-70)</span>
                <span><span style="color:#88cc44;">●</span> Good (-85 to -70)</span>
                <span><span style="color:#ffcc00;">●</span> Fair (-100 to -85)</span>
                <span><span style="color:#ff6644;">●</span> Weak (&lt;-100)</span>
              </div>
            </div>`; 
        }

        // Technology summary with info toggle
        if (cellData.technologies && Object.keys(cellData.technologies).length > 0) {
          const detectedTechs = [];
          html += `<div class="cell-tech-summary">`;
          const techOrder = ['5G', 'LTE', 'UMTS', 'GSM', 'CDMA'];
          for (const tech of techOrder) {
            const count = cellData.technologies[tech] || 0;
            if (count > 0) {
              detectedTechs.push(tech);
              const info = TECH_INFO[tech] || { color: '#888' };
              html += `
                <div class="cell-tech-badge" style="border-color:${info.color}44;" title="${info.desc || ''}">
                  <span style="color:${info.color};">●</span>
                  <span>${tech}</span>
                  <span class="count">×${count}</span>
                </div>`;
            }
          }
          html += `</div>`;
          
          // Technology definitions panel
          html += `
            <div class="cell-tech-info">
              <div class="cell-tech-info-title">
                <span>📡 Technology Reference</span>
                <span class="cell-tech-info-toggle" onclick="event.stopPropagation(); window.RussellTV.CellCoverage.toggleTechInfo()">
                  ${showTechInfo ? 'Hide' : 'Show'}
                </span>
              </div>`;
          
          if (showTechInfo) {
            for (const tech of detectedTechs) {
              const info = TECH_INFO[tech];
              if (info) {
                html += `
                  <div class="cell-tech-def">
                    <span class="cell-tech-def-name" style="color:${info.color};">${info.name}</span>
                    <span class="cell-tech-def-desc">${info.desc}</span>
                  </div>`;
              }
            }
          }
          html += `</div>`;
        }

        // Carriers
        if (cellData.carriers && cellData.carriers.length > 0) {
          html += `
            <div class="cell-carriers">
              <div class="cell-carriers-title">Carriers Detected</div>`;
          
          for (const carrier of cellData.carriers.slice(0, 6)) {
            const flag = carrier.flag || '';
            html += `
              <div class="cell-carrier">
                <span class="cell-carrier-name">${flag} ${escapeHtml(carrier.name)}</span>
                <div class="cell-carrier-tech">`;
            
            // Show technologies for this carrier
            const techOrder = ['5G', 'LTE', 'UMTS', 'GSM', 'CDMA'];
            for (const tech of techOrder) {
              if (carrier.technologies && carrier.technologies[tech]) {
                const info = TECH_INFO[tech] || { color: '#888' };
                html += `<span style="background:${info.color}33; color:${info.color};">${tech}</span>`;
              }
            }
            
            html += `
                </div>
              </div>`;
            
            // Show bands for this carrier
            if (carrier.bands && carrier.bands.length > 0) {
              html += `
                <div class="cell-bands">
                  <div class="cell-bands-title">Typical Bands for ${escapeHtml(carrier.name)}</div>
                  <div class="cell-bands-list">`;
              for (const bandRaw of carrier.bands) {
                const band = String(bandRaw);
                let cls = '';
                if (band.startsWith('n')) {
                  cls = ' nr';          // 5G NR
                } else if (band.startsWith('B')) {
                  cls = ' lte';         // LTE / 4G
                } else if (/^\d+$/.test(band)) {
                  const num = parseInt(band, 10);
                  // crude: lower freqs ~GSM, higher often 3G-ish
                  if (num <= 900) cls = ' gsm';
                  else cls = ' umts';
                }
                html += `<span class="cell-band${cls}">${band}</span>`;
              }
              html += `</div></div>`;
            }
          }
          
          html += `</div>`;
        }

        // Band legend (notation for bands across carriers)
        if (cellData.carriers && cellData.carriers.some(c => c.bands && c.bands.length)) {
          html += `
            <div class="cell-band-legend">
              <div class="cell-band-legend-title">Band Legend</div>
              <div class="cell-band-legend-items">
                <span><span class="cell-band-legend-dot lte"></span> LTE / 4G bands (Bxx)</span>
                <span><span class="cell-band-legend-dot umts"></span> UMTS / 3G bands</span>
                <span><span class="cell-band-legend-dot gsm"></span> GSM / 2G bands (often 900 / 1800 MHz)</span>
                <span><span class="cell-band-legend-dot nr"></span> 5G NR bands (nxx)</span>
              </div>
            </div>`;
        }

        // Nearest towers table
        if (cellData.towers && cellData.towers.length > 0) {
          html += `
            <div class="cell-towers-nearby">
              <div class="cell-towers-title">
                <span>Nearest Towers</span>
                <button class="cell-btn" onclick="event.stopPropagation(); window.RussellTV.CellCoverage.refresh()">🔄</button>
              </div>
              <div class="cell-tower cell-tower-header">
                <span>Carrier</span>
                <span>Technology</span>
                <span>Distance</span>
                <span>Bearing (°T)</span>
              </div>`;
          
          for (const tower of cellData.towers.slice(0, 8)) {
            const techInfo = TECH_INFO[tower.technology] || TECH_INFO[tower.radio] || { color: '#888' };
            const flag = tower.flag || '';
            const signal = formatSignal(tower.signal || tower.averageSignal || tower.samples?.[0]?.signal);

            const bearingText = (typeof tower.bearingDeg === 'number' && !Number.isNaN(tower.bearingDeg))
              ? `${tower.bearingDeg}°T`
              : '—';
            
            html += `
              <div class="cell-tower">
                <span style="font-size:0.65rem;">${flag} ${escapeHtml(tower.carrier?.split(' ')[0] || 'Unknown')}</span>
                <span style="color:${techInfo.color};">${tower.technology || tower.radio || '?'}</span>
                <span class="cell-tower-distance">${tower.distance}m</span>
                <span class="cell-tower-bearing">${bearingText}</span>
              </div>`;
          }
          
          html += `</div>`;
        }

        // Footer
        html += `
          <div class="cell-footer">
            <span>Data: <a href="https://opencellid.org" target="_blank" rel="noopener">OpenCelliD</a></span>
            <span>${lastFetch ? 'Updated: ' + new Date(lastFetch).toLocaleTimeString() : ''}</span>
          </div>`;

      } else {
        html += `<div class="cell-no-data">No cell tower data available</div>`;
      }

      html += `</div>`; // end cell-content
    }

    html += `</div>`; // end cell-section

    containerEl.innerHTML = html;
    
    // Add scroll isolation to prevent parent scrolling
    const contentEl = containerEl.querySelector('.cell-content');
    if (contentEl) {
      contentEl.addEventListener('wheel', (e) => {
        const { scrollTop, scrollHeight, clientHeight } = contentEl;
        const isAtTop = scrollTop === 0;
        const isAtBottom = scrollTop + clientHeight >= scrollHeight - 1;
        
        // If scrolling up at top or down at bottom, prevent propagation
        if ((e.deltaY < 0 && isAtTop) || (e.deltaY > 0 && isAtBottom)) {
          // At boundary - let it propagate naturally but don't over-scroll
          if (scrollHeight > clientHeight) {
            // Has scrollable content, stop at boundary
            e.preventDefault();
          }
        } else if (scrollHeight > clientHeight) {
          // Has scrollable content and not at boundary - stop propagation
          e.stopPropagation();
        }
      }, { passive: false });
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, c => 
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ============ LOCATION HANDLING ============
  
  /**
   * Update current location and fetch new data if needed
   * This is the single source of truth for location updates
   */
  function updateLocation(location) {
    if (!location) return false;
    
    // Normalize location format - handle both {coords: {lat, lon}} and {lat, lon}
    const lat = location.coords?.lat ?? location.lat;
    const lon = location.coords?.lon ?? location.lon;
    const label = location.label || location.name || 'Unknown';
    
    if (lat == null || lon == null || isNaN(lat) || isNaN(lon)) {
      console.warn('[Cellular] Invalid location:', location);
      return false;
    }
    
    const newLat = parseFloat(lat);
    const newLon = parseFloat(lon);
    
    // Check if this is actually a new location
    const isNewLocation = !currentLocation || 
      Math.abs(currentLocation.lat - newLat) > 0.001 || 
      Math.abs(currentLocation.lon - newLon) > 0.001;
    
    if (isNewLocation) {
      console.log('[Cellular] Setting new location:', label, newLat.toFixed(4), newLon.toFixed(4));
      
      // Clear cached data for old location
      cellData = null;
      lastFetch = null;
      lastFetchLocation = null;
      
      currentLocation = {
        lat: newLat,
        lon: newLon,
        name: label
      };
      
      // Fetch data for new location
      fetchCellData(newLat, newLon);
      return true;
    }
    
    return false;
  }

  // ============ PUBLIC API ============
  
  function toggleExpand() { 
    isExpanded = !isExpanded; 
    Events.emit('cell:render'); 
  }

  function toggleTechInfo() {
    showTechInfo = !showTechInfo;
    Events.emit('cell:render');
  }

  function refresh() {
    if (currentLocation) {
      // Force refresh by clearing cache
      cellData = null;
      lastFetch = null;
      lastFetchLocation = null;
      fetchCellData(currentLocation.lat, currentLocation.lon);
    }
  }

  // ============ INITIALIZATION ============
  
  function injectStyles() {
    if (document.getElementById('cell-coverage-styles')) return;
    const styleEl = document.createElement('style');
    styleEl.id = 'cell-coverage-styles';
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);
  }

  function loadLocationFromStorage() {
    try {
      // Try propagation panel API first
      let propLocation = window.RussellTV?.Propagation?.getSelectedLocation?.();
      
      // Fallback to storage
      if (!propLocation || (!propLocation.coords && propLocation.lat == null)) {
        const Storage = window.RussellTV?.Storage;
        if (Storage) {
          const saved = Storage.load('propLocation');
          if (saved) {
            propLocation = typeof saved === 'string' ? JSON.parse(saved) : saved;
            console.log('[Cellular] Loaded location from storage:', propLocation);
          }
        }
      }
      
      if (propLocation) {
        const lat = propLocation.coords?.lat ?? propLocation.lat;
        const lon = propLocation.coords?.lon ?? propLocation.lon;
        
        if (lat != null && lon != null && !isNaN(lat) && !isNaN(lon)) {
          currentLocation = {
            lat: parseFloat(lat),
            lon: parseFloat(lon),
            name: propLocation.label || 'Saved Location'
          };
          console.log('[Cellular] Set location from storage:', currentLocation);
          fetchCellData(currentLocation.lat, currentLocation.lon);
          return true;
        }
      }
    } catch (e) {
      console.warn('[Cellular] Error loading location:', e);
    }
    return false;
  }

  function ensureAndRender() {
    const container = document.getElementById('cell-container');
    if (container) {
      renderCellularCoverage(container);
      return true;
    }
    return false;
  }

  function init() {
    console.log('[Cellular] Initializing coverage panel');
    injectStyles();

    // Listen for render events
    Events.on('cell:render', () => {
      ensureAndRender();
    });

    // Listen for location changes from propagation panel - THIS IS THE PRIMARY HANDLER
    Events.on('propagation:location-changed', (location) => {
      console.log('[Cellular] Location changed event received:', location);
      updateLocation(location);
    });

    // Listen for propagation panel content updates to render ourselves
    Events.on('spaceweather:data-updated', () => {
      setTimeout(() => {
        // Check if we need to load location from storage
        if (!currentLocation) {
          loadLocationFromStorage();
        }
        ensureAndRender();
      }, 100);
    });

    // Listen for propagation panel content rendered (container now exists)
    Events.on('propagation:content-rendered', () => {
      console.log('[Cellular] Propagation content rendered, checking container');
      if (!currentLocation) {
        loadLocationFromStorage();
      }
      ensureAndRender();
    });

    // Try to load location and render immediately
    loadLocationFromStorage();
    
    // Retry render a few times to catch container creation
    setTimeout(ensureAndRender, 100);
    setTimeout(ensureAndRender, 300);
    setTimeout(ensureAndRender, 600);
    setTimeout(ensureAndRender, 1000);

    Events.emit('cell:ready', null, { sticky: true });
    console.log('✅ [Cellular] Coverage panel initialized');
  }

  // Start initialization immediately - don't wait for propagation:ready
  // The propagation panel creates the container, but we should be ready to render
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ============ EXPORT PUBLIC API ============
  window.RussellTV = window.RussellTV || {};
  window.RussellTV.CellCoverage = {
    toggleExpand,
    toggleTechInfo,
    refresh,
    getData: () => cellData,
    getLocation: () => currentLocation,
    updateLocation,
    render: ensureAndRender
  };

})();
