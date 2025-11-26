/**
 * storage.js - LocalStorage management for Russell TV
 * Handles saving/loading channel selections, view preferences, and feature toggles
 */
window.RussellTV = window.RussellTV || {};
window.RussellTV.Storage = (function() {
  'use strict';
  
  const KEYS = {
    channel: 'russelltv.lastChannel',
    view: 'russelltv.lastView',
    features: 'russelltv.featureToggles'
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
  
  /**
   * Save feature toggle states
   * @param {Object} features - Object with feature keys and boolean values
   */
  function saveFeatureToggles(features) {
    try {
      localStorage.setItem(KEYS.features, JSON.stringify(features));
    } catch (e) {
      console.warn('Could not save feature toggles:', e);
    }
  }
  
  /**
   * Load feature toggle states
   * @returns {Object|null} - Saved feature states or null if none saved
   */
  function loadFeatureToggles() {
    try {
      const stored = localStorage.getItem(KEYS.features);
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      console.warn('Could not load feature toggles:', e);
      return null;
    }
  }
  
  // Public API
  return {
    saveLastChannel,
    loadLastChannel,
    saveLastView,
    loadLastView,
    saveFeatureToggles,
    loadFeatureToggles
  };
})();
