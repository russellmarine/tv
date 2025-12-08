/**
 * SpaceWeatherCard.js
 * Displays NOAA SWPC space weather data (R/S/G scales, Kp index, sunspots)
 * Emits: 'spaceweather:data-updated' when new data is fetched
 */

(function () {
  'use strict';

  const { BaseCard, Events, Storage, Layout, escapeHtml } = window.CommDashboard;

  // ============================================================
  // Constants
  // ============================================================
  const ENDPOINTS = {
    SCALES: '/api/spaceweather/noaa-scales.json',
    KP_INDEX: '/api/spaceweather/noaa-planetary-k-index.json',
    SOLAR_CYCLE: '/api/spaceweather/json/solar-cycle/observed-solar-cycle.json'
  };

  const FALLBACK_ENDPOINTS = {
    SCALES: 'https://services.swpc.noaa.gov/products/noaa-scales.json',
    KP_INDEX: 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index-1-minute.json',
    SOLAR_CYCLE: 'https://services.swpc.noaa.gov/json/solar-cycle/observed-solar-cycle.json'
  };

  const UPDATE_INTERVAL = 5 * 60 * 1000; // 5 minutes
  const STORAGE_KEY = 'commSpaceWeatherCache';

  const SCALE_LINKS = {
    R: 'https://www.swpc.noaa.gov/noaa-scales-explanation',
    S: 'https://www.swpc.noaa.gov/noaa-scales-explanation',
    G: 'https://www.swpc.noaa.gov/noaa-scales-explanation'
  };

  const SCALE_TOOLTIPS = {
    R: 'R-scale: HF radio blackouts driven by X-ray flares (R1 minor → R5 extreme).',
    S: 'S-scale: Solar radiation storms. Energetic protons causing HF disruption at high latitudes.',
    G: 'G-scale: Geomagnetic storms from CMEs/solar wind. Can trigger aurora, absorption, and scintillation.'
  };

  // ============================================================
  // SpaceWeatherCard Class
  // ============================================================
  class SpaceWeatherCard extends BaseCard {
    constructor() {
      super({
        id: 'comm-card-spacewx',
        title: 'Space Weather',
        metaId: 'comm-spacewx-meta'
      });

      this.data = null;
      this.sunspotData = [];
      this.lastUpdate = null;
      this.updateTimer = null;
    }

    init() {
      super.init();
      
      // Try to load cached data first
      this.loadCached();
      
      // Fetch fresh data
      this.fetchData();
      
      // Set up periodic updates
      this.updateTimer = this.setInterval(() => this.fetchData(), UPDATE_INTERVAL);
    }

    destroy() {
      if (this.updateTimer) {
        clearInterval(this.updateTimer);
      }
      super.destroy();
    }

    // ============================================================
    // Data Fetching
    // ============================================================

    async fetchData() {
      try {
        const [scales, kpIndex, sunspots] = await Promise.all([
          this.fetchScales(),
          this.fetchKpIndex(),
          this.fetchSunspots()
        ]);

        if (scales && kpIndex !== null) {
          this.data = {
            scales,
            kpIndex,
            timestamp: new Date()
          };
          this.sunspotData = sunspots || this.sunspotData;
          this.lastUpdate = new Date();

          this.cacheData();
          this.render();

          // Emit event for downstream cards
          Events.emit('spaceweather:data-updated', this.data);
        }
      } catch (err) {
        console.warn('[SpaceWeatherCard] Fetch error:', err);
        // Keep showing cached/existing data
      }
    }

    async fetchScales() {
      try {
        let resp = await fetch(ENDPOINTS.SCALES);
        if (!resp.ok) {
          resp = await fetch(FALLBACK_ENDPOINTS.SCALES);
        }
        if (!resp.ok) return null;

        const data = await resp.json();
        // NOAA scales format: { "0": {..., "R": {...}, "S": {...}, "G": {...}} }
        // We want the current values (index 0)
        const current = data['0'] || data[0] || data;
        
        return {
          R: this.parseScaleValue(current.R?.Scale || current.R || 0),
          S: this.parseScaleValue(current.S?.Scale || current.S || 0),
          G: this.parseScaleValue(current.G?.Scale || current.G || 0)
        };
      } catch (err) {
        console.warn('[SpaceWeatherCard] Scales fetch error:', err);
        return null;
      }
    }

    parseScaleValue(val) {
      if (typeof val === 'number') return Math.min(5, Math.max(0, val));
      if (typeof val === 'string') {
        const num = parseInt(val.replace(/\D/g, ''), 10);
        return isNaN(num) ? 0 : Math.min(5, Math.max(0, num));
      }
      return 0;
    }

    async fetchKpIndex() {
      try {
        let resp = await fetch(ENDPOINTS.KP_INDEX);
        if (!resp.ok) {
          resp = await fetch(FALLBACK_ENDPOINTS.KP_INDEX);
        }
        if (!resp.ok) return null;

        const data = await resp.json();
        // Get most recent Kp value
        if (Array.isArray(data) && data.length > 1) {
          // Skip header row, get last entry
          const latest = data[data.length - 1];
          const kp = parseFloat(latest[1] || latest.kp_index || latest.Kp || 0);
          return isNaN(kp) ? 0 : kp;
        }
        return 0;
      } catch (err) {
        console.warn('[SpaceWeatherCard] Kp fetch error:', err);
        return null;
      }
    }

    async fetchSunspots() {
      try {
        let resp = await fetch(ENDPOINTS.SOLAR_CYCLE);
        if (!resp.ok) {
          resp = await fetch(FALLBACK_ENDPOINTS.SOLAR_CYCLE);
        }
        if (!resp.ok) return [];

        const data = await resp.json();
        // Extract recent sunspot numbers
        if (Array.isArray(data)) {
          return data
            .slice(-60) // Last 60 entries (5 years monthly)
            .map(d => ({
              date: d['time-tag'] || d.time_tag || d.date,
              value: parseFloat(d.ssn || d.sunspot_number || d.SUNSPOTS || 0)
            }))
            .filter(d => !isNaN(d.value));
        }
        return [];
      } catch (err) {
        console.warn('[SpaceWeatherCard] Sunspot fetch error:', err);
        return [];
      }
    }

    // ============================================================
    // Caching
    // ============================================================

    loadCached() {
      const cached = Storage.get(STORAGE_KEY);
      if (cached && cached.data && cached.timestamp) {
        const age = Date.now() - new Date(cached.timestamp).getTime();
        // Use cache if less than 30 minutes old
        if (age < 30 * 60 * 1000) {
          this.data = cached.data;
          this.sunspotData = cached.sunspots || [];
          this.lastUpdate = new Date(cached.timestamp);
          this.render();
        }
      }
    }

    cacheData() {
      Storage.set(STORAGE_KEY, {
        data: this.data,
        sunspots: this.sunspotData,
        timestamp: this.lastUpdate?.toISOString()
      });
    }

    // ============================================================
    // Rendering
    // ============================================================

    renderBody() {
      if (!this.data) {
        return '<p class="comm-placeholder">Loading space weather data...</p>';
      }

      const overall = this.getOverallStatus();
      const kpColor = this.getKpColor(this.data.kpIndex);
      const kpCondition = this.getKpCondition(this.data.kpIndex);

      return `
        <div class="spacewx-summary-row">
          <div class="spacewx-summary-desc">${escapeHtml(overall.desc)}</div>
        </div>
        
        ${this.renderScaleCards()}
        
        <a class="spacewx-kp-row tooltip-target" 
           href="https://www.swpc.noaa.gov/products/planetary-k-index" 
           target="_blank" 
           rel="noopener noreferrer"
           data-tooltip="Planetary K index (0–9) measures geomagnetic disturbance. Kp≥5 is storm level.">
          <span class="label">Kp Index</span>
          <span class="value" style="color: ${kpColor};">${this.data.kpIndex.toFixed(2)}</span>
          <span class="status">${kpCondition}</span>
        </a>
        
        ${this.renderSunspotBlock()}
        ${this.renderKpDefinition()}
        
        <div class="comm-card-micro comm-card-footer">
          Source: <a class="inline-link" href="https://www.swpc.noaa.gov" target="_blank" rel="noopener noreferrer">NOAA SWPC</a> · 
          <a class="inline-link" href="https://www.swpc.noaa.gov/products/space-weather-scales" target="_blank" rel="noopener noreferrer">NOAA Scales</a> • 
          ${this.getUpdateText()}
        </div>
      `;
    }

    renderScaleCards() {
      const cards = ['R', 'S', 'G'].map(key => {
        const value = this.data.scales[key];
        const color = this.getScaleColor(value);
        const label = key === 'R' ? 'Radio' : key === 'S' ? 'Solar' : 'Geomag';
        const desc = this.getScaleDescription(key, value);

        return `
          <a class="spacewx-scale-card tooltip-target" 
             href="${SCALE_LINKS[key]}" 
             target="_blank" 
             rel="noopener noreferrer"
             data-tooltip="${escapeHtml(SCALE_TOOLTIPS[key])}">
            <div class="label">${label}</div>
            <div class="value" style="color: ${color}">${key}${value}</div>
            <div class="desc">${desc}</div>
          </a>
        `;
      }).join('');

      return `<div class="spacewx-scales-row">${cards}</div>`;
    }

    renderSunspotBlock() {
      if (!this.sunspotData.length) return '';

      const latest = this.sunspotData[this.sunspotData.length - 1];
      const latestValue = latest ? Math.round(latest.value) : '—';
      const sparkline = this.renderSparkline();

      return `
        <div class="spacewx-sunspot-block">
          <div class="sunspot-meta">
            <div class="sunspot-label">Sunspot Number</div>
            <div class="sunspot-value">${escapeHtml(String(latestValue))}</div>
          </div>
          <div class="sunspot-chart">${sparkline}</div>
        </div>
      `;
    }

    renderSparkline() {
      const data = this.sunspotData;
      if (data.length < 2) return '';

      const recent = data.slice(-24).map(d => d.value);
      const width = 200;
      const height = 48;
      const min = Math.min(...recent);
      const max = Math.max(...recent);
      const span = max - min || 1;
      const step = recent.length > 1 ? width / (recent.length - 1) : width;

      const points = recent.map((v, idx) => {
        const x = idx * step;
        const y = height - ((v - min) / span) * height;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(' ');

      return `
        <svg class="sunspot-spark" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
          <defs>
            <linearGradient id="sunspotGrad" x1="0" x2="0" y1="0" y2="1">
              <stop stop-color="#ffa94d" stop-opacity="0.9"/>
              <stop offset="1" stop-color="#ff7f32" stop-opacity="0.25"/>
            </linearGradient>
          </defs>
          <polyline points="${points}" fill="none" stroke="url(#sunspotGrad)" 
                    stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `;
    }

    renderKpDefinition() {
      const kpScale = [
        { label: 'Kp < 3', desc: 'Quiet', color: '#44cc44' },
        { label: 'Kp = 3', desc: 'Unsettled', color: '#88cc44' },
        { label: 'Kp = 4', desc: 'Active', color: '#ffcc00' },
        { label: 'Kp = 5', desc: 'Minor storm', color: '#ff9900' },
        { label: 'Kp ≥ 6', desc: 'Storm/Severe', color: '#ff4444' }
      ].map(item => `
        <div class="kp-segment" style="--kp-color: ${item.color}">
          <span>${escapeHtml(item.label)}</span>
          <small>${escapeHtml(item.desc)}</small>
        </div>
      `).join('');

      return `
        <details class="comm-definition">
          <summary>What is Kp?</summary>
          <div class="definition-body">
            <div class="kp-scale" aria-label="Kp scale">${kpScale}</div>
            <p>The K-index and Planetary K-index (Kp) characterize geomagnetic storm magnitude. 
               Kp is used to decide when to issue alerts for users impacted by geomagnetic disturbances.</p>
            <p>Primary users affected include power-grid operators, spacecraft controllers, 
               HF/VHF radio users, and aurora observers. Higher Kp indicates stronger geomagnetic 
               activity and greater disruption risk.</p>
            <div class="spacewx-footnote">R = HF Radio Blackouts · S = Solar Radiation · G = Geomagnetic Storms</div>
          </div>
        </details>
      `;
    }

    // ============================================================
    // Status Calculations
    // ============================================================

    getOverallStatus() {
      const r = this.data?.scales?.R || 0;
      const s = this.data?.scales?.S || 0;
      const g = this.data?.scales?.G || 0;
      const kp = this.data?.kpIndex || 0;

      const kpScore = kp >= 7 ? 4 : kp >= 6 ? 3 : kp >= 5 ? 2 : kp >= 4 ? 2 : 0;
      const severityScore = Math.max(r, s, g, kpScore);

      if (severityScore >= 4) {
        return {
          className: 'severity-poor',
          label: 'Severe',
          desc: 'Strong storms in progress. Expect widespread HF absorption and SATCOM scintillation.'
        };
      }
      if (severityScore >= 3) {
        return {
          className: 'severity-watch',
          label: 'Watch',
          desc: 'Active disturbances. Monitor HF MUF/LUF shifts and increased SATCOM fading.'
        };
      }
      if (severityScore >= 2) {
        return {
          className: 'severity-fair',
          label: 'Elevated',
          desc: 'Minor solar activity; slight HF degradation or positioning jitter possible.'
        };
      }
      return {
        className: 'severity-good',
        label: 'Calm',
        desc: 'Nominal conditions. Routine HF, SATCOM, and GPS performance expected.'
      };
    }

    getScaleColor(value) {
      if (value >= 4) return '#ff4444';
      if (value >= 3) return '#ff8800';
      if (value >= 2) return '#ffcc00';
      if (value >= 1) return '#88cc44';
      return '#44cc44';
    }

    getScaleDescription(type, value) {
      const descriptions = {
        R: ['None', 'Minor', 'Moderate', 'Strong', 'Severe', 'Extreme'],
        S: ['None', 'Minor', 'Moderate', 'Strong', 'Severe', 'Extreme'],
        G: ['Quiet', 'Minor', 'Moderate', 'Strong', 'Severe', 'Extreme']
      };
      return (descriptions[type] && descriptions[type][value]) || 'Unknown';
    }

    getKpColor(kp) {
      if (kp >= 6) return '#ff4444';
      if (kp >= 5) return '#ff8800';
      if (kp >= 4) return '#ffcc00';
      if (kp >= 3) return '#88cc44';
      return '#44cc44';
    }

    getKpCondition(kp) {
      if (kp >= 6) return 'Storm/Severe';
      if (kp >= 5) return 'Minor storm';
      if (kp >= 4) return 'Active';
      if (kp >= 3) return 'Unsettled';
      return 'Quiet';
    }

    getUpdateText() {
      if (!this.lastUpdate) return 'Loading...';
      
      const now = new Date();
      const diff = now - this.lastUpdate;
      const mins = Math.floor(diff / 60000);
      
      if (mins < 1) return 'Just updated';
      if (mins < 60) return `Updated ${mins}m ago`;
      
      return `Updated ${this.lastUpdate.toLocaleTimeString()}`;
    }

    // ============================================================
    // Header Status
    // ============================================================

    getMetaText() {
      if (!this.data) return '';
      
      const overall = this.getOverallStatus();
      return `<span class="spacewx-pill ${overall.className}">${escapeHtml(overall.label)}</span>`;
    }

    // ============================================================
    // Public API
    // ============================================================

    getData() {
      return this.data;
    }

    getLastUpdate() {
      return this.lastUpdate;
    }

    refresh() {
      this.fetchData();
    }
  }

  // ============================================================
  // Register Card
  // ============================================================
  window.CommDashboard.SpaceWeatherCard = SpaceWeatherCard;

})();
