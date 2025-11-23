/**
 * space-weather-infobar.js - Adds space weather indicators to info bar
 */

(function() {
  'use strict';

  console.log('🛰️ Space weather info bar integration loading...');

  function addSpaceWeatherToInfoBar() {
    const infoBar = document.getElementById('info-bar');
    if (!infoBar) {
      console.warn('⚠️ Info bar not found, retrying...');
      setTimeout(addSpaceWeatherToInfoBar, 1000);
      return;
    }

    // Check if already added
    if (document.getElementById('space-weather-indicators')) {
      return;
    }

    // Create space weather container
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

    // Create indicators for each band
    const bands = ['hf', 'gps', 'satcom'];
    
    bands.forEach(bandKey => {
      const indicator = createIndicator(bandKey);
      container.appendChild(indicator);
    });

    // Add to info bar (at the end)
    infoBar.appendChild(container);

    console.log('✅ Space weather indicators added to info bar');

    // Start updating indicators
    updateIndicators();
    setInterval(updateIndicators, 60000); // Update every minute
  }

  function createIndicator(bandKey) {
    const config = window.SPACE_WEATHER_CONFIG;
    const band = config.bands[bandKey];

    const indicator = document.createElement('span');
    indicator.id = `sw-indicator-${bandKey}`;
    indicator.className = 'sw-indicator';
    indicator.dataset.band = bandKey;
    indicator.style.cssText = `
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      cursor: help;
      position: relative;
      padding: 0.15rem 0.4rem;
      border-radius: 4px;
      transition: background 0.2s ease;
    `;

    // Icon
    const icon = document.createElement('span');
    icon.className = 'sw-icon';
    icon.textContent = band.icon;
    icon.style.fontSize = '0.9rem';

    // Status indicator (colored dot)
    const status = document.createElement('span');
    status.className = 'sw-status-dot';
    status.style.cssText = `
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #888;
      display: inline-block;
    `;

    indicator.appendChild(icon);
    indicator.appendChild(status);

    // Add hover effect
    indicator.addEventListener('mouseenter', () => {
      indicator.style.background = 'rgba(255, 255, 255, 0.1)';
      showTooltip(indicator, bandKey);
    });

    indicator.addEventListener('mouseleave', () => {
      indicator.style.background = 'transparent';
      hideTooltip();
    });

    return indicator;
  }

  function updateIndicators() {
    const data = window.RussellTV?.SpaceWeather?.getCurrentData();
    if (!data) return;

    const bands = ['hf', 'gps', 'satcom'];
    
    bands.forEach(bandKey => {
      const indicator = document.getElementById(`sw-indicator-${bandKey}`);
      if (!indicator) return;

      const statusDot = indicator.querySelector('.sw-status-dot');
      const status = data.status[bandKey];
      const config = window.SPACE_WEATHER_CONFIG;
      const statusInfo = config.statusLevels[status];

      if (statusDot && statusInfo) {
        statusDot.style.background = statusInfo.color;
        
        // Add glow effect for warnings
        if (status === 'red' || status === 'orange') {
          statusDot.style.boxShadow = `0 0 8px ${statusInfo.color}`;
        } else {
          statusDot.style.boxShadow = 'none';
        }
      }
    });
  }

  function showTooltip(indicator, bandKey) {
    const data = window.RussellTV?.SpaceWeather?.getCurrentData();
    if (!data) return;

    hideTooltip(); // Remove any existing tooltip

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
      pointer-events: none;
      border: 1px solid rgba(255, 255, 255, 0.2);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
      min-width: 250px;
      max-width: 350px;
    `;

    // Position tooltip above indicator
    const rect = indicator.getBoundingClientRect();
    tooltip.style.left = `${rect.left + (rect.width / 2)}px`;
    tooltip.style.bottom = `${window.innerHeight - rect.top + 10}px`;
    tooltip.style.transform = 'translateX(-50%)';

    // Build tooltip content
    const html = `
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
      <div style="font-size: 0.8rem; opacity: 0.8;">
        <strong>Uses:</strong> ${detailed.uses}
      </div>
      <div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid rgba(255, 255, 255, 0.2); font-size: 0.75rem; opacity: 0.7;">
        <strong>Current Conditions:</strong><br>
        Radio: R${data.scales.R} | Solar: S${data.scales.S} | Geo: G${data.scales.G}<br>
        Kp Index: ${data.kpIndex.toFixed(1)}
        <br>
        Updated: ${formatTime(data.timestamp)}
      </div>
    `;

    tooltip.innerHTML = html;
    document.body.appendChild(tooltip);
  }

  function hideTooltip() {
    const tooltip = document.getElementById('space-weather-tooltip');
    if (tooltip) {
      tooltip.remove();
    }
  }

  function formatTime(date) {
    const now = new Date();
    const diff = Math.floor((now - date) / 60000); // minutes ago

    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff}m ago`;
    const hours = Math.floor(diff / 60);
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleString();
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addSpaceWeatherToInfoBar);
  } else {
    addSpaceWeatherToInfoBar();
  }

  console.log('✅ Space weather info bar integration loaded');
})();
