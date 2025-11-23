/**
 * space-weather-infobar.js - Space weather indicators for info bar
 * Simple, reliable version
 */

(function() {
  'use strict';

  console.log('🛰️ Space weather info bar loading...');

  let hideTooltipTimer = null;

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

    // Check if already added
    if (document.getElementById('space-weather-indicators')) {
      console.log('✅ Space weather indicators already exist');
      return;
    }

    // Create container
    const container = document.createElement('span');
    container.id = 'space-weather-indicators';
    container.style.cssText = `
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      margin-left: 1rem;
      padding-left: 1rem;
      border-left: 1px solid rgba(255, 255, 255, 0.2);
    `;

    // Create indicators
    ['hf', 'gps', 'satcom'].forEach(bandKey => {
      container.appendChild(createIndicator(bandKey));
    });

    // Add propagation button
    container.appendChild(createPropButton());

    // Add to bar
    infoBar.appendChild(container);
    
    console.log('✅ Space weather indicators added to info bar');

    // Attach event listeners and update colors
    attachListeners();
    updateColors();

    // Update colors every minute
    setInterval(updateColors, 60000);
  }

  function createIndicator(bandKey) {
    const band = window.SPACE_WEATHER_CONFIG.bands[bandKey];

    const span = document.createElement('span');
    span.id = `sw-indicator-${bandKey}`;
    span.className = 'sw-indicator';
    span.dataset.band = bandKey;
    span.style.cssText = `
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      cursor: help;
      padding: 0.15rem 0.4rem;
      border-radius: 4px;
      transition: background 0.2s ease;
    `;

    // Icon
    const icon = document.createElement('span');
    icon.textContent = band.icon;
    icon.style.fontSize = '0.9rem';

    // Status dot
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
    btn.innerHTML = '📊';
    btn.title = 'View HF Propagation';
    btn.style.cssText = `
      background: rgba(0, 0, 0, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.26);
      border-radius: 4px;
      padding: 0.15rem 0.4rem;
      font-size: 0.9rem;
      cursor: pointer;
      transition: all 0.25s ease;
      margin-left: 0.5rem;
    `;

    return btn;
  }

  function attachListeners() {
    // Attach to each indicator
    ['hf', 'gps', 'satcom'].forEach(bandKey => {
      const indicator = document.getElementById(`sw-indicator-${bandKey}`);
      if (!indicator || indicator._hasListeners) return;
      
      indicator._hasListeners = true;

      indicator.onmouseenter = function() {
        this.style.background = 'rgba(255, 255, 255, 0.1)';
        if (hideTooltipTimer) clearTimeout(hideTooltipTimer);
        showTooltip(this, bandKey);
      };

      indicator.onmouseleave = function() {
        this.style.background = 'transparent';
        hideTooltipTimer = setTimeout(() => {
          const tooltip = document.getElementById('space-weather-tooltip');
          if (tooltip && !tooltip.matches(':hover')) {
            hideTooltip();
          }
        }, 200);
      };
    });

    // Attach to propagation button
    const btn = document.getElementById('propagation-panel-btn');
    if (btn && !btn._hasListeners) {
      btn._hasListeners = true;

      btn.onclick = function(e) {
        e.stopPropagation();
        if (window.RussellTV?.PropagationPanel) {
          window.RussellTV.PropagationPanel.toggle();
        }
      };

      btn.onmouseenter = function() {
        this.style.background = 'linear-gradient(90deg, rgba(255,80,0,0.25), rgba(255,150,0,0.25))';
        this.style.boxShadow = '0 0 8px rgba(255,120,0,0.6)';
        this.style.transform = 'translateY(-1px)';
      };

      btn.onmouseleave = function() {
        this.style.background = 'rgba(0, 0, 0, 0.7)';
        this.style.boxShadow = 'none';
        this.style.transform = 'translateY(0)';
      };
    }
  }

  function startMaintenance() {
    // Re-attach listeners every 6 seconds (after info-bar re-renders every 10 seconds)
    setInterval(() => {
      const container = document.getElementById('space-weather-indicators');
      if (container) {
        // Container exists, make sure listeners are attached
        attachListeners();
      } else {
        // Container was removed, re-add it
        console.log('🔄 Re-adding space weather indicators');
        addIndicators();
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

  function showTooltip(indicator, bandKey) {
    const data = window.RussellTV?.SpaceWeather?.getCurrentData();
    if (!data) return;

    hideTooltip();

    const detailed = window.RussellTV.SpaceWeather.getDetailedStatus(bandKey);
    if (!detailed) return;

    const tooltip = document.createElement('div');
    tooltip.id = 'space-weather-tooltip';
    tooltip.style.cssText = `
      position: fixed;
      background: rgba(0, 0, 0, 0.95);
      color: white;
      padding: 0.75rem 1rem;
      border-radius: 8px;
      font-size: 0.85rem;
      z-index: 10001;
      pointer-events: auto;
      border: 1px solid rgba(255, 255, 255, 0.2);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
      min-width: 280px;
      max-width: 350px;
    `;

    const rect = indicator.getBoundingClientRect();
    tooltip.style.left = `${rect.left + (rect.width / 2)}px`;
    tooltip.style.bottom = `${window.innerHeight - rect.top + 10}px`;
    tooltip.style.transform = 'translateX(-50%)';

    tooltip.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;">
        <span style="font-size: 1.2rem;">${detailed.icon}</span>
        <span>${detailed.band}</span>
        <span style="margin-left: auto;">${detailed.statusIcon}</span>
      </div>
      <div style="margin-bottom: 0.5rem;">
        <strong>Status:</strong> <span style="color: ${detailed.color};">${detailed.status}</span>
      </div>
      <div style="margin-bottom: 0.5rem; font-size: 0.8rem; opacity: 0.9;">
        ${detailed.description}
      </div>
      <div style="margin-bottom: 0.25rem; font-size: 0.8rem;">
        <strong>Frequencies:</strong> ${detailed.frequencies}
      </div>
      <div style="font-size: 0.8rem; opacity: 0.8; margin-bottom: 0.5rem;">
        <strong>Uses:</strong> ${detailed.uses}
      </div>
      ${bandKey === 'hf' ? `
      <div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid rgba(255, 255, 255, 0.2);">
        <a href="https://weatherspotter.net/propagation.php" target="_blank" 
           style="color: #ff9900; text-decoration: none; font-size: 0.8rem; display: block; margin-bottom: 0.3rem;"
           onmouseover="this.style.color='#ffbb00'" onmouseout="this.style.color='#ff9900'">
          📊 View HF Propagation Maps →
        </a>
        <a href="https://www.voacap.com/prediction.html" target="_blank"
           style="color: #ff9900; text-decoration: none; font-size: 0.8rem; display: block;"
           onmouseover="this.style.color='#ffbb00'" onmouseout="this.style.color='#ff9900'">
          📡 VOACAP Path Analysis →
        </a>
      </div>
      ` : ''}
      <div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid rgba(255, 255, 255, 0.2); font-size: 0.75rem; opacity: 0.7;">
        <strong>Current Conditions:</strong><br>
        Radio: R${data.scales.R} | Solar: S${data.scales.S} | Geo: G${data.scales.G}<br>
        Kp Index: ${data.kpIndex.toFixed(1)}<br>
        Updated: ${formatTime(data.timestamp)}
      </div>
    `;

    document.body.appendChild(tooltip);

    if (hideTooltipTimer) clearTimeout(hideTooltipTimer);

    tooltip.onmouseenter = () => {
      if (hideTooltipTimer) clearTimeout(hideTooltipTimer);
    };

    tooltip.onmouseleave = () => {
      hideTooltipTimer = setTimeout(hideTooltip, 200);
    };
  }

  function hideTooltip() {
    if (hideTooltipTimer) clearTimeout(hideTooltipTimer);
    const tooltip = document.getElementById('space-weather-tooltip');
    if (tooltip) tooltip.remove();
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

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  console.log('✅ Space weather info bar loaded');
})();
