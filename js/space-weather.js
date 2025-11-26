/**
 * space-weather.js - Space weather data fetching and processing
 * 
 * Events Emitted:
 * - 'spaceweather:data-updated' - When new data is fetched
 * 
 * Events Listened:
 * - 'core:ready' - Start auto-updates
 */

window.RussellTV = window.RussellTV || {};

window.RussellTV.SpaceWeather = (function() {
  'use strict';

  const Events = window.RussellTV?.Events;

  let currentData = null;
  let lastUpdate = null;

  // ============ DATA FETCHING ============

  async function fetchSpaceWeather() {
    try {
      const config = window.SPACE_WEATHER_CONFIG;
      if (!config) {
        console.warn('[SpaceWeather] Config not found');
        return null;
      }

      // Fetch NOAA scales
      const scalesResponse = await fetch(config.endpoints.scales);
      const scalesData = await scalesResponse.json();

      // Fetch Kp index
      const kpResponse = await fetch(config.endpoints.kIndex);
      const kpData = await kpResponse.json();

      currentData = parseSpaceWeatherData(scalesData, kpData);
      lastUpdate = new Date();

      console.log('🛰️ Space weather data updated:', currentData);

      if (Events) {
        Events.emit('spaceweather:data-updated', currentData);
      }

      return currentData;
    } catch (error) {
      console.error('❌ Error fetching space weather:', error);
      return null;
    }
  }

  function parseSpaceWeatherData(scalesData, kpData) {
    const config = window.SPACE_WEATHER_CONFIG;

    const latest = scalesData[scalesData.length - 1] || scalesData[0];

    const rScale = parseInt(latest['R']) || 0;
    const sScale = parseInt(latest['S']) || 0;
    const gScale = parseInt(latest['G']) || 0;

    const kpIndex = parseKpIndex(kpData);

    return {
      timestamp: new Date(latest[0] || Date.now()),
      scales: { R: rScale, S: sScale, G: gScale },
      kpIndex: kpIndex,
      status: {
        hf: getStatusForScale('R', rScale),
        gps: getStatusForScale('S', sScale),
        satcom: getStatusForScale('G', gScale),
        vhf: getStatusForScale('R', rScale)
      },
      overall: getOverallStatus(rScale, sScale, gScale)
    };
  }

  function parseKpIndex(kpData) {
    if (!kpData || !Array.isArray(kpData) || kpData.length === 0) {
      return 0;
    }

    for (let i = kpData.length - 1; i >= 0; i--) {
      const entry = kpData[i];
      if (!Array.isArray(entry) || entry.length < 2) continue;
      if (entry[0] === 'time_tag' || entry[1] === 'kp') continue;

      const kpValue = parseKpValue(entry[1]);
      if (!isNaN(kpValue)) {
        return kpValue;
      }
    }

    return 0;
  }

  function parseKpValue(value) {
    if (value === null || value === undefined) return NaN;

    let str = String(value).trim();
    if (str === '') return NaN;

    if (str.endsWith('+')) {
      return parseFloat(str.slice(0, -1)) + 0.33;
    } else if (str.endsWith('-')) {
      return parseFloat(str.slice(0, -1)) - 0.33;
    } else if (str.endsWith('o') || str.endsWith('O')) {
      return parseFloat(str.slice(0, -1));
    }

    return parseFloat(str);
  }

  function getStatusForScale(scaleType, scaleValue) {
    const config = window.SPACE_WEATHER_CONFIG;
    const threshold = config?.scaleThresholds?.[scaleType];
    return threshold?.[scaleValue] || 'green';
  }

  function getOverallStatus(rScale, sScale, gScale) {
    const maxScale = Math.max(rScale, sScale, gScale);
    if (maxScale >= 4) return 'red';
    if (maxScale >= 3) return 'orange';
    if (maxScale >= 2) return 'yellow';
    return 'green';
  }

  // ============ PUBLIC API ============

  function getCurrentData() {
    return currentData;
  }

  function getLastUpdate() {
    return lastUpdate;
  }

  function getStatusIcon(status) {
    const config = window.SPACE_WEATHER_CONFIG;
    return config?.statusLevels?.[status]?.icon || '⚪';
  }

  function getStatusLabel(status) {
    const config = window.SPACE_WEATHER_CONFIG;
    return config?.statusLevels?.[status]?.label || 'Unknown';
  }

  function getDetailedStatus(bandKey) {
    if (!currentData) return null;

    const config = window.SPACE_WEATHER_CONFIG;
    const band = config?.bands?.[bandKey];
    const status = currentData.status[bandKey];
    const statusInfo = config?.statusLevels?.[status];

    if (!band || !statusInfo) return null;

    return {
      band: band.label,
      icon: band.icon,
      status: statusInfo.label,
      statusIcon: statusInfo.icon,
      color: statusInfo.color,
      description: statusInfo.description,
      frequencies: band.frequencies,
      uses: band.uses
    };
  }

  function startAutoUpdate() {
    const config = window.SPACE_WEATHER_CONFIG;
    const interval = config?.updateInterval || 300000;

    // Initial fetch
    fetchSpaceWeather();

    // Periodic updates
    setInterval(fetchSpaceWeather, interval);

    console.log(`🛰️ Space weather auto-update enabled (every ${interval / 60000} minutes)`);
  }

  // ============ INITIALIZATION ============

  function init() {
    if (window.SPACE_WEATHER_CONFIG) {
      startAutoUpdate();
    } else {
      // Wait for config
      const checkConfig = setInterval(() => {
        if (window.SPACE_WEATHER_CONFIG) {
          clearInterval(checkConfig);
          startAutoUpdate();
        }
      }, 100);

      // Give up after 10 seconds
      setTimeout(() => clearInterval(checkConfig), 10000);
    }
  }

  // Start when ready
  if (Events) {
    Events.whenReady('core:ready', init);
  } else {
    // Fallback if core not loaded yet
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }

  return {
    fetch: fetchSpaceWeather,
    getCurrentData,
    getLastUpdate,
    getStatusIcon,
    getStatusLabel,
    getDetailedStatus,
    startAutoUpdate
  };
})();
