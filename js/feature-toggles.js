/**
 * feature-toggles.js - Feature toggle system for RussellTV
 * 
 * Events Emitted:
 * - 'feature:toggle' - When any feature is toggled { feature, enabled }
 * - 'features:ready' (sticky) - When toggle system is initialized
 * 
 * Events Listened:
 * - 'spaceweather:ready' - Apply initial states when indicators exist
 */

(function() {
  'use strict';

  const Events = window.RussellTV?.Events;
  const Storage = window.RussellTV?.Storage;

  if (!Events) {
    console.error('[Features] RussellTV.Events not found. Load russelltv-core.js first.');
    return;
  }

  // ============ FEATURE DEFINITIONS ============

  const FEATURES = {
    'space-weather-indicators': {
      label: 'HF/GPS/SAT Indicators',
      description: 'Status indicators in the info bar',
      icon: '📡',
      category: 'space-comms',
      default: true
    },
    'propagation-panel': {
      label: 'Propagation Panel',
      description: 'Detailed HF/SATCOM propagation forecasts',
      icon: '⚡',
      category: 'space-comms',
      default: true
    },
    'satellite-planner': {
      label: 'Satellite Look Angles',
      description: 'GEO satellite visibility calculator',
      icon: '🛰️',
      category: 'space-comms',
      default: true
    },
    'weather-tooltips': {
      label: 'Weather Tooltips',
      description: 'Location weather information on hover',
      icon: '🌤️',
      category: 'weather',
      default: true
    }
  };

  const CATEGORIES = {
    'space-comms': { label: 'Comm Planner Tools', icon: '📡' },
    'weather': { label: 'Weather Features', icon: '🌤️' }
  };

  // ============ STATE ============

  let featureStates = {};
  let panelVisible = false;

  // ============ STORAGE ============

  function loadStates() {
    const stored = Storage?.loadFeatureToggles?.() || Storage?.load?.('featureToggles');
    featureStates = {};
    
    for (const [key, def] of Object.entries(FEATURES)) {
      featureStates[key] = stored?.[key] ?? def.default;
    }
  }

  function saveStates() {
    if (Storage?.saveFeatureToggles) {
      Storage.saveFeatureToggles(featureStates);
    } else if (Storage?.save) {
      Storage.save('featureToggles', featureStates);
    }
  }

  // ============ APPLY STATES ============

  function applyState(key) {
    const enabled = featureStates[key];
    console.log(`[Features] Applying state: ${key} = ${enabled}`);

    // Emit event - info-bar.js will handle the actual DOM changes
    Events.emit('feature:toggle', { feature: key, enabled });

    // Special case for weather tooltips (CSS class on body)
    if (key === 'weather-tooltips') {
      document.body.classList.toggle('weather-tooltips-disabled', !enabled);
    }

    // Close propagation panel if disabled
    if (key === 'propagation-panel' && !enabled) {
      const panel = document.getElementById('propagation-panel');
      if (panel) panel.style.display = 'none';
    }
  }

  function applyAllStates() {
    for (const key of Object.keys(featureStates)) {
      applyState(key);
    }
  }

  // ============ TOGGLE LOGIC ============

  function toggle(key) {
    if (!FEATURES[key]) return;

    featureStates[key] = !featureStates[key];
    applyState(key);  // This now emits the event
    saveStates();
    updatePanelUI();
  }

  function setAll(enabled) {
    for (const key of Object.keys(FEATURES)) {
      featureStates[key] = enabled;
      applyState(key);  // This now emits the event
    }
    saveStates();
    updatePanelUI();
  }

  // ============ SETTINGS PANEL ============

  const panelStyles = `
    #feature-settings-panel {
      position: fixed;
      top: 80px;
      right: 20px;
      width: 340px;
      max-height: 80vh;
      overflow-y: auto;
      background: linear-gradient(145deg, rgba(10, 5, 0, 0.98), rgba(25, 12, 0, 0.98));
      border: 2px solid rgba(255, 120, 0, 0.5);
      border-radius: 16px;
      z-index: 10003;
      display: none;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.9), 0 0 30px rgba(255, 100, 0, 0.2);
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    #feature-settings-panel .panel-header {
      padding: 1rem;
      background: rgba(255, 80, 0, 0.1);
      border-bottom: 1px solid rgba(255, 120, 0, 0.3);
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: move;
      user-select: none;
    }

    #feature-settings-panel .panel-header:active {
      cursor: grabbing;
    }

    #feature-settings-panel .panel-header .drag-hint {
      font-size: 0.6rem;
      opacity: 0.5;
      font-weight: normal;
      margin-left: 0.5rem;
    }

    #feature-settings-panel .panel-close {
      background: none;
      border: none;
      color: white;
      font-size: 1.5rem;
      cursor: pointer;
      line-height: 1;
      opacity: 0.7;
      transition: opacity 0.2s;
    }

    #feature-settings-panel .panel-close:hover {
      opacity: 1;
    }

    #feature-settings-panel .toggle-all-row {
      padding: 0.75rem 1rem;
      display: flex;
      gap: 0.5rem;
      border-bottom: 1px solid rgba(255, 120, 0, 0.2);
    }

    #feature-settings-panel .toggle-all-btn {
      flex: 1;
      padding: 0.5rem;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      transition: all 0.2s;
    }

    #feature-settings-panel .panel-content {
      padding: 1rem;
    }

    #feature-settings-panel .category-label {
      font-size: 0.75rem;
      font-weight: 600;
      color: rgba(255, 150, 0, 0.9);
      margin-bottom: 0.5rem;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    #feature-settings-panel .feature-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.6rem;
      margin-bottom: 0.4rem;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
    }

    #feature-settings-panel .feature-row:hover {
      background: rgba(255, 120, 0, 0.1);
      border-color: rgba(255, 120, 0, 0.3);
    }

    #feature-settings-panel .feature-info {
      display: flex;
      align-items: center;
      gap: 0.6rem;
    }

    #feature-settings-panel .feature-icon {
      font-size: 1.1rem;
    }

    #feature-settings-panel .feature-label {
      font-size: 0.85rem;
      font-weight: 500;
    }

    #feature-settings-panel .feature-desc {
      font-size: 0.7rem;
      opacity: 0.6;
    }

    #feature-settings-panel .toggle-track {
      width: 44px;
      height: 24px;
      border-radius: 12px;
      position: relative;
      transition: all 0.3s;
    }

    #feature-settings-panel .toggle-track.on {
      background: linear-gradient(135deg, #ff8800, #ff5500);
      box-shadow: 0 0 8px rgba(255, 100, 0, 0.5);
    }

    #feature-settings-panel .toggle-track.off {
      background: rgba(255, 255, 255, 0.15);
    }

    #feature-settings-panel .toggle-knob {
      width: 20px;
      height: 20px;
      background: white;
      border-radius: 50%;
      position: absolute;
      top: 2px;
      transition: left 0.3s;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    }

    #feature-settings-panel .toggle-track.on .toggle-knob {
      left: 22px;
    }

    #feature-settings-panel .toggle-track.off .toggle-knob {
      left: 2px;
    }

    #feature-settings-panel .panel-footer {
      padding: 0.75rem;
      border-top: 1px solid rgba(255, 120, 0, 0.2);
      font-size: 0.7rem;
      color: rgba(255, 255, 255, 0.5);
      text-align: center;
    }
  `;

  // ============ DRAG FUNCTIONALITY ============

  let isDragging = false;
  let dragOffset = { x: 0, y: 0 };

  function initPanelDrag(panelEl, headerEl) {
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

  function createPanel() {
    if (document.getElementById('feature-settings-panel')) return;

    const styleEl = document.createElement('style');
    styleEl.textContent = panelStyles;
    document.head.appendChild(styleEl);

    const panel = document.createElement('div');
    panel.id = 'feature-settings-panel';
    panel.innerHTML = `
      <div class="panel-header">
        <span style="font-weight: 600;">⚙️ Comm Planner Tools<span class="drag-hint">(drag to move)</span></span>
        <button class="panel-close">&times;</button>
      </div>
      <div class="toggle-all-row">
        <button class="toggle-all-btn" data-action="all-on">✓ All On</button>
        <button class="toggle-all-btn" data-action="all-off">✗ All Off</button>
      </div>
      <div class="panel-content"></div>
      <div class="panel-footer">💾 Settings auto-saved</div>
    `;

    document.body.appendChild(panel);

    // Initialize drag functionality
    initPanelDrag(panel, panel.querySelector('.panel-header'));

    // Event listeners
    panel.querySelector('.panel-close').addEventListener('click', hidePanel);
    panel.querySelector('[data-action="all-on"]').addEventListener('click', () => setAll(true));
    panel.querySelector('[data-action="all-off"]').addEventListener('click', () => setAll(false));

    renderPanelContent();
  }

  function renderPanelContent() {
    const content = document.querySelector('#feature-settings-panel .panel-content');
    if (!content) return;

    let html = '';

    for (const [catKey, catDef] of Object.entries(CATEGORIES)) {
      const features = Object.entries(FEATURES).filter(([k, v]) => v.category === catKey);
      if (features.length === 0) continue;

      html += `<div class="category-label">${catDef.icon} ${catDef.label}</div>`;

      for (const [key, def] of features) {
        const isOn = featureStates[key];
        html += `
          <div class="feature-row" data-feature="${key}">
            <div class="feature-info">
              <span class="feature-icon">${def.icon}</span>
              <div>
                <div class="feature-label">${def.label}</div>
                <div class="feature-desc">${def.description}</div>
              </div>
            </div>
            <div class="toggle-track ${isOn ? 'on' : 'off'}">
              <div class="toggle-knob"></div>
            </div>
          </div>
        `;
      }

      html += '<div style="height: 0.75rem;"></div>';
    }

    content.innerHTML = html;

    // Attach click handlers
    content.querySelectorAll('.feature-row').forEach(row => {
      row.addEventListener('click', () => toggle(row.dataset.feature));
    });

    updatePanelUI();
  }

  function updatePanelUI() {
    const panel = document.getElementById('feature-settings-panel');
    if (!panel) return;

    // Update toggle states
    for (const [key, enabled] of Object.entries(featureStates)) {
      const row = panel.querySelector(`.feature-row[data-feature="${key}"]`);
      if (!row) continue;

      const track = row.querySelector('.toggle-track');
      if (track) {
        track.classList.toggle('on', enabled);
        track.classList.toggle('off', !enabled);
      }
    }

    // Update all on/off buttons
    const allOn = Object.values(featureStates).every(v => v);
    const allOff = Object.values(featureStates).every(v => !v);

    const onBtn = panel.querySelector('[data-action="all-on"]');
    const offBtn = panel.querySelector('[data-action="all-off"]');

    if (onBtn) {
      onBtn.style.background = allOn ? 'rgba(255,120,0,0.3)' : 'rgba(255,255,255,0.05)';
      onBtn.style.border = `1px solid ${allOn ? 'rgba(255,150,0,0.6)' : 'rgba(255,255,255,0.2)'}`;
      onBtn.style.color = allOn ? '#ffcc00' : 'rgba(255,255,255,0.7)';
    }

    if (offBtn) {
      offBtn.style.background = allOff ? 'rgba(255,60,0,0.3)' : 'rgba(255,255,255,0.05)';
      offBtn.style.border = `1px solid ${allOff ? 'rgba(255,100,0,0.6)' : 'rgba(255,255,255,0.2)'}`;
      offBtn.style.color = allOff ? '#ff9966' : 'rgba(255,255,255,0.7)';
    }
  }

  function showPanel() {
    const panel = document.getElementById('feature-settings-panel');
    if (panel) {
      renderPanelContent();
      panel.style.display = 'block';
      panelVisible = true;
    }
  }

  function hidePanel() {
    const panel = document.getElementById('feature-settings-panel');
    if (panel) {
      panel.style.display = 'none';
      panelVisible = false;
    }
  }

  function togglePanel() {
    panelVisible ? hidePanel() : showPanel();
  }

  // ============ PUBLIC API ============

  window.RussellTV.Features = {
    isEnabled: (key) => featureStates[key] === true,
    getAllStates: () => ({ ...featureStates }),
    toggleFeature: toggle,
    setAllFeatures: setAll,
    showSettings: showPanel,
    hideSettings: hidePanel,
    toggleSettings: togglePanel,
    applyStates: applyAllStates
  };

  // ============ INITIALIZATION ============

  function init() {
    loadStates();
    createPanel();

    // Apply all states when infobar is ready
    Events.whenReady('infobar:ready', () => {
      console.log('[Features] infobar:ready received, applying all states');
      applyAllStates();
    });

    Events.emit('features:ready', null, { sticky: true });

    console.log('✅ [Features] Initialized');
  }

  Events.whenReady('core:ready', init);

})();
