/**
 * russellTV-core.js - Core event bus and utilities for RussellTV
 * 
 * This is the foundation that all other modules build upon.
 * Load this FIRST before any other RussellTV scripts.
 * 
 * Architecture:
 * - Simple pub/sub event system
 * - No polling, no race conditions
 * - Debug mode for development
 */

window.RussellTV = window.RussellTV || {};

(function() {
  'use strict';

  // ============ EVENT BUS ============
  
  const listeners = {};
  const firedOnceEvents = new Set();
  let debugMode = false;

  /**
   * Subscribe to an event
   * @param {string} event - Event name
   * @param {function} callback - Handler function
   * @param {object} options - { once: bool } - if true, only fires once
   */
  function on(event, callback, options = {}) {
    if (!listeners[event]) {
      listeners[event] = [];
    }
    listeners[event].push({ callback, once: options.once || false });
    
    if (debugMode) {
      console.log(`📡 [RTV] Subscribed to "${event}"`);
    }
  }

  /**
   * Subscribe to an event, but only fire once
   */
  function once(event, callback) {
    on(event, callback, { once: true });
  }

  /**
   * Unsubscribe from an event
   */
  function off(event, callback) {
    if (!listeners[event]) return;
    listeners[event] = listeners[event].filter(l => l.callback !== callback);
  }

  /**
   * Emit an event
   * @param {string} event - Event name
   * @param {any} data - Data to pass to handlers
   * @param {object} options - { sticky: bool } - if true, late subscribers get it immediately
   */
  function emit(event, data = null, options = {}) {
    if (debugMode) {
      console.log(`📢 [RTV] Emit "${event}"`, data || '');
    }

    // Track sticky/once events
    if (options.sticky) {
      firedOnceEvents.add(event);
    }

    if (!listeners[event]) return;

    // Copy array to avoid mutation during iteration
    const toCall = [...listeners[event]];
    
    toCall.forEach(listener => {
      try {
        listener.callback(data);
      } catch (err) {
        console.error(`[RTV] Error in "${event}" handler:`, err);
      }
    });

    // Remove once listeners
    listeners[event] = listeners[event].filter(l => !l.once);
  }

  /**
   * Check if a sticky event has already fired
   * If so, call the callback immediately
   * Otherwise, subscribe normally
   */
  function whenReady(event, callback) {
    if (firedOnceEvents.has(event)) {
      // Already fired, call immediately
      if (debugMode) {
        console.log(`📡 [RTV] "${event}" already fired, calling immediately`);
      }
      try {
        callback();
      } catch (err) {
        console.error(`[RTV] Error in "${event}" whenReady handler:`, err);
      }
    } else {
      // Not yet fired, subscribe
      once(event, callback);
    }
  }

  /**
   * Enable/disable debug logging
   */
  function setDebug(enabled) {
    debugMode = enabled;
    console.log(`🔧 [RTV] Debug mode ${enabled ? 'ON' : 'OFF'}`);
  }

  // ============ SANITIZATION ============

  /**
   * Sanitize a string for safe innerHTML insertion
   * Prevents XSS from external data sources (API responses, etc.)
   * @param {any} str - String to sanitize
   * @returns {string} - Safe string with HTML entities escaped
   */
  function sanitize(str) {
    if (str == null) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }

  // ============ STORAGE UTILITIES ============

  const STORAGE_PREFIX = 'russelltv.';

  function saveToStorage(key, value) {
    try {
      localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn(`[RTV] Storage save failed for "${key}":`, e);
      return false;
    }
  }

  function loadFromStorage(key, defaultValue = null) {
    try {
      const stored = localStorage.getItem(STORAGE_PREFIX + key);
      return stored ? JSON.parse(stored) : defaultValue;
    } catch (e) {
      console.warn(`[RTV] Storage load failed for "${key}":`, e);
      return defaultValue;
    }
  }

  // ============ DOM UTILITIES ============

  /**
   * Safely get or create an element
   */
  function getOrCreate(id, tagName, parent, attributes = {}) {
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement(tagName);
      el.id = id;
      Object.entries(attributes).forEach(([k, v]) => {
        if (k === 'style' && typeof v === 'object') {
          Object.assign(el.style, v);
        } else if (k === 'className') {
          el.className = v;
        } else {
          el.setAttribute(k, v);
        }
      });
      if (parent) {
        parent.appendChild(el);
      }
    }
    return el;
  }

  // ============ PUBLIC API ============

  window.RussellTV.Events = {
    on,
    once,
    off,
    emit,
    whenReady,
    setDebug
  };

  window.RussellTV.Storage = {
    save: saveToStorage,
    load: loadFromStorage,
    // Legacy compatibility
    saveLastChannel: (key) => saveToStorage('lastChannel', key),
    loadLastChannel: () => loadFromStorage('lastChannel'),
    saveLastView: (view) => saveToStorage('lastView', view),
    loadLastView: () => loadFromStorage('lastView'),
    saveFeatureToggles: (features) => saveToStorage('featureToggles', features),
    loadFeatureToggles: () => loadFromStorage('featureToggles')
  };

  window.RussellTV.DOM = {
    getOrCreate
  };

  window.RussellTV.sanitize = sanitize;

  // ============ INITIALIZATION ============

  // Fire core ready event
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.RussellTV.Events.emit('core:ready', null, { sticky: true });
    });
  } else {
    window.RussellTV.Events.emit('core:ready', null, { sticky: true });
  }

  console.log('✅ [RTV] Core initialized');

})();
