/**
 * mobile-ui.js - Mobile-specific UI features
 * Handles mobile dropdown and ticker
 */

window.RussellTV = window.RussellTV || {};

window.RussellTV.MobileUI = (function() {
  'use strict';

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

  function initTicker() {
    const desktopBar = document.getElementById('info-bar');
    const mobileInner = document.getElementById('info-bar-mobile-inner');
    
    if (!desktopBar || !mobileInner) return;

    function startTickerWhenReady() {
      const content = desktopBar.innerHTML.trim();
      if (!content) {
        setTimeout(startTickerWhenReady, 1000);
        return;
      }
      
      // Duplicate content for seamless loop
      mobileInner.innerHTML = content + ' \u00A0 \u00B7 \u00A0 ' + content;
      mobileInner.classList.add('ticker-running');
    }

    // Wait for info bar to be populated
    setTimeout(startTickerWhenReady, 2000);
  }

  // Public API
  return {
    initChannelDropdown,
    initTicker
  };
})();
