/**
 * player-grid.js - Grid view video player management
 * Handles HLS playback for the 4-cell grid view
 */

window.RussellTV = window.RussellTV || {};

window.RussellTV.GridPlayer = (function() {
  'use strict';

  const hlsInstances = {};
  const GRID_SIZE = 4;

  function stopAll() {
    for (let cell = 1; cell <= GRID_SIZE; cell++) {
      stopCell(cell);
    }
  }

  function stopCell(cell) {
    // Destroy HLS instance
    if (hlsInstances[cell]) {
      hlsInstances[cell].destroy();
      delete hlsInstances[cell];
    }

    // Stop video element
    const video = document.getElementById(`grid-video-${cell}`);
    if (video) {
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
  }

  function playCell(cell, channelKey) {
    if (!window.CHANNELS || !window.CHANNELS[channelKey]) {
      console.warn('Channel not found:', channelKey);
      return;
    }

    const channel = window.CHANNELS[channelKey];
    const video = document.getElementById(`grid-video-${cell}`);
    const label = document.getElementById(`label-cell-${cell}`);

    if (!video) {
      console.warn('Grid video element not found for cell:', cell);
      return;
    }

    // Update label if it exists
    if (label) {
      label.textContent = channel.label;
    }

    // Stop current playback in this cell
    stopCell(cell);

    // Start new HLS stream
    if (window.Hls && Hls.isSupported()) {
      const hls = new Hls({ lowLatencyMode: true });
      hls.loadSource(channel.url);
      hls.attachMedia(video);
      hlsInstances[cell] = hls;
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = channel.url;
    }
  }

  function loadDefaults() {
    if (!window.GRID_DEFAULTS) return;

    for (let cell = 1; cell <= GRID_SIZE; cell++) {
      const defaultKey = window.GRID_DEFAULTS[cell];
      if (!defaultKey) continue;

      // Update selector if it exists
      const selector = document.querySelector(`select[data-cell="${cell}"]`);
      if (selector) {
        selector.value = defaultKey;
      }

      playCell(cell, defaultKey);
    }
  }

  // Public API
  return {
    playCell,
    stopAll,
    stopCell,
    loadDefaults
  };
})();

// Expose playCell globally for grid-state.js compatibility
window.playGridCell = function(cell, key) {
  window.RussellTV.GridPlayer.playCell(cell, key);
};
