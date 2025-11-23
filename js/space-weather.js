/**
 * space-weather.js - Space weather data fetching and processing
 */

window.RussellTV = window.RussellTV || {};

window.RussellTV.SpaceWeather = (function() {
  'use strict';

  let currentData = null;
  let lastUpdate = null;

  async function fetchSpaceWeather() {
    try {
      const config = window.SPACE_WEATHER_CONFIG;
      
      // Fetch NOAA scales (primary data source)
      const scalesResponse = await fetch(config.endpoints.scales);
      const scalesData = await scalesResponse.json();
      
      // Fetch Kp index
      const kpResponse = await fetch(config.endpoints.kIndex);
      const kpData = await kpResponse.json();
      
      // Parse and store data
      currentData = parseSpaceWeatherData(scalesData, kpData);
      lastUpdate = new Date();
      
      console.log('🛰️ Space weather data updated:', currentData);
      
      return currentData;
    } catch (error) {
      console.error('❌ Error fetching space weather:', error);
      return null;
    }
  }

  function parseSpaceWeatherData(scalesData, kpData) {
    const config = window.SPACE_WEATHER_CONFIG;
    
    // NOAA scales are in format: [date, R-scale, S-scale, G-scale, ...]
    // Most recent data is typically the last entry or "-1" index
    const latest = scalesData[scalesData.length - 1] || scalesData[0];
    
    const rScale = parseInt(latest['R']) || 0; // Radio blackout
    const sScale = parseInt(latest['S']) || 0; // Solar radiation
    const gScale = parseInt(latest['G']) || 0; // Geomagnetic
    
    // Get current Kp index (last entry)
    const latestKp = kpData[kpData.length - 1] || kpData[0];
    const kpIndex = parseFloat(latestKp[1]) || 0;
    
    return {
      timestamp: new Date(latest[0] || Date.now()),
      scales: {
        R: rScale,
        S: sScale,
        G: gScale
      },
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

  function getStatusForScale(scaleType, scaleValue) {
    const config = window.SPACE_WEATHER_CONFIG;
    const threshold = config.scaleThresholds[scaleType];
    return threshold[scaleValue] || 'green';
  }

  function getOverallStatus(rScale, sScale, gScale) {
    const maxScale = Math.max(rScale, sScale, gScale);
    
    if (maxScale >= 4) return 'red';
    if (maxScale >= 3) return 'orange';
    if (maxScale >= 2) return 'yellow';
    return 'green';
  }

  function getCurrentData() {
    return currentData;
  }

  function getLastUpdate() {
    return lastUpdate;
  }

  function getStatusIcon(status) {
    const config = window.SPACE_WEATHER_CONFIG;
    return config.statusLevels[status]?.icon || '⚪';
  }

  function getStatusLabel(status) {
    const config = window.SPACE_WEATHER_CONFIG;
    return config.statusLevels[status]?.label || 'Unknown';
  }

  function getDetailedStatus(bandKey) {
    if (!currentData) return null;
    
    const config = window.SPACE_WEATHER_CONFIG;
    const band = config.bands[bandKey];
    const status = currentData.status[bandKey];
    const statusInfo = config.statusLevels[status];
    
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
    
    // Initial fetch
    fetchSpaceWeather();
    
    // Set up periodic updates
    setInterval(fetchSpaceWeather, config.updateInterval);
    
    console.log(`🛰️ Space weather auto-update enabled (every ${config.updateInterval / 60000} minutes)`);
  }

  // Public API
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

// Auto-start updates on load
window.addEventListener('load', () => {
  if (window.RussellTV?.SpaceWeather) {
    window.RussellTV.SpaceWeather.startAutoUpdate();
  }
});
