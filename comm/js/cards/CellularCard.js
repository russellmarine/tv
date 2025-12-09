/**
 * CellularCard.js
 * Cellular coverage assessment card for Comm Dashboard
 * 
 * Features:
 * - Collapsible nearest towers summary
 * - Collapsible carriers list with per-carrier tower drill-down
 * - Uses RussellTV.Declination for True/Magnetic bearings
 * - Technology breakdown (5G/LTE/UMTS/GSM/CDMA)
 * - Band display grouped by technology
 * - Coverage quality assessment
 * - Roaming detection & warnings
 * 
 * Data source: OpenCellID via /cell proxy
 */

(function () {
  'use strict';

  if (!window.CommDashboard) {
    console.error('[CellularCard] CommDashboard namespace not found.');
    return;
  }

  const { BaseCard, Events, escapeHtml, Layout } = window.CommDashboard;

  // ============================================================
  // Configuration
  // ============================================================
  const CONFIG = {
    API_URL: '/cell',
    SEARCH_RADIUS: 500,
    MAX_TOWERS_SUMMARY: 5,
    MAX_CARRIERS_DISPLAY: 10,
    MAX_CARRIER_TOWERS: 5
  };

  // Technology display config
  const TECH_CONFIG = {
    '5G':   { priority: 1, class: 'cell-tech-5g',   label: '5G',   color: '#00dca8' },
    'NR':   { priority: 1, class: 'cell-tech-5g',   label: '5G NR', color: '#00dca8' },
    'LTE':  { priority: 2, class: 'cell-tech-lte',  label: 'LTE',  color: '#64b4ff' },
    'UMTS': { priority: 3, class: 'cell-tech-umts', label: 'UMTS', color: '#ffb850' },
    'HSPA': { priority: 3, class: 'cell-tech-umts', label: 'HSPA', color: '#ffb850' },
    'GSM':  { priority: 4, class: 'cell-tech-gsm',  label: 'GSM',  color: '#c8a0d8' },
    'CDMA': { priority: 5, class: 'cell-tech-cdma', label: 'CDMA', color: '#d8c0a0' }
  };

  // Coverage quality config
  const COVERAGE_CONFIG = {
    excellent: { class: 'severity-good',  icon: '📶', label: 'Excellent' },
    good:      { class: 'severity-good',  icon: '📶', label: 'Good' },
    moderate:  { class: 'severity-fair',  icon: '📶', label: 'Moderate' },
    limited:   { class: 'severity-watch', icon: '📶', label: 'Limited' },
    none:      { class: 'severity-poor',  icon: '📵', label: 'No Coverage' },
    unknown:   { class: '',               icon: '📱', label: 'Unknown' }
  };

  // ============================================================
  // CellularCard Class
  // ============================================================
  class CellularCard extends BaseCard {
    constructor() {
      super({
        id: 'comm-card-cellular',
        title: 'Cellular Coverage',
        metaId: 'comm-cellular-meta',
        bodyId: 'comm-cellular-body'
      });

      this.data = null;
      this.location = null;
      this.isLoading = false;
      this.error = null;
      this.declination = null;
    }

    // ----------------------------------------------------------
    // Lifecycle
    // ----------------------------------------------------------
    init() {
      super.init();
      
      this.subscribe('comm:location-changed', (loc) => {
        this.location = loc;
        this.fetchData();
      });

      // Listen for declination updates from other cards
      this.subscribe('declination:updated', (decl) => {
        this.declination = decl;
        if (this.data) this.render();
      });
    }

    // ----------------------------------------------------------
    // Data Fetching
    // ----------------------------------------------------------
    async fetchData() {
      if (!this.location?.coords) {
        this.data = null;
        this.render();
        return;
      }

      const { lat, lon } = this.location.coords;

      // Skip polar regions
      if (Math.abs(lat) > 85) {
        this.data = { 
          carriers: [], 
          towers: [], 
          summary: { total: 0, coverage: 'none' } 
        };
        this.render();
        return;
      }

      this.isLoading = true;
      this.error = null;
      this.render();

      // Fetch declination in parallel
      this.fetchDeclination(lat, lon);

      try {
        const url = `${CONFIG.API_URL}?lat=${lat}&lon=${lon}&range=${CONFIG.SEARCH_RADIUS}`;
        const res = await fetch(url);
        
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        this.data = await res.json();
      } catch (err) {
        console.error('[CellularCard] Fetch error:', err);
        this.error = err.message;
        this.data = { 
          carriers: [], 
          towers: [], 
          summary: { total: 0, coverage: 'unknown' } 
        };
      }

      this.isLoading = false;
      this.render();
    }

    async fetchDeclination(lat, lon) {
      try {
        // Use the existing RussellTV.Declination module
        if (window.RussellTV?.Declination?.get) {
          this.declination = await window.RussellTV.Declination.get(lat, lon);
          Events.emit('declination:updated', this.declination);
        }
      } catch (err) {
        console.warn('[CellularCard] Declination fetch failed:', err);
        // Try local estimate as fallback
        if (window.RussellTV?.Declination?.estimateLocal) {
          this.declination = window.RussellTV.Declination.estimateLocal(lat, lon);
        }
      }
    }

    // ----------------------------------------------------------
    // Helpers
    // ----------------------------------------------------------
    getDeclination() {
      return this.declination 
        ?? window.CommDashboard?.currentDeclination
        ?? window.RussellTV?.CommPlanner?.getDeclination?.()
        ?? null;
    }

    formatBearing(trueBearing) {
      if (trueBearing == null || !isFinite(trueBearing)) return '—';
      
      const decl = this.getDeclination();
      const trueStr = `${Math.round(trueBearing)}°T`;
      
      if (decl != null && isFinite(decl)) {
        const mag = ((trueBearing - decl) % 360 + 360) % 360;
        return `${trueStr} / ${Math.round(mag)}°M`;
      }
      
      return trueStr;
    }

    formatDistance(meters) {
      if (meters == null) return '—';
      if (meters < 1000) return `${Math.round(meters)}m`;
      return `${(meters / 1000).toFixed(1)}km`;
    }

    formatTimestamp() {
      const d = new Date();
      const time = d.toLocaleTimeString(undefined, { 
        hour: '2-digit', minute: '2-digit', hour12: false 
      }).replace(':', '');
      const day = String(d.getDate()).padStart(2, '0');
      const month = d.toLocaleDateString(undefined, { month: 'short' });
      const year = d.getFullYear().toString().slice(-2);
      return `${time} ${day} ${month} ${year}`;
    }

    getTechConfig(tech) {
      return TECH_CONFIG[tech] || { priority: 99, class: 'cell-tech-other', label: tech || 'Unknown' };
    }

    getCoverageConfig(coverage) {
      const key = (coverage || 'unknown').toLowerCase();
      return COVERAGE_CONFIG[key] || COVERAGE_CONFIG.unknown;
    }

    buildMapLink(lat, lon) {
      if (lat == null || lon == null) return '';
      const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}&basemap=satellite`;
      return `<a class="cell-map-link" href="${url}" target="_blank" rel="noopener noreferrer" title="View on map">📍</a>`;
    }

    // Parse bands into grouped structure by technology
    parseBands(carrier) {
      const result = {};
      
      // First try bands_structured (from DB - already grouped)
      if (carrier.bands_structured && typeof carrier.bands_structured === 'object') {
        for (const [tech, bands] of Object.entries(carrier.bands_structured)) {
          if (Array.isArray(bands) && bands.length) {
            const normalizedTech = this.normalizeTech(tech);
            if (!result[normalizedTech]) result[normalizedTech] = [];
            result[normalizedTech].push(...bands.map(b => String(b).trim()).filter(Boolean));
          }
        }
        for (const tech of Object.keys(result)) {
          result[tech] = [...new Set(result[tech])];
        }
        if (Object.keys(result).length) return result;
      }

      // Fallback: parse bands array/string
      const bandsRaw = carrier.bands || [];
      const bandsArr = Array.isArray(bandsRaw) 
        ? bandsRaw 
        : String(bandsRaw).split(/[\/,]/).map(b => b.trim()).filter(Boolean);

      for (const band of bandsArr) {
        const match = band.match(/^(5G|NR|LTE|UMTS|HSPA|GSM|CDMA|WCDMA)[\s\-]?(.+)$/i);
        if (match) {
          const tech = this.normalizeTech(match[1]);
          const bandId = match[2].trim();
          if (!result[tech]) result[tech] = [];
          result[tech].push(bandId);
        } else {
          const tech = this.inferTechFromBand(band);
          if (!result[tech]) result[tech] = [];
          result[tech].push(band);
        }
      }

      for (const tech of Object.keys(result)) {
        result[tech] = [...new Set(result[tech])];
      }

      return result;
    }

    normalizeTech(tech) {
      const t = String(tech).toUpperCase();
      if (t === 'NR' || t === '5G' || t === 'NBIOT') return '5G';
      if (t === 'LTE' || t === 'LTECATM') return 'LTE';
      if (t === 'WCDMA' || t === 'HSPA' || t === 'HSPA+' || t === 'HSDPA' || t === 'HSUPA') return 'UMTS';
      if (t === 'GPRS' || t === 'EDGE') return 'GSM';
      return t;
    }

    inferTechFromBand(band) {
      const b = String(band).toLowerCase();
      if (/^n\d+/.test(b)) return '5G';
      if (/^b\d+/.test(b)) return 'LTE';
      if (b.includes('700') || b.includes('850') || b.includes('1900') || b.includes('aws')) return 'LTE';
      return 'Other';
    }

    // ----------------------------------------------------------
    // Rendering
    // ----------------------------------------------------------
    getMetaText() {
      if (this.isLoading) {
        return '<span class="status-pill">Loading…</span>';
      }
      
      if (!this.data) {
        return '<span class="status-pill">Awaiting Location</span>';
      }

      const coverage = this.getCoverageConfig(this.data.summary?.coverage);
      return `<span class="status-pill ${coverage.class}">${escapeHtml(coverage.label)}</span>`;
    }

    renderBody() {
      if (!this.location) return this.renderWaitingState();
      if (this.isLoading) return this.renderLoadingState();
      if (this.error && !this.data?.towers?.length) return this.renderErrorState();
      if (!this.data?.towers?.length) return this.renderNoCoverage();
      return this.renderFullCard();
    }

    renderWaitingState() {
      return `
        <div class="cell-waiting">
          <div class="cell-waiting-icon">📱</div>
          <p class="comm-placeholder">Cellular coverage data will appear once a location is selected.</p>
          <p class="cell-waiting-hint">Use the Location card to set coordinates</p>
        </div>
      `;
    }

    renderLoadingState() {
      return `
        <div class="cell-loading">
          <div class="cell-loading-spinner"></div>
          <p class="comm-placeholder">Scanning cellular infrastructure…</p>
        </div>
      `;
    }

    renderErrorState() {
      return `
        <div class="cell-error">
          <div class="cell-error-icon">⚠️</div>
          <p class="comm-placeholder">Unable to retrieve cellular data</p>
          <p class="cell-error-detail">${escapeHtml(this.error)}</p>
        </div>
      `;
    }

    renderNoCoverage() {
      return `
        <div class="cell-no-coverage">
          <div class="cell-no-coverage-icon">📵</div>
          <p class="comm-placeholder">No cellular towers detected within ${CONFIG.SEARCH_RADIUS}m</p>
          <p class="cell-no-coverage-hint">This area may have limited or no cellular service</p>
        </div>
      `;
    }

    renderFullCard() {
      const { summary, carriers, towers, technologies, roamingCountries } = this.data;
      
      return [
        this.renderSummary(summary, technologies),
        this.renderRoamingWarning(roamingCountries || summary?.roamingCountries),
        this.renderNearestTowersDropdown(towers),
        this.renderCarriersDropdown(carriers, towers),
        this.renderFooter()
      ].join('');
    }

    renderSummary(summary, technologies) {
      const coverage = this.getCoverageConfig(summary?.coverage);
      const total = summary?.total || 0;
      const nearest = summary?.nearestTower;

      const techBadges = Object.entries(technologies || {})
        .filter(([_, count]) => count > 0)
        .sort((a, b) => this.getTechConfig(a[0]).priority - this.getTechConfig(b[0]).priority)
        .map(([tech, count]) => {
          const cfg = this.getTechConfig(tech);
          return `<span class="cell-tech-badge ${cfg.class}">${escapeHtml(cfg.label)}<span class="cell-tech-count">${count}</span></span>`;
        })
        .join('');

      return `
        <div class="cell-summary">
          <div class="cell-summary-row">
            <div class="cell-coverage-pill ${coverage.class}">
              <span class="cell-coverage-icon">${coverage.icon}</span>
              <span class="cell-coverage-label">${escapeHtml(coverage.label)}</span>
            </div>
            <div class="cell-summary-stats">
              <span class="cell-stat"><strong>${total}</strong> towers</span>
              ${nearest ? `<span class="cell-stat"><strong>${this.formatDistance(nearest)}</strong> nearest</span>` : ''}
            </div>
          </div>
          ${techBadges ? `<div class="cell-tech-row">${techBadges}</div>` : ''}
        </div>
      `;
    }

    renderRoamingWarning(roamingCountries) {
      if (!roamingCountries?.length) return '';
      const flags = roamingCountries.map(r => r.flag || '🌐').join(' ');
      return `
        <div class="cell-roaming-warning">
          <span class="cell-roaming-icon">⚠️</span>
          <span>Roaming detected: ${flags} — Verify PLMN to avoid unplanned charges</span>
        </div>
      `;
    }

    renderNearestTowersDropdown(towers) {
      if (!towers?.length) return '';

      const displayTowers = towers.slice(0, CONFIG.MAX_TOWERS_SUMMARY);
      const nearestDist = towers[0]?.distance;
      const summaryText = `${towers.length} tower${towers.length !== 1 ? 's' : ''} · nearest ${this.formatDistance(nearestDist)}`;

      const rows = displayTowers.map(t => this.renderTowerRow(t)).join('');

      return `
        <details class="cell-dropdown">
          <summary class="cell-dropdown-summary">
            <span class="cell-dropdown-title">📡 Nearest Towers</span>
            <span class="cell-dropdown-meta">${escapeHtml(summaryText)}</span>
          </summary>
          <div class="cell-dropdown-content">
            <div class="cell-tower-table">
              <div class="cell-tower-header">
                <span>Tech</span>
                <span>Carrier</span>
                <span>Dist</span>
                <span>Bearing</span>
                <span></span>
              </div>
              ${rows}
            </div>
          </div>
        </details>
      `;
    }

    renderTowerRow(tower) {
      const tech = tower.technology || tower.radio || 'Unknown';
      const techCfg = this.getTechConfig(tech);
      const bearing = tower.bearingDeg ?? tower.bearing;
      const mapLink = this.buildMapLink(tower.lat, tower.lon);
      const carrierDisplay = `${tower.flag || ''} ${tower.carrier || 'Unknown'}`.trim();

      return `
        <div class="cell-tower-row">
          <span class="cell-tower-tech ${techCfg.class}">${escapeHtml(techCfg.label)}</span>
          <span class="cell-tower-carrier" title="${escapeHtml(carrierDisplay)}">${escapeHtml(carrierDisplay)}</span>
          <span class="cell-tower-distance">${this.formatDistance(tower.distance)}</span>
          <span class="cell-tower-bearing">${this.formatBearing(bearing)}</span>
          <span class="cell-tower-map">${mapLink}</span>
        </div>
      `;
    }

    renderCarriersDropdown(carriers, allTowers) {
      if (!carriers?.length) return '';

      const carrierCount = carriers.length;
      const summaryText = `${carrierCount} carrier${carrierCount !== 1 ? 's' : ''} in range`;

      const carrierItems = carriers
        .slice(0, CONFIG.MAX_CARRIERS_DISPLAY)
        .map((carrier, idx) => this.renderCarrierItem(carrier, allTowers, idx))
        .join('');

      return `
        <details class="cell-dropdown">
          <summary class="cell-dropdown-summary">
            <span class="cell-dropdown-title">📶 Carriers</span>
            <span class="cell-dropdown-meta">${escapeHtml(summaryText)}</span>
          </summary>
          <div class="cell-dropdown-content cell-carriers-list">
            ${carrierItems}
          </div>
        </details>
      `;
    }

    renderCarrierItem(carrier, allTowers, idx) {
      const mcc = carrier.mcc || '???';
      const mnc = carrier.mnc || '??';
      const plmn = `${mcc}${mnc}`.replace(/-/g, '');
      const flag = carrier.flag || '';
      const name = carrier.name || `MCC ${mcc} / MNC ${mnc}`;
      const towerCount = carrier.count || 0;

      // Get this carrier's towers
      const carrierTowers = (allTowers || []).filter(t => 
        String(t.mcc) === String(mcc) && String(t.mnc) === String(mnc)
      );

      // Tech breakdown
      const techBreakdown = Object.entries(carrier.technologies || {})
        .filter(([_, count]) => count > 0)
        .sort((a, b) => this.getTechConfig(a[0]).priority - this.getTechConfig(b[0]).priority)
        .map(([tech, count]) => {
          const cfg = this.getTechConfig(tech);
          return `<span class="cell-carrier-tech-badge ${cfg.class}">${cfg.label}: ${count}</span>`;
        })
        .join('');

      // Bands grouped by technology
      const bandsGrouped = this.parseBands(carrier);
      const bandsHtml = this.renderBandsGrouped(bandsGrouped);

      // Nested tower list
      const hasTowers = carrierTowers.length > 0;
      const towerRows = carrierTowers
        .slice(0, CONFIG.MAX_CARRIER_TOWERS)
        .map(t => this.renderTowerRow(t))
        .join('');

      return `
        <details class="cell-carrier-item">
          <summary class="cell-carrier-summary">
            <div class="cell-carrier-main">
              ${flag ? `<span class="cell-carrier-flag">${flag}</span>` : ''}
              <span class="cell-carrier-name">${escapeHtml(name)}</span>
              <span class="cell-carrier-plmn">${escapeHtml(plmn)}</span>
            </div>
            <span class="cell-carrier-count">${towerCount} tower${towerCount !== 1 ? 's' : ''}</span>
          </summary>
          <div class="cell-carrier-details">
            ${techBreakdown ? `<div class="cell-carrier-techs">${techBreakdown}</div>` : ''}
            ${bandsHtml}
            ${hasTowers ? `
              <details class="cell-carrier-towers-dropdown">
                <summary class="cell-carrier-towers-summary">
                  View ${carrierTowers.length} tower${carrierTowers.length !== 1 ? 's' : ''}
                </summary>
                <div class="cell-tower-table cell-carrier-tower-table">
                  <div class="cell-tower-header">
                    <span>Tech</span>
                    <span>Carrier</span>
                    <span>Dist</span>
                    <span>Bearing</span>
                    <span></span>
                  </div>
                  ${towerRows}
                </div>
              </details>
            ` : ''}
          </div>
        </details>
      `;
    }

    renderBandsGrouped(bandsGrouped) {
      if (!bandsGrouped || !Object.keys(bandsGrouped).length) return '';

      const techOrder = ['5G', 'LTE', 'UMTS', 'GSM', 'CDMA', 'Other'];
      const sections = techOrder
        .filter(tech => bandsGrouped[tech]?.length)
        .map(tech => {
          const cfg = this.getTechConfig(tech);
          const badges = bandsGrouped[tech]
            .map(band => `<span class="cell-band-badge ${cfg.class}">${escapeHtml(band)}</span>`)
            .join('');
          return `
            <div class="cell-bands-group">
              <span class="cell-bands-label ${cfg.class}">${cfg.label}:</span>
              <div class="cell-bands-list">${badges}</div>
            </div>
          `;
        })
        .join('');

      return sections ? `<div class="cell-bands-section">${sections}</div>` : '';
    }

    renderFooter() {
      const decl = this.getDeclination();
      const declText = decl != null && isFinite(decl)
        ? `Declination: ${decl > 0 ? '+' : ''}${decl.toFixed(1)}° (NOAA WMM)`
        : 'Declination: calculating…';

      return `
        <div class="cell-footer">
          <div class="cell-footer-note">${declText}</div>
          <div class="cell-footer-note">Verify PLMN/MCC near borders to avoid unplanned roaming</div>
          <div class="cell-footer-source">
            Source: <a class="inline-link" href="https://opencellid.org" target="_blank" rel="noopener noreferrer">OpenCellID</a>
            • Updated: ${this.formatTimestamp()}
          </div>
        </div>
      `;
    }

    afterRender() {
      Layout.queue();
    }
  }

  // ============================================================
  // Register
  // ============================================================
  window.CommDashboard.CellularCard = CellularCard;

})();
