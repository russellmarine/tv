/**
 * player-single.js - Single view video player management
 * Handles HLS playback for the single-channel view
 */

window.RussellTV = window.RussellTV || {};

window.RussellTV.SinglePlayer = (function() {
  'use strict';

  let hlsInstance = null;
  let currentChannel = null;
  const playerElement = document.getElementById('single-player-hls');

  function stop() {
    if (hlsInstance) {
      hlsInstance.destroy();
      hlsInstance = null;
    }
    if (playerElement) {
      playerElement.pause();
      playerElement.removeAttribute('src');
      playerElement.load();
    }
    currentChannel = null;
  }

  function play(channelKey) {
    if (!window.CHANNELS || !window.CHANNELS[channelKey]) {
      console.warn('Channel not found:', channelKey);
      return;
    }

    const channel = window.CHANNELS[channelKey];
    stop();

    currentChannel = channelKey;

    // Save to storage
    if (window.RussellTV.Storage) {
      window.RussellTV.Storage.saveLastChannel(channelKey);
    }

    // Load channel headlines if available
    try {
      if (window.loadChannelHeadlines) {
        window.loadChannelHeadlines(channelKey, channel.label || channelKey);
      }
    } catch (e) {
      console.warn('Error loading channel headlines:', e);
    }

    // Play HLS stream
    if (window.Hls && Hls.isSupported()) {
      hlsInstance = new Hls({ lowLatencyMode: true });
      hlsInstance.loadSource(channel.url);
      hlsInstance.attachMedia(playerElement);
    } else if (playerElement.canPlayType('application/vnd.apple.mpegurl')) {
      playerElement.src = channel.url;
    }
  }

  function getCurrentChannel() {
    return currentChannel;
  }

  // Public API
  return {
    play,
    stop,
    getCurrentChannel
  };
})();
