/**
 * mobile-ui.js - Mobile-specific UI features
 * Handles mobile dropdown and ticker (with space weather support)
 * Updated to work with unified info-bar.js
 */

window.RussellTV = window.RussellTV || {};

window.RussellTV.MobileUI = (function() {
  'use strict';

  let tickerUpdateInterval = null;

  function initChannelDropdown() {
    const select = document.getElementById('channel-select-mobile');
    if (!select || !window.CHANNEL_ORDER || !window.CHANNELS) return;

    // Clear existing options (except first placeholder)
    while (select.options.length > 1) {
      select.remove(1);
    }

    // Populate dropdown
    window.CHANNEL_ORDER.forEach(key => {
      const channel = window.CHANNELS[key];
      if (!channel) return;

      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = channel.label;
      select.appendChild(opt);
    });

    // Handle selection
    select.addEventListener('change', (e) => {
      const key = e.target.value;
      if (!key) return;

      if (window.RussellTV.ViewManager) {
        window.RussellTV.ViewManager.showSingle(key);
      }
    });
  }

  function updateTickerContent() {
    const desktopBar = document.getElementById('info-bar');
    const mobileInner = document.getElementById('info-bar-mobile-inner');
    
    if (!desktopBar || !mobileInner) return;

    // Get all info blocks (time/weather)
    const infoBlocks = Array.from(desktopBar.querySelectorAll('.info-block'));
    
    if (infoBlocks.length === 0) return;

    // Get space weather section (new unified structure)
    const spaceWeatherSection = document.getElementById('space-weather-section');

    // Build ticker content
    let tickerHTML = '';
    
    // Add info blocks
    infoBlocks.forEach(block => {
      tickerHTML += block.outerHTML + ' ';
    });

    // Add space weather at the end if it exists
    if (spaceWeatherSection) {
      tickerHTML += ' <span style="margin: 0 0.5rem;">·</span> ';
      tickerHTML += spaceWeatherSection.outerHTML;
    }

    // Triple duplicate for extra seamless loop (reduces visible gaps)
    const separator = ' <span style="margin: 0 0.5rem;">·</span> ';
    const fullContent = tickerHTML + separator + tickerHTML + separator + tickerHTML;
    
    // Only update if content actually changed
    const currentContent = mobileInner.getAttribute('data-content');
    if (currentContent === tickerHTML) return;
    
    mobileInner.setAttribute('data-content', tickerHTML);
    
    // Smooth update: temporarily pause animation, update, resume
    const wasRunning = mobileInner.classList.contains('ticker-running');
    if (wasRunning) {
      // Pause animation
      mobileInner.style.animation = 'none';
      
      // Update content
      mobileInner.innerHTML = fullContent;
      
      // Force reflow
      void mobileInner.offsetWidth;
      
      // Resume animation
      mobileInner.style.animation = '';
      if (wasRunning) {
        mobileInner.classList.add('ticker-running');
      }
    } else {
      mobileInner.innerHTML = fullContent;
    }
    
    // Re-attach space weather event listeners to mobile clones
    if (spaceWeatherSection && window.RussellTV.SpaceWeather) {
      attachMobileSpaceWeatherListeners();
    }
  }

  function attachMobileSpaceWeatherListeners() {
    const mobileInner = document.getElementById('info-bar-mobile-inner');
    if (!mobileInner) return;

    // Find all space weather indicators in mobile ticker
    const mobileIndicators = mobileInner.querySelectorAll('.sw-indicator[data-band]');
    
    mobileIndicators.forEach(indicator => {
      const bandKey = indicator.dataset.band;
      if (!bandKey) return;

      // Skip if already has listeners
      if (indicator._hasMobileListeners) return;
      indicator._hasMobileListeners = true;

      indicator.addEventListener('mouseenter', function() {
        this.style.background = 'rgba(255, 120, 0, 0.15)';
        showMobileTooltip(this, bandKey);
      });

      indicator.addEventListener('mouseleave', function() {
        this.style.background = '';
        setTimeout(() => {
          const tooltip = document.getElementById('sw-tooltip');
          if (tooltip && !tooltip.matches(':hover')) {
            hideTooltip();
          }
        }, 200);
      });
    });

    // Find propagation buttons in mobile ticker
    const mobilePropBtns = mobileInner.querySelectorAll('#propagation-panel-btn');
    
    mobilePropBtns.forEach(btn => {
      if (btn._hasMobileListeners) return;
      btn._hasMobileListeners = true;

      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const panel = document.getElementById('propagation-panel');
        if (panel) {
          panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        }
      });

      btn.addEventListener('mouseenter', function() {
        this.style.background = 'rgba(255, 120, 0, 0.15)';
        this.style.borderColor = 'rgba(255, 120, 0, 0.5)';
      });

      btn.addEventListener('mouseleave', function() {
        this.style.background = '';
        this.style.borderColor = '';
      });
    });

    // Find settings buttons in mobile ticker
    const mobileSettingsBtns = mobileInner.querySelectorAll('#feature-settings-btn');
    
    mobileSettingsBtns.forEach(btn => {
      if (btn._hasMobileListeners) return;
      btn._hasMobileListeners = true;

      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        if (window.RussellTV?.Features?.toggleSettings) {
          window.RussellTV.Features.toggleSettings();
        }
      });

      btn.addEventListener('mouseenter', function() {
        this.style.background = 'rgba(255, 120, 0, 0.15)';
        this.style.borderColor = 'rgba(255, 120, 0, 0.5)';
      });

      btn.addEventListener('mouseleave', function() {
        this.style.background = '';
        this.style.borderColor = '';
      });
    });
  }

  function showMobileTooltip(indicator, bandKey) {
    const data = window.RussellTV?.SpaceWeather?.getCurrentData();
    if (!data) return;

    hideTooltip();

    const detailed = window.RussellTV.SpaceWeather.getDetailedStatus(bandKey);
    if (!detailed) return;

    const tooltip = document.createElement('div');
    tooltip.id = 'sw-tooltip';
    tooltip.className = 'visible';
    tooltip.style.cssText = `
      position: fixed;
      background: linear-gradient(135deg, rgba(0, 0, 0, 0.98), rgba(20, 10, 0, 0.98));
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
    `;

    const rect = indicator.getBoundingClientRect();
    tooltip.style.left = `${rect.left + (rect.width / 2)}px`;
    tooltip.style.bottom = `${window.innerHeight - rect.top + 12}px`;
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
        Kp Index: ${data.kpIndex.toFixed(1)}
      </div>
    `;

    document.body.appendChild(tooltip);

    tooltip.addEventListener('mouseleave', () => {
      setTimeout(() => hideTooltip(), 200);
    });
  }

  function hideTooltip() {
    const tooltip = document.getElementById('sw-tooltip');
    if (tooltip) tooltip.remove();
  }

  function initTicker() {
    const desktopBar = document.getElementById('info-bar');
    const mobileInner = document.getElementById('info-bar-mobile-inner');
    
    if (!desktopBar || !mobileInner) return;

    function startTickerWhenReady() {
      const content = desktopBar.innerHTML.trim();
      const spaceWeatherSection = document.getElementById('space-weather-section');
      
      if (!content) {
        setTimeout(startTickerWhenReady, 1000);
        return;
      }

      // Wait for space weather section to appear
      if (!spaceWeatherSection) {
        setTimeout(startTickerWhenReady, 500);
        return;
      }

      // Initial update
      updateTickerContent();
      
      // Add ticker animation class
      mobileInner.classList.add('ticker-running');

      // Update ticker every 6 seconds
      if (tickerUpdateInterval) clearInterval(tickerUpdateInterval);
      tickerUpdateInterval = setInterval(updateTickerContent, 6000);

      console.log('📱 Mobile ticker started with space weather support');
    }

    // Wait for info bar to be populated
    setTimeout(startTickerWhenReady, 2000);
  }

  // Public API
  return {
    initChannelDropdown,
    initTicker,
    updateTickerContent
  };
})();
