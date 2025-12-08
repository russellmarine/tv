/**
 * SpaceWeatherCard.js
 * Displays NOAA SWPC space weather data (R/S/G scales, Kp index, X-ray flux, sunspots)
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
    SOLAR_CYCLE: '/api/spaceweather/json/solar-cycle/observed-solar-cycle-indices.json',
    XRAY: '/api/spaceweather/json/goes/primary/xrays-1-day.json'
  };

  const UPDATE_INTERVAL = 5 * 60 * 1000; // 5 minutes
  const STORAGE_KEY = 'commSpaceWeatherCache';

  const SCALE_LINKS = {
    R: 'https://www.swpc.noaa.gov/noaa-scales-explanation',
    S: 'https://www.swpc.noaa.gov/noaa-scales-explanation',
    G: 'https://www.swpc.noaa.gov/noaa-scales-explanation'
  };

  const SCALE_TOOLTIPS = {
    R: 'Radio blackouts from X-ray flares',
    S: 'Solar radiation storms from protons',
    G: 'Geomagnetic storms from solar wind'
  };

  const XRAY_THRESHOLDS = {
    R5: 2e-3,
    R4: 1e-3,
    R3: 1e-4,
    R2: 5e-5,
    R1: 1e-5
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
      this.xrayData = null;
      this.lastUpdate = null;
      this.updateTimer = null;
    }

    init() {
      super.init();
      this.loadCached();
      this.fetchData();
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
        const [scales, kpIndex, sunspots, xray] = await Promise.all([
          this.fetchScales(),
          this.fetchKpIndex(),
          this.fetchSunspots(),
          this.fetchXray()
        ]);

        if (scales && kpIndex !== null) {
          this.data = {
            scales,
            kpIndex,
            xray: xray || this.xrayData,
            timestamp: new Date()
          };
          this.sunspotData = sunspots || this.sunspotData;
          this.xrayData = xray || this.xrayData;
          this.lastUpdate = new Date();

          this.cacheData();
          this.render();

          Events.emit('spaceweather:data-updated', this.data);
        }
      } catch (err) {
        console.warn('[SpaceWeatherCard] Fetch error:', err);
      }
    }

    async fetchScales() {
      try {
        const resp = await fetch(ENDPOINTS.SCALES);
        if (!resp.ok) return null;

        const data = await resp.json();
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
        const resp = await fetch(ENDPOINTS.KP_INDEX);
        if (!resp.ok) return null;

        const data = await resp.json();
        if (Array.isArray(data) && data.length > 1) {
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
        const resp = await fetch(ENDPOINTS.SOLAR_CYCLE);
        if (!resp.ok) return [];

        const data = await resp.json();
        if (Array.isArray(data)) {
          return data
            .slice(-60)
            .map(d => ({
              date: d['time-tag'] || d.time_tag || d.date,
              value: parseFloat(d.ssn || d.sunspot_number || d['ssn-total'] || 0)
            }))
            .filter(d => !isNaN(d.value));
        }
        return [];
      } catch (err) {
        console.warn('[SpaceWeatherCard] Sunspot fetch error:', err);
        return [];
      }
    }

    async fetchXray() {
      try {
        const resp = await fetch(ENDPOINTS.XRAY);
        if (!resp.ok) return null;

        const data = await resp.json();
        if (Array.isArray(data) && data.length > 0) {
          for (let i = data.length - 1; i >= 0; i--) {
            const entry = data[i];
            const flux = parseFloat(entry.flux || entry.current_flux || 0);
            if (flux > 0) {
              return {
                flux,
                fluxClass: this.classifyXrayFlux(flux),
                satellite: entry.satellite || 'GOES',
                energy: entry.energy || '0.1-0.8nm',
                timestamp: entry.time_tag || entry.timestamp
              };
            }
          }
        }
        return null;
      } catch (err) {
        console.warn('[SpaceWeatherCard] X-ray fetch error:', err);
        return null;
      }
    }

    classifyXrayFlux(flux) {
      if (flux >= 1e-4) {
        const level = flux / 1e-4;
        return `X${level.toFixed(1)}`;
      } else if (flux >= 1e-5) {
        const level = flux / 1e-5;
        return `M${level.toFixed(1)}`;
      } else if (flux >= 1e-6) {
        const level = flux / 1e-6;
        return `C${level.toFixed(1)}`;
      } else if (flux >= 1e-7) {
        const level = flux / 1e-7;
        return `B${level.toFixed(1)}`;
      } else {
        const level = flux / 1e-8;
        return `A${level.toFixed(1)}`;
      }
    }

    getXrayRScale(flux) {
      if (flux >= XRAY_THRESHOLDS.R5) return 5;
      if (flux >= XRAY_THRESHOLDS.R4) return 4;
      if (flux >= XRAY_THRESHOLDS.R3) return 3;
      if (flux >= XRAY_THRESHOLDS.R2) return 2;
      if (flux >= XRAY_THRESHOLDS.R1) return 1;
      return 0;
    }

    // ============================================================
    // Caching
    // ============================================================

    loadCached() {
      const cached = Storage.get(STORAGE_KEY);
      if (cached && cached.data && cached.timestamp) {
        const age = Date.now() - new Date(cached.timestamp).getTime();
        if (age < 30 * 60 * 1000) {
          this.data = cached.data;
          this.sunspotData = cached.sunspots || [];
          this.xrayData = cached.xray || null;
          this.lastUpdate = new Date(cached.timestamp);
          this.render();
        }
      }
    }

    cacheData() {
      Storage.set(STORAGE_KEY, {
        data: this.data,
        sunspots: this.sunspotData,
        xray: this.xrayData,
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

      return `
        <div class="spacewx-summary-row">
          <div class="spacewx-summary-desc">${escapeHtml(overall.desc)}</div>
        </div>
        
        ${this.renderScaleCards()}
        ${this.renderMetricsRow()}
        ${this.renderSunspotChart()}
        ${this.renderDefinitions()}
        
        <div class="comm-card-micro comm-card-footer">
          Source: <a class="inline-link" href="https://www.swpc.noaa.gov" target="_blank" rel="noopener noreferrer">NOAA SWPC</a> · 
          <a class="inline-link" href="https://www.swpc.noaa.gov/products/goes-x-ray-flux" target="_blank" rel="noopener noreferrer">GOES X-ray</a> • 
          ${this.getUpdateText()}
        </div>
      `;
    }

    renderScaleCards() {
      const cards = [
        { key: 'R', label: 'Radio', sub: 'X-ray Flux' },
        { key: 'S', label: 'Solar', sub: 'Sunspots' },
        { key: 'G', label: 'Geomag', sub: 'Kp Index' }
      ].map(({ key, label, sub }) => {
        const value = this.data.scales[key];
        const color = this.getScaleColor(value);
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
            <div class="scale-driver">${sub} ↓</div>
          </a>
        `;
      }).join('');

      return `<div class="spacewx-scales-row">${cards}</div>`;
    }

    renderMetricsRow() {
      const xray = this.xrayData;
      const rScale = xray ? this.getXrayRScale(xray.flux) : 0;
      const xrayColor = this.getScaleColor(rScale);

      const sunspot = this.sunspotData.length > 0 
        ? Math.round(this.sunspotData[this.sunspotData.length - 1].value) 
        : null;
      const sunspotColor = this.getSunspotColor(sunspot);

      const kpColor = this.getKpColor(this.data.kpIndex);
      const kpCondition = this.getKpCondition(this.data.kpIndex);

      return `
        <div class="spacewx-metrics-row">
          <a class="spacewx-metric-card" 
             href="https://www.swpc.noaa.gov/products/goes-x-ray-flux" 
             target="_blank" rel="noopener noreferrer">
            <span class="metric-label">X-ray Flux</span>
            <span class="metric-value" style="color: ${xrayColor};">${xray ? xray.fluxClass : '--'}</span>
            <span class="metric-status">${rScale > 0 ? 'R' + rScale + ' level' : 'Background'}</span>
          </a>
          
          <a class="spacewx-metric-card" 
             href="https://www.swpc.noaa.gov/products/solar-cycle-progression" 
             target="_blank" rel="noopener noreferrer">
            <span class="metric-label">Sunspot #</span>
            <span class="metric-value" style="color: ${sunspotColor};">${sunspot !== null ? sunspot : '--'}</span>
            <span class="metric-status">${this.getSunspotCondition(sunspot)}</span>
          </a>
          
          <a class="spacewx-metric-card" 
             href="https://www.swpc.noaa.gov/products/planetary-k-index" 
             target="_blank" rel="noopener noreferrer">
            <span class="metric-label">Kp Index</span>
            <span class="metric-value" style="color: ${kpColor};">${this.data.kpIndex.toFixed(2)}</span>
            <span class="metric-status">${kpCondition}</span>
          </a>
        </div>
      `;
    }

    renderSunspotChart() {
      const data = this.sunspotData;
      if (data.length < 2) return '';

      const width = 320;
      const height = 100;
      const padding = { top: 8, right: 12, bottom: 22, left: 32 };
      const chartWidth = width - padding.left - padding.right;
      const chartHeight = height - padding.top - padding.bottom;

      const values = data.map(d => d.value);
      const minVal = 0;
      const maxVal = Math.ceil(Math.max(...values) / 50) * 50;
      const valueRange = maxVal - minVal || 1;

      const points = data.map((d, i) => {
        const x = padding.left + (i / (data.length - 1)) * chartWidth;
        const y = padding.top + chartHeight - ((d.value - minVal) / valueRange) * chartHeight;
        return { x, y, value: d.value, date: d.date };
      });

      const linePoints = points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

      const areaPoints = [
        `${padding.left},${padding.top + chartHeight}`,
        ...points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`),
        `${padding.left + chartWidth},${padding.top + chartHeight}`
      ].join(' ');

      // Y-axis ticks
      const yTicks = [];
      const tickCount = 4;
      for (let i = 0; i <= tickCount; i++) {
        const val = minVal + (valueRange * i / tickCount);
        const y = padding.top + chartHeight - (i / tickCount) * chartHeight;
        yTicks.push({ y, label: Math.round(val) });
      }

      // X-axis labels
      const xLabels = [];
      const labelInterval = Math.floor(data.length / 4);
      for (let i = 0; i < data.length; i += labelInterval) {
        const d = data[i];
        const x = padding.left + (i / (data.length - 1)) * chartWidth;
        xLabels.push({ x, label: this.formatChartDate(d.date) });
      }
      if (data.length > 1) {
        xLabels.push({
          x: padding.left + chartWidth,
          label: this.formatChartDate(data[data.length - 1].date)
        });
      }

      const gridLines = yTicks.slice(1, -1).map(tick =>
        `<line x1="${padding.left}" y1="${tick.y}" x2="${padding.left + chartWidth}" y2="${tick.y}" 
               stroke="rgba(255,200,150,0.12)" stroke-dasharray="2,2"/>`
      ).join('');

      return `
        <div class="spacewx-chart-block">
          <div class="chart-title">Solar Cycle Trend (5 yr)</div>
          <svg class="spacewx-chart-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
            <defs>
              <linearGradient id="sunspotAreaGrad" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stop-color="#ffa94d" stop-opacity="0.35"/>
                <stop offset="100%" stop-color="#ff7f32" stop-opacity="0.05"/>
              </linearGradient>
              <linearGradient id="sunspotLineGrad" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stop-color="#ff8c42"/>
                <stop offset="100%" stop-color="#ffd700"/>
              </linearGradient>
            </defs>
            
            ${gridLines}
            
            <line x1="${padding.left}" y1="${padding.top}" 
                  x2="${padding.left}" y2="${padding.top + chartHeight}" 
                  stroke="rgba(255,200,150,0.4)" stroke-width="1"/>
            
            <line x1="${padding.left}" y1="${padding.top + chartHeight}" 
                  x2="${padding.left + chartWidth}" y2="${padding.top + chartHeight}" 
                  stroke="rgba(255,200,150,0.4)" stroke-width="1"/>
            
            ${yTicks.map(tick => `
              <text x="${padding.left - 6}" y="${tick.y + 3}" 
                    fill="rgba(255,220,180,0.6)" font-size="8" text-anchor="end">${tick.label}</text>
            `).join('')}
            
            ${xLabels.map(label => `
              <text x="${label.x}" y="${padding.top + chartHeight + 12}" 
                    fill="rgba(255,220,180,0.6)" font-size="7" text-anchor="middle">${label.label}</text>
            `).join('')}
            
            <polygon points="${areaPoints}" fill="url(#sunspotAreaGrad)"/>
            
            <polyline points="${linePoints}" fill="none" stroke="url(#sunspotLineGrad)" 
                      stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            
            <circle cx="${points[points.length - 1].x}" cy="${points[points.length - 1].y}" 
                    r="3" fill="#ffd700" stroke="#fff" stroke-width="1"/>
          </svg>
        </div>
      `;
    }

    formatChartDate(dateStr) {
      if (!dateStr) return '';
      try {
        const date = new Date(dateStr);
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
          'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const month = months[date.getMonth()];
        const year = String(date.getFullYear()).slice(-2);
        return `${month}'${year}`;
      } catch (e) {
        return '';
      }
    }

    renderDefinitions() {
      return `
        <div class="spacewx-definitions">
          <details class="comm-definition">
            <summary>What is X-ray Flux?</summary>
            <div class="definition-body">
              <p>X-ray flux measures solar flare intensity in the 0.1–0.8nm band, detected by GOES satellites. 
                 Higher flux causes HF radio absorption on Earth's sunlit side.</p>
              <div class="def-scale">
                <span class="def-item" style="--def-color: #44cc44">A/B: Quiet</span>
                <span class="def-item" style="--def-color: #88cc44">C: Minor</span>
                <span class="def-item" style="--def-color: #ffcc00">M1–M4: Moderate</span>
                <span class="def-item" style="--def-color: #ff8800">M5–M9: Strong</span>
                <span class="def-item" style="--def-color: #ff4444">X: Severe</span>
              </div>
            </div>
          </details>
          
          <details class="comm-definition">
            <summary>What is Sunspot Number?</summary>
            <div class="definition-body">
              <p>The International Sunspot Number (SSN) tracks solar activity in the ~11-year solar cycle. 
                 More sunspots mean more flares, CMEs, and potential radio disruptions.</p>
              <div class="def-scale">
                <span class="def-item" style="--def-color: #44cc44">&lt;50: Solar Min</span>
                <span class="def-item" style="--def-color: #88cc44">50–100: Rising</span>
                <span class="def-item" style="--def-color: #ffcc00">100–150: Active</span>
                <span class="def-item" style="--def-color: #ff8800">150–200: High</span>
                <span class="def-item" style="--def-color: #ff4444">&gt;200: Solar Max</span>
              </div>
            </div>
          </details>
          
          <details class="comm-definition">
            <summary>What is Kp Index?</summary>
            <div class="definition-body">
              <p>The Planetary K-index (Kp) measures geomagnetic disturbance from solar wind. 
                 Higher Kp causes aurora, HF absorption at high latitudes, and GPS degradation.</p>
              <div class="def-scale">
                <span class="def-item" style="--def-color: #44cc44">0–2: Quiet</span>
                <span class="def-item" style="--def-color: #88cc44">3: Unsettled</span>
                <span class="def-item" style="--def-color: #ffcc00">4: Active</span>
                <span class="def-item" style="--def-color: #ff8800">5–6: Storm</span>
                <span class="def-item" style="--def-color: #ff4444">7–9: Severe</span>
              </div>
            </div>
          </details>
        </div>
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

    getSunspotColor(ssn) {
      if (ssn === null) return '#888';
      if (ssn >= 200) return '#ff4444';
      if (ssn >= 150) return '#ff8800';
      if (ssn >= 100) return '#ffcc00';
      if (ssn >= 50) return '#88cc44';
      return '#44cc44';
    }

    getSunspotCondition(ssn) {
      if (ssn === null) return 'Loading';
      if (ssn >= 200) return 'Solar Max';
      if (ssn >= 150) return 'High';
      if (ssn >= 100) return 'Active';
      if (ssn >= 50) return 'Moderate';
      return 'Solar Min';
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

    getMetaText() {
      if (!this.data) return '';

      const overall = this.getOverallStatus();
      return `<span class="spacewx-pill ${overall.className}">${escapeHtml(overall.label)}</span>`;
    }

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

  window.CommDashboard.SpaceWeatherCard = SpaceWeatherCard;

})();
