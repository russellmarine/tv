/**
 * space-weather-infobar.js - Space weather indicators for info bar
 * FIXED VERSION - addresses tooltip and click issues
 */

(function() {
  'use strict';

  console.log('🛰️ Space weather info bar loading...');

  let hideTooltipTimer = null;
  let currentTooltipBand = null;
  let tooltipLocked = false;
  let isCreatingTooltip = false; // NEW: prevents race conditions

  function init() {
    const checkReady = setInterval(() => {
      const infoBar = document.getElementById('info-bar');
      const hasConfig = window.SPACE_WEATHER_CONFIG;
      const hasData = window.RussellTV?.SpaceWeather;
      const hasFeatures = window.RussellTV?.Features;

      if (infoBar && hasConfig && hasData) {
        clearInterval(checkReady);
        addIndicators();
        startMaintenance();
        
        // Listen for feature toggle events
        window.addEventListener('feature:toggle', (e) => {
          const { feature, enabled } = e.detail;
          if (feature === 'space-weather-indicators') {
            const container = document.getElementById('space-weather-indicators');
            if (container) {
              container.style.display = enabled ? 'inline-flex' : 'none';
            }
          }
          if (feature === 'propagation-panel') {
            const btn = document.getElementById('propagation-panel-btn');
            if (btn) {
              btn.style.display = enabled ? 'inline-block' : 'none';
            }
            if (!enabled) {
              const panel = document.getElementById('propagation-panel');
              if (panel) panel.style.display = 'none';
            }
          }
        });
        
        // Apply initial state from feature toggles if available
        if (hasFeatures) {
          const indicatorsEnabled = hasFeatures.isEnabled('space-weather-indicators');
          const propPanelEnabled = hasFeatures.isEnabled('propagation-panel');
          
          setTimeout(() => {
            const container = document.getElementById('space-weather-indicators');
            if (container && !indicatorsEnabled) {
              container.style.display = 'none';
            }
            
            const btn = document.getElementById('propagation-panel-btn');
            if (btn && !propPanelEnabled) {
              btn.style.display = 'none';
            }
          }, 100);
        }
      }
    }, 500);
  }

  function addIndicators() {
    const infoBar = document.getElementById('info-bar');
    if (!infoBar) return;

    // Ensure the bar has enough right padding so we don't overlap the pills
    const cs = window.getComputedStyle(infoBar);
    const pr = parseInt(cs.paddingRight, 10) || 0;
    if (pr < 120) {
      infoBar.style.paddingRight = '120px';
    }

    // Avoid duplicates
    if (document.getElementById('space-weather-indicators')) {
      return;
    }

    const container = document.createElement('span');
    container.id = 'space-weather-indicators';
    container.style.cssText = `
      position: absolute;
      right: 50px;
      bottom: 6px;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding-left: 1rem;
      border-left: 1px solid rgba(255, 255, 255, 0.2);
      pointer-events: auto;
    `;

    ['hf', 'gps', 'satcom'].forEach(bandKey => {
      container.appendChild(createIndicator(bandKey));
    });

    container.appendChild(createPropButton());

    infoBar.appendChild(container);

    attachListeners();
    updateColors();
    setInterval(updateColors, 60000);
  }

  function createIndicator(bandKey) {
    const span = document.createElement('span');
    span.id = `sw-indicator-${bandKey}`;
    span.className = 'sw-indicator';
    span.dataset.band = bandKey;
    span.style.cssText = `
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      cursor: pointer;
      padding: 0.35rem 0.7rem;
      border-radius: 14px;
      transition: all 0.2s ease;
      background: rgba(0, 0, 0, 0.5);
      border: 1px solid rgba(255, 120, 0, 0.3);
      pointer-events: auto;
    `;

    const label = document.createElement('span');
    label.style.cssText = `
      font-size: 0.75rem;
      font-weight: bold;
      letter-spacing: 0.5px;
      color: rgba(180, 180, 180, 0.9);
    `;

    if (bandKey === 'hf') label.textContent = 'HF';
    else if (bandKey === 'gps') label.textContent = 'GPS';
    else if (bandKey === 'satcom') label.textContent = 'SAT';

    const dot = document.createElement('span');
    dot.className = 'sw-status-dot';
    dot.style.cssText = `
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #888;
      display: inline-block;
    `;

    span.appendChild(label);
    span.appendChild(dot);

    return span;
  }

  function createPropButton() {
    const btn = document.createElement('button');
    btn.id = 'propagation-panel-btn';
    btn.innerHTML = '⚡';
    btn.title = 'Click for detailed propagation forecast';
    btn.style.cssText = `
      background: rgba(0, 0, 0, 0.7);
      border: 1px solid rgba(255, 120, 0, 0.4);
      border-radius: 6px;
      padding: 0.2rem 0.5rem;
      font-size: 1rem;
      cursor: pointer;
      transition: all 0.25s ease;
      margin-left: 0.5rem;
      filter: hue-rotate(20deg) saturate(1.5);
    `;
    return btn;
  }

  // FIX: Improved hide scheduling with better state checks
  function scheduleTooltipHide() {
    if (tooltipLocked) return; // Don't schedule hide if locked
    
    if (hideTooltipTimer) clearTimeout(hideTooltipTimer);
    
    hideTooltipTimer = setTimeout(() => {
      if (tooltipLocked || isCreatingTooltip) return;
      
      // FIX: Use document.elementFromPoint with current mouse position
      // to check what's actually under the cursor right now
      const tooltip = document.getElementById('space-weather-tooltip');
      const hoveredIndicator = document.querySelector('.sw-indicator:hover');
      
      // Check if mouse is over tooltip or any indicator
      if (tooltip && tooltip.matches(':hover')) return;
      if (hoveredIndicator) return;
      
      // FIX: Also check if mouse is in the "bridge zone" between indicator and tooltip
      if (tooltip && isMouseNearTooltipOrIndicator()) return;
      
      hideTooltip();
    }, 400); // Slightly longer delay to allow mouse travel
  }
  
  // FIX: Track mouse position globally for better hover detection
  let lastMouseX = 0;
  let lastMouseY = 0;
  
  document.addEventListener('mousemove', (e) => {
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
  }, { passive: true });
  
  // FIX: Check if mouse is near the tooltip or any indicator (within a tolerance zone)
  function isMouseNearTooltipOrIndicator() {
    const tooltip = document.getElementById('space-weather-tooltip');
    const tolerance = 25; // pixels of tolerance
    
    // Check tooltip
    if (tooltip) {
      const rect = tooltip.getBoundingClientRect();
      if (lastMouseX >= rect.left - tolerance && 
          lastMouseX <= rect.right + tolerance &&
          lastMouseY >= rect.top - tolerance && 
          lastMouseY <= rect.bottom + tolerance) {
        return true;
      }
    }
    
    // Check all indicators
    const indicators = document.querySelectorAll('.sw-indicator');
    for (const ind of indicators) {
      const rect = ind.getBoundingClientRect();
      if (lastMouseX >= rect.left - tolerance && 
          lastMouseX <= rect.right + tolerance &&
          lastMouseY >= rect.top - tolerance && 
          lastMouseY <= rect.bottom + tolerance) {
        return true;
      }
    }
    
    return false;
  }

  // FIX: Cancel any pending hide when we know we want to show
  function cancelScheduledHide() {
    if (hideTooltipTimer) {
      clearTimeout(hideTooltipTimer);
      hideTooltipTimer = null;
    }
  }

  function attachListeners() {
    ['hf', 'gps', 'satcom'].forEach(bandKey => {
      const indicator = document.getElementById(`sw-indicator-${bandKey}`);
      if (!indicator || indicator._hasListeners) return;
      indicator._hasListeners = true;

      indicator.addEventListener('mouseenter', function() {
        this.style.background = 'rgba(255, 120, 0, 0.15)';
        this.style.borderColor = 'rgba(255, 120, 0, 0.5)';
        
        if (!tooltipLocked) {
          cancelScheduledHide(); // FIX: Cancel any pending hide
          showTooltip(this, bandKey, false);
          currentTooltipBand = bandKey;
        }
      });

      indicator.addEventListener('mouseleave', function(e) {
        // FIX: Check if we're moving to the tooltip
        const relatedTarget = e.relatedTarget;
        const tooltip = document.getElementById('space-weather-tooltip');
        
        if (!tooltipLocked || currentTooltipBand !== bandKey) {
          this.style.background = 'rgba(0, 0, 0, 0.5)';
          this.style.borderColor = 'rgba(255, 120, 0, 0.3)';
        }
        
        // FIX: Don't schedule hide if moving to tooltip
        if (tooltip && (tooltip === relatedTarget || tooltip.contains(relatedTarget))) {
          return;
        }
        
        if (!tooltipLocked) {
          scheduleTooltipHide();
        }
      });

      indicator.addEventListener('click', function(e) {
        e.stopPropagation();
        
        if (tooltipLocked && currentTooltipBand === bandKey) {
          // Unlock and hide
          tooltipLocked = false;
          hideTooltip();
          this.style.background = 'rgba(0, 0, 0, 0.5)';
          this.style.borderColor = 'rgba(255, 120, 0, 0.3)';
          this.style.boxShadow = 'none';
          currentTooltipBand = null;
        } else {
          // Lock to this indicator
          resetAllIndicatorStyles();
          
          this.style.background =
            'linear-gradient(135deg, rgba(255, 80, 0, 0.3), rgba(255, 150, 0, 0.2))';
          this.style.borderColor = 'rgba(255, 150, 0, 0.8)';
          this.style.boxShadow = '0 0 10px rgba(255, 120, 0, 0.4)';
          
          tooltipLocked = true;
          currentTooltipBand = bandKey;
          showTooltip(this, bandKey, true);
        }
      });
    });

    const btn = document.getElementById('propagation-panel-btn');
    if (btn && !btn._hasListeners) {
      btn._hasListeners = true;
      btn.style.position = 'relative';
      btn.style.zIndex = '10002';

      // FIX: Use mousedown instead of click for more immediate response
      // This helps with the "two click" issue when window isn't focused
      btn.addEventListener('mousedown', function(e) {
        // Only respond to left click
        if (e.button !== 0) return;
        
        e.stopPropagation();
        e.preventDefault();

        // Clean up tooltip state
        tooltipLocked = false;
        currentTooltipBand = null;
        hideTooltip();

        const panel = document.getElementById('propagation-panel');
        if (!panel) {
          console.error('❌ propagation-panel element not found');
          return;
        }

        const currentDisplay = window.getComputedStyle(panel).display;
        if (currentDisplay === 'none') {
          panel.style.display = 'block';
          panel.style.zIndex = '10000';
        } else {
          panel.style.display = 'none';
        }
      });

      // FIX: Also add click handler to prevent any default behavior
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        e.preventDefault();
      });

      btn.addEventListener('mouseenter', function() {
        this.style.background =
          'linear-gradient(135deg, rgba(255,60,0,0.3), rgba(255,140,0,0.25))';
        this.style.borderColor = 'rgba(255,120,0,0.8)';
        this.style.boxShadow =
          '0 0 12px rgba(255,100,0,0.8), 0 0 20px rgba(255,140,0,0.4)';
        this.style.transform = 'translateY(-2px) scale(1.05)';
        this.style.filter = 'hue-rotate(0deg) saturate(2) brightness(1.2)';
      });

      btn.addEventListener('mouseleave', function() {
        this.style.background = 'rgba(0, 0, 0, 0.7)';
        this.style.borderColor = 'rgba(255, 120, 0, 0.4)';
        this.style.boxShadow = 'none';
        this.style.transform = 'translateY(0) scale(1)';
        this.style.filter = 'hue-rotate(20deg) saturate(1.5)';
      });
    }
  }

  // FIX: Helper function to reset all indicator styles
  function resetAllIndicatorStyles() {
    ['hf', 'gps', 'satcom'].forEach(key => {
      const ind = document.getElementById(`sw-indicator-${key}`);
      if (ind) {
        ind.style.background = 'rgba(0, 0, 0, 0.5)';
        ind.style.borderColor = 'rgba(255, 120, 0, 0.3)';
        ind.style.boxShadow = 'none';
      }
    });
  }

  function startMaintenance() {
    setInterval(() => {
      const infoBar = document.getElementById('info-bar');
      if (!infoBar) return;
      let container = document.getElementById('space-weather-indicators');
      if (!container) {
        addIndicators();
      } else {
        attachListeners();
      }
    }, 6000);
  }

  function updateColors() {
    const data = window.RussellTV?.SpaceWeather?.getCurrentData();
    if (!data) return;

    ['hf', 'gps', 'satcom'].forEach(bandKey => {
      const indicator = document.getElementById(`sw-indicator-${bandKey}`);
      if (!indicator) return;
      const dot = indicator.querySelector('.sw-status-dot');
      const status = data.status[bandKey];
      const statusInfo = window.SPACE_WEATHER_CONFIG.statusLevels[status];
      if (dot && statusInfo) {
        dot.style.background = statusInfo.color;
        dot.style.boxShadow =
          status === 'red' || status === 'orange'
            ? `0 0 8px ${statusInfo.color}`
            : 'none';
      }
    });
  }

  function showTooltip(indicator, bandKey, locked) {
    // FIX: Prevent race conditions with flag
    if (isCreatingTooltip) return;
    isCreatingTooltip = true;
    
    const data = window.RussellTV?.SpaceWeather?.getCurrentData();
    if (!data) {
      isCreatingTooltip = false;
      return;
    }

    // FIX: Remove existing tooltip first, but only if it exists
    const existingTooltip = document.getElementById('space-weather-tooltip');
    if (existingTooltip) {
      existingTooltip.remove();
    }
    
    // FIX: Also remove existing bridge
    const existingBridge = document.getElementById('space-weather-tooltip-bridge');
    if (existingBridge) {
      existingBridge.remove();
    }
    
    const detailed = window.RussellTV.SpaceWeather.getDetailedStatus(bandKey);
    if (!detailed) {
      isCreatingTooltip = false;
      return;
    }

    const tooltip = document.createElement('div');
    tooltip.id = 'space-weather-tooltip';
    tooltip.style.cssText = `
      position: fixed;
      background: linear-gradient(135deg, rgba(0, 0, 0, 0.98) 0%, rgba(20, 10, 0, 0.98) 100%);
      color: white;
      padding: 1rem 1.25rem;
      border-radius: 16px;
      font-size: 0.85rem;
      z-index: 10001;
      pointer-events: auto;
      border: 2px solid rgba(255, 120, 0, 0.6);
      box-shadow:
        0 8px 24px rgba(0, 0, 0, 0.8),
        0 0 20px rgba(255, 120, 0, 0.3),
        inset 0 1px 0 rgba(255, 150, 0, 0.2);
      min-width: 300px;
      max-width: 380px;
      backdrop-filter: blur(10px);
    `;

    const rect = indicator.getBoundingClientRect();
    tooltip.style.left = `${rect.left + rect.width / 2}px`;
    tooltip.style.bottom = `${window.innerHeight - rect.top + 8}px`;
    tooltip.style.transform = 'translateX(-50%)';

    tooltip.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.5rem; padding-bottom: 0.75rem; border-bottom: 1px solid rgba(255, 120, 0, 0.3);">
        <span style="font-size: 1.3rem;">${detailed.icon}</span>
        <span style="font-size: 1rem;">${detailed.band}</span>
        <span style="margin-left: auto; font-size: 1.1rem;">${detailed.statusIcon}</span>
      </div>
      <div style="margin-bottom: 0.75rem;">
        <strong>Status:</strong> <span style="color: ${detailed.color}; font-weight: bold;">${detailed.status}</span>
      </div>
      <div style="margin-bottom: 0.75rem; font-size: 0.85rem; opacity: 0.95; line-height: 1.4;">
        ${detailed.description}
      </div>
      <div style="margin-bottom: 0.5rem; font-size: 0.85rem;">
        <strong style="color: rgba(255, 150, 0, 0.9);">Frequencies:</strong> ${detailed.frequencies}
      </div>
      <div style="font-size: 0.85rem; opacity: 0.9; margin-bottom: 0.75rem; line-height: 1.4;">
        <strong style="color: rgba(255, 150, 0, 0.9);">Uses:</strong> ${detailed.uses}
      </div>
      ${bandKey === 'hf' ? `
      <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid rgba(255, 120, 0, 0.3);">
        <a href="https://weatherspotter.net/propagation.php" target="_blank"
           style="color: #ffbb00; text-decoration: none; font-size: 0.85rem; display: block; margin-bottom: 0.5rem; padding: 0.4rem 0.75rem; background: rgba(255, 120, 0, 0.15); border-radius: 8px; border: 1px solid rgba(255, 120, 0, 0.3);">
          📊 View HF Propagation Maps →
        </a>
        <a href="https://www.voacap.com/prediction.html" target="_blank"
           style="color: #ffbb00; text-decoration: none; font-size: 0.85rem; display: block; padding: 0.4rem 0.75rem; background: rgba(255, 120, 0, 0.15); border-radius: 8px; border: 1px solid rgba(255, 120, 0, 0.3);">
          📡 VOACAP Path Analysis →
        </a>
      </div>
      ` : ''}
      <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid rgba(255, 120, 0, 0.3); font-size: 0.75rem; opacity: 0.8;">
        <strong>Current Conditions:</strong><br>
        Radio: R${data.scales.R} | Solar: S${data.scales.S} | Geo: G${data.scales.G}<br>
        Kp Index: ${data.kpIndex.toFixed(1)}<br>
        Updated: ${formatTime(data.timestamp)}
      </div>
      <div style="text-align: center; margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid rgba(255, 120, 0, 0.3); font-size: 0.7rem; opacity: 0.6;">
        ${locked ? '🔒 Locked - Click indicator to unlock' : '💡 Click to lock tooltip'}
      </div>
    `;

    document.body.appendChild(tooltip);
    
    // FIX: Add invisible bridge element to connect indicator and tooltip
    // This prevents the "gap" problem when moving mouse between them
    const bridge = document.createElement('div');
    bridge.id = 'space-weather-tooltip-bridge';
    bridge.style.cssText = `
      position: fixed;
      left: ${rect.left}px;
      width: ${rect.width}px;
      bottom: ${window.innerHeight - rect.top}px;
      height: 12px;
      background: transparent;
      z-index: 10000;
      pointer-events: auto;
    `;
    bridge.addEventListener('mouseenter', () => {
      cancelScheduledHide();
    });
    bridge.addEventListener('mouseleave', (e) => {
      const relatedTarget = e.relatedTarget;
      const tooltip = document.getElementById('space-weather-tooltip');
      const isMovingToTooltip = tooltip && (tooltip === relatedTarget || tooltip.contains(relatedTarget));
      const isMovingToIndicator = relatedTarget && relatedTarget.closest('.sw-indicator');
      
      if (!tooltipLocked && !isMovingToTooltip && !isMovingToIndicator) {
        scheduleTooltipHide();
      }
    });
    document.body.appendChild(bridge);

    // FIX: Always attach hover listeners for better UX
    tooltip.addEventListener('mouseenter', () => {
      cancelScheduledHide();
    });
    
    tooltip.addEventListener('mouseleave', (e) => {
      // FIX: Check if moving back to an indicator
      const relatedTarget = e.relatedTarget;
      const isMovingToIndicator = relatedTarget && relatedTarget.closest('.sw-indicator');
      
      if (!tooltipLocked && !isMovingToIndicator) {
        scheduleTooltipHide();
      }
    });

    // FIX: Reset flag after creation complete
    isCreatingTooltip = false;
  }

  function hideTooltip() {
    cancelScheduledHide();
    
    const tooltip = document.getElementById('space-weather-tooltip');
    if (tooltip) {
      tooltip.remove();
    }
    
    // FIX: Also remove the bridge element
    const bridge = document.getElementById('space-weather-tooltip-bridge');
    if (bridge) {
      bridge.remove();
    }

    if (!tooltipLocked) {
      resetAllIndicatorStyles();
      currentTooltipBand = null;
    }
  }

  function formatTime(date) {
    const now = new Date();
    const diff = Math.floor((now - date) / 60000);
    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff}m ago`;
    const hours = Math.floor(diff / 60);
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleString();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // FIX: Improved global click handler
  document.addEventListener('click', (e) => {
    const tooltip = document.getElementById('space-weather-tooltip');
    const clickedIndicator = e.target.closest('.sw-indicator');
    const clickedTooltip = e.target.closest('#space-weather-tooltip');
    const clickedPropBtn = e.target.closest('#propagation-panel-btn');
    
    if (tooltip && !clickedIndicator && !clickedTooltip && !clickedPropBtn) {
      hideTooltip();
      tooltipLocked = false;
      currentTooltipBand = null;
      resetAllIndicatorStyles();
    }
  });

  console.log('✅ Space weather info bar loaded');
})();
