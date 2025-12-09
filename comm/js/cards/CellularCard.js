/**
 * CellularCard.js
 * Cellular coverage assessment card for Comm Dashboard
 * 
 * Features:
 * - Carrier detection with MCC/MNC lookup
 * - Technology breakdown (5G/LTE/UMTS/GSM/CDMA)
 * - Nearest tower bearings (True/Magnetic)
 * - Coverage quality assessment
 * - Roaming detection & warnings
 * - Band information display
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
    SEARCH_RADIUS: 500, // meters
    MAX_TOWERS_DISPLAY: 5,
    MAX_CARRIERS_EXPANDED: 3,
    REFRESH_ON_LOCATION: true
  };

  // Technology display priority and styling
  const TECH_CONFIG = {
    '5G':   { priority: 1, class: 'cell-tech-5g',   label: '5G' },
    'NR':   { priority: 1, class: 'cell-tech-5g',   label: '5G NR' },
    'LTE':  { priority: 2, class: 'cell-tech-lte',  label: 'LTE' },
    'UMTS': { priority: 3, class: 'cell-tech-umts', label: 'UMTS' },
    'HSPA': { priority: 3, class: 'cell-tech-umts', label: 'HSPA' },
    'GSM':  { priority: 4, class: 'cell-tech-gsm',  label: 'GSM' },
    'CDMA': { priority: 5, class: 'cell-tech-cdma', label: 'CDMA' }
  };

  // Coverage quality thresholds and display
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
      this.expandedCarriers = new Set();
    }

    // ----------------------------------------------------------
    // Lifecycle
    // ----------------------------------------------------------
    init() {
      super.init();
      
      // Listen for location changes
      this.subscribe('comm:location-changed', (loc) => {
        this.location = loc;
        this.fetchData();
      });

      // Listen for declination updates (for magnetic bearing calc)
      this.subscribe('declination:updated', () => {
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

      // Skip polar regions (no cell coverage)
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

      try {
        const url = `${CONFIG.API_URL}?lat=${lat}&lon=${lon}&range=${CONFIG.SEARCH_RADIUS}`;
        const res = await fetch(url);
        
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

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

    // ----------------------------------------------------------
    // Helpers
    // ----------------------------------------------------------
    getDeclination() {
      // Try to get declination from CommPlanner or global
      return window.CommDashboard?.getDeclination?.() 
        || window.RussellTV?.CommPlanner?.getDeclination?.()
        || null;
    }

    formatBearing(trueBearing) {
      if (trueBearing == null) return '—';
      
      const decl = this.getDeclination();
      const trueStr = `${Math.round(trueBearing)}°T`;
      
      if (decl != null) {
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
        hour: '2-digit', 
        minute: '2-digit', 
        hour12: false 
      }).replace(':', '');
      const day = String(d.getDate()).padStart(2, '0');
      const month = d.toLocaleDateString(undefined, { month: 'short' });
      const year = d.getFullYear().toString().slice(-2);
      return `${time} ${day} ${month} ${year}`;
    }

    getTechConfig(tech) {
      return TECH_CONFIG[tech] || { priority: 99, class: 'cell-tech-other', label: tech };
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
      // Waiting for location
      if (!this.location) {
        return this.renderWaitingState();
      }

      // Loading state
      if (this.isLoading) {
        return this.renderLoadingState();
      }

      // Error state
      if (this.error && !this.data?.towers?.length) {
        return this.renderErrorState();
      }

      // No data / no coverage
      if (!this.data?.towers?.length) {
        return this.renderNoCoverage();
      }

      // Full render
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
        this.renderSummarySection(summary, technologies),
        this.renderRoamingWarning(roamingCountries),
        this.renderCarriersSection(carriers),
        this.renderNearestTowers(towers),
        this.renderFooter()
      ].join('');
    }

    renderSummarySection(summary, technologies) {
      const coverage = this.getCoverageConfig(summary?.coverage);
      const total = summary?.total || 0;
      const nearest = summary?.nearestTower;

      // Build technology badges
      const techBadges = Object.entries(technologies || {})
        .filter(([_, count]) => count > 0)
        .sort((a, b) => this.getTechConfig(a[0]).priority - this.getTechConfig(b[0]).priority)
        .map(([tech, count]) => {
          const cfg = this.getTechConfig(tech);
          return `<span class="cell-tech-badge ${cfg.class}">${escapeHtml(cfg.label)} <span class="cell-tech-count">${count}</span></span>`;
        })
        .join('');

      return `
        <div class="cell-summary">
          <div class="cell-summary-main">
            <div class="cell-coverage-indicator ${coverage.class}">
              <span class="cell-coverage-icon">${coverage.icon}</span>
              <span class="cell-coverage-label">${escapeHtml(coverage.label)}</span>
            </div>
            <div class="cell-summary-stats">
              <div class="cell-stat">
                <span class="cell-stat-value">${total}</span>
                <span class="cell-stat-label">towers</span>
              </div>
              ${nearest ? `
              <div class="cell-stat">
                <span class="cell-stat-value">${this.formatDistance(nearest)}</span>
                <span class="cell-stat-label">nearest</span>
              </div>
              ` : ''}
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
          <span class="cell-roaming-text">
            Roaming detected: ${flags} — Verify PLMN to avoid unplanned charges
          </span>
        </div>
      `;
    }

    renderCarriersSection(carriers) {
      if (!carriers?.length) return '';

      const carrierHtml = carriers
        .slice(0, 6)
        .map((carrier, idx) => this.renderCarrier(carrier, idx))
        .join('');

      return `
        <div class="cell-section">
          <div class="cell-section-header">
            <span class="cell-section-title">Carriers Detected</span>
            <span class="cell-section-count">${carriers.length}</span>
          </div>
          <div class="cell-carriers-grid">
            ${carrierHtml}
          </div>
        </div>
      `;
    }

    renderCarrier(carrier, idx) {
      const mcc = carrier.mcc || '???';
      const mnc = carrier.mnc || '??';
      const plmn = `${mcc}${mnc}`.replace(/-/g, '');
      const flag = carrier.flag || '';
      const name = carrier.name || `MCC ${mcc} / MNC ${mnc}`;
      const towerCount = carrier.count || carrier.towers?.length || 0;
      const isExpanded = this.expandedCarriers.has(idx);

      // Technology breakdown for this carrier
      const techBreakdown = Object.entries(carrier.technologies || {})
        .filter(([_, count]) => count > 0)
        .sort((a, b) => this.getTechConfig(a[0]).priority - this.getTechConfig(b[0]).priority)
        .map(([tech, count]) => {
          const cfg = this.getTechConfig(tech);
          return `<span class="cell-carrier-tech ${cfg.class}">${cfg.label}: ${count}</span>`;
        })
        .join('');

      // Band badges
      const bandBadges = (carrier.bands || [])
        .slice(0, 8)
        .map(band => {
          const techPrefix = band.split(' ')[0];
          const cfg = this.getTechConfig(techPrefix);
          return `<span class="cell-band-badge ${cfg.class}">${escapeHtml(band)}</span>`;
        })
        .join('');

      return `
        <div class="cell-carrier ${isExpanded ? 'expanded' : ''}" data-carrier-idx="${idx}">
          <div class="cell-carrier-header">
            <div class="cell-carrier-identity">
              ${flag ? `<span class="cell-carrier-flag">${flag}</span>` : ''}
              <span class="cell-carrier-name">${escapeHtml(name)}</span>
            </div>
            <div class="cell-carrier-meta">
              <span class="cell-carrier-plmn" title="PLMN / MCC-MNC">${escapeHtml(plmn)}</span>
              <span class="cell-carrier-towers">${towerCount} towers</span>
            </div>
          </div>
          ${techBreakdown ? `<div class="cell-carrier-techs">${techBreakdown}</div>` : ''}
          ${bandBadges ? `<div class="cell-carrier-bands">${bandBadges}</div>` : ''}
        </div>
      `;
    }

    renderNearestTowers(towers) {
      if (!towers?.length) return '';

      const displayTowers = towers.slice(0, CONFIG.MAX_TOWERS_DISPLAY);
      
      const towerRows = displayTowers.map(tower => {
        const tech = tower.technology || tower.radio || 'Unknown';
        const techCfg = this.getTechConfig(tech);
        const bearing = tower.bearingDeg ?? tower.bearing;
        const mapLink = this.buildMapLink(tower.lat, tower.lon);

        return `
          <div class="cell-tower-row">
            <span class="cell-tower-tech ${techCfg.class}">${escapeHtml(techCfg.label)}</span>
            <span class="cell-tower-carrier">${escapeHtml(tower.flag || '')} ${escapeHtml(tower.carrier || '')}</span>
            <span class="cell-tower-distance">${this.formatDistance(tower.distance)}</span>
            <span class="cell-tower-bearing">${this.formatBearing(bearing)}</span>
            <span class="cell-tower-map">${mapLink}</span>
          </div>
        `;
      }).join('');

      return `
        <div class="cell-section">
          <div class="cell-section-header">
            <span class="cell-section-title">Nearest Towers</span>
          </div>
          <div class="cell-tower-table">
            <div class="cell-tower-header">
              <span>Tech</span>
              <span>Carrier</span>
              <span>Dist</span>
              <span>Bearing</span>
              <span></span>
            </div>
            ${towerRows}
          </div>
        </div>
      `;
    }

    renderFooter() {
      const decl = this.getDeclination();
      const declNote = decl != null 
        ? `Declination: ${decl > 0 ? '+' : ''}${decl.toFixed(1)}° (NOAA WMM)`
        : 'Declination unavailable';

      return `
        <div class="cell-footer">
          <div class="cell-footer-note">${declNote}</div>
          <div class="cell-footer-note">Verify PLMN/MCC near borders to avoid unplanned roaming</div>
          <div class="cell-footer-source">
            Source: <a class="inline-link" href="https://opencellid.org" target="_blank" rel="noopener noreferrer">OpenCellID</a>
            • Updated: ${this.formatTimestamp()}
          </div>
        </div>
      `;
    }

    // ----------------------------------------------------------
    // Post-render & Events
    // ----------------------------------------------------------
    afterRender() {
      // Wire up carrier expand/collapse (if needed in future)
      this.$$('.cell-carrier').forEach(el => {
        el.addEventListener('click', (e) => {
          if (e.target.closest('a')) return; // Don't toggle on link clicks
          const idx = parseInt(el.dataset.carrierIdx, 10);
          if (this.expandedCarriers.has(idx)) {
            this.expandedCarriers.delete(idx);
          } else {
            this.expandedCarriers.add(idx);
          }
          // Could re-render just this carrier, but full re-render is fine for now
        });
      });

      Layout.queue();
    }
  }

  // ============================================================
  // Register Card
  // ============================================================
  window.CommDashboard.CellularCard = CellularCard;

})();
