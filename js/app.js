/**
 * app.js - Russell TV Application Bootstrap
 * Initializes all modules and restores saved state
 */

(function() {
  'use strict';

  function channelExists(key) {
    return !!(window.CHANNELS && window.CHANNELS[key]);
  }

  function getDefaultChannel() {
    if (window.CHANNEL_ORDER && window.CHANNEL_ORDER.length > 0) {
      return window.CHANNEL_ORDER[0];
    }
    return 'cbs';
  }

  function initialize() {
    console.log('Initializing Russell TV...');

    // Build UI components
    if (window.RussellTV.UIControls) {
      window.RussellTV.UIControls.buildChannelButtons();
      window.RussellTV.UIControls.buildGrid();
    }

    // Initialize mobile UI
    if (window.RussellTV.MobileUI) {
      window.RussellTV.MobileUI.initChannelDropdown();
      window.RussellTV.MobileUI.initTicker();
    }

    // Initialize view manager buttons
    if (window.RussellTV.ViewManager) {
      window.RussellTV.ViewManager.initButtons();
    }

    // Restore saved state
    const savedView = window.RussellTV.Storage.loadLastView();
    const savedChannel = window.RussellTV.Storage.loadLastChannel();

    let initialChannel = getDefaultChannel();
    if (savedChannel && channelExists(savedChannel)) {
      initialChannel = savedChannel;
    }

    // Restore view
    if (savedView === 'grid') {
      window.RussellTV.ViewManager.showGrid();
    } else {
      window.RussellTV.ViewManager.showSingle(initialChannel);
    }

    console.log('Russell TV initialized successfully');
  }

  // Wait for DOM and dependencies to be ready
  window.addEventListener('load', initialize);
})();
