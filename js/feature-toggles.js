/**
 * feature-toggles.js - Modular feature toggle system for RussellTV
 * SIMPLIFIED VERSION - instant toggles, gear always visible
 */

window.RussellTV = window.RussellTV || {};

window.RussellTV.Features = (function() {
  'use strict';

  // Feature definitions with defaults - ALL ON by default
  const FEATURE_DEFINITIONS = {
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
    'space-comms': { label: 'Space Comms Suite', icon: '📡' },
    'weather': { label: 'Weather Features', icon: '🌤️' }
  };

  let featureStates = {};
  let settingsPanelVisible = false;

  // ============ INITIALIZATION ============
  
  function init() {
    loadSettings();
    waitForInfoBar();
    createSettingsPanel();
    console.log('⚙️ Feature toggles initialized:', featureStates);
  }

  function waitForInfoBar() {
    // Check frequently and continuously
    setInterval(() => {
      const container = document.getElementById('space-weather-indicators');
      const infoBar = document.getElementById('info-bar');
      
      // Ensure gear button exists and is visible
      let btn = document.getElementById('feature-settings-btn');
      
      if (container) {
        // Preferred: put inside the container for correct spacing
        if (!btn) {
          btn = createGearButtonElement();
          container.appendChild(btn);
        } else if (!container.contains(btn)) {
          // Move it into container if it's elsewhere
          container.appendChild(btn);
        }
      } else if (infoBar) {
        // Fallback: put in info bar if container doesn't exist
        if (!btn) {
          btn = createGearButtonElement();
          btn.style.position = 'absolute';
          btn.style.right = '12px';
          btn.style.bottom = '6px';
          infoBar.appendChild(btn);
        }
      }
      
      // Always ensure it's visible
      if (btn) {
        btn.style.display = 'inline-block';
        btn.style.visibility = 'visible';
        btn.style.opacity = '1';
      }
      
      // Apply states
      applyAllStates();
    }, 500);
  }
  
  function createGearButtonElement() {
    const btn = document.createElement('button');
    btn.id = 'feature-settings-btn';
    btn.innerHTML = '⚙️';
    btn.title = 'Display Settings';
    btn.style.cssText = `
      background: rgba(0, 0, 0, 0.7);
      border: 1px solid rgba(255, 120, 0, 0.4);
      border-radius: 6px;
      padding: 0.2rem 0.5rem;
      font-size: 1rem;
      cursor: pointer;
      z-index: 10002;
      line-height: 1;
      pointer-events: auto;
      flex-shrink: 0;
    `;

    btn.onmouseenter = () => {
      btn.style.background = 'linear-gradient(135deg, rgba(255,60,0,0.3), rgba(255,140,0,0.25))';
      btn.style.borderColor = 'rgba(255,120,0,0.8)';
      btn.style.boxShadow = '0 0 12px rgba(255,100,0,0.6)';
    };

    btn.onmouseleave = () => {
      btn.style.background = 'rgba(0, 0, 0, 0.7)';
      btn.style.borderColor = 'rgba(255, 120, 0, 0.4)';
      btn.style.boxShadow = 'none';
    };

    btn.onclick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      console.log('⚙️ Gear button clicked');
      toggleSettingsPanel();
    };
    
    // Also use mousedown for more reliable clicking
    btn.onmousedown = (e) => {
      e.stopPropagation();
    };
    
    return btn;
  }

  function loadSettings() {
    try {
      const stored = window.RussellTV?.Storage?.loadFeatureToggles?.() || 
                     JSON.parse(localStorage.getItem('russelltv.featureToggles'));
      featureStates = {};
      for (const [key, def] of Object.entries(FEATURE_DEFINITIONS)) {
        featureStates[key] = stored?.[key] ?? def.default;
      }
    } catch (e) {
      // Use defaults
      for (const [key, def] of Object.entries(FEATURE_DEFINITIONS)) {
        featureStates[key] = def.default;
      }
    }
  }

  function saveSettings() {
    try {
      if (window.RussellTV?.Storage?.saveFeatureToggles) {
        window.RussellTV.Storage.saveFeatureToggles(featureStates);
      } else {
        localStorage.setItem('russelltv.featureToggles', JSON.stringify(featureStates));
      }
    } catch (e) {
      console.warn('⚙️ Could not save settings:', e);
    }
  }

  // ============ GEAR BUTTON (ALWAYS VISIBLE) ============

  function createGearButton(infoBar) {
    // Always recreate if missing
    let btn = document.getElementById('feature-settings-btn');
    
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'feature-settings-btn';
      btn.innerHTML = '⚙️';
      btn.title = 'Display Settings';
      infoBar.appendChild(btn);
    }
    
    // Always reset styles (in case something changed them)
    btn.style.cssText = `
      position: absolute;
      right: 12px;
      bottom: 6px;
      background: rgba(0, 0, 0, 0.6);
      border: 1px solid rgba(255, 120, 0, 0.3);
      border-radius: 6px;
      padding: 0.3rem 0.5rem;
      font-size: 1rem;
      cursor: pointer;
      z-index: 10002;
      line-height: 1;
      display: inline-block !important;
      visibility: visible !important;
      opacity: 1 !important;
    `;

    // Re-attach event handlers
    btn.onmouseenter = () => {
      btn.style.background = 'linear-gradient(135deg, rgba(255,60,0,0.3), rgba(255,140,0,0.25))';
      btn.style.borderColor = 'rgba(255,120,0,0.8)';
      btn.style.boxShadow = '0 0 12px rgba(255,100,0,0.6)';
    };

    btn.onmouseleave = () => {
      btn.style.background = 'rgba(0, 0, 0, 0.6)';
      btn.style.borderColor = 'rgba(255, 120, 0, 0.3)';
      btn.style.boxShadow = 'none';
    };

    btn.onclick = (e) => {
      e.stopPropagation();
      toggleSettingsPanel();
    };
  }

  // ============ SETTINGS PANEL ============

  function createSettingsPanel() {
    if (document.getElementById('feature-settings-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'feature-settings-panel';
    panel.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      width: 340px;
      max-height: 80vh;
      overflow-y: auto;
      background: linear-gradient(145deg, rgba(10, 5, 0, 0.98) 0%, rgba(25, 12, 0, 0.98) 100%);
      border: 2px solid rgba(255, 120, 0, 0.5);
      border-radius: 16px;
      z-index: 10003;
      display: none;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.9), 0 0 30px rgba(255, 100, 0, 0.2);
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    document.body.appendChild(panel);
    renderPanelContent();
  }

  function renderPanelContent() {
    const panel = document.getElementById('feature-settings-panel');
    if (!panel) return;

    const allOn = Object.values(featureStates).every(v => v);
    const allOff = Object.values(featureStates).every(v => !v);

    let html = `
      <div style="padding: 1rem; background: rgba(255, 80, 0, 0.1); border-bottom: 1px solid rgba(255, 120, 0, 0.3); display: flex; justify-content: space-between; align-items: center;">
        <span style="font-weight: 600;">⚙️ Display Settings</span>
        <button id="settings-close-btn" style="background: none; border: none; color: white; font-size: 1.5rem; cursor: pointer; line-height: 1;">&times;</button>
      </div>
      <div style="padding: 0.75rem 1rem; display: flex; gap: 0.5rem; border-bottom: 1px solid rgba(255,120,0,0.2);">
        <button id="toggle-all-on-btn" style="flex:1; padding: 0.5rem; background: ${allOn ? 'rgba(255,120,0,0.3)' : 'rgba(255,255,255,0.05)'}; border: 1px solid ${allOn ? 'rgba(255,150,0,0.6)' : 'rgba(255,255,255,0.2)'}; border-radius: 8px; color: ${allOn ? '#ffcc00' : 'rgba(255,255,255,0.7)'}; cursor: pointer; font-weight: 600;">✓ All On</button>
        <button id="toggle-all-off-btn" style="flex:1; padding: 0.5rem; background: ${allOff ? 'rgba(255,60,0,0.3)' : 'rgba(255,255,255,0.05)'}; border: 1px solid ${allOff ? 'rgba(255,100,0,0.6)' : 'rgba(255,255,255,0.2)'}; border-radius: 8px; color: ${allOff ? '#ff9966' : 'rgba(255,255,255,0.7)'}; cursor: pointer; font-weight: 600;">✗ All Off</button>
      </div>
      <div style="padding: 1rem;">
    `;

    // Group by category
    for (const [catKey, catDef] of Object.entries(CATEGORIES)) {
      const features = Object.entries(FEATURE_DEFINITIONS).filter(([k, v]) => v.category === catKey);
      if (features.length === 0) continue;

      html += `<div style="font-size: 0.75rem; font-weight: 600; color: rgba(255,150,0,0.9); margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 1px;">${catDef.icon} ${catDef.label}</div>`;

      for (const [key, def] of features) {
        const isOn = featureStates[key];
        html += `
          <div class="feature-row" data-key="${key}" style="display: flex; align-items: center; justify-content: space-between; padding: 0.6rem; margin-bottom: 0.4rem; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; cursor: pointer;">
            <div style="display: flex; align-items: center; gap: 0.6rem;">
              <span style="font-size: 1.1rem;">${def.icon}</span>
              <div>
                <div style="font-size: 0.85rem; font-weight: 500;">${def.label}</div>
                <div style="font-size: 0.7rem; opacity: 0.6;">${def.description}</div>
              </div>
            </div>
            <div class="toggle-track" style="width: 44px; height: 24px; background: ${isOn ? 'linear-gradient(135deg, #ff8800, #ff5500)' : 'rgba(255,255,255,0.15)'}; border-radius: 12px; position: relative; ${isOn ? 'box-shadow: 0 0 8px rgba(255,100,0,0.5);' : ''}">
              <div class="toggle-knob" style="width: 20px; height: 20px; background: white; border-radius: 50%; position: absolute; top: 2px; left: ${isOn ? '22px' : '2px'}; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>
            </div>
          </div>
        `;
      }
      html += `<div style="height: 0.75rem;"></div>`;
    }

    html += `
      </div>
      <div style="padding: 0.75rem; border-top: 1px solid rgba(255,120,0,0.2); font-size: 0.7rem; color: rgba(255,255,255,0.5); text-align: center;">💾 Settings auto-saved</div>
    `;

    panel.innerHTML = html;
    attachPanelListeners();
  }

  function attachPanelListeners() {
    document.getElementById('settings-close-btn')?.addEventListener('click', hideSettingsPanel);
    
    document.getElementById('toggle-all-on-btn')?.addEventListener('click', () => setAll(true));
    document.getElementById('toggle-all-off-btn')?.addEventListener('click', () => setAll(false));

    document.querySelectorAll('.feature-row').forEach(row => {
      row.addEventListener('click', () => {
        const key = row.dataset.key;
        toggle(key);
      });
    });
  }

  function showSettingsPanel() {
    const panel = document.getElementById('feature-settings-panel');
    if (panel) {
      renderPanelContent();
      panel.style.display = 'block';
      settingsPanelVisible = true;
    }
  }

  function hideSettingsPanel() {
    const panel = document.getElementById('feature-settings-panel');
    if (panel) {
      panel.style.display = 'none';
      settingsPanelVisible = false;
    }
  }

  function toggleSettingsPanel() {
    settingsPanelVisible ? hideSettingsPanel() : showSettingsPanel();
  }

  // ============ TOGGLE LOGIC (INSTANT) ============

  function toggle(key) {
    if (!FEATURE_DEFINITIONS[key]) return;
    
    featureStates[key] = !featureStates[key];
    applyState(key);  // INSTANT - apply first
    saveSettings();   // Then save
    updateToggleUI(key);  // Update just the toggle switch
    updateAllOnOffButtons();
    
    // Dispatch event for other components
    window.dispatchEvent(new CustomEvent('feature:toggle', {
      detail: { feature: key, enabled: featureStates[key] }
    }));
  }

  function setAll(enabled) {
    // Apply all states FIRST (instant visual feedback)
    for (const key of Object.keys(FEATURE_DEFINITIONS)) {
      featureStates[key] = enabled;
      applyState(key);
    }
    
    // Then save and update UI
    saveSettings();
    renderPanelContent();
    
    window.dispatchEvent(new CustomEvent('features:changed', {
      detail: { states: { ...featureStates } }
    }));
  }

  // Update just one toggle switch without re-rendering everything
  function updateToggleUI(key) {
    const row = document.querySelector(`.feature-row[data-key="${key}"]`);
    if (!row) return;
    
    const isOn = featureStates[key];
    const track = row.querySelector('.toggle-track');
    const knob = row.querySelector('.toggle-knob');
    
    if (track) {
      track.style.background = isOn ? 'linear-gradient(135deg, #ff8800, #ff5500)' : 'rgba(255,255,255,0.15)';
      track.style.boxShadow = isOn ? '0 0 8px rgba(255,100,0,0.5)' : 'none';
    }
    if (knob) {
      knob.style.left = isOn ? '22px' : '2px';
    }
  }

  function updateAllOnOffButtons() {
    const allOn = Object.values(featureStates).every(v => v);
    const allOff = Object.values(featureStates).every(v => !v);
    
    const onBtn = document.getElementById('toggle-all-on-btn');
    const offBtn = document.getElementById('toggle-all-off-btn');
    
    if (onBtn) {
      onBtn.style.background = allOn ? 'rgba(255,120,0,0.3)' : 'rgba(255,255,255,0.05)';
      onBtn.style.borderColor = allOn ? 'rgba(255,150,0,0.6)' : 'rgba(255,255,255,0.2)';
      onBtn.style.color = allOn ? '#ffcc00' : 'rgba(255,255,255,0.7)';
    }
    if (offBtn) {
      offBtn.style.background = allOff ? 'rgba(255,60,0,0.3)' : 'rgba(255,255,255,0.05)';
      offBtn.style.borderColor = allOff ? 'rgba(255,100,0,0.6)' : 'rgba(255,255,255,0.2)';
      offBtn.style.color = allOff ? '#ff9966' : 'rgba(255,255,255,0.7)';
    }
  }

  // ============ APPLY STATES TO DOM (INSTANT) ============

  function applyState(key) {
    const enabled = featureStates[key];
    
    switch (key) {
      case 'space-weather-indicators':
        const hf = document.getElementById('sw-indicator-hf');
        const gps = document.getElementById('sw-indicator-gps');
        const sat = document.getElementById('sw-indicator-satcom');
        if (hf) hf.style.display = enabled ? 'inline-flex' : 'none';
        if (gps) gps.style.display = enabled ? 'inline-flex' : 'none';
        if (sat) sat.style.display = enabled ? 'inline-flex' : 'none';
        break;

      case 'propagation-panel':
        const propBtn = document.getElementById('propagation-panel-btn');
        if (propBtn) propBtn.style.display = enabled ? 'inline-block' : 'none';
        if (!enabled) {
          const panel = document.getElementById('propagation-panel');
          if (panel) panel.style.display = 'none';
        }
        break;

      case 'satellite-planner':
        const satBtn = document.getElementById('satellite-planner-btn');
        if (satBtn) satBtn.style.display = enabled ? 'inline-block' : 'none';
        if (!enabled) {
          const panel = document.getElementById('satellite-planner-panel');
          if (panel) panel.style.display = 'none';
        }
        break;

      case 'weather-tooltips':
        document.body.classList.toggle('weather-tooltips-disabled', !enabled);
        break;
    }
  }

  function applyAllStates() {
    for (const key of Object.keys(featureStates)) {
      applyState(key);
    }
  }

  // ============ PUBLIC API ============

  function isEnabled(key) {
    return featureStates[key] === true;
  }

  function getAllStates() {
    return { ...featureStates };
  }

  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return {
    isEnabled,
    getAllStates,
    toggleFeature: toggle,
    setAllFeatures: setAll,
    showSettings: showSettingsPanel,
    hideSettings: hideSettingsPanel,
    toggleSettings: toggleSettingsPanel,
    applyStates: applyAllStates
  };
})();
