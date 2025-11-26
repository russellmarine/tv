/**
 * space-weather-infobar.js - Space weather indicators for info bar
 * 
 * Events Emitted:
 * - 'spaceweather:ready' (sticky) - Indicators exist in DOM
 * - 'spaceweather:updated' - Data has been refreshed
 * 
 * Events Listened:
 * - 'infobar:ready' - Create indicators when bar exists
 * - 'feature:toggle' - Show/hide based on feature state
 */

(function() {
  'use strict';

  const Events = window.RussellTV?.Events;
  if (!Events) {
    console.error('[SpaceWeather] RussellTV.Events not found. Load russelltv-core.js first.');
    return;
  }

  // ============ STYLES ============

  const styles = `
    #space-weather-indicators {
      position: absolute;
      right: 12px;
      bottom: 6px;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding-left: 1rem;
      border-left: 1px solid rgba(255, 255, 255, 0.2);
      pointer-events: auto;
    }

    .sw-indicator {
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
    }

    .sw-indicator:hover {
      background: rgba(255, 120, 0, 0.15);
      border-color: rgba(255, 120, 0, 0.5);
    }

    .sw-indicator-label {
      font-size: 0.75rem;
      font-weight: bold;
      letter-spacing: 0.5px;
      color: rgba(180, 180, 180, 0.9);
    }

    .sw-status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #888;
      display: inline-block;
    }

    #space-weather-tooltip {
      position: fixed;
      background: linear-gradient(135deg, rgba(0, 0, 0, 0.98) 0%, rgba(20, 10, 0, 0.98) 100%);
      color: white;
      padding: 1rem 1.25rem;
      border-radius: 16px;
      font-size: 0.85rem;
      z-index: 10001;
      pointer-events: auto;
      border: 2px solid rgba(255, 120, 0, 0.6);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.8), 0 0 20px rgba(255, 120, 0, 0.3);
      min-width: 300px;
      max-width: 380px;
      backdrop-filter: blur(10px);
    }

    #space-weather-tooltip-bridge {
      position: fixed;
      background: transparent;
      z-index: 10000;
      pointer-events: auto;
    }
  `;

  // ============ STATE ============

  let container = null;
  let currentTooltipBand = null;
  let tooltipLocked = false;
  let hideTooltipTimer = null;

  // ============ INDICATOR CREATION ============

  function createIndicator(bandKey) {
    const span = document.createElement('span');
    span.id = `sw-indicator-${bandKey}`;
    span.className = 'sw-indicator';
    span.dataset.band = bandKey;

    const label = document.createElement('span');
    label.className = 'sw-indicator-label';
    label.textContent = bandKey === 'hf' ? 'HF' : bandKey === 'gps' ? 'GPS' : 'SAT';

    const dot = document.createElement('span');
    dot.className = 'sw-status-dot';

    span.appendChild(label);
    span.appendChild(dot);

    // Event handlers
    span.addEventListener('mouseenter', () => {
      if (!tooltipLocked) {
        cancelHideTooltip();
        showTooltip(span, bandKey, false);
        currentTooltipBand = bandKey;
      }
    });

    span.addEventListener('mouseleave', (e) => {
      if (!tooltipLocked) {
        scheduleHideTooltip();
      }
    });

    span.addEventListener('click', (e) => {
      e.stopPropagation();
      if (tooltipLocked && currentTooltipBand === bandKey) {
        tooltipLocked = false;
        hideTooltip();
        currentTooltipBand = null;
      } else {
        tooltipLocked = true;
        showTooltip(span, bandKey, true);
        currentTooltipBand = bandKey;
      }
    });

    return span;
  }

  function createPropButton() {
    const span = document.createElement('span');
    span.id = 'propagation-panel-btn';
    span.className = 'sw-indicator';
    span.title = 'Detailed propagation forecast';

    const label = document.createElement('span');
    label.className = 'sw-indicator-label';
    label.textContent = '⚡';

    span.appendChild(label);

    span.addEventListener('click', (e) => {
      e.stopPropagation();
      tooltipLocked = false;
      hideTooltip();
      
      const panel = document.getElementById('propagation-panel');
      if (panel) {
        const isVisible = panel.style.display !== 'none';
        panel.style.display = isVisible ? 'none' : 'block';
      }
    });

    return span;
  }

  function createSettingsButton() {
    const span = document.createElement('span');
    span.id = 'feature-settings-btn';
    span.className = 'sw-indicator';
    span.title = 'Display Settings';

    const label = document.createElement('span');
    label.className = 'sw-indicator-label';
    label.textContent = '⚙️';

    span.appendChild(label);

    span.addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.RussellTV?.Features?.toggleSettings) {
        window.RussellTV.Features.toggleSettings();
      }
    });

    return span;
  }

  // ============ TOOLTIP ============

  function showTooltip(indicator, bandKey, locked) {
    const data = window.RussellTV?.SpaceWeather?.getCurrentData();
    if (!data) return;

    hideTooltip();

    const detailed = window.RussellTV.SpaceWeather.getDetailedStatus(bandKey);
    if (!detailed) return;

    const tooltip = document.createElement('div');
    tooltip.id = 'space-weather-tooltip';

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
      <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid rgba(255, 120, 0, 0.3); font-size: 0.75rem; opacity: 0.8;">
        <strong>Current Conditions:</strong><br>
        Radio: R${data.scales.R} | Solar: S${data.scales.S} | Geo: G${data.scales.G}<br>
        Kp Index: ${data.kpIndex.toFixed(1)}<br>
        Updated: ${formatTime(data.timestamp)}
      </div>
      <div style="text-align: center; margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid rgba(255, 120, 0, 0.3); font-size: 0.7rem; opacity: 0.6;">
        ${locked ? '🔒 Click indicator to unlock' : '💡 Click to lock'}
      </div>
    `;

    document.body.appendChild(tooltip);

    // Bridge element
    const bridge = document.createElement('div');
    bridge.id = 'space-weather-tooltip-bridge';
    bridge.style.left = `${rect.left}px`;
    bridge.style.width = `${rect.width}px`;
    bridge.style.bottom = `${window.innerHeight - rect.top}px`;
    bridge.style.height = '12px';

    bridge.addEventListener('mouseenter', cancelHideTooltip);
    bridge.addEventListener('mouseleave', () => {
      if (!tooltipLocked) scheduleHideTooltip();
    });

    document.body.appendChild(bridge);

    tooltip.addEventListener('mouseenter', cancelHideTooltip);
    tooltip.addEventListener('mouseleave', () => {
      if (!tooltipLocked) scheduleHideTooltip();
    });
  }

  function hideTooltip() {
    cancelHideTooltip();
    document.getElementById('space-weather-tooltip')?.remove();
    document.getElementById('space-weather-tooltip-bridge')?.remove();
  }

  function scheduleHideTooltip() {
    cancelHideTooltip();
    hideTooltipTimer = setTimeout(() => {
      if (!tooltipLocked) hideTooltip();
    }, 300);
  }

  function cancelHideTooltip() {
    if (hideTooltipTimer) {
      clearTimeout(hideTooltipTimer);
      hideTooltipTimer = null;
    }
  }

  function formatTime(date) {
    if (!date) return 'Unknown';
    const now = new Date();
    const diff = Math.floor((now - date) / 60000);
    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff}m ago`;
    const hours = Math.floor(diff / 60);
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleString();
  }

  // ============ COLOR UPDATES ============

  function updateColors() {
    const data = window.RussellTV?.SpaceWeather?.getCurrentData();
    if (!data) return;

    const config = window.SPACE_WEATHER_CONFIG;
    if (!config) return;

    ['hf', 'gps', 'satcom'].forEach(bandKey => {
      const indicator = document.getElementById(`sw-indicator-${bandKey}`);
      if (!indicator) return;

      const dot = indicator.querySelector('.sw-status-dot');
      const status = data.status[bandKey];
      const statusInfo = config.statusLevels[status];

      if (dot && statusInfo) {
        dot.style.background = statusInfo.color;
        dot.style.boxShadow = (status === 'red' || status === 'orange')
          ? `0 0 8px ${statusInfo.color}`
          : 'none';
      }
    });
  }

  // ============ INITIALIZATION ============

  function init(barData) {
    const bar = barData?.bar || document.getElementById('info-bar');
    if (!bar) {
      console.error('[SpaceWeather] Info bar not found');
      return;
    }

    // Add styles
    const styleEl = document.createElement('style');
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);

    // Create container
    container = document.createElement('span');
    container.id = 'space-weather-indicators';

    // Add indicators
    ['hf', 'gps', 'satcom'].forEach(bandKey => {
      container.appendChild(createIndicator(bandKey));
    });

    container.appendChild(createPropButton());
    container.appendChild(createSettingsButton());

    bar.appendChild(container);

    // Start color updates
    updateColors();
    setInterval(updateColors, 60000);

    // Close tooltip on outside click
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.sw-indicator') && 
          !e.target.closest('#space-weather-tooltip')) {
        tooltipLocked = false;
        hideTooltip();
        currentTooltipBand = null;
      }
    });

    // Listen for feature toggles
    Events.on('feature:toggle', ({ feature, enabled }) => {
      if (feature === 'space-weather-indicators') {
        ['hf', 'gps', 'satcom'].forEach(key => {
          const el = document.getElementById(`sw-indicator-${key}`);
          if (el) el.style.display = enabled ? 'inline-flex' : 'none';
        });
      }
      if (feature === 'propagation-panel') {
        const btn = document.getElementById('propagation-panel-btn');
        if (btn) btn.style.display = enabled ? 'inline-flex' : 'none';
        if (!enabled) {
          const panel = document.getElementById('propagation-panel');
          if (panel) panel.style.display = 'none';
        }
      }
    });

    // Signal ready
    Events.emit('spaceweather:ready', { container }, { sticky: true });

    console.log('✅ [SpaceWeather] Indicators initialized');
  }

  // Wait for info bar AND space weather data
  function waitAndInit() {
    const hasConfig = window.SPACE_WEATHER_CONFIG;
    const hasData = window.RussellTV?.SpaceWeather;

    if (hasConfig && hasData) {
      Events.whenReady('infobar:ready', init);
    } else {
      // Retry in 100ms if config/data not ready
      setTimeout(waitAndInit, 100);
    }
  }

  Events.whenReady('core:ready', waitAndInit);

})();
