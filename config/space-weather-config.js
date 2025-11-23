/**
 * space-weather-config.js - Configuration for space weather data
 */

window.SPACE_WEATHER_CONFIG = {
  // API endpoints (via nginx proxy)
  endpoints: {
    scales: '/api/spaceweather/noaa-scales.json',
    kIndex: '/api/spaceweather/noaa-planetary-k-index.json',
    forecast: '/api/spaceweather/3-day-forecast.json',
    solarWind: '/api/spaceweather/solar-wind/mag-1-day.json'
  },

  // Update interval (milliseconds)
  updateInterval: 15 * 60 * 1000, // 15 minutes

  // Frequency band thresholds and labels
  bands: {
    hf: {
      label: 'HF Radio',
      icon: '📻',
      frequencies: '3-30 MHz',
      uses: 'Long-range comms, emergency radio',
      scaleType: 'R' // Radio blackout scale
    },
    gps: {
      label: 'GPS/GNSS',
      icon: '🛰️',
      frequencies: 'L1/L2/L5',
      uses: 'Navigation, positioning, timing',
      scaleType: 'S' // Solar radiation storm scale
    },
    satcom: {
      label: 'SATCOM',
      icon: '📡',
      frequencies: 'C/Ku/Ka/X Band',
      uses: 'Satellite communications',
      scaleType: 'G' // Geomagnetic storm scale
    },
    vhf: {
      label: 'VHF/UHF',
      icon: '📞',
      frequencies: '30-3000 MHz',
      uses: 'Line-of-sight comms, radar',
      scaleType: 'R'
    }
  },

  // Status levels
  statusLevels: {
    green: {
      color: '#00ff00',
      label: 'Normal',
      icon: '🟢',
      description: 'No significant impacts expected'
    },
    yellow: {
      color: '#ffff00',
      label: 'Minor',
      icon: '🟡',
      description: 'Minor degradation possible'
    },
    orange: {
      color: '#ff8800',
      label: 'Moderate',
      icon: '🟠',
      description: 'Moderate impacts likely'
    },
    red: {
      color: '#ff0000',
      label: 'Severe',
      icon: '🔴',
      description: 'Significant disruption expected'
    }
  },

  // NOAA scale interpretations
  scaleThresholds: {
    R: { // Radio Blackouts (affects HF)
      0: 'green',
      1: 'green',
      2: 'yellow',
      3: 'orange',
      4: 'red',
      5: 'red'
    },
    S: { // Solar Radiation Storms (affects GPS/satellites)
      0: 'green',
      1: 'green',
      2: 'yellow',
      3: 'orange',
      4: 'red',
      5: 'red'
    },
    G: { // Geomagnetic Storms (affects power grids, satcom)
      0: 'green',
      1: 'green',
      2: 'yellow',
      3: 'orange',
      4: 'red',
      5: 'red'
    }
  },

  // Kp Index thresholds
  kpThresholds: {
    0: 'green',
    1: 'green',
    2: 'green',
    3: 'green',
    4: 'yellow',
    5: 'yellow',
    6: 'orange',
    7: 'orange',
    8: 'red',
    9: 'red'
  }
};
