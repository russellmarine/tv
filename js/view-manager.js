/**
 * view-manager.js - View state management
 * Handles switching between single and grid views
 */

window.RussellTV = window.RussellTV || {};

window.RussellTV.ViewManager = (function() {
  'use strict';

  const singleView = document.getElementById('single-view');
  const gridView = document.getElementById('grid-view');
  const btnSingle = document.getElementById('btn-single');
  const btnGrid = document.getElementById('btn-grid');

  let currentView = 'single';

  function showSingle(channelKey) {
    // Update UI
    if (btnSingle) btnSingle.classList.add('active');
    if (btnGrid) btnGrid.classList.remove('active');
    if (singleView) singleView.style.display = 'block';
    if (gridView) gridView.style.display = 'none';

    // Stop grid playback
    if (window.RussellTV.GridPlayer) {
      window.RussellTV.GridPlayer.stopAll();
    }

    // Save view preference
    if (window.RussellTV.Storage) {
      window.RussellTV.Storage.saveLastView('single');
    }

    currentView = 'single';

    // Play channel if provided
    if (channelKey) {
      if (window.RussellTV.SinglePlayer) {
        window.RussellTV.SinglePlayer.play(channelKey);
      }
      if (window.RussellTV.UIControls) {
        window.RussellTV.UIControls.highlightButton(channelKey);
      }
      // Sync mobile dropdown
      syncMobileDropdown(channelKey);
    }
  }

  function showGrid() {
    // Update UI
    if (btnGrid) btnGrid.classList.add('active');
    if (btnSingle) btnSingle.classList.remove('active');
    if (gridView) gridView.style.display = 'block';
    if (singleView) singleView.style.display = 'none';

    // Stop single playback
    if (window.RussellTV.SinglePlayer) {
      window.RussellTV.SinglePlayer.stop();
    }

    // Clear channel button highlights
    if (window.RussellTV.UIControls) {
      window.RussellTV.UIControls.clearButtonHighlights();
    }

    // Save view preference
    if (window.RussellTV.Storage) {
      window.RussellTV.Storage.saveLastView('grid');
    }

    currentView = 'grid';

    // Load default grid channels
    if (window.RussellTV.GridPlayer) {
      window.RussellTV.GridPlayer.loadDefaults();
    }
  }

  function syncMobileDropdown(channelKey) {
    const mobileSelect = document.getElementById('channel-select-mobile');
    if (mobileSelect) {
      mobileSelect.value = channelKey;
    }
  }

  function getCurrentView() {
    return currentView;
  }

  function initButtons() {
    if (btnSingle) {
      btnSingle.addEventListener('click', () => {
        // Get last viewed channel
        const lastChannel = window.RussellTV.Storage.loadLastChannel() || 
                           (window.CHANNEL_ORDER && window.CHANNEL_ORDER[0]) || 
                           'cbs';
        showSingle(lastChannel);
      });
    }

    if (btnGrid) {
      btnGrid.addEventListener('click', showGrid);
    }
  }

  // Public API
  return {
    showSingle,
    showGrid,
    getCurrentView,
    initButtons
  };
})();
