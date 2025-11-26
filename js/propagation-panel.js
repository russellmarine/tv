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
      width: 380px;
      max-height: 80vh;
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

  // ============ PANEL CREATION ============

  function createPanel() {
    if (document.getElementById('propagation-panel')) return;

    // Add styles
    const styleEl = document.createElement('style');
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);

    panel = document.createElement('div');
    panel.id = 'propagation-panel';
    panel.innerHTML = `
      <div class="panel-header">
        <span class="panel-title">📡 Propagation Forecast</span>
        <button class="panel-close">&times;</button>
      </div>
      <div class="panel-content">
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

    if (!data || !config) {
      panel.querySelector('.panel-content').innerHTML = `
        <div style="text-align: center; padding: 2rem; opacity: 0.7;">
          Loading space weather data...
        </div>
      `;
      return;
    }

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
    panel.querySelector('#prop-status-grid').innerHTML = gridHtml;

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
    panel.querySelector('#prop-band-list').innerHTML = bandHtml;

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

    panel.querySelector('#prop-forecast').innerHTML = forecastHtml;

    // Last update
    const lastUpdate = window.RussellTV?.SpaceWeather?.getLastUpdate();
    if (lastUpdate) {
      const ago = formatTimeAgo(lastUpdate);
      panel.querySelector('#prop-last-update').textContent = ` • Updated ${ago}`;
    }
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
    Events.on('spaceweather:data-updated', updatePanelContent);

    // Handle feature toggles
    Events.on('feature:toggle', ({ feature, enabled }) => {
      if (feature === 'propagation-panel' && !enabled && panel) {
        panel.style.display = 'none';
      }
    });

    Events.emit('propagation:ready', null, { sticky: true });

    console.log('✅ [Propagation] Panel initialized');
  }

  // Wait for space weather indicators to be ready
  Events.whenReady('spaceweather:ready', init);

})();
