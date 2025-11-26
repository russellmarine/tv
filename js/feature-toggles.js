/**
 * feature-toggles.js - Modular feature toggle system for RussellTV
 * - Persists settings to localStorage
 * - Provides settings UI panel
 * - Emits events when features toggle
 * - Integrates with info bar (gear icon)
 */

window.RussellTV = window.RussellTV || {};

window.RussellTV.Features = (function() {
  'use strict';

  const STORAGE_KEY = 'russelltv.featureToggles';  // Matches storage.js naming convention
  
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

  // Category definitions
  const CATEGORIES = {
    'space-comms': {
      label: 'Space Comms Suite',
      icon: '📡',
      description: 'Space weather and satellite communication tools'
    },
    'weather': {
      label: 'Weather Features',
      icon: '🌤️',
      description: 'Weather information and forecasts'
    }
  };

  let featureStates = {};
  let settingsPanelVisible = false;

  /**
   * Initialize the feature toggle system
   */
  function init() {
    loadSettings();
    createSettingsButton();
    createSettingsPanel();
    applyInitialStates();
    
    console.log('⚙️ Feature toggles initialized:', featureStates);
  }

  /**
   * Load settings from localStorage via Storage module (or use defaults)
   */
  function loadSettings() {
    try {
      const stored = window.RussellTV?.Storage?.loadFeatureToggles();
      if (stored) {
        // Merge with defaults (in case new features were added)
        featureStates = {};
        for (const [key, def] of Object.entries(FEATURE_DEFINITIONS)) {
          featureStates[key] = stored.hasOwnProperty(key) ? stored[key] : def.default;
        }
      } else {
        // Use defaults
        featureStates = {};
        for (const [key, def] of Object.entries(FEATURE_DEFINITIONS)) {
          featureStates[key] = def.default;
        }
      }
    } catch (error) {
      console.error('⚙️ Error loading feature settings:', error);
      // Fall back to defaults
      featureStates = {};
      for (const [key, def] of Object.entries(FEATURE_DEFINITIONS)) {
        featureStates[key] = def.default;
      }
    }
  }

  /**
   * Save settings via Storage module
   */
  function saveSettings() {
    try {
      if (window.RussellTV?.Storage?.saveFeatureToggles) {
        window.RussellTV.Storage.saveFeatureToggles(featureStates);
      } else {
        // Fallback if Storage module not available
        localStorage.setItem(STORAGE_KEY, JSON.stringify(featureStates));
      }
      console.log('⚙️ Feature settings saved');
    } catch (error) {
      console.error('⚙️ Error saving feature settings:', error);
    }
  }

  /**
   * Create the settings gear button in the info bar
   * Positioned AFTER the space-weather-indicators container, not inside it
   */
  function createSettingsButton() {
    const checkReady = setInterval(() => {
      const infoBar = document.getElementById('info-bar');
      if (infoBar) {
        clearInterval(checkReady);
        
        // Check if button already exists
        if (document.getElementById('feature-settings-btn')) return;
        
        const btn = document.createElement('button');
        btn.id = 'feature-settings-btn';
        btn.innerHTML = '⚙️';
        btn.title = 'Display Settings';
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
          transition: all 0.25s ease;
          z-index: 10002;
          line-height: 1;
        `;
        
        btn.addEventListener('mouseenter', () => {
          btn.style.background = 'linear-gradient(135deg, rgba(255,60,0,0.3), rgba(255,140,0,0.25))';
          btn.style.borderColor = 'rgba(255,120,0,0.8)';
          btn.style.boxShadow = '0 0 12px rgba(255,100,0,0.6)';
          btn.style.transform = 'scale(1.1)';
        });
        
        btn.addEventListener('mouseleave', () => {
          btn.style.background = 'rgba(0, 0, 0, 0.6)';
          btn.style.borderColor = 'rgba(255, 120, 0, 0.3)';
          btn.style.boxShadow = 'none';
          btn.style.transform = 'scale(1)';
        });
        
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          toggleSettingsPanel();
        });
        
        // Add directly to info bar (not inside space-weather-indicators)
        infoBar.appendChild(btn);
        
        // Adjust position when space-weather-indicators exists
        updateGearPosition();
      }
    }, 500);
  }
  
  /**
   * Update gear button position based on space-weather-indicators width
   */
  function updateGearPosition() {
    const btn = document.getElementById('feature-settings-btn');
    const indicators = document.getElementById('space-weather-indicators');
    
    if (!btn) return;
    
    if (indicators && indicators.style.display !== 'none') {
      // Position to the right of the indicators
      const indicatorsRect = indicators.getBoundingClientRect();
      const infoBar = document.getElementById('info-bar');
      const infoBarRect = infoBar.getBoundingClientRect();
      
      // Calculate right position
      const rightOffset = infoBarRect.right - indicatorsRect.right + 12;
      btn.style.right = Math.max(12, rightOffset - 40) + 'px';
    } else {
      // Default position when indicators hidden
      btn.style.right = '12px';
    }
  }

  /**
   * Create the settings panel
   */
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
      padding: 0;
      z-index: 10003;
      display: none;
      box-shadow: 
        0 8px 32px rgba(0, 0, 0, 0.9),
        0 0 30px rgba(255, 100, 0, 0.2),
        inset 0 1px 0 rgba(255, 150, 0, 0.1);
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      backdrop-filter: blur(12px);
    `;
    
    document.body.appendChild(panel);
    updateSettingsPanelContent();
    
    // NOTE: Settings panel only closes via the X button, not by clicking outside
    // This keeps the panel open until user explicitly closes it
  }

  /**
   * Update the settings panel content
   */
  function updateSettingsPanelContent() {
    const panel = document.getElementById('feature-settings-panel');
    if (!panel) return;
    
    // Check if all features are enabled
    const allEnabled = Object.values(featureStates).every(v => v);
    const allDisabled = Object.values(featureStates).every(v => !v);
    
    // Group features by category
    const categorizedFeatures = {};
    for (const [key, def] of Object.entries(FEATURE_DEFINITIONS)) {
      if (!categorizedFeatures[def.category]) {
        categorizedFeatures[def.category] = [];
      }
      categorizedFeatures[def.category].push({ key, ...def });
    }
    
    let html = `
      <div style="
        padding: 1rem 1.25rem;
        background: linear-gradient(135deg, rgba(255, 80, 0, 0.15) 0%, rgba(255, 120, 0, 0.05) 100%);
        border-bottom: 1px solid rgba(255, 120, 0, 0.3);
        border-radius: 14px 14px 0 0;
      ">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h3 style="margin: 0; font-size: 1.1rem; font-weight: 600; letter-spacing: 0.5px;">
            ⚙️ Display Settings
          </h3>
          <button id="close-settings-panel" style="
            background: none;
            border: none;
            color: rgba(255, 255, 255, 0.7);
            font-size: 1.5rem;
            cursor: pointer;
            padding: 0;
            width: 30px;
            height: 30px;
            line-height: 1;
            transition: color 0.2s;
          ">&times;</button>
        </div>
      </div>
      
      <!-- Master Toggle -->
      <div style="
        padding: 0.75rem 1.25rem;
        background: rgba(255, 255, 255, 0.03);
        border-bottom: 1px solid rgba(255, 120, 0, 0.2);
        display: flex;
        gap: 0.5rem;
      ">
        <button id="toggle-all-on" style="
          flex: 1;
          padding: 0.5rem;
          background: ${allEnabled ? 'rgba(255, 120, 0, 0.3)' : 'rgba(255, 255, 255, 0.05)'};
          border: 1px solid ${allEnabled ? 'rgba(255, 150, 0, 0.6)' : 'rgba(255, 255, 255, 0.2)'};
          border-radius: 8px;
          color: ${allEnabled ? '#ffcc00' : 'rgba(255, 255, 255, 0.7)'};
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        ">✓ All On</button>
        <button id="toggle-all-off" style="
          flex: 1;
          padding: 0.5rem;
          background: ${allDisabled ? 'rgba(255, 60, 0, 0.3)' : 'rgba(255, 255, 255, 0.05)'};
          border: 1px solid ${allDisabled ? 'rgba(255, 100, 0, 0.6)' : 'rgba(255, 255, 255, 0.2)'};
          border-radius: 8px;
          color: ${allDisabled ? '#ff9966' : 'rgba(255, 255, 255, 0.7)'};
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        ">✗ All Off</button>
      </div>
      
      <div style="padding: 1rem 1.25rem;">
    `;
    
    // Render each category
    for (const [catKey, catDef] of Object.entries(CATEGORIES)) {
      const features = categorizedFeatures[catKey] || [];
      if (features.length === 0) continue;
      
      html += `
        <div style="margin-bottom: 1.25rem;">
          <div style="
            font-size: 0.8rem;
            font-weight: 600;
            color: rgba(255, 150, 0, 0.9);
            margin-bottom: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 1px;
          ">
            ${catDef.icon} ${catDef.label}
          </div>
      `;
      
      for (const feature of features) {
        const isEnabled = featureStates[feature.key];
        html += `
          <div class="feature-toggle-row" data-feature="${feature.key}" style="
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0.75rem;
            margin-bottom: 0.5rem;
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 10px;
            cursor: pointer;
            transition: all 0.2s;
          ">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <span style="font-size: 1.2rem;">${feature.icon}</span>
              <div>
                <div style="font-size: 0.9rem; font-weight: 500;">${feature.label}</div>
                <div style="font-size: 0.75rem; opacity: 0.6; margin-top: 0.1rem;">${feature.description}</div>
              </div>
            </div>
            <div class="toggle-switch" style="
              width: 48px;
              height: 26px;
              background: ${isEnabled ? 'linear-gradient(135deg, #ff8800, #ff5500)' : 'rgba(255, 255, 255, 0.15)'};
              border-radius: 13px;
              position: relative;
              transition: all 0.3s ease;
              box-shadow: ${isEnabled ? '0 0 10px rgba(255, 100, 0, 0.5)' : 'inset 0 1px 3px rgba(0,0,0,0.3)'};
            ">
              <div class="toggle-knob" style="
                width: 22px;
                height: 22px;
                background: white;
                border-radius: 50%;
                position: absolute;
                top: 2px;
                left: ${isEnabled ? '24px' : '2px'};
                transition: all 0.3s ease;
                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
              "></div>
            </div>
          </div>
        `;
      }
      
      html += `</div>`;
    }
    
    html += `
      </div>
      
      <div style="
        padding: 0.75rem 1.25rem;
        border-top: 1px solid rgba(255, 120, 0, 0.2);
        font-size: 0.75rem;
        color: rgba(255, 255, 255, 0.5);
        text-align: center;
      ">
        💾 Settings auto-saved to browser
      </div>
    `;
    
    panel.innerHTML = html;
    
    // Attach event listeners
    document.getElementById('close-settings-panel')?.addEventListener('click', hideSettingsPanel);
    
    document.getElementById('toggle-all-on')?.addEventListener('click', () => {
      setAllFeatures(true);
    });
    
    document.getElementById('toggle-all-off')?.addEventListener('click', () => {
      setAllFeatures(false);
    });
    
    // Feature toggle rows
    panel.querySelectorAll('.feature-toggle-row').forEach(row => {
      row.addEventListener('click', () => {
        const featureKey = row.dataset.feature;
        toggleFeature(featureKey);
      });
      
      row.addEventListener('mouseenter', () => {
        row.style.background = 'rgba(255, 120, 0, 0.1)';
        row.style.borderColor = 'rgba(255, 120, 0, 0.3)';
      });
      
      row.addEventListener('mouseleave', () => {
        row.style.background = 'rgba(255, 255, 255, 0.03)';
        row.style.borderColor = 'rgba(255, 255, 255, 0.1)';
      });
    });
  }

  /**
   * Toggle a specific feature
   */
  function toggleFeature(featureKey) {
    if (!FEATURE_DEFINITIONS.hasOwnProperty(featureKey)) {
      console.warn(`⚙️ Unknown feature: ${featureKey}`);
      return;
    }
    
    const newState = !featureStates[featureKey];
    featureStates[featureKey] = newState;
    saveSettings();
    updateSettingsPanelContent();
    
    // Dispatch event for this specific feature
    window.dispatchEvent(new CustomEvent('feature:toggle', {
      detail: { feature: featureKey, enabled: newState }
    }));
    
    // Also dispatch a general event
    window.dispatchEvent(new CustomEvent('features:changed', {
      detail: { states: { ...featureStates } }
    }));
    
    console.log(`⚙️ Feature "${featureKey}" ${newState ? 'enabled' : 'disabled'}`);
    
    // Apply the change immediately
    applyFeatureState(featureKey, newState);
  }

  /**
   * Set all features on or off
   */
  function setAllFeatures(enabled) {
    for (const key of Object.keys(FEATURE_DEFINITIONS)) {
      featureStates[key] = enabled;
    }
    saveSettings();
    updateSettingsPanelContent();
    
    // Dispatch events
    for (const key of Object.keys(FEATURE_DEFINITIONS)) {
      window.dispatchEvent(new CustomEvent('feature:toggle', {
        detail: { feature: key, enabled }
      }));
    }
    
    window.dispatchEvent(new CustomEvent('features:changed', {
      detail: { states: { ...featureStates } }
    }));
    
    console.log(`⚙️ All features ${enabled ? 'enabled' : 'disabled'}`);
    
    // Apply all changes
    applyAllFeatureStates();
  }

  /**
   * Check if a feature is enabled
   */
  function isEnabled(featureKey) {
    return featureStates[featureKey] === true;
  }

  /**
   * Get all feature states
   */
  function getAllStates() {
    return { ...featureStates };
  }

  /**
   * Apply a single feature state (show/hide related elements)
   */
  function applyFeatureState(featureKey, enabled) {
    switch (featureKey) {
      case 'space-weather-indicators':
        // Hide/show the indicator pills (HF, GPS, SAT) individually
        const hfIndicator = document.getElementById('sw-indicator-hf');
        const gpsIndicator = document.getElementById('sw-indicator-gps');
        const satIndicator = document.getElementById('sw-indicator-satcom');
        
        if (hfIndicator) hfIndicator.style.display = enabled ? 'inline-flex' : 'none';
        if (gpsIndicator) gpsIndicator.style.display = enabled ? 'inline-flex' : 'none';
        if (satIndicator) satIndicator.style.display = enabled ? 'inline-flex' : 'none';
        
        // Also update the border/padding on container when empty
        const indicators = document.getElementById('space-weather-indicators');
        if (indicators) {
          if (enabled) {
            indicators.style.paddingLeft = '1rem';
            indicators.style.borderLeft = '1px solid rgba(255, 255, 255, 0.2)';
          } else {
            indicators.style.paddingLeft = '0';
            indicators.style.borderLeft = 'none';
          }
        }
        break;
        
      case 'propagation-panel':
        const propBtn = document.getElementById('propagation-panel-btn');
        if (propBtn) {
          propBtn.style.display = enabled ? 'inline-block' : 'none';
        }
        // Also hide the panel if open
        if (!enabled) {
          const panel = document.getElementById('propagation-panel');
          if (panel) panel.style.display = 'none';
        }
        break;
        
      case 'satellite-planner':
        const satBtn = document.getElementById('satellite-planner-btn');
        if (satBtn) {
          satBtn.style.display = enabled ? 'inline-block' : 'none';
        }
        // Also hide the panel if open
        if (!enabled) {
          const panel = document.getElementById('satellite-planner-panel');
          if (panel) panel.style.display = 'none';
        }
        break;
        
      case 'weather-tooltips':
        // Toggle weather tooltip visibility via CSS class
        document.body.classList.toggle('weather-tooltips-disabled', !enabled);
        break;
    }
  }

  /**
   * Apply all feature states on initial load
   */
  function applyAllFeatureStates() {
    for (const [key, enabled] of Object.entries(featureStates)) {
      applyFeatureState(key, enabled);
    }
  }

  /**
   * Apply initial states after a short delay (wait for other components to load)
   */
  function applyInitialStates() {
    // Apply immediately for anything already in DOM
    applyAllFeatureStates();
    
    // Also apply after a delay for components that load later
    setTimeout(applyAllFeatureStates, 1000);
    setTimeout(applyAllFeatureStates, 3000);
  }

  /**
   * Show the settings panel
   */
  function showSettingsPanel() {
    const panel = document.getElementById('feature-settings-panel');
    if (panel) {
      updateSettingsPanelContent();
      panel.style.display = 'block';
      settingsPanelVisible = true;
    }
  }

  /**
   * Hide the settings panel
   */
  function hideSettingsPanel() {
    const panel = document.getElementById('feature-settings-panel');
    if (panel) {
      panel.style.display = 'none';
      settingsPanelVisible = false;
    }
  }

  /**
   * Toggle the settings panel
   */
  function toggleSettingsPanel() {
    if (settingsPanelVisible) {
      hideSettingsPanel();
    } else {
      showSettingsPanel();
    }
  }

  /**
   * Register a new feature dynamically
   */
  function registerFeature(key, definition) {
    if (FEATURE_DEFINITIONS.hasOwnProperty(key)) {
      console.warn(`⚙️ Feature "${key}" already registered`);
      return;
    }
    
    FEATURE_DEFINITIONS[key] = definition;
    
    // Load state for new feature
    try {
      const stored = window.RussellTV?.Storage?.loadFeatureToggles();
      if (stored) {
        featureStates[key] = stored.hasOwnProperty(key) ? stored[key] : definition.default;
      } else {
        featureStates[key] = definition.default;
      }
    } catch (e) {
      featureStates[key] = definition.default;
    }
    
    console.log(`⚙️ Feature "${key}" registered`);
    
    // Update panel if visible
    if (settingsPanelVisible) {
      updateSettingsPanelContent();
    }
  }

  /**
   * Register a new category dynamically
   */
  function registerCategory(key, definition) {
    if (CATEGORIES.hasOwnProperty(key)) {
      console.warn(`⚙️ Category "${key}" already registered`);
      return;
    }
    
    CATEGORIES[key] = definition;
    console.log(`⚙️ Category "${key}" registered`);
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Public API
  return {
    isEnabled,
    getAllStates,
    toggleFeature,
    setAllFeatures,
    showSettings: showSettingsPanel,
    hideSettings: hideSettingsPanel,
    toggleSettings: toggleSettingsPanel,
    registerFeature,
    registerCategory,
    applyStates: applyAllFeatureStates
  };
})();
