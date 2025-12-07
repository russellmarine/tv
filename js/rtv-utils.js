(function () {
  'use strict';

  const root = window;
  if (!root.RussellTV) root.RussellTV = {};

  const Utils = {};

  // ---------- DOM helpers ----------
  Utils.$ = function (selector, scope) {
    return (scope || document).querySelector(selector);
  };

  Utils.$$ = function (selector, scope) {
    return Array.prototype.slice.call(
      (scope || document).querySelectorAll(selector)
    );
  };

  Utils.on = function (target, event, handler, opts) {
    if (!target) return;
    target.addEventListener(event, handler, opts || false);
  };

  Utils.onReady = function (fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  };

  // ---------- Time / date formatting ----------
  Utils.formatUserStamp = function (date) {
    if (!date) return '';
    const d = (date instanceof Date) ? date : new Date(date);
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  Utils.formatZulu = function (date) {
    if (!date) return '';
    const d = (date instanceof Date) ? date : new Date(date);
    return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
  };

  Utils.now = function () {
    return new Date();
  };

  // ---------- Number / string ----------
  Utils.clamp = function (value, min, max) {
    return Math.min(max, Math.max(min, value));
  };

  Utils.round = function (value, digits) {
    const factor = Math.pow(10, digits || 0);
    return Math.round(value * factor) / factor;
  };

  // ---------- Coordinate helpers ----------
  Utils.toDMS = function (deg, isLat) {
    if (typeof deg !== 'number' || isNaN(deg)) return '';
    const abs = Math.abs(deg);
    const d = Math.floor(abs);
    const mFloat = (abs - d) * 60;
    const m = Math.floor(mFloat);
    const s = (mFloat - m) * 60;
    const hemi = isLat
      ? (deg >= 0 ? 'N' : 'S')
      : (deg >= 0 ? 'E' : 'W');
    return d + '°' + m + '\'' + Utils.round(s, 1) + '"' + hemi;
  };

  // Haversine distance (km)
  Utils.haversineKm = function (lat1, lon1, lat2, lon2) {
    function toRad(x) { return x * Math.PI / 180; }
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // ---------- Small DOM utilities ----------
  Utils.toggleClass = function (el, className, force) {
    if (!el || !className) return;
    if (typeof force === 'boolean') {
      el.classList.toggle(className, force);
    } else {
      el.classList.toggle(className);
    }
  };

  Utils.setText = function (selectorOrEl, text) {
    const el = (typeof selectorOrEl === 'string')
      ? Utils.$(selectorOrEl)
      : selectorOrEl;
    if (el) el.textContent = text;
  };

  Utils.safeJSON = function (value, fallback) {
    try {
      return JSON.parse(value);
    } catch (e) {
      return (typeof fallback === 'undefined') ? null : fallback;
    }
  };

  root.RussellTV.Utils = Utils;
})();
