/**
 * HfPropagationCard.js
 * HF Propagation conditions and band assessment
 * 
 * Features:
 * - Band conditions (80m, 40m, 30m, 20m, 17m, 15m, 12m, 10m)
 * - Day/Night propagation indicators
 * - MUF (Maximum Usable Frequency) for location
 * - Solar/geomagnetic impact integration
 * - Visual condition indicators (Good/Fair/Poor)
 * - NVIS (0–400 km) assessment
 * - Field antenna helper (½-wave / ¼-wave / ⅝-wave lengths)
 */

(function () {
  'use strict';

  const { BaseCard, Events, Storage, Layout, escapeHtml } = window.CommDashboard;

  // ============================================================
  // Constants
  // ============================================================
  const ENDPOINTS = {
    HAMQSL: '/api/hf/hamqsl'
  };

  const UPDATE_INTERVAL = 10 * 60 * 1000; // 10 minutes
  const STORAGE_KEY = 'commHfPropCache';

  // HF band definitions with typical characteristics
  const HF_BANDS = [
    { name: '80m', freq: '3.5-4 MHz', mhz: 3.75, dayProp: 'poor', nightProp: 'excellent', dist: '500-2000km', use: 'Regional NVIS' },
    { name: '40m', freq: '7-7.3 MHz', mhz: 7.15, dayProp: 'good', nightProp: 'excellent', dist: '1000-5000km', use: 'Regional/DX' },
    { name: '30m', freq: '10.1-10.15 MHz', mhz: 10.125, dayProp: 'good', nightProp: 'good', dist: '2000-6000km', use: 'Transition band' },
    { name: '20m', freq: '14-14.35 MHz', mhz: 14.175, dayProp: 'excellent', nightProp: 'fair', dist: '3000-10000km', use: 'Primary DX' },
    { name: '17m', freq: '18.068-18.168 MHz', mhz: 18.118, dayProp: 'excellent', nightProp: 'poor', dist: '5000-15000km', use: 'DX band' },
    { name: '15m', freq: '21-21.45 MHz', mhz: 21.225, dayProp: 'excellent', nightProp: 'poor', dist: '5000-20000km', use: 'DX band' },
    { name: '12m', freq: '24.89-24.99 MHz', mhz: 24.94, dayProp: 'variable', nightProp: 'closed', dist: '8000-20000km', use: 'Solar-dependent' },
    { name: '10m', freq: '28-29.7 MHz', mhz: 28.85, dayProp: 'variable', nightProp: 'closed', dist: '10000km+', use: 'Solar max DX' }
  ];

  // Condition thresholds based on HamQSL data
  const CONDITION_LABELS = {
    'Good': { className: 'hf-good', color: '#44cc44' },
    'Fair': { className: 'hf-fair', color: '#ffcc00' },
    'Poor': { className: 'hf-poor', color: '#ff8844' },
    'Closed': { className: 'hf-closed', color: '#ff4444' },
    'Unknown': { className: 'hf-unknown', color: '#888888' }
  };

  // ============================================================
  // Field Antenna Helper – global event delegation
  // ============================================================
  function computeAntennaResults() {
    const freqInput = document.getElementById('hf-ant-freq');
    const vfSelect = document.getElementById('hf-ant-vf');
    const results = document.getElementById('hf-ant-results');

    if (!freqInput || !vfSelect || !results) return;

    const f = parseFloat(freqInput.value);
    const vf = parseFloat(vfSelect.value || '1');

    if (!f || f <= 0) {
      results.innerHTML = '<p class="comm-placeholder">Enter a valid frequency in MHz.</p>';
      return;
    }

    // 1/2-wave approximations with velocity factor
    const halfWave_m = (142.5 / f) * vf;
    const halfWave_ft = (468 / f) * vf;

    const quarterWave_m = halfWave_m / 2;
    const quarterWave_ft = halfWave_ft / 2;

    // 5/8-wave (use 300 m/µs for speed of light approximation)
    const wavelength_m = 300 / f;
    const fiveEighth_m = 0.625 * wavelength_m * vf;
    const fiveEighth_ft = fiveEighth_m * 3.28084;

    results.innerHTML = `
      <div class="hf-antenna-grid">
        <div class="hf-ant-card">
          <div class="hf-ant-title">½-wave wire</div>
          <div class="hf-ant-main">${halfWave_m.toFixed(1)} m</div>
          <div class="hf-ant-sub">${halfWave_ft.toFixed(1)} ft</div>
        </div>
        <div class="hf-ant-card">
          <div class="hf-ant-title">¼-wave wire</div>
          <div class="hf-ant-main">${quarterWave_m.toFixed(1)} m</div>
          <div class="hf-ant-sub">${quarterWave_ft.toFixed(1)} ft</div>
        </div>
        <div class="hf-ant-card">
          <div class="hf-ant-title">⅝-wave (vertical)</div>
          <div class="hf-ant-main">${fiveEighth_m.toFixed(1)} m</div>
          <div class="hf-ant-sub">${fiveEighth_ft.toFixed(1)} ft</div>
        </div>
      </div>
      <p class="hf-ant-note">
        Values include velocity factor (${vf.toFixed(2)}). Round in the field and trim-to-tune with an analyzer or SWR meter.
      </p>
    `;
  }

  function setupHfAntennaCalculator() {
    if (window.__HF_ANTENNA_HELPER_BOUND__) return;
    window.__HF_ANTENNA_HELPER_BOUND__ = true;

    document.addEventListener('click', function (e) {
      const btn = e.target.closest('#hf-ant-calc');
      if (!btn) return;
      e.preventDefault();
      computeAntennaResults();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      const input = e.target.closest('#hf-ant-freq');
      if (!input) return;
      e.preventDefault();
      computeAntennaResults();
    });
  }

  // ============================================================
  // HfPropagationCard Class
  // ============================================================
  class HfPropagationCard extends BaseCard {
    constructor() {
      super({
        id: 'comm-card-hf',
        title: 'HF Propagation',
        metaId: 'comm-hf-meta'
      });

      this.bandConditions = null;
      this.solarData = null;
      this.spaceWeather = null;
      this.location = null;
      this.lastUpdate = null;
      this.isDay = true;
      this.muf = null;
      this.updateTimer = null;
      this.hasLoadedData = false;
    }

    init() {
      super.init();

      // Wire antenna calculator events (global, but id-scoped)
      setupHfAntennaCalculator();

      // Subscribe to location changes
      this.subscribe('comm:location-changed', (loc) => {
        this.location = loc;

        // Update day/night state for the new location
        this.updateDayNight();

        if (!this.hasLoadedData) {
          this.loadCached();

          if (this.solarData) {
            this.calculateMuf();
          }

          this.fetchData();
          this.hasLoadedData = true;

          this.updateTimer = this.setInterval(() => this.fetchData(), UPDATE_INTERVAL);

          // Update day/night every minute
          this.setInterval(() => this.updateDayNight(), 60000);

          this.render();
        } else {
          if (this.solarData) {
            this.calculateMuf();
          }
          this.render();
        }
      });

      // Subscribe to space weather updates - re-merge NOAA SSN when it updates
      this.subscribe('spaceweather:data-updated', (data) => {
        this.spaceWeather = data;
        if (this.solarData) {
          this.mergeNoaaData();
          if (this.location?.coords) {
            this.calculateMuf();
          }
          this.render();
        }
      });
    }

    destroy() {
      if (this.updateTimer) clearInterval(this.updateTimer);
      super.destroy();
    }

    // ============================================================
    // Day/Night Calculation
    // ============================================================
    updateDayNight() {
      if (!this.location?.coords) {
        this.isDay = this.calculateLocalDayNight();
      } else {
        this.isDay = this.calculateDayNightForLocation(
          this.location.coords.lat,
          this.location.coords.lon
        );
      }
      this.render();
    }

    calculateLocalDayNight() {
      const hour = new Date().getHours();
      return hour >= 6 && hour < 18;
    }

    calculateDayNightForLocation(lat, lon) {
      const now = new Date();
      const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);

      // Solar declination approximation
      const declination = -23.45 * Math.cos((360 / 365) * (dayOfYear + 10) * (Math.PI / 180));

      const latRad = lat * (Math.PI / 180);
      const decRad = declination * (Math.PI / 180);

      const cosHourAngle = -Math.tan(latRad) * Math.tan(decRad);

      // Handle polar day/night
      if (cosHourAngle < -1) return true;  // Polar day
      if (cosHourAngle > 1) return false;  // Polar night

      const hourAngle = Math.acos(cosHourAngle) * (180 / Math.PI);

      const sunriseHour = 12 - (hourAngle / 15);
      const sunsetHour = 12 + (hourAngle / 15);

      const utcHours = now.getUTCHours() + now.getUTCMinutes() / 60;
      const localSolarHours = (utcHours + lon / 15 + 24) % 24;

      return localSolarHours >= sunriseHour && localSolarHours < sunsetHour;
    }

    // ============================================================
    // Data Fetching
    // ============================================================
    async fetchData() {
      try {
        const hamqsl = await this.fetchHamQSL();

        if (hamqsl) {
          this.solarData = hamqsl.solar;
          this.bandConditions = hamqsl.bands;

          this.mergeNoaaData();

          this.calculateMuf();

          this.lastUpdate = new Date();
          this.cacheData();
          this.render();

          Events.emit('hf:data-updated', {
            bands: this.bandConditions,
            solar: this.solarData,
            muf: this.muf,
            isDay: this.isDay
          });
        }
      } catch (err) {
        console.warn('[HfPropagationCard] Fetch error:', err);
      }
    }

    mergeNoaaData() {
      const spacewxCard = window.CommDashboard?.CardRegistry?.get('comm-card-spacewx');
      console.log('[HfPropagationCard] Trying to merge NOAA data, spacewxCard:', !!spacewxCard);

      if (spacewxCard) {
        const sunspots = spacewxCard.sunspotData;
        console.log('[HfPropagationCard] SpaceWeatherCard.sunspotData:', sunspots?.length, 'entries');

        if (Array.isArray(sunspots) && sunspots.length > 0) {
          const latestSsn = sunspots[sunspots.length - 1]?.value;
          console.log('[HfPropagationCard] Latest NOAA SSN value:', latestSsn);

          if (latestSsn !== undefined && !isNaN(latestSsn)) {
            const oldSsn = this.solarData.sunspots;
            this.solarData.sunspots = Math.round(latestSsn);
            this.solarData.ssnSource = 'NOAA';
            console.log('[HfPropagationCard] SSN updated:', oldSsn, '->', this.solarData.sunspots);
          }
        } else {
          console.log('[HfPropagationCard] No sunspot data available from SpaceWeatherCard');
        }

        const swData = spacewxCard.getData?.();
        if (swData?.kpIndex !== undefined) {
          this.solarData.kIndex = swData.kpIndex;
        }
      } else {
        console.log('[HfPropagationCard] SpaceWeatherCard not found in registry');
      }
    }

    calculateMuf() {
      if (!this.location?.coords) {
        this.muf = null;
        return;
      }

      const lat = this.location.coords.lat;
      const lon = this.location.coords.lon;
      const absLat = Math.abs(lat);
      const now = new Date();
      const month = now.getMonth();

      const dayNight = this.getDayNightStatus(lat, lon);

      let baseMUF = dayNight.status === 'day' ? 21 :
                    dayNight.status === 'greyline' ? 18 : 10;

      const isNorthernHemisphere = lat >= 0;
      const isSummer = (isNorthernHemisphere && month >= 4 && month <= 8) ||
                       (!isNorthernHemisphere && (month >= 10 || month <= 2));
      if (isSummer && dayNight.status === 'day') baseMUF += 4;

      if (absLat > 60) baseMUF -= 5;
      else if (absLat > 45) baseMUF -= 2;

      const kp = this.solarData?.kIndex || this.spaceWeather?.kpIndex || 0;
      if (kp >= 6) baseMUF -= 4;
      else if (kp >= 4) baseMUF -= 2;

      const rScale = this.spaceWeather?.scales?.R || 0;
      if (rScale >= 3) baseMUF -= 6;
      else if (rScale >= 2) baseMUF -= 3;

      const sfi = this.solarData?.sfi || 0;
      if (sfi >= 150) baseMUF += 3;
      else if (sfi >= 120) baseMUF += 2;
      else if (sfi >= 100) baseMUF += 1;

      const finalMuf = Math.max(5, Math.min(35, Math.round(baseMUF)));

      this.muf = {
        value: finalMuf,
        dayNight: dayNight,
        source: 'Estimated',
        note: `${dayNight.label} • ${absLat > 45 ? 'High' : absLat > 25 ? 'Mid' : 'Low'} latitude`
      };
    }

    getDayNightStatus(lat, lon) {
      const now = new Date();
      const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);

      const declination = -23.45 * Math.cos((360 / 365) * (dayOfYear + 10) * (Math.PI / 180));
      const latRad = lat * (Math.PI / 180);
      const decRad = declination * (Math.PI / 180);

      const cosHourAngle = -Math.tan(latRad) * Math.tan(decRad);

      if (cosHourAngle < -1) return { status: 'day', label: 'Polar Day' };
      if (cosHourAngle > 1) return { status: 'night', label: 'Polar Night' };

      const hourAngle = Math.acos(cosHourAngle) * (180 / Math.PI);
      const sunriseHour = 12 - (hourAngle / 15);
      const sunsetHour = 12 + (hourAngle / 15);

      const utcHours = now.getUTCHours() + now.getUTCMinutes() / 60;
      const localSolarHours = (utcHours + lon / 15 + 24) % 24;

      const greylineWindow = 0.5; // hours
      if (Math.abs(localSolarHours - sunriseHour) < greylineWindow) {
        return { status: 'greyline', label: 'Sunrise Greyline' };
      }
      if (Math.abs(localSolarHours - sunsetHour) < greylineWindow) {
        return { status: 'greyline', label: 'Sunset Greyline' };
      }

      if (localSolarHours >= sunriseHour && localSolarHours < sunsetHour) {
        return { status: 'day', label: 'Daytime' };
      }
      return { status: 'night', label: 'Nighttime' };
    }

    async fetchHamQSL() {
      try {
        const resp = await fetch(ENDPOINTS.HAMQSL);
        if (!resp.ok) return null;

        const text = await resp.text();
        return this.parseHamQSLXml(text);
      } catch (err) {
        console.warn('[HfPropagationCard] HamQSL fetch error:', err);
        return null;
      }
    }

    parseHamQSLXml(xmlText) {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlText, 'text/xml');

        const solar = doc.querySelector('solardata');
        if (!solar) return null;

        const getText = (tag) => {
          const el = solar.querySelector(tag);
          return el ? el.textContent.trim() : null;
        };

        // Parse solar indices
        const solarData = {
          sfi: parseFloat(getText('solarflux')) || 0,
          sunspots: parseInt(getText('sunspots')) || 0,
          aIndex: parseInt(getText('aindex')) || 0,
          kIndex: parseInt(getText('kindex')) || 0,
          xray: getText('xray') || '--',
          heliumLine: getText('heliumline') || '--',
          protonFlux: getText('protonflux') || '--',
          electronFlux: getText('electronflux') || '--',
          aurora: getText('aurora') || '--',
          solarWind: getText('solarwind') || '--',
          magneticField: getText('magneticfield') || '--',
          geomagField: getText('geomagfield') || '--',
          signalNoise: getText('signalnoise') || '--',
          fof2: getText('fof2') || '--',
          muffactor: getText('muffactor') || 3.0,
          muf: getText('muf') || '--',
          updated: getText('updated') || null
        };

        // Parse band conditions
        const bands = {};
        const bandNodes = solar.querySelectorAll('calculatedconditions band');

        bandNodes.forEach(band => {
          const name = band.getAttribute('name');
          const time = band.getAttribute('time');
          const condition = band.textContent.trim();

          if (!bands[name]) bands[name] = {};
          bands[name][time] = condition;
        });

        const vhf = solar.querySelectorAll('calculatedvhfconditions phenomenon');
        const vhfConditions = {};
        vhf.forEach(p => {
          const name = p.getAttribute('name');
          const location = p.getAttribute('location');
          vhfConditions[`${name}_${location}`] = p.textContent.trim();
        });

        return {
          solar: solarData,
          bands,
          vhf: vhfConditions
        };
      } catch (err) {
        console.warn('[HfPropagationCard] XML parse error:', err);
        return null;
      }
    }

    // ============================================================
    // Caching
    // ============================================================
    loadCached() {
      const cached = Storage.get(STORAGE_KEY);
      if (cached && cached.timestamp) {
        const age = Date.now() - new Date(cached.timestamp).getTime();
        if (age < 30 * 60 * 1000) {
          this.solarData = cached.solar || null;
          this.bandConditions = cached.bands || null;
          this.lastUpdate = new Date(cached.timestamp);

          if (this.solarData) {
            this.mergeNoaaData();
          }

          this.render();

          this.setTimeout(() => {
            if (this.solarData) {
              this.mergeNoaaData();
              if (this.location?.coords) {
                this.calculateMuf();
              }
              this.render();
            }
          }, 500);
        }
      }
    }

    cacheData() {
      const solarForCache = this.solarData ? {
        ...this.solarData,
        sunspots: null,
        ssnSource: null
      } : null;

      Storage.set(STORAGE_KEY, {
        solar: solarForCache,
        bands: this.bandConditions,
        timestamp: this.lastUpdate?.toISOString()
      });
    }

    // ============================================================
    // Legacy basic NVIS (kept for reuse if needed)
    // ============================================================
    getNvisAssessment() {
      if (!this.muf || !this.solarData) {
        return {
          recommended: '40–80m',
          quality: 'Unknown (awaiting data)'
        };
      }

      const muf = this.muf.value;
      const sfi = this.solarData.sfi || 0;
      const kp = this.solarData.kIndex || this.spaceWeather?.kpIndex || 0;

      let recommended;
      if (muf <= 5) {
        recommended = '80m (3.5–4 MHz)';
      } else if (muf <= 8) {
        recommended = '60m/80m (3–8 MHz)';
      } else if (muf <= 12) {
        recommended = '40m/60m (4–8 MHz)';
      } else {
        recommended = '40m (7 MHz)';
      }

      let qualityScore = 0;
      if (sfi >= 120) qualityScore += 1;
      if (sfi >= 150) qualityScore += 1;
      if (kp >= 4) qualityScore -= 1;
      if (kp >= 6) qualityScore -= 1;

      const quality =
        qualityScore >= 2 ? 'Excellent' :
        qualityScore >= 1 ? 'Good' :
        qualityScore >= 0 ? 'Fair' :
        'Poor';

      return { recommended, quality };
    }

    renderNvisRow() {
      const nvis = this.getNvisAssessment();
      return `
        <div class="hf-nvis-row">
          <span class="hf-nvis-label">NVIS (0–400 km)</span>
          <span class="hf-nvis-hint">${escapeHtml(nvis.recommended)} — ${escapeHtml(nvis.quality)}</span>
        </div>
      `;
    }

    // ============================================================
    // Field Antenna Helper (UI)
    // ============================================================
    renderAntennaHelper() {
      return `
        <div class="hf-section hf-antenna-section">
          <div class="hf-section-header">
            <span class="hf-section-title">Field Antenna Helper</span>
            <span class="hf-section-subtitle">Quick ½-wave & ¼-wave lengths</span>
          </div>
          <div class="hf-antenna-form">
            <label class="hf-antenna-label">
              Frequency (MHz)
              <input type="number" min="1" max="60" step="0.1"
                     class="hf-antenna-input"
                     id="hf-ant-freq"
                     placeholder="e.g. 7.2">
            </label>
            <label class="hf-antenna-label">
              Velocity factor
              <select id="hf-ant-vf" class="hf-antenna-select">
                <option value="1.0">Bare wire / theoretical (1.00)</option>
                <option value="0.97">Typical copper wire (0.97)</option>
                <option value="0.95" selected>Insulated field wire (0.95)</option>
              </select>
            </label>
            <button class="hf-antenna-btn" id="hf-ant-calc">
              Compute lengths
            </button>
          </div>
          <div class="hf-antenna-results" id="hf-ant-results">
            <p class="comm-placeholder">
              Enter a frequency to compute ½-wave, ¼-wave, and ⅝-wave wire lengths.
            </p>
          </div>
        </div>
      `;
    }

    // ============================================================
    // NVIS Section (0–400 km) – enhanced UI
    // ============================================================
    getNvisInfo() {
      if (!this.location?.coords || !this.muf || !this.solarData) return null;

      const lat = this.location.coords.lat;
      const absLat = Math.abs(lat);
      const status = this.muf.dayNight?.status || (this.isDay ? 'day' : 'night');
      const muf = this.muf.value || 10;
      const sfi = this.solarData.sfi || 0;
      const k = this.solarData.kIndex || 0;

      let primaryBand = '40m';
      let primaryFreq = '7 MHz';

      if (status === 'night') {
        if (muf <= 6) {
          primaryBand = '80m';
          primaryFreq = '3.5–4 MHz';
        } else {
          primaryBand = '40m';
          primaryFreq = '7–7.3 MHz';
        }
      } else {
        if (muf < 8) {
          primaryBand = '80m';
          primaryFreq = '3.5–4 MHz';
        } else if (muf < 15) {
          primaryBand = '40m';
          primaryFreq = '7–7.3 MHz';
        } else {
          primaryBand = '30m';
          primaryFreq = '10.1–10.15 MHz';
        }
      }

      const overall = this.getOverallCondition();
      const quality = overall.label || 'Good';

      const alternates = [];
      if (primaryBand !== '80m') {
        alternates.push({
          band: '80m',
          icon: '🟦',
          label: 'Night',
          text: '🟦 80m (Night)'
        });
      }
      if (primaryBand !== '30m') {
        alternates.push({
          band: '30m',
          icon: '☀️',
          label: 'Day',
          text: '☀️ 30m (Day)'
        });
      }

      const tooltipLines = [
        'NVIS – Near Vertical Incidence Skywave',
        'Short-range HF (~0–400 km) using high-angle F-layer returns.',
        '',
        `Primary band now: ${primaryBand} (${primaryFreq}) – ${quality} short-range coverage.`,
        '',
        'Rules of thumb:',
        '• 80m: Night regional comms, best after sunset',
        '• 40m: Day/night general-purpose tactical NVIS',
        '• 30m: Daytime NVIS when MUF and SFI are high'
      ];

      return {
        primaryBand,
        primaryFreq,
        quality,
        alternates,
        tooltip: tooltipLines.join('\n')
      };
    }

    renderNvisSection() {
      const info = this.getNvisInfo();
      if (!info) return '';

      const summary = `${info.primaryBand} (${info.primaryFreq}) — ${info.quality} short-range coverage`;
      const tooltip = escapeHtml(info.tooltip || '');

      return `
        <div class="hf-nvis-row" title="${tooltip}">
          <div class="hf-nvis-label">NVIS (0–400 km)</div>
          <div class="hf-nvis-hint">${escapeHtml(summary)}</div>
        </div>
        ${this.renderNvisAlternates(info)}
      `;
    }

    renderNvisAlternates(info) {
      if (!info?.alternates || info.alternates.length === 0) return '';

      const chips = info.alternates.map(alt => `
        <span class="hf-nvis-chip" title="${escapeHtml(`${alt.band} – ${alt.label} operations`)}">
          ${escapeHtml(alt.text)}
        </span>
      `).join('');

      return `
        <div class="hf-nvis-alt-row">
          <span class="hf-nvis-alt-label">Other options</span>
          <div class="hf-nvis-alt-chips">
            ${chips}
          </div>
        </div>
      `;
    }

    // ============================================================
    // MUF section
    // ============================================================
    renderMufSection() {
      if (!this.muf) {
        return '';
      }

      const mufValue = this.muf.value;
      const dayNight = this.muf.dayNight;
      const propDesc = this.getDayNightDescription(dayNight?.status);
      const bandSummary = this.getMufBandSummary(mufValue, dayNight?.status);

      return `
        <div class="hf-muf-section">
          <div class="hf-muf-row">
            <div class="hf-muf-primary">
              <div class="hf-muf-label">Est. MUF</div>
              <div class="hf-muf-value">${mufValue} MHz</div>
              <div class="hf-muf-bands">${escapeHtml(bandSummary)}</div>
            </div>
          </div>
          <p class="hf-muf-desc">${propDesc}</p>
        </div>
      `;
    }

    getDayNightDescription(status) {
      switch (status) {
        case 'greyline':
          return 'Excellent DX window. Greyline propagation enhances long-distance paths on 20m–40m.';
        case 'night':
          return 'Nighttime favors lower bands (40m–160m). F2 layer may support 20m long-path DX.';
        case 'day':
        default:
          return 'Daytime favors higher bands (10m–20m). F2 layer supporting normal skip distances.';
      }
    }

    getMufBandSummary(mufValue, status) {
      if (!mufValue) return 'Use 40–20m as a starting point.';

      let low, high, label;
      if (mufValue <= 8) {
        low = '80m';
        high = '40m';
      } else if (mufValue <= 15) {
        low = '40m';
        high = '20m';
      } else if (mufValue <= 25) {
        low = '30m';
        high = '15m';
      } else {
        low = '20m';
        high = '10m';
      }

      if (status === 'night') {
        label = `Night NVIS: favor ${low}, check ${high} for DX.`;
      } else if (status === 'greyline') {
        label = `Greyline: ${low}–${high} likely open for long-path DX.`;
      } else {
        label = `Work roughly ${low}–${high} based on mission and distance.`;
      }

      return label;
    }

    getDayPhaseIcon(status) {
      switch (status) {
        case 'day':
          return `<svg class="hf-phase-icon" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="5" fill="#ffcc00" stroke="#ff9900" stroke-width="1"/>
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12" 
                  stroke="#ffaa00" stroke-width="1.5" stroke-linecap="round"/>
          </svg>`;
        case 'night':
          return `<svg class="hf-phase-icon" viewBox="0 0 24 24" fill="none">
            <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" fill="#6699cc" stroke="#4477aa" stroke-width="1"/>
          </svg>`;
        case 'greyline':
          return `<svg class="hf-phase-icon" viewBox="0 0 24 24" fill="none">
            <defs>
              <linearGradient id="greyGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#ffcc66"/>
                <stop offset="100%" stop-color="#4466aa"/>
              </linearGradient>
            </defs>
            <circle cx="12" cy="12" r="8" fill="url(#greyGrad)" stroke="#cc8844" stroke-width="1"/>
          </svg>`;
        default:
          return '';
      }
    }

    renderPropagationNotes() {
      const notes = [];
      const s = this.solarData;

      if (s.kIndex >= 4) {
        notes.push({
          type: 'warning',
          text: `Elevated K-index (${s.kIndex}) may cause polar path degradation`
        });
      }

      if (s.aIndex >= 20) {
        notes.push({
          type: 'warning',
          text: 'High A-index indicates recent geomagnetic disturbance'
        });
      }

      if (s.sfi >= 150) {
        notes.push({
          type: 'good',
          text: 'Excellent SFI supports higher band openings (15m, 12m, 10m)'
        });
      } else if (s.sfi < 90) {
        notes.push({
          type: 'info',
          text: 'Low SFI favors lower bands (40m, 80m) for reliable propagation'
        });
      }

      if (s.aurora && s.aurora !== '--' && parseInt(s.aurora) > 5) {
        notes.push({
          type: 'warning',
          text: `Aurora activity (${s.aurora}) may affect high-latitude paths`
        });
      }

      if (notes.length === 0) {
        return '';
      }

      const noteHtml = notes.map(n => `
        <div class="hf-note hf-note-${n.type}">
          <span class="hf-note-icon">${this.getNoteIcon(n.type)}</span>
          <span class="hf-note-text">${n.text}</span>
        </div>
      `).join('');

      return `
        <div class="hf-notes-section">
          ${noteHtml}
        </div>
      `;
    }

    // ============================================================
    // Card Rendering + header phase badge
    // ============================================================
    render() {
      super.render();
      this.updatePhaseBadge();
    }

    updatePhaseBadge() {
      const cardEl = this.card || document.getElementById('comm-card-hf');
      if (!cardEl) return;

      const header = cardEl.querySelector('.comm-card-header');
      if (!header) return;

      // Remove any existing badge if no MUF / location yet
      const existing = header.querySelector('.hf-phase-badge');
      if (!this.muf) {
        if (existing) existing.remove();
        return;
      }

      const status = this.muf.dayNight?.status || (this.isDay ? 'day' : 'night');

      // Clean, non-redundant label for the pill
      const baseLabel =
        this.muf.dayNight?.label ||
        (status === 'day'
          ? 'Daytime'
          : status === 'night'
          ? 'Nighttime'
          : status === 'greyline'
          ? 'Greyline'
          : 'Phase');

      const phaseClass =
        status === 'night' ? 'night' :
        status === 'greyline' ? 'grey' : 'day';

      const icon = this.getDayPhaseIcon(status);
      const title = this.getDayNightDescription(status);

      const html = `
        <div class="hf-phase-badge ${phaseClass}" title="${escapeHtml(title)}">
          ${icon}<span>${escapeHtml(baseLabel)}</span>
        </div>
      `;

      if (existing) {
        existing.outerHTML = html;
      } else {
        header.insertAdjacentHTML('beforeend', html);
      }
    }

    renderBody() {
      if (!this.location) {
        return `
          <div class="hf-waiting-location">
            <div class="hf-waiting-icon">📻</div>
            <p class="comm-placeholder">Select a location to view HF propagation conditions.</p>
            <p class="hf-waiting-hint">Band conditions, solar indices, NVIS and MUF will be calculated for your location.</p>
          </div>
        `;
      }

      if (!this.solarData || !this.bandConditions) {
        return '<p class="comm-placeholder">Loading HF propagation data...</p>';
      }

      return `
        ${this.renderMufSection()}
        ${this.renderSolarIndices()}
        ${this.renderBandGrid()}
        ${this.renderNvisSection()}
        ${this.renderPropagationNotes()}
        ${this.renderAntennaHelper()}
        
        <div class="comm-card-micro comm-card-footer">
          Source: <a class="inline-link" href="https://www.hamqsl.com/solar.html" target="_blank">HamQSL</a> • 
          <a class="inline-link" href="https://www.swpc.noaa.gov" target="_blank">NOAA SWPC</a> • 
          ${this.getUpdateText()}
        </div>
      `;
    }

    renderSolarIndices() {
      const s = this.solarData;
      const sfiColor = this.getSfiColor(s.sfi);
      const kColor = this.getKpColor(s.kIndex);
      const aColor = this.getAIndexColor(s.aIndex);

      let ssn = s.sunspots;
      let ssnSource = s.ssnSource || 'HamQSL';
      const spacewxCard = window.CommDashboard?.CardRegistry?.get('comm-card-spacewx');
      if (spacewxCard?.sunspotData?.length > 0) {
        const latestSsn = spacewxCard.sunspotData[spacewxCard.sunspotData.length - 1]?.value;
        if (latestSsn !== undefined && !isNaN(latestSsn)) {
          ssn = Math.round(latestSsn);
          ssnSource = 'NOAA';
        }
      }

      return `
        <div class="hf-indices-row">
          <div class="hf-index-card" title="Solar Flux Index - Higher is better for HF">
            <span class="hf-index-label">SFI</span>
            <span class="hf-index-value" style="color: ${sfiColor}">${s.sfi}</span>
            <span class="hf-index-status">${this.getSfiCondition(s.sfi)}</span>
          </div>
          <div class="hf-index-card" title="Sunspot Number (${ssnSource})">
            <span class="hf-index-label">SSN</span>
            <span class="hf-index-value">${ssn}</span>
            <span class="hf-index-status">${this.getSsnCondition(ssn)}</span>
          </div>
          <div class="hf-index-card" title="A Index - Lower is better">
            <span class="hf-index-label">A</span>
            <span class="hf-index-value" style="color: ${aColor}">${s.aIndex}</span>
            <span class="hf-index-status">${this.getACondition(s.aIndex)}</span>
          </div>
          <div class="hf-index-card" title="K Index - Lower is better">
            <span class="hf-index-label">K</span>
            <span class="hf-index-value" style="color: ${kColor}">${s.kIndex}</span>
            <span class="hf-index-status">${this.getKCondition(s.kIndex)}</span>
          </div>
        </div>
      `;
    }

    renderBandGrid() {
      const timeKey = this.isDay ? 'day' : 'night';

      const bandCards = HF_BANDS.map(band => {
        const condition = this.getBandCondition(band.name, timeKey);
        const condInfo = CONDITION_LABELS[condition] || CONDITION_LABELS['Unknown'];
        const mufOpen = this.muf ? band.mhz <= this.muf.value : true;
        const closedClass = !mufOpen ? 'hf-muf-closed' : '';

        return `
          <div class="hf-band-card ${condInfo.className} ${closedClass}" 
               title="${band.freq} - ${band.use}${!mufOpen ? ' (Below MUF)' : ''}">
            <div class="hf-band-name">${band.name}</div>
            <div class="hf-band-condition" style="color: ${condInfo.color}">${condition}</div>
            <div class="hf-band-freq">${band.freq}</div>
          </div>
        `;
      }).join('');

      return `
        <div class="hf-section">
          <div class="hf-section-header">
            <span class="hf-section-title">Band Conditions</span>
            <span class="hf-section-subtitle">${this.isDay ? 'Daytime' : 'Nighttime'} propagation</span>
          </div>
          <div class="hf-band-grid">
            ${bandCards}
          </div>
        </div>
      `;
    }

    // ============================================================
    // Condition Helpers
    // ============================================================
    getBandCondition(bandName, timeKey) {
      if (!this.bandConditions) return 'Unknown';

      const bandData = this.bandConditions[bandName];
      if (bandData && bandData[timeKey]) {
        return this.normalizeCondition(bandData[timeKey]);
      }

      const variations = {
        '80m': ['80m-40m', '80m'],
        '40m': ['80m-40m', '40m'],
        '30m': ['30m-20m', '30m'],
        '20m': ['30m-20m', '20m'],
        '17m': ['17m-15m', '17m'],
        '15m': ['17m-15m', '15m'],
        '12m': ['12m-10m', '12m'],
        '10m': ['12m-10m', '10m']
      };

      const keys = variations[bandName] || [bandName];
      for (const key of keys) {
        if (this.bandConditions[key]?.[timeKey]) {
          return this.normalizeCondition(this.bandConditions[key][timeKey]);
        }
      }

      return 'Unknown';
    }

    normalizeCondition(condition) {
      const cond = (condition || '').toLowerCase();
      if (cond.includes('good') || cond.includes('excellent')) return 'Good';
      if (cond.includes('fair') || cond.includes('moderate')) return 'Fair';
      if (cond.includes('poor') || cond.includes('bad')) return 'Poor';
      if (cond.includes('closed') || cond.includes('none')) return 'Closed';
      return 'Unknown';
    }

    getOverallCondition() {
      if (!this.solarData) {
        return { label: 'Unknown', desc: 'Loading data...' };
      }

      const s = this.solarData;

      let score = 0;

      if (s.sfi >= 150) score += 40;
      else if (s.sfi >= 120) score += 30;
      else if (s.sfi >= 100) score += 20;
      else if (s.sfi >= 80) score += 10;

      if (s.kIndex <= 1) score += 0;
      else if (s.kIndex <= 2) score -= 5;
      else if (s.kIndex <= 3) score -= 10;
      else if (s.kIndex <= 4) score -= 20;
      else score -= 30;

      if (s.aIndex <= 7) score += 0;
      else if (s.aIndex <= 15) score -= 5;
      else if (s.aIndex <= 30) score -= 10;
      else score -= 20;

      if (score >= 30) {
        return { label: 'Excellent', desc: 'Outstanding HF conditions. All bands likely open.' };
      } else if (score >= 15) {
        return { label: 'Good', desc: 'Good HF propagation. Most bands should be productive.' };
      } else if (score >= 0) {
        return { label: 'Fair', desc: 'Moderate conditions. Lower bands more reliable.' };
      } else if (score >= -15) {
        return { label: 'Poor', desc: 'Degraded conditions. Expect weak signals and fading.' };
      } else {
        return { label: 'Very Poor', desc: 'Disturbed conditions. HF propagation severely impacted.' };
      }
    }

    // ============================================================
    // Color Helpers
    // ============================================================
    getSfiColor(sfi) {
      if (sfi >= 150) return '#44cc44';
      if (sfi >= 120) return '#88cc44';
      if (sfi >= 100) return '#cccc44';
      if (sfi >= 80) return '#cc8844';
      return '#cc4444';
    }

    getSfiCondition(sfi) {
      if (sfi >= 150) return 'Excellent';
      if (sfi >= 120) return 'Good';
      if (sfi >= 100) return 'Fair';
      if (sfi >= 80) return 'Poor';
      return 'Very Low';
    }

    getSsnCondition(ssn) {
      if (ssn >= 150) return 'High';
      if (ssn >= 100) return 'Active';
      if (ssn >= 50) return 'Moderate';
      return 'Low';
    }

    getKpColor(kp) {
      if (kp <= 1) return '#44cc44';
      if (kp <= 2) return '#88cc44';
      if (kp <= 3) return '#cccc44';
      if (kp <= 4) return '#cc8844';
      return '#cc4444';
    }

    getKCondition(k) {
      if (k <= 1) return 'Quiet';
      if (k <= 2) return 'Settled';
      if (k <= 3) return 'Unsettled';
      if (k <= 4) return 'Active';
      return 'Storm';
    }

    getAIndexColor(a) {
      if (a <= 7) return '#44cc44';
      if (a <= 15) return '#88cc44';
      if (a <= 30) return '#cccc44';
      if (a <= 50) return '#cc8844';
      return '#cc4444';
    }

    getACondition(a) {
      if (a <= 7) return 'Quiet';
      if (a <= 15) return 'Unsettled';
      if (a <= 30) return 'Active';
      if (a <= 50) return 'Minor Storm';
      return 'Major Storm';
    }

    // ============================================================
    // Icons
    // ============================================================
    getNoteIcon(type) {
      switch (type) {
        case 'warning':
          return '⚠️';
        case 'good':
          return '✅';
        case 'info':
        default:
          return 'ℹ️';
      }
    }

    // ============================================================
    // Meta/Status
    // ============================================================
    getMetaText() {
      if (!this.location) return '<span class="status-pill hf-pill-waiting">Awaiting Location</span>';
      if (!this.solarData) return '';
      const overall = this.getOverallCondition();
      const className = overall.label.toLowerCase().replace(' ', '-');
      return `<span class="status-pill hf-pill-${className}">${overall.label}</span>`;
    }

    getUpdateText() {
      if (!this.lastUpdate) return 'Loading...';
      const mins = Math.floor((Date.now() - this.lastUpdate) / 60000);
      if (mins < 1) return 'Just updated';
      if (mins < 60) return `Updated ${mins}m ago`;
      return `Updated ${this.lastUpdate.toLocaleTimeString()}`;
    }

    // ============================================================
    // Public API
    // ============================================================
    getData() {
      return {
        bands: this.bandConditions,
        solar: this.solarData,
        muf: this.muf,
        isDay: this.isDay
      };
    }

    refresh() {
      this.fetchData();
    }
  }

  // Register with CommDashboard
  window.CommDashboard.HfPropagationCard = HfPropagationCard;
})();
