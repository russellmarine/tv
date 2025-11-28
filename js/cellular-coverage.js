/**
 * cellular-coverage.js - Cell Tower Coverage Panel for RussellTV
 * 
 * Displays cellular coverage information based on location:
 * - Nearby carriers and their technologies (5G, LTE, 3G)
 * - Tower density and coverage quality assessment
 * - Band information for US carriers
 * - VPN/CGNAT considerations for cellular backhaul
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

  // Technology colors
  const TECH_COLORS = {
    '5G': '#00ffcc',
    'LTE': '#44cc44',
    'UMTS': '#ffaa00',
    'GSM': '#ff6644',
    'CDMA': '#cc66ff'
  };

  // ============ STATE ============
  
  let currentLocation = null;
  let cellData = null;
  let lastFetch = null;
  let isExpanded = false;
  let isLoading = false;

  // ============ STYLES ============
  
  const styles = `
    .cell-section { margin-top:1rem; border:1px solid rgba(150,100,255,0.3); border-radius:8px; overflow:visible; }
    .cell-header { display:flex; justify-content:space-between; align-items:center; padding:0.75rem 1rem; background:rgba(150,100,255,0.1); cursor:pointer; user-select:none; transition:background 0.15s; }
    .cell-header:hover { background:rgba(150,100,255,0.25); }
    .cell-header:active { background:rgba(150,100,255,0.35); }
    .cell-header .section-title { font-weight:bold; font-size:0.9rem; pointer-events:none; }
    .cell-header .expand-icon { font-size:0.8rem; opacity:0.7; pointer-events:none; }
    .cell-content { padding:1rem; }
    
    .cell-summary { display:flex; align-items:center; gap:0.6rem; padding:0.5rem 0.6rem; background:rgba(150,100,255,0.08); border-radius:6px; margin-bottom:0.6rem; }
    .cell-summary-badge { padding:0.2rem 0.5rem; border-radius:4px; font-size:0.7rem; font-weight:600; text-transform:uppercase; }
    .cell-summary-text { font-size:0.8rem; }
    
    .cell-location { display:flex; justify-content:space-between; padding:0.4rem 0.6rem; background:rgba(150,100,255,0.1); border-radius:4px; margin-bottom:0.5rem; font-size:0.8rem; }
    .cell-location .coords { font-family:monospace; font-size:0.7rem; opacity:0.7; }
    
    .cell-carriers { margin-bottom:0.6rem; }
    .cell-carriers-title { font-size:0.7rem; text-transform:uppercase; opacity:0.6; margin-bottom:0.3rem; letter-spacing:0.5px; }
    .cell-carrier { display:flex; justify-content:space-between; align-items:center; padding:0.4rem 0.6rem; background:rgba(255,255,255,0.03); border-bottom:1px solid rgba(255,255,255,0.05); }
    .cell-carrier:last-child { border-bottom:none; }
    .cell-carrier-name { font-weight:500; font-size:0.8rem; }
    .cell-carrier-tech { display:flex; gap:0.3rem; }
    .cell-carrier-tech span { padding:0.1rem 0.3rem; border-radius:3px; font-size:0.6rem; font-weight:600; }
    
    .cell-tech-summary { display:flex; flex-wrap:wrap; gap:0.4rem; margin-bottom:0.6rem; }
    .cell-tech-badge { display:flex; align-items:center; gap:0.25rem; padding:0.25rem 0.5rem; border-radius:4px; font-size:0.7rem; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); }
    .cell-tech-badge .count { opacity:0.7; }
    
    .cell-towers-nearby { margin-bottom:0.6rem; }
    .cell-towers-title { font-size:0.7rem; text-transform:uppercase; opacity:0.6; margin-bottom:0.3rem; letter-spacing:0.5px; display:flex; justify-content:space-between; align-items:center; }
    .cell-tower { display:grid; grid-template-columns:60px 1fr 50px 50px; gap:0.3rem; padding:0.3rem 0.5rem; background:rgba(255,255,255,0.02); border-bottom:1px solid rgba(255,255,255,0.03); font-size:0.7rem; }
    .cell-tower:nth-child(odd) { background:rgba(255,255,255,0.04); }
    .cell-tower-header { font-weight:600; opacity:0.6; text-transform:uppercase; font-size:0.6rem; }
    .cell-tower-distance { font-family:monospace; }
    .cell-tower-signal { font-family:monospace; }
    
    .cell-vpn-note { padding:0.5rem 0.6rem; background:rgba(255,200,100,0.1); border:1px solid rgba(255,200,100,0.3); border-radius:6px; margin-top:0.5rem; }
    .cell-vpn-note-title { font-size:0.75rem; font-weight:600; color:#ffcc88; margin-bottom:0.3rem; display:flex; align-items:center; gap:0.3rem; }
    .cell-vpn-note-text { font-size:0.7rem; opacity:0.85; line-height:1.4; }
    
    .cell-bands { margin-top:0.5rem; padding:0.4rem 0.6rem; background:rgba(100,150,255,0.08); border-radius:4px; }
    .cell-bands-title { font-size:0.65rem; text-transform:uppercase; opacity:0.6; margin-bottom:0.25rem; }
    .cell-bands-list { display:flex; flex-wrap:wrap; gap:0.25rem; }
    .cell-band { padding:0.1rem 0.3rem; background:rgba(100,150,255,0.2); border-radius:3px; font-size:0.6rem; font-family:monospace; }
    .cell-band.nr { background:rgba(0,255,200,0.2); color:#00ffcc; }
    
    .cell-loading { display:flex; align-items:center; justify-content:center; gap:0.6rem; padding:1.5rem; font-size:0.8rem; }
    .cell-loading-spinner { width:18px; height:18px; border:2px solid rgba(150,100,255,0.3); border-top-color:rgba(150,100,255,1); border-radius:50%; animation:cell-spin 1s linear infinite; }
    @keyframes cell-spin { to { transform:rotate(360deg); } }
    
    .cell-no-data { text-align:center; padding:1.2rem; opacity:0.6; font-size:0.75rem; }
    
    .cell-footer { display:flex; justify-content:space-between; padding-top:0.4rem; margin-top:0.4rem; border-top:1px solid rgba(255,255,255,0.1); font-size:0.6rem; opacity:0.6; }
    .cell-footer a { color:rgba(150,180,255,0.9); }
    
    .cell-btn { padding:0.25rem 0.4rem; border-radius:4px; border:1px solid rgba(150,100,255,0.5); background:rgba(150,100,255,0.2); color:white; cursor:pointer; font-size:0.7rem; }
    .cell-btn:hover { background:rgba(150,100,255,0.4); }
    
    .cell-roaming-warning { display:flex; align-items:flex-start; gap:0.5rem; padding:0.6rem; background:rgba(255,100,100,0.15); border:1px solid rgba(255,100,100,0.4); border-radius:6px; margin-bottom:0.6rem; }
    .cell-roaming-icon { font-size:1.2rem; }
    .cell-roaming-text { font-size:0.75rem; line-height:1.4; }
    .cell-roaming-text small { opacity:0.8; }
    
    .cell-signal-stats { padding:0.5rem 0.6rem; background:rgba(100,200,255,0.08); border-radius:6px; margin-bottom:0.6rem; }
    .cell-signal-title { font-size:0.7rem; font-weight:600; margin-bottom:0.4rem; }
    .cell-signal-bar { height:8px; background:rgba(255,255,255,0.1); border-radius:4px; overflow:hidden; margin-bottom:0.3rem; }
    .cell-signal-fill { height:100%; border-radius:4px; transition:width 0.3s; }
    .cell-signal-details { display:flex; gap:0.8rem; font-size:0.65rem; opacity:0.85; }
  `;

  // ============ DATA FETCHING ============
  
  async function fetchCellData(lat, lon) {
    // Skip if we already have recent data for this location
    if (cellData && lastFetch && (Date.now() - lastFetch < CACHE_TTL) && currentLocation &&
        Math.abs(currentLocation.lat - lat) < 0.001 && Math.abs(currentLocation.lon - lon) < 0.001) {
      console.log('[Cellular] Using cached data');
      Events.emit('cell:render');
      return;
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
      
      console.log(`[Cellular] Received ${data.summary?.total || 0} towers, coverage: ${data.summary?.coverage}`);
      
    } catch (error) {
      console.error('[Cellular] Fetch error:', error);
      cellData = {
        towers: [],
        carriers: [],
        technologies: {},
        summary: { total: 0, coverage: 'unknown' },
        error: error.message
      };
    }
    
    isLoading = false;
    Events.emit('cell:render');
  }

  // ============ UI RENDERING ============
  
  function renderCellularCoverage(containerEl) {
    if (!containerEl) return;
    
    // Get location from propagation panel
    const propLocation = window.RussellTV?.Propagation?.getSelectedLocation?.();
    if (propLocation && propLocation.coords) {
      const newLat = propLocation.coords.lat;
      const newLon = propLocation.coords.lon;
      
      // Check if location changed
      if (!currentLocation || 
          Math.abs(currentLocation.lat - newLat) > 0.001 || 
          Math.abs(currentLocation.lon - newLon) > 0.001) {
        currentLocation = {
          lat: newLat,
          lon: newLon,
          name: propLocation.label
        };
        // Fetch new data
        fetchCellData(newLat, newLon);
      }
    }

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
            </div>`; 
        }

        // Technology summary
        if (cellData.technologies && Object.keys(cellData.technologies).length > 0) {
          html += `<div class="cell-tech-summary">`;
          const techOrder = ['5G', 'LTE', 'UMTS', 'GSM', 'CDMA'];
          for (const tech of techOrder) {
            const count = cellData.technologies[tech] || 0;
            if (count > 0) {
              const color = TECH_COLORS[tech] || '#888';
              html += `
                <div class="cell-tech-badge" style="border-color:${color}44;">
                  <span style="color:${color};">●</span>
                  <span>${tech}</span>
                  <span class="count">×${count}</span>
                </div>`;
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
                const color = TECH_COLORS[tech] || '#888';
                html += `<span style="background:${color}33; color:${color};">${tech}</span>`;
              }
            }
            
            html += `
                </div>
              </div>`;
            
            // Show bands for US carriers
            if (carrier.bands && carrier.bands.length > 0) {
              html += `
                <div class="cell-bands">
                  <div class="cell-bands-title">Typical Bands for ${escapeHtml(carrier.name)}</div>
                  <div class="cell-bands-list">`;
              for (const band of carrier.bands) {
                const isNR = band.startsWith('n');
                html += `<span class="cell-band${isNR ? ' nr' : ''}">${band}</span>`;
              }
              html += `</div></div>`;
            }
          }
          
          html += `</div>`;
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
                <span>Signal</span>
              </div>`;
          
          for (const tower of cellData.towers.slice(0, 8)) {
            const techColor = TECH_COLORS[tower.technology] || '#888';
            const flag = tower.flag || '';
            html += `
              <div class="cell-tower">
                <span style="font-size:0.65rem;">${flag} ${escapeHtml(tower.carrier?.split(' ')[0] || 'Unknown')}</span>
                <span style="color:${techColor};">${tower.technology || tower.radio || '?'}</span>
                <span class="cell-tower-distance">${tower.distance}m</span>
                <span class="cell-tower-signal">${tower.signal ? tower.signal + ' dBm' : '—'}</span>
              </div>`;
          }
          
          html += `</div>`;
        }

        // VPN/CGNAT note
        html += `
          <div class="cell-vpn-note">
            <div class="cell-vpn-note-title">⚠️ VPN Considerations</div>
            <div class="cell-vpn-note-text">
              Most cellular carriers use <strong>CGNAT</strong> (Carrier-Grade NAT), which can affect VPN connectivity:
              <ul style="margin:0.3rem 0 0 1rem; padding:0;">
                <li>Use <strong>UDP-based VPNs</strong> (WireGuard, OpenVPN UDP) for better NAT traversal</li>
                <li>Avoid TCP-based VPNs which may have connection issues</li>
                <li>Consider <strong>split tunneling</strong> for bandwidth-sensitive applications</li>
                <li>5G networks may have better throughput but similar NAT limitations</li>
              </ul>
            </div>
          </div>`;

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
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, c => 
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ============ PUBLIC API ============
  
  function toggleExpand() { 
    isExpanded = !isExpanded; 
    Events.emit('cell:render'); 
  }

  function refresh() {
    if (currentLocation) {
      cellData = null;
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

  function init() {
    console.log('[Cellular] Initializing coverage panel');
    injectStyles();

    // Listen for render events
    Events.on('cell:render', () => {
      const container = document.getElementById('cell-container');
      if (container) {
        renderCellularCoverage(container);
      }
    });

    // Listen for location changes from propagation panel
    Events.on('propagation:location-changed', (location) => {
      console.log('[Cellular] Location changed event:', location);
      
      if (location) {
        // Handle both formats: {coords: {lat, lon}} and {lat, lon}
        const newLat = location.coords?.lat ?? location.lat;
        const newLon = location.coords?.lon ?? location.lon;
        
        if (newLat != null && newLon != null && !isNaN(newLat) && !isNaN(newLon)) {
          const lat = parseFloat(newLat);
          const lon = parseFloat(newLon);
          
          if (!currentLocation || 
              Math.abs(currentLocation.lat - lat) > 0.001 || 
              Math.abs(currentLocation.lon - lon) > 0.001) {
            currentLocation = {
              lat: lat,
              lon: lon,
              name: location.label || 'Unknown'
            };
            
            console.log('[Cellular] New location set:', currentLocation);
            // Always pre-fetch data when location changes (cache will handle duplicates)
            fetchCellData(lat, lon);
          }
        }
      }
    });

    // Helper function to ensure container exists
    function ensureCellContainer() {
      let cellContainer = document.getElementById('cell-container');
      if (!cellContainer) {
        cellContainer = document.createElement('div');
        cellContainer.id = 'cell-container';
        
        // Try to insert after satellite look angles section
        const satlaSection = document.querySelector('.satla-section');
        if (satlaSection && satlaSection.parentNode) {
          satlaSection.parentNode.insertBefore(cellContainer, satlaSection.nextSibling);
        } else {
          // Fallback: append to prop-content
          const propContent = document.getElementById('prop-content');
          if (propContent) {
            propContent.appendChild(cellContainer);
          }
        }
      }
      return cellContainer;
    }

    // Listen for satellite look angles render to inject our section
    Events.on('satla:render', () => {
      setTimeout(() => {
        const container = ensureCellContainer();
        if (container) renderCellularCoverage(container);
      }, 50);
    });

    // Initial render when propagation panel is ready
    Events.whenReady('propagation:ready', () => {
      setTimeout(() => {
        // Get location from propagation panel's public API first
        let propLocation = window.RussellTV?.Propagation?.getSelectedLocation?.();
        
        // Fallback: check localStorage using RussellTV Storage API
        if (!propLocation || (!propLocation.coords && propLocation.lat == null)) {
          try {
            const Storage = window.RussellTV?.Storage;
            if (Storage) {
              // The propagation panel saves to 'propLocation' 
              // Storage.load automatically adds 'russelltv.' prefix
              const saved = Storage.load('propLocation');
              if (saved) {
                // Handle double-stringified case
                const parsed = typeof saved === 'string' ? JSON.parse(saved) : saved;
                console.log('[Cellular] Loaded from storage:', parsed);
                
                // Handle both formats: {coords: {lat, lon}} and {lat, lon}
                const lat = parsed.coords?.lat ?? parsed.lat;
                const lon = parsed.coords?.lon ?? parsed.lon;
                
                if (lat != null && lon != null && !isNaN(lat) && !isNaN(lon)) {
                  propLocation = {
                    coords: { lat: parseFloat(lat), lon: parseFloat(lon) },
                    label: parsed.label || 'Saved Location'
                  };
                }
              }
            }
          } catch (e) {
            console.warn('[Cellular] Error reading saved location:', e);
          }
        }
        
        if (propLocation) {
          // Normalize the location format
          const lat = propLocation.coords?.lat ?? propLocation.lat;
          const lon = propLocation.coords?.lon ?? propLocation.lon;
          
          if (lat != null && lon != null && !isNaN(lat) && !isNaN(lon)) {
            currentLocation = {
              lat: parseFloat(lat),
              lon: parseFloat(lon),
              name: propLocation.label || 'Unknown'
            };
            console.log('[Cellular] Using location:', currentLocation);
            // Pre-fetch data for cached location
            fetchCellData(currentLocation.lat, currentLocation.lon);
          }
        }
        
        // Ensure container exists and render
        const container = ensureCellContainer();
        if (container) renderCellularCoverage(container);
      }, 300);
    });

    // Also listen for propagation panel render to ensure we always show
    Events.on('propagation:render', () => {
      setTimeout(() => {
        // Check for location again in case it wasn't ready before
        if (!currentLocation) {
          const propLocation = window.RussellTV?.Propagation?.getSelectedLocation?.();
          if (propLocation && propLocation.coords) {
            currentLocation = {
              lat: propLocation.coords.lat,
              lon: propLocation.coords.lon,
              name: propLocation.label
            };
            fetchCellData(currentLocation.lat, currentLocation.lon);
          }
        }
        const container = ensureCellContainer();
        if (container) renderCellularCoverage(container);
      }, 100);
    });

    Events.emit('cell:ready', null, { sticky: true });
    console.log('✅ [Cellular] Coverage panel initialized');
  }

  // Wait for dependencies
  if (Events.whenReady) {
    Events.whenReady('propagation:ready', init);
  } else {
    window.addEventListener('load', () => setTimeout(init, 1000));
  }

  // ============ EXPORT PUBLIC API ============
  window.RussellTV = window.RussellTV || {};
  window.RussellTV.CellCoverage = {
    toggleExpand,
    refresh,
    getData: () => cellData,
    getLocation: () => currentLocation
  };

})();
