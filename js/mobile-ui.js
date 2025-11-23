/**
 * mobile-ui.js - Mobile-specific UI features
 * Handles mobile dropdown and ticker (with space weather support)
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

    // Get space weather indicators
    const spaceWeather = document.getElementById('space-weather-indicators');

    // Build ticker content
    let tickerHTML = '';
    
    // Add info blocks
    infoBlocks.forEach(block => {
      tickerHTML += block.outerHTML + ' ';
    });

    // Add space weather at the end if it exists
    if (spaceWeather) {
      tickerHTML += ' <span style="margin: 0 0.5rem;">·</span> ';
      tickerHTML += spaceWeather.outerHTML;
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
      // Save current animation position
      const computedStyle = window.getComputedStyle(mobileInner);
      const transform = computedStyle.transform;
      
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
    if (spaceWeather && window.RussellTV.SpaceWeather) {
      attachMobileSpaceWeatherListeners();
    }
  }

  function attachMobileSpaceWeatherListeners() {
    const mobileInner = document.getElementById('info-bar-mobile-inner');
    if (!mobileInner) return;

    // Find all space weather indicators in mobile ticker (there will be 2 due to duplication)
    const mobileIndicators = mobileInner.querySelectorAll('.sw-indicator');
    
    mobileIndicators.forEach(indicator => {
      const bandKey = indicator.dataset.band;
      if (!bandKey) return;

      // Skip if already has listeners
      if (indicator._hasMobileListeners) return;
      indicator._hasMobileListeners = true;

      indicator.addEventListener('mouseenter', function() {
        this.style.background = 'rgba(255, 255, 255, 0.1)';
        showMobileTooltip(this, bandKey);
      });

      indicator.addEventListener('mouseleave', function() {
        this.style.background = 'transparent';
        setTimeout(() => {
          const tooltip = document.getElementById('space-weather-tooltip');
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
        if (window.RussellTV && window.RussellTV.PropagationPanel) {
          window.RussellTV.PropagationPanel.toggle();
        }
      });

      btn.addEventListener('mouseenter', function() {
        this.style.background = 'linear-gradient(90deg, rgba(255,80,0,0.25), rgba(255,150,0,0.25))';
        this.style.boxShadow = '0 0 8px rgba(255,120,0,0.6)';
        this.style.transform = 'translateY(-1px)';
      });

      btn.addEventListener('mouseleave', function() {
        this.style.background = 'rgba(0, 0, 0, 0.7)';
        this.style.boxShadow = 'none';
        this.style.transform = 'translateY(0)';
      });
    });
  }

  function showMobileTooltip(indicator, bandKey) {
    // Use the same tooltip function from space-weather-infobar.js
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
      </div>
    `;

    tooltip.innerHTML = html;
    document.body.appendChild(tooltip);

    tooltip.addEventListener('mouseenter', () => {
      // Keep tooltip open
    });

    tooltip.addEventListener('mouseleave', () => {
      setTimeout(() => hideTooltip(), 200);
    });
  }

  function hideTooltip() {
    const tooltip = document.getElementById('space-weather-tooltip');
    if (tooltip) tooltip.remove();
  }

  function initTicker() {
    const desktopBar = document.getElementById('info-bar');
    const mobileInner = document.getElementById('info-bar-mobile-inner');
    
    if (!desktopBar || !mobileInner) return;

    function startTickerWhenReady() {
      const content = desktopBar.innerHTML.trim();
      const spaceWeather = document.getElementById('space-weather-indicators');
      
      if (!content) {
        setTimeout(startTickerWhenReady, 1000);
        return;
      }

      // Wait for space weather to appear (it loads after ~1-2 seconds)
      if (!spaceWeather) {
        setTimeout(startTickerWhenReady, 500);
        return;
      }

      // Initial update
      updateTickerContent();
      
      // Add ticker animation class
      mobileInner.classList.add('ticker-running');

      // Update ticker every 6 seconds (in sync with space-weather maintenance)
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
    updateTickerContent // Expose for manual updates
  };
})();
