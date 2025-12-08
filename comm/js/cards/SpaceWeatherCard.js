/**
 * SpaceWeatherCard.js
 * Displays NOAA SWPC space weather data
 */

(function () {
  'use strict';

  const { BaseCard, Events, Storage, Layout, escapeHtml } = window.CommDashboard;

  const ENDPOINTS = {
    SCALES: '/api/spaceweather/noaa-scales.json',
    KP_INDEX: '/api/spaceweather/noaa-planetary-k-index.json',
    SOLAR_CYCLE: '/api/spaceweather/json/solar-cycle/observed-solar-cycle-indices.json',
    XRAY: '/api/spaceweather/json/goes/primary/xrays-1-day.json'
  };

  const UPDATE_INTERVAL = 5 * 60 * 1000;
  const STORAGE_KEY = 'commSpaceWeatherCache';

  const XRAY_THRESHOLDS = { R5: 2e-3, R4: 1e-3, R3: 1e-4, R2: 5e-5, R1: 1e-5 };

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
      if (this.updateTimer) clearInterval(this.updateTimer);
      super.destroy();
    }

    async fetchData() {
      try {
        const [scales, kpIndex, sunspots, xray] = await Promise.all([
          this.fetchScales(),
          this.fetchKpIndex(),
          this.fetchSunspots(),
          this.fetchXray()
        ]);

        if (scales && kpIndex !== null) {
          this.data = { scales, kpIndex, xray: xray || this.xrayData, timestamp: new Date() };
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
          return data.slice(-60).map(d => ({
            date: d['time-tag'] || d.time_tag || d.date,
            value: parseFloat(d.ssn || d.sunspot_number || d['ssn-total'] || 0)
          })).filter(d => !isNaN(d.value));
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
        const text = await resp.text();
        // Clean up potentially malformed JSON
        const cleanText = text.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
        const data = JSON.parse(cleanText);
        if (Array.isArray(data) && data.length > 0) {
          for (let i = data.length - 1; i >= 0; i--) {
            const entry = data[i];
            const flux = parseFloat(entry.flux || entry.current_flux || 0);
            if (flux > 0) {
              return {
                flux,
                fluxClass: this.classifyXrayFlux(flux),
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
      if (flux >= 1e-4) return `X${(flux / 1e-4).toFixed(1)}`;
      if (flux >= 1e-5) return `M${(flux / 1e-5).toFixed(1)}`;
      if (flux >= 1e-6) return `C${(flux / 1e-6).toFixed(1)}`;
      if (flux >= 1e-7) return `B${(flux / 1e-7).toFixed(1)}`;
      return `A${(flux / 1e-8).toFixed(1)}`;
    }

    getXrayRScale(flux) {
      if (flux >= XRAY_THRESHOLDS.R5) return 5;
      if (flux >= XRAY_THRESHOLDS.R4) return 4;
      if (flux >= XRAY_THRESHOLDS.R3) return 3;
      if (flux >= XRAY_THRESHOLDS.R2) return 2;
      if (flux >= XRAY_THRESHOLDS.R1) return 1;
      return 0;
    }

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
        <div class="spacewx-connector-row">
          <div class="spacewx-connector"></div>
          <div class="spacewx-connector"></div>
          <div class="spacewx-connector"></div>
        </div>
        ${this.renderMetricsRow()}
        ${this.renderSunspotChart()}
        ${this.renderDefinitions()}
        <div class="comm-card-micro comm-card-footer">
          Source: <a class="inline-link" href="https://www.swpc.noaa.gov" target="_blank">NOAA SWPC</a> · 
          <a class="inline-link" href="https://www.swpc.noaa.gov/products/goes-x-ray-flux" target="_blank">GOES X-ray</a> • 
          ${this.getUpdateText()}
        </div>
      `;
    }

    renderScaleCards() {
      const scales = [
        { key: 'R', label: 'Radio', tip: 'HF blackouts from X-ray flares' },
        { key: 'S', label: 'Solar', tip: 'Radiation storms from protons' },
        { key: 'G', label: 'Geomag', tip: 'Geomagnetic storms from solar wind' }
      ];

      const cards = scales.map(({ key, label, tip }) => {
        const value = this.data.scales[key];
        const color = this.getScaleColor(value);
        const desc = this.getScaleDescription(key, value);
        return `
          <a class="spacewx-scale-card" href="https://www.swpc.noaa.gov/noaa-scales-explanation" 
             target="_blank" title="${tip}">
            <div class="scale-label">${label}</div>
            <div class="scale-value" style="color: ${color}">${key}${value}</div>
            <div class="scale-desc">${desc}</div>
          </a>
        `;
      }).join('');

      return `<div class="spacewx-scales-row">${cards}</div>`;
    }

    renderMetricsRow() {
      // X-ray Flux (drives R-scale)
      const xray = this.xrayData;
      const rScale = xray ? this.getXrayRScale(xray.flux) : 0;
      const xrayColor = this.getScaleColor(rScale);
      const xrayValue = xray ? xray.fluxClass : '--';
      const xrayStatus = rScale > 0 ? `R${rScale} level` : 'Background';

      // Sunspot Number (drives S-scale activity)
      const ssn = this.sunspotData.length > 0 
        ? Math.round(this.sunspotData[this.sunspotData.length - 1].value) 
        : null;
      const ssnColor = this.getSunspotColor(ssn);
      const ssnValue = ssn !== null ? ssn : '--';
      const ssnStatus = this.getSunspotCondition(ssn);

      // Kp Index (drives G-scale)
      const kp = this.data.kpIndex;
      const kpColor = this.getKpColor(kp);
      const kpValue = kp.toFixed(2);
      const kpStatus = this.getKpCondition(kp);

      return `
        <div class="spacewx-metrics-row">
          <a class="spacewx-metric-card" href="https://www.swpc.noaa.gov/products/goes-x-ray-flux" target="_blank">
            <span class="metric-label">X-ray Flux</span>
            <span class="metric-value" style="color: ${xrayColor}">${xrayValue}</span>
            <span class="metric-status">${xrayStatus}</span>
          </a>
          <a class="spacewx-metric-card" href="https://www.swpc.noaa.gov/products/solar-cycle-progression" target="_blank">
            <span class="metric-label">Sunspot #</span>
            <span class="metric-value" style="color: ${ssnColor}">${ssnValue}</span>
            <span class="metric-status">${ssnStatus}</span>
          </a>
          <a class="spacewx-metric-card" href="https://www.swpc.noaa.gov/products/planetary-k-index" target="_blank">
            <span class="metric-label">Kp Index</span>
            <span class="metric-value" style="color: ${kpColor}">${kpValue}</span>
            <span class="metric-status">${kpStatus}</span>
          </a>
        </div>
      `;
    }

    renderSunspotChart() {
      const data = this.sunspotData;
      if (data.length < 2) return '';

      const width = 300, height = 90;
      const pad = { top: 6, right: 10, bottom: 18, left: 28 };
      const w = width - pad.left - pad.right;
      const h = height - pad.top - pad.bottom;

      const values = data.map(d => d.value);
      const maxVal = Math.ceil(Math.max(...values) / 50) * 50 || 250;

      const points = data.map((d, i) => {
        const x = pad.left + (i / (data.length - 1)) * w;
        const y = pad.top + h - (d.value / maxVal) * h;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      });

      const area = [`${pad.left},${pad.top + h}`, ...points, `${pad.left + w},${pad.top + h}`].join(' ');

      // Y ticks
      const yTicks = [0, maxVal / 2, maxVal].map((val, i) => {
        const y = pad.top + h - (i / 2) * h;
        return `<text x="${pad.left - 4}" y="${y + 3}" fill="rgba(255,220,180,0.5)" font-size="7" text-anchor="end">${Math.round(val)}</text>`;
      }).join('');

      // X labels
      const xLabels = [0, Math.floor(data.length / 2), data.length - 1].map(i => {
        const d = data[i];
        if (!d) return '';
        const x = pad.left + (i / (data.length - 1)) * w;
        return `<text x="${x}" y="${pad.top + h + 12}" fill="rgba(255,220,180,0.5)" font-size="7" text-anchor="middle">${this.formatChartDate(d.date)}</text>`;
      }).join('');

      return `
        <div class="spacewx-chart-block">
          <div class="chart-title">Solar Cycle (5yr trend)</div>
          <svg viewBox="0 0 ${width} ${height}" class="spacewx-chart-svg">
            <defs>
              <linearGradient id="areaGrad" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stop-color="#ffa94d" stop-opacity="0.3"/>
                <stop offset="100%" stop-color="#ff7f32" stop-opacity="0.05"/>
              </linearGradient>
            </defs>
            <line x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${pad.top + h}" stroke="rgba(255,200,150,0.3)" stroke-width="1"/>
            <line x1="${pad.left}" y1="${pad.top + h}" x2="${pad.left + w}" y2="${pad.top + h}" stroke="rgba(255,200,150,0.3)" stroke-width="1"/>
            ${yTicks}
            ${xLabels}
            <polygon points="${area}" fill="url(#areaGrad)"/>
            <polyline points="${points.join(' ')}" fill="none" stroke="#ffa94d" stroke-width="1.5"/>
            <circle cx="${points[points.length - 1].split(',')[0]}" cy="${points[points.length - 1].split(',')[1]}" r="3" fill="#ffd700" stroke="#fff" stroke-width="1"/>
          </svg>
        </div>
      `;
    }

    formatChartDate(dateStr) {
      if (!dateStr) return '';
      try {
        const d = new Date(dateStr);
        const m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];
        return `${m}'${String(d.getFullYear()).slice(-2)}`;
      } catch { return ''; }
    }

    renderDefinitions() {
      return `
        <div class="spacewx-definitions">
          <details class="comm-definition">
            <summary>What is X-ray Flux?</summary>
            <div class="definition-body">
              <p>X-ray flux measures solar flare intensity (0.1–0.8nm). Higher flux causes HF radio absorption on Earth's sunlit side.</p>
              <div class="def-scale">
                <span class="def-item" style="--def-color:#44cc44">A/B Quiet</span>
                <span class="def-item" style="--def-color:#88cc44">C Minor</span>
                <span class="def-item" style="--def-color:#ffcc00">M1-4 Moderate</span>
                <span class="def-item" style="--def-color:#ff8800">M5-9 Strong</span>
                <span class="def-item" style="--def-color:#ff4444">X Severe</span>
              </div>
            </div>
          </details>
          <details class="comm-definition">
            <summary>What is Sunspot Number?</summary>
            <div class="definition-body">
              <p>The International Sunspot Number tracks solar activity in the ~11-year cycle. More sunspots = more flares and CMEs.</p>
              <div class="def-scale">
                <span class="def-item" style="--def-color:#44cc44">&lt;50 Min</span>
                <span class="def-item" style="--def-color:#88cc44">50-100 Rising</span>
                <span class="def-item" style="--def-color:#ffcc00">100-150 Active</span>
                <span class="def-item" style="--def-color:#ff8800">150-200 High</span>
                <span class="def-item" style="--def-color:#ff4444">&gt;200 Max</span>
              </div>
            </div>
          </details>
          <details class="comm-definition">
            <summary>What is Kp Index?</summary>
            <div class="definition-body">
              <p>Planetary K-index measures geomagnetic disturbance. Higher Kp causes aurora, HF absorption at high latitudes, GPS issues.</p>
              <div class="def-scale">
                <span class="def-item" style="--def-color:#44cc44">0-2 Quiet</span>
                <span class="def-item" style="--def-color:#88cc44">3 Unsettled</span>
                <span class="def-item" style="--def-color:#ffcc00">4 Active</span>
                <span class="def-item" style="--def-color:#ff8800">5-6 Storm</span>
                <span class="def-item" style="--def-color:#ff4444">7-9 Severe</span>
              </div>
            </div>
          </details>
        </div>
      `;
    }

    getOverallStatus() {
      const { R, S, G } = this.data?.scales || {};
      const kp = this.data?.kpIndex || 0;
      const kpScore = kp >= 7 ? 4 : kp >= 6 ? 3 : kp >= 5 ? 2 : kp >= 4 ? 1 : 0;
      const max = Math.max(R || 0, S || 0, G || 0, kpScore);

      if (max >= 4) return { className: 'severity-poor', label: 'Severe', desc: 'Strong storms in progress. Expect widespread HF absorption and SATCOM scintillation.' };
      if (max >= 3) return { className: 'severity-watch', label: 'Watch', desc: 'Active disturbances. Monitor HF MUF/LUF shifts and increased SATCOM fading.' };
      if (max >= 2) return { className: 'severity-fair', label: 'Elevated', desc: 'Minor solar activity; slight HF degradation or positioning jitter possible.' };
      return { className: 'severity-good', label: 'Calm', desc: 'Nominal conditions. Routine HF, SATCOM, and GPS performance expected.' };
    }

    getScaleColor(v) {
      if (v >= 4) return '#ff4444';
      if (v >= 3) return '#ff8800';
      if (v >= 2) return '#ffcc00';
      if (v >= 1) return '#88cc44';
      return '#44cc44';
    }

    getScaleDescription(type, v) {
      const desc = { R: ['None','Minor','Moderate','Strong','Severe','Extreme'], S: ['None','Minor','Moderate','Strong','Severe','Extreme'], G: ['Quiet','Minor','Moderate','Strong','Severe','Extreme'] };
      return desc[type]?.[v] || 'Unknown';
    }

    getKpColor(kp) {
      if (kp >= 6) return '#ff4444';
      if (kp >= 5) return '#ff8800';
      if (kp >= 4) return '#ffcc00';
      if (kp >= 3) return '#88cc44';
      return '#44cc44';
    }

    getKpCondition(kp) {
      if (kp >= 6) return 'Storm';
      if (kp >= 5) return 'Minor Storm';
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
      const mins = Math.floor((Date.now() - this.lastUpdate) / 60000);
      if (mins < 1) return 'Just updated';
      if (mins < 60) return `Updated ${mins}m ago`;
      return `Updated ${this.lastUpdate.toLocaleTimeString()}`;
    }

    getMetaText() {
      if (!this.data) return '';
      const o = this.getOverallStatus();
      return `<span class="spacewx-pill ${o.className}">${escapeHtml(o.label)}</span>`;
    }

    getData() { return this.data; }
    getLastUpdate() { return this.lastUpdate; }
    refresh() { this.fetchData(); }
  }

  window.CommDashboard.SpaceWeatherCard = SpaceWeatherCard;
})();
