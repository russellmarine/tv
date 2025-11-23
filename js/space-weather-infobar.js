/**
 * space-weather-infobar.js - Space weather indicators for info bar
 * Survives info-bar re-renders and maintains event listeners
 */

(function() {
  'use strict';

  console.log('🛰️ Space weather info bar loading...');

  let updateInterval = null;
  let checkInterval = null;

  function addSpaceWeatherToInfoBar() {
    const infoBar = document.getElementById('info-bar');
    if (!infoBar) {
      console.warn('⚠️ Info bar not found, retrying...');
      setTimeout(addSpaceWeatherToInfoBar, 1000);
      return;
    }

    // Check if already added
    let container = document.getElementById('space-weather-indicators');
    if (container) {
      // Already exists, just update it
      updateIndicators();
      reattachEventListeners();
      return;
    }

    // Create space weather container
    container = document.createElement('span');
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

    // Add propagation panel button
    const propButton = createPropagationButton();
    container.appendChild(propButton);

    // Add to info bar
    infoBar.appendChild(container);

    console.log('✅ Space weather indicators added to info bar');

    // Attach event listeners
    reattachEventListeners();

    // Start updating indicators
    updateIndicators();
    
    // Update indicators every minute
    if (updateInterval) clearInterval(updateInterval);
    updateInterval = setInterval(updateIndicators, 60000);

    // Check if we need to re-add after info-bar re-renders (every 11 seconds)
    if (checkInterval) clearInterval(checkInterval);
    checkInterval = setInterval(() => {
      const existing = document.getElementById('space-weather-indicators');
      if (existing) {
        // Still exists, but might need event listeners re-attached
        reattachEventListeners();
      } else {
        // Was removed, re-add it
        console.log('🔄 Space weather indicators removed by re-render, re-adding...');
        addSpaceWeatherToInfoBar();
      }
    }, 11000);
  }

  function createPropagationButton() {
    const button = document.createElement('button');
    button.id = 'propagation-panel-btn';
    button.innerHTML = '📊';
    button.title = 'View HF Propagation';
    button.style.cssText = `
      background: rgba(0, 0, 0, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.26);
      border-radius: 4px;
      padding: 0.15rem 0.4rem;
      font-size: 0.9rem;
      cursor: pointer;
      transition: background 0.25s ease, box-shadow 0.25s ease, transform 0.12s ease;
      margin-left: 0.5rem;
    `;

    // Event listeners will be attached by reattachEventListeners()
    return button;
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

    // Event listeners will be attached by reattachEventListeners()
    return indicator;
  }

  function reattachEventListeners() {
    // Attach listeners to indicators
    const bands = ['hf', 'gps', 'satcom'];
    
    bands.forEach(bandKey => {
      const indicator = document.getElementById(`sw-indicator-${bandKey}`);
      if (!indicator) return;

      // Check if already has our listeners
      if (indicator.dataset.listenersAttached === 'true') return;
      indicator.dataset.listenersAttached = 'true';

      // Remove old listeners by cloning (fresh start)
      const newIndicator = indicator.cloneNode(true);
      indicator.parentNode.replaceChild(newIndicator, indicator);
      newIndicator.dataset.listenersAttached = 'true';

      newIndicator.addEventListener('mouseenter', () => {
        newIndicator.style.background = 'rgba(255, 255, 255, 0.1)';
        showTooltip(newIndicator, bandKey);
      });

      newIndicator.addEventListener('mouseleave', () => {
        newIndicator.style.background = 'transparent';
        hideTooltip();
      });
    });

    // Attach listeners to propagation button
    const propBtn = document.getElementById('propagation-panel-btn');
    if (propBtn && propBtn.dataset.listenersAttached !== 'true') {
      propBtn.dataset.listenersAttached = 'true';

      // Clone to remove old listeners
      const newBtn = propBtn.cloneNode(true);
      propBtn.parentNode.replaceChild(newBtn, propBtn);
      newBtn.dataset.listenersAttached = 'true';

      newBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        togglePropagationPanel();
      });

      newBtn.addEventListener('mouseenter', () => {
        newBtn.style.background = 'linear-gradient(90deg, rgba(255,80,0,0.25), rgba(255,150,0,0.25))';
        newBtn.style.boxShadow = '0 0 8px rgba(255,120,0,0.6)';
        newBtn.style.transform = 'translateY(-1px)';
      });

      newBtn.addEventListener('mouseleave', () => {
        newBtn.style.background = 'rgba(0, 0, 0, 0.7)';
        newBtn.style.boxShadow = 'none';
        newBtn.style.transform = 'translateY(0)';
      });
    }
  }

  function updateIndicators() {
    const data = window.RussellTV?.SpaceWeather?.getCurrentData();
    if (!data) {
      // Data not ready yet, show gray dots
      const bands = ['hf', 'gps', 'satcom'];
      bands.forEach(bandKey => {
        const indicator = document.getElementById(`sw-indicator-${bandKey}`);
        if (!indicator) return;
        const statusDot = indicator.querySelector('.sw-status-dot');
        if (statusDot) {
          statusDot.style.background = '#888';
          statusDot.style.boxShadow = 'none';
        }
      });
      return;
    }

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
      pointer-events: auto;
      border: 1px solid rgba(255, 255, 255, 0.2);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
      min-width: 280px;
      max-width: 350px;
    `;

    // Position tooltip above indicator
    const rect = indicator.getBoundingClientRect();
    tooltip.style.left = `${rect.left + (rect.width / 2)}px`;
    tooltip.style.bottom = `${window.innerHeight - rect.top + 10}px`;
    tooltip.style.transform = 'translateX(-50%)';

    // Build tooltip content with propagation links
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
        Kp Index: ${data.kpIndex.toFixed(1)}
        <br>
        Updated: ${formatTime(data.timestamp)}
      </div>
    `;

    tooltip.innerHTML = html;
    document.body.appendChild(tooltip);

    // Keep tooltip open when hovering over it
    tooltip.addEventListener('mouseenter', () => {
      tooltip.style.pointerEvents = 'auto';
    });

    tooltip.addEventListener('mouseleave', () => {
      hideTooltip();
    });
  }

  function hideTooltip() {
    const tooltip = document.getElementById('space-weather-tooltip');
    if (tooltip) {
      tooltip.remove();
    }
  }

  function togglePropagationPanel() {
    if (window.RussellTV && window.RussellTV.PropagationPanel) {
      window.RussellTV.PropagationPanel.toggle();
    } else {
      console.warn('PropagationPanel not loaded yet');
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

  // Also listen for space weather data updates
  document.addEventListener('spaceweather:updated', updateIndicators);

  console.log('✅ Space weather info bar loaded');
})();
