/**
 * storage.js - LocalStorage management for Russell TV
 * Handles saving/loading channel selections and view preferences
 */

window.RussellTV = window.RussellTV || {};

window.RussellTV.Storage = (function() {
  'use strict';

  const KEYS = {
    channel: 'russelltv.lastChannel',
    view: 'russelltv.lastView'
  };

  function saveLastChannel(key) {
    try {
      localStorage.setItem(KEYS.channel, key);
    } catch (e) {
      console.warn('Could not save last channel:', e);
    }
  }

  function loadLastChannel() {
    try {
      return localStorage.getItem(KEYS.channel);
    } catch (e) {
      return null;
    }
  }

  function saveLastView(view) {
    try {
      localStorage.setItem(KEYS.view, view);
    } catch (e) {
      console.warn('Could not save last view:', e);
    }
  }

  function loadLastView() {
    try {
      return localStorage.getItem(KEYS.view);
    } catch (e) {
      return null;
    }
  }

  // Public API
  return {
    saveLastChannel,
    loadLastChannel,
    saveLastView,
    loadLastView
  };
})();
