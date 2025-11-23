/**
 * propagation-panel.js - HF Propagation prediction panel
 * Shows MUF, best bands, and conditions for selected location
 */

window.RussellTV = window.RussellTV || {};

window.RussellTV.PropagationPanel = (function() {
  'use strict';

  let panelVisible = false;
  let solarData = null;

  // Solar flux and sunspot data (we'll fetch from NOAA)
  async function fetchSolarData() {
    try {
      // NOAA Solar Flux data
      const solarResponse = await fetch('/api/spaceweather/text/daily-solar-indices.txt');
      const solarText = await solarResponse.text();
      
      // Parse the data (format: date, SSN, radio flux, etc.)
      const lines = solarText.trim().split('\n');
      const dataLine = lines[lines.length - 1]; // Most recent
      const parts = dataLine.split(/\s+/);
      
      solarData = {
        solarFlux: parseFloat(parts[3]) || 150, // SFI (10.7cm flux)
        sunspotNumber: parseInt(parts[1]) || 50, // SSN
        aIndex: parseFloat(parts[4]) || 10, // A-index
        kIndex: parseFloat(parts[5]) || 2 // K-index
      };
      
      console.log('☀️ Solar data fetched:', solarData);
      return solarData;
    } catch (error) {
      console.warn('Could not fetch solar data, using defaults:', error);
      // Default moderate conditions
      solarData = {
        solarFlux: 150,
        sunspotNumber: 50,
        aIndex: 10,
        kIndex: 2
      };
      return solarData;
    }
  }

  // Calculate MUF based on solar flux and time of day
  function calculateMUF(solarFlux, isDay) {
    // Simplified MUF calculation
    // MUF ≈ foF2 × 3.0 (skip distance factor)
    // foF2 varies with solar flux and local time
    
    const baseMUF = Math.sqrt(solarFlux / 100) * 10; // Rough approximation
    const timeFactor = isDay ? 1.2 : 0.7; // Day vs night
    
    return baseMUF * timeFactor;
  }

  // Determine best bands based on conditions
  function getBestBands(muf, conditions) {
    const bands = [];
    
    // 80m (3.5-4.0 MHz) - Night, low solar activity
    if (!conditions.isDay && muf > 5) {
      bands.push({ band: '80m', freq: '3.5-4.0 MHz', quality: 'good', note: 'Night DX' });
    }
    
    // 40m (7.0-7.3 MHz) - All times, reliable
    if (muf > 8) {
      bands.push({ 
        band: '40m', 
        freq: '7.0-7.3 MHz', 
        quality: conditions.isDay ? 'fair' : 'excellent', 
        note: conditions.isDay ? 'NVIS/Regional' : 'Long DX' 
      });
    }
    
    // 30m (10.1-10.15 MHz) - Good for DX
    if (muf > 12) {
      bands.push({ band: '30m', freq: '10.1-10.15 MHz', quality: 'good', note: 'Digital modes' });
    }
    
    // 20m (14.0-14.35 MHz) - Best DX band
    if (muf > 18 && conditions.isDay) {
      bands.push({ band: '20m', freq: '14.0-14.35 MHz', quality: 'excellent', note: 'Best DX' });
    } else if (muf > 18) {
      bands.push({ band: '20m', freq: '14.0-14.35 MHz', quality: 'good', note: 'DX possible' });
    }
    
    // 17m (18.068-18.168 MHz) - Day DX
    if (muf > 22 && conditions.isDay) {
      bands.push({ band: '17m', freq: '18.068-18.168 MHz', quality: 'good', note: 'Day DX' });
    }
    
    // 15m (21.0-21.45 MHz) - High solar activity
    if (muf > 25 && conditions.isDay && conditions.solarFlux > 120) {
      bands.push({ band: '15m', freq: '21.0-21.45 MHz', quality: 'excellent', note: 'High activity' });
    }
    
    // 12m (24.89-24.99 MHz) - Peak conditions
    if (muf > 28 && conditions.isDay && conditions.solarFlux > 140) {
      bands.push({ band: '12m', freq: '24.89-24.99 MHz', quality: 'good', note: 'Peak times' });
    }
    
    // 10m (28.0-29.7 MHz) - Solar max
    if (muf > 32 && conditions.solarFlux > 150) {
      bands.push({ band: '10m', freq: '28.0-29.7 MHz', quality: 'fair', note: 'Solar max' });
    }
    
    if (bands.length === 0) {
      bands.push({ band: '40m', freq: '7.0-7.3 MHz', quality: 'fair', note: 'Poor conditions' });
    }
    
    return bands;
  }

  function createPanel() {
    if (document.getElementById('propagation-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'propagation-panel';
    panel.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      width: 380px;
      max-height: 80vh;
      overflow-y: auto;
      background: rgba(0, 0, 0, 0.95);
      border: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: 12px;
      padding: 1rem;
      z-index: 9999;
      display: none;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.8);
      color: white;
      font-size: 0.9rem;
    `;

    panel.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <h3 style="margin: 0; font-size: 1.1rem;">📡 HF Propagation</h3>
        <button id="close-prop-panel" style="background: none; border: none; color: white; font-size: 1.5rem; cursor: pointer; padding: 0; width: 30px; height: 30px;">&times;</button>
      </div>
      
      <div id="prop-content">
        <div style="text-align: center; padding: 2rem; opacity: 0.7;">
          Loading conditions...
        </div>
      </div>
    `;

    document.body.appendChild(panel);

    // Close button
    document.getElementById('close-prop-panel').addEventListener('click', hide);

    // Close when clicking outside
    document.addEventListener('click', (e) => {
      if (panelVisible && !panel.contains(e.target) && !e.target.closest('#propagation-panel-btn')) {
        hide();
      }
    });

    updatePanelContent();
  }

  async function updatePanelContent() {
    if (!solarData) {
      await fetchSolarData();
    }

    const content = document.getElementById('prop-content');
    if (!content) return;

    // Get current time and location
    const now = new Date();
    const hour = now.getUTCHours();
    const isDay = hour >= 6 && hour < 18; // Rough day/night

    // Calculate MUF
    const muf = calculateMUF(solarData.solarFlux, isDay);
    
    // Get space weather data
    const swData = window.RussellTV?.SpaceWeather?.getCurrentData();
    
    // Determine conditions
    const conditions = {
      isDay,
      solarFlux: solarData.solarFlux,
      sunspotNumber: solarData.sunspotNumber,
      kIndex: swData?.kpIndex || solarData.kIndex,
      rScale: swData?.scales.R || 0
    };

    // Get best bands
    const bestBands = getBestBands(muf, conditions);

    // Build HTML
    let html = `
      <div style="background: rgba(255, 255, 255, 0.05); border-radius: 8px; padding: 0.75rem; margin-bottom: 1rem;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; font-size: 0.85rem;">
          <div>
            <div style="opacity: 0.7; font-size: 0.75rem;">Solar Flux</div>
            <div style="font-size: 1.1rem; font-weight: bold; color: #ff9900;">${solarData.solarFlux.toFixed(0)} sfu</div>
          </div>
          <div>
            <div style="opacity: 0.7; font-size: 0.75rem;">Sunspot #</div>
            <div style="font-size: 1.1rem; font-weight: bold;">${solarData.sunspotNumber}</div>
          </div>
          <div>
            <div style="opacity: 0.7; font-size: 0.75rem;">MUF (Max Usable)</div>
            <div style="font-size: 1.1rem; font-weight: bold; color: #00ff00;">${muf.toFixed(1)} MHz</div>
          </div>
          <div>
            <div style="opacity: 0.7; font-size: 0.75rem;">Kp Index</div>
            <div style="font-size: 1.1rem; font-weight: bold;">${conditions.kIndex.toFixed(1)}</div>
          </div>
        </div>
      </div>

      <div style="margin-bottom: 1rem;">
        <div style="font-weight: bold; margin-bottom: 0.5rem; font-size: 0.95rem;">Current Conditions:</div>
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; font-size: 0.8rem;">
          <span style="background: ${isDay ? 'rgba(255,200,0,0.2)' : 'rgba(0,100,255,0.2)'}; padding: 0.25rem 0.5rem; border-radius: 4px;">
            ${isDay ? '☀️ Daytime' : '🌙 Nighttime'}
          </span>
          <span style="background: rgba(255,255,255,0.1); padding: 0.25rem 0.5rem; border-radius: 4px;">
            ${solarData.solarFlux > 150 ? '📈 High' : solarData.solarFlux > 100 ? '📊 Moderate' : '📉 Low'} Activity
          </span>
          ${conditions.rScale > 0 ? `
            <span style="background: rgba(255,0,0,0.3); padding: 0.25rem 0.5rem; border-radius: 4px;">
              ⚠️ R${conditions.rScale} Blackout
            </span>
          ` : ''}
        </div>
      </div>

      <div style="margin-bottom: 1rem;">
        <div style="font-weight: bold; margin-bottom: 0.5rem; font-size: 0.95rem;">Best Bands Now:</div>
        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
    `;

    bestBands.forEach(band => {
      const qualityColor = {
        'excellent': '#00ff00',
        'good': '#ffff00',
        'fair': '#ff9900'
      }[band.quality] || '#888';

      html += `
        <div style="background: rgba(255,255,255,0.05); border-left: 3px solid ${qualityColor}; padding: 0.5rem; border-radius: 4px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
            <span style="font-weight: bold; font-size: 0.95rem;">${band.band}</span>
            <span style="color: ${qualityColor}; font-size: 0.8rem; text-transform: uppercase;">${band.quality}</span>
          </div>
          <div style="font-size: 0.8rem; opacity: 0.8;">${band.freq}</div>
          <div style="font-size: 0.75rem; opacity: 0.7; margin-top: 0.25rem;">${band.note}</div>
        </div>
      `;
    });

    html += `
        </div>
      </div>

      <div style="background: rgba(255,255,255,0.05); border-radius: 8px; padding: 0.75rem; font-size: 0.8rem;">
        <div style="font-weight: bold; margin-bottom: 0.5rem;">External Resources:</div>
        <a href="https://weatherspotter.net/propagation.php" target="_blank" 
           style="color: #ff9900; text-decoration: none; display: block; margin-bottom: 0.3rem;"
           onmouseover="this.style.color='#ffbb00'" onmouseout="this.style.color='#ff9900'">
          📊 Live Propagation Maps →
        </a>
        <a href="https://www.voacap.com/prediction.html" target="_blank"
           style="color: #ff9900; text-decoration: none; display: block; margin-bottom: 0.3rem;"
           onmouseover="this.style.color='#ffbb00'" onmouseout="this.style.color='#ff9900'">
          📡 VOACAP Path Predictions →
        </a>
        <a href="https://www.hamqsl.com/solar.html" target="_blank"
           style="color: #ff9900; text-decoration: none; display: block;"
           onmouseover="this.style.color='#ffbb00'" onmouseout="this.style.color='#ff9900'">
          ☀️ Solar Data & Charts →
        </a>
      </div>

      <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.2); font-size: 0.75rem; opacity: 0.6; text-align: center;">
        Updated: ${new Date().toLocaleTimeString()}
      </div>
    `;

    content.innerHTML = html;
  }

  function show() {
    const panel = document.getElementById('propagation-panel');
    if (!panel) {
      createPanel();
      return;
    }

    panel.style.display = 'block';
    panelVisible = true;
    updatePanelContent();
    
    console.log('📡 Propagation panel opened');
  }

  function hide() {
    const panel = document.getElementById('propagation-panel');
    if (panel) {
      panel.style.display = 'none';
      panelVisible = false;
    }
  }

  function toggle() {
    if (panelVisible) {
      hide();
    } else {
      show();
    }
  }

  // Auto-update every 15 minutes
  setInterval(() => {
    if (panelVisible) {
      fetchSolarData().then(updatePanelContent);
    }
  }, 15 * 60 * 1000);

  // Initialize
  window.addEventListener('load', () => {
    createPanel();
    fetchSolarData(); // Pre-fetch data
  });

  // Public API
  return {
    show,
    hide,
    toggle,
    update: updatePanelContent
  };
})();
