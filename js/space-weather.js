/**
 * space-weather.js - Space weather data fetching and processing
 * FIXED VERSION - improved Kp index parsing and data consistency
 */

window.RussellTV = window.RussellTV || {};

window.RussellTV.SpaceWeather = (function() {
  'use strict';

  let currentData = null;
  let lastUpdate = null;
  
  // Store raw fetched data so other components can access it
  let rawKpData = null;
  let rawScalesData = null;

  async function fetchSpaceWeather() {
    try {
      const config = window.SPACE_WEATHER_CONFIG;
      
      // Fetch NOAA scales (primary data source)
      const scalesResponse = await fetch(config.endpoints.scales);
      const scalesData = await scalesResponse.json();
      rawScalesData = scalesData;
      
      // Fetch Kp index
      const kpResponse = await fetch(config.endpoints.kIndex);
      const kpData = await kpResponse.json();
      rawKpData = kpData;
      
      // Parse and store data
      currentData = parseSpaceWeatherData(scalesData, kpData);
      lastUpdate = new Date();
      
      console.log('🛰️ Space weather data updated:', currentData);
      
      // Dispatch custom event so other components can react to updates
      window.dispatchEvent(new CustomEvent('spaceweather:updated', { 
        detail: currentData 
      }));
      
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
    
    // FIX: Better Kp index parsing
    const kpIndex = parseKpIndex(kpData);
    
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

  /**
   * FIX: Improved Kp index parsing
   * NOAA Kp data format: [["time_tag", "kp", ...], ["2024-01-01 00:00:00", "2.33", ...], ...]
   * Sometimes has header row, sometimes values have + or - suffixes
   */
  function parseKpIndex(kpData) {
    if (!kpData || !Array.isArray(kpData) || kpData.length === 0) {
      console.warn('⚠️ Kp data is empty or invalid');
      return 0;
    }
    
    // Find the last valid data entry (skip header row if present)
    let latestKp = null;
    
    // Start from the end and work backwards to find valid data
    for (let i = kpData.length - 1; i >= 0; i--) {
      const entry = kpData[i];
      
      // Skip if not an array or too short
      if (!Array.isArray(entry) || entry.length < 2) continue;
      
      // Skip header row (first element is string like "time_tag")
      if (entry[0] === 'time_tag' || entry[1] === 'kp' || entry[1] === 'Kp') continue;
      
      // Try to parse the Kp value
      const kpValue = parseKpValue(entry[1]);
      if (!isNaN(kpValue)) {
        latestKp = kpValue;
        console.log(`🛰️ Parsed Kp index: ${kpValue} from entry:`, entry);
        break;
      }
    }
    
    if (latestKp === null) {
      console.warn('⚠️ Could not find valid Kp value in data');
      return 0;
    }
    
    return latestKp;
  }

  /**
   * Parse a Kp value that might have suffixes like "2+", "3-", "2.33", or "2o"
   */
  function parseKpValue(value) {
    if (value === null || value === undefined) return NaN;
    
    // Convert to string for processing
    let str = String(value).trim();
    
    // Handle empty string
    if (str === '') return NaN;
    
    // Remove any suffix characters and adjust value
    // NOAA uses: number (e.g., "3"), plus (e.g., "3+"), minus (e.g., "3-"), or decimal (e.g., "2.67")
    if (str.endsWith('+')) {
      // "3+" means 3.33
      return parseFloat(str.slice(0, -1)) + 0.33;
    } else if (str.endsWith('-')) {
      // "3-" means 2.67
      return parseFloat(str.slice(0, -1)) - 0.33;
    } else if (str.endsWith('o') || str.endsWith('O')) {
      // Sometimes "o" is used for "0" or as a suffix
      return parseFloat(str.slice(0, -1));
    }
    
    // Standard numeric value
    return parseFloat(str);
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
  
  // FIX: Expose raw data for other components that need it
  function getRawKpData() {
    return rawKpData;
  }
  
  function getRawScalesData() {
    return rawScalesData;
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
    getRawKpData,
    getRawScalesData,
    getLastUpdate,
    getStatusIcon,
    getStatusLabel,
    getDetailedStatus,
    startAutoUpdate,
    // FIX: Expose parser for other components to use
    parseKpValue
  };
})();

// Auto-start updates on load
window.addEventListener('load', () => {
  if (window.RussellTV?.SpaceWeather) {
    window.RussellTV.SpaceWeather.startAutoUpdate();
  }
});
