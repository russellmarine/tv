/**
 * space-weather-infobar.js - Space weather indicators for info bar
 */

(function() {
  'use strict';

  console.log('🛰️ Space weather info bar loading...');

  let hideTooltipTimer = null;
  let currentTooltipBand = null;
  let tooltipLocked = false;

  function init() {
    // Wait for both info-bar and space weather data to be ready
    const checkReady = setInterval(() => {
      const infoBar = document.getElementById('info-bar');
      const hasConfig = window.SPACE_WEATHER_CONFIG;
      const hasData = window.RussellTV?.SpaceWeather;

      if (infoBar && hasConfig && hasData) {
        clearInterval(checkReady);
        addIndicators();
        startMaintenance();
      }
    }, 500);
  }

  function addIndicators() {
    const infoBar = document.getElementById('info-bar');
    if (!infoBar) return;

    // Make sure we have a little reserved space on the right
    const cs = window.getComputedStyle(infoBar);
    const pr = parseInt(cs.paddingRight, 10) || 0;
    if (pr < 120) {
      infoBar.style.paddingRight = '120px';
    }

    // If already present, don't duplicate
    if (document.getElementById('space-weather-indicators')) {
      console.log('✅ Space weather indicators already exist');
      return;
    }

    const container = document.createElement('span');
    container.id = 'space-weather-indicators';
    container.style.cssText = `
      position: absolute;
      right: 12px;
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

    console.log('✅ Space weather indicators added to info bar');

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

    const icon = document.createElement('span');
    icon.style.cssText = `
      font-size: 0.75rem;
      font-weight: bold;
      letter-spacing: 0.5px;
      color: rgba(180, 180, 180, 0.9);
    `;
    
    if (bandKey === 'hf') icon.textContent = 'HF';
    else if (bandKey === 'gps') icon.textContent = 'GPS';
    else if (bandKey === 'satcom') icon.textContent = 'SAT';

    const dot = document.createElement('span');
    dot.className = 'sw-status-dot';
    dot.style.cssText = `
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #888;
      display: inline-block;
    `;

    span.appendChild(icon);
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

  // Hide tooltip only if not hovering any pill or the tooltip
  function scheduleTooltipHide() {
    if (hideTooltipTimer) clearTimeout(hideTooltipTimer);
    hideTooltipTimer = setTimeout(() => {
      if (tooltipLocked) return;

      const tooltip = document.getElementById('space-weather-tooltip');
      const hoveredIndicator = document.querySelector('.sw-indicator:hover');

      if (tooltip && tooltip.matches(':hover')) return;
      if (hoveredIndicator) return;

      hideTooltip();
    }, 400);
  }

  function attachListeners() {
    ['hf', 'gps', 'satcom'].forEach(bandKey => {
      const indicator = document.getElementById(`sw-indicator-${bandKey}`);
      if (!indicator || indicator._hasListeners) return;
      
      indicator._hasListeners = true;

      indicator.onmouseenter = function() {
        this.style.background = 'rgba(255, 120, 0, 0.15)';
        this.style.borderColor = 'rgba(255, 120, 0, 0.5)';
        
        if (!tooltipLocked) {
          if (hideTooltipTimer) clearTimeout(hideTooltipTimer);
          showTooltip(this, bandKey, false);
          currentTooltipBand = bandKey;
        }
      };

      indicator.onmouseleave = function() {
        if (!tooltipLocked || currentTooltipBand !== bandKey) {
          this.style.background = 'rgba(0, 0, 0, 0.5)';
          this.style.borderColor = 'rgba(255, 120, 0, 0.3)';
        }

        if (!tooltipLocked) {
          scheduleTooltipHide();
        }
      };

      indicator.onclick = function(e) {
        e.stopPropagation();
        
        if (tooltipLocked && currentTooltipBand === bandKey) {
          tooltipLocked = false;
          hideTooltip();
          this.style.background = 'rgba(0, 0, 0, 0.5)';
          this.style.borderColor = 'rgba(255, 120, 0, 0.3)';
          this.style.boxShadow = 'none';
          currentTooltipBand = null;
        } else {
          ['hf', 'gps', 'satcom'].forEach(key => {
            const ind = document.getElementById(`sw-indicator-${key}`);
            if (ind) {
              ind.style.background = 'rgba(0, 0, 0, 0.5)';
              ind.style.borderColor = 'rgba(255, 120, 0, 0.3)';
              ind.style.boxShadow = 'none';
            }
          });
          
          this.style.background = 'linear-gradient(135deg, rgba(255, 80, 0, 0.3), rgba(255, 150, 0, 0.2))';
          this.style.borderColor = 'rgba(255, 150, 0, 0.8)';
          this.style.boxShadow = '0 0 10px rgba(255, 120, 0, 0.4)';
          
          tooltipLocked = true;
          showTooltip(this, bandKey, true);
          currentTooltipBand = bandKey;
        }
      };
    });

    const btn = document.getElementById('propagation-panel-btn');
    if (btn) {
      btn.style.position = 'relative';
      btn.style.zIndex = '10002';
      
      if (!btn.onclick) {
        console.log('⚡ Attaching propagation button listener');

        btn.onclick = function(e) {
          e.stopPropagation();
          e.preventDefault();
          
          console.log('⚡ Propagation button clicked');

          tooltipLocked = false;
          currentTooltipBand = null;
          hideTooltip();

          if (window.RussellTV?.PropagationPanel) {
            window.RussellTV.PropagationPanel.toggle();
          } else {
            console.error('❌ PropagationPanel module not available');
          }
        };

        btn.onmouseenter = function() {
          this.style.background = 'linear-gradient(135deg, rgba(255,60,0,0.3), rgba(255,140,0,0.25))';
          this.style.borderColor = 'rgba(255,120,0,0.8)';
          this.style.boxShadow = '0 0 12px rgba(255,100,0,0.8), 0 0 20px rgba(255,140,0,0.4)';
          this.style.transform = 'translateY(-2px) scale(1.05)';
          this.style.filter = 'hue-rotate(0deg) saturate(2) brightness(1.2)';
        };

        btn.onmouseleave = function() {
          this.style.background = 'rgba(0, 0, 0, 0.7)';
          this.style.borderColor = 'rgba(255, 120, 0, 0.4)';
          this.style.boxShadow = 'none';
          this.style.transform = 'translateY(0) scale(1)';
          this.style.filter = 'hue-rotate(20deg) saturate(1.5)';
        };
      }
    }
  }

  function startMaintenance() {
    setInterval(() => {
      const container = document.getElementById('space-weather-indicators');
      if (!container) {
        console.log('🔄 Re-adding space weather indicators');
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
        dot.style.boxShadow = (status === 'red' || status === 'orange') 
          ? `0 0 8px ${statusInfo.color}` 
          : 'none';
      }
    });
  }

  function showTooltip(indicator, bandKey, locked) {
    const data = window.RussellTV?.SpaceWeather?.getCurrentData();
    if (!data) return;

    hideTooltip();

    const detailed = window.RussellTV.SpaceWeather.getDetailedStatus(bandKey);
    if (!detailed) return;

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
    tooltip.style.bottom = `${window.innerHeight - rect.top + 15}px`;
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
           style="
             color: #ffbb00;
             text-decoration: none;
             font-size: 0.85rem;
             display: block;
             margin-bottom: 0.5rem;
             padding: 0.4rem 0.75rem;
             background: rgba(255, 120, 0, 0.15);
             border-radius: 8px;
             border: 1px solid rgba(255, 120, 0, 0.3);
             transition: all 0.2s ease;
           ">
          📊 View HF Propagation Maps →
        </a>
        <a href="https://www.voacap.com/prediction.html" target="_blank"
           style="
             color: #ffbb00;
             text-decoration: none;
             font-size: 0.85rem;
             display: block;
             padding: 0.4rem 0.75rem;
             background: rgba(255, 120, 0, 0.15);
             border-radius: 8px;
             border: 1px solid rgba(255, 120, 0, 0.3);
             transition: all 0.2s ease;
           ">
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

    if (!locked) {
      tooltip.onmouseenter = () => {
        if (hideTooltipTimer) clearTimeout(hideTooltipTimer);
      };
      tooltip.onmouseleave = () => {
        scheduleTooltipHide();
      };
    }
  }

  function hideTooltip() {
    if (hideTooltipTimer) clearTimeout(hideTooltipTimer);
    const tooltip = document.getElementById('space-weather-tooltip');
    if (tooltip) tooltip.remove();

    if (!tooltipLocked) {
      ['hf', 'gps', 'satcom'].forEach(key => {
        const ind = document.getElementById(`sw-indicator-${key}`);
        if (ind) {
          ind.style.background = 'rgba(0, 0, 0, 0.5)';
          ind.style.borderColor = 'rgba(255, 120, 0, 0.3)';
          ind.style.boxShadow = 'none';
        }
      });
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

  document.addEventListener('click', (e) => {
    const tooltip = document.getElementById('space-weather-tooltip');
    if (
      tooltip &&
      !e.target.closest('.sw-indicator') &&
      !e.target.closest('#space-weather-tooltip') &&
      !e.target.closest('#propagation-panel-btn')
    ) {
      hideTooltip();
      tooltipLocked = false;
      currentTooltipBand = null;
    }
  });

  console.log('✅ Space weather info bar loaded');
})();
