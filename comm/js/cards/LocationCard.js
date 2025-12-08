/**
 * LocationCard.js
 * Location selection card with multiple input modes
 * Emits: 'comm:location-changed' when location is selected
 */

(function () {
  'use strict';

  const { BaseCard, Events, Storage, Layout, escapeHtml, $ } = window.CommDashboard;

  // ============================================================
  // Constants
  // ============================================================
  const STORAGE_KEYS = {
    RECENT: 'commRecentLocations',
    SELECTED: 'commSelectedLocation'
  };

  const MAX_RECENT = 7;
  const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';
  const BACKUP_GEOCODER = 'https://geocode.maps.co/search';

  const INPUT_MODES = {
    SEARCH: 'search',
    MGRS: 'mgrs',
    LATLON: 'latlon',
    MAIDEN: 'maiden'
  };

  // ============================================================
  // LocationCard Class
  // ============================================================
  class LocationCard extends BaseCard {
    constructor() {
      super({
        id: 'comm-card-location',
        title: 'Location',
        metaId: null  // No status display in header
      });

      this.mode = INPUT_MODES.SEARCH;
      this.selectedLocation = null;
      this.recentLocations = [];
      this.autocompleteResults = [];
      this.autocompleteTimeout = null;
    }

    init() {
      super.init();
      this.loadRecent();
      this.loadSelected();

      // If we have a persisted location, apply it
      if (this.selectedLocation) {
        this.applyLocation(this.selectedLocation, false);
      }
    }

    // ============================================================
    // Rendering
    // ============================================================

    renderBody() {
      return `
        <div class="comm-location-tabs">
          ${this.renderTabs()}
        </div>
        <div id="comm-location-input-area" class="comm-location-input-area">
          ${this.renderInputArea()}
        </div>
        <div class="comm-location-display" id="comm-location-display">
          ${this.renderLocationDisplay()}
        </div>
        <div class="comm-location-footer">
          <div class="comm-recent-wrapper">
            <div class="comm-recent-header">
              <span class="comm-recent-label">Recent</span>
              <button type="button" id="comm-clear-recents" class="comm-recent-clear" aria-label="Clear recent locations">Clear</button>
            </div>
            <div id="comm-recent-list" class="comm-recent-list">
              ${this.renderRecentList()}
            </div>
          </div>
        </div>
      `;
    }

    renderTabs() {
      const tabs = [
        { mode: INPUT_MODES.SEARCH, label: 'Search' },
        { mode: INPUT_MODES.MGRS, label: 'MGRS' },
        { mode: INPUT_MODES.LATLON, label: 'Lat/Long' },
        { mode: INPUT_MODES.MAIDEN, label: 'Grid' }
      ];

      return tabs.map(t => `
        <button type="button" 
                class="location-mode-tab ${this.mode === t.mode ? 'active' : ''}" 
                data-mode="${t.mode}">
          ${t.label}
        </button>
      `).join('');
    }

    renderInputArea() {
      switch (this.mode) {
        case INPUT_MODES.SEARCH:
          return this.renderSearchInput();
        case INPUT_MODES.MGRS:
          return this.renderMgrsInput();
        case INPUT_MODES.LATLON:
          return this.renderLatLonInput();
        case INPUT_MODES.MAIDEN:
          return this.renderMaidenInput();
        default:
          return this.renderSearchInput();
      }
    }

    renderSearchInput() {
      return `
        <div class="location-input-hint">Search by city, address, or place name</div>
        <div class="location-search-container">
          <input type="text" 
                 id="comm-location-search" 
                 class="location-search-input" 
                 placeholder="Enter location..."
                 autocomplete="off">
          <div id="comm-autocomplete-list" class="autocomplete-list"></div>
        </div>
      `;
    }

    renderMgrsInput() {
      return `
        <div class="location-input-hint">Enter MGRS coordinate (e.g., 33UUP0500912000)</div>
        <div class="location-coord-input">
          <input type="text" 
                 id="comm-mgrs-input" 
                 class="location-search-input" 
                 placeholder="MGRS coordinate..."
                 autocomplete="off">
          <button type="button" id="comm-mgrs-go" class="location-go-btn">Go</button>
        </div>
      `;
    }

    renderLatLonInput() {
      return `
        <div class="location-input-hint">Enter decimal degrees</div>
        <div class="location-coord-inputs">
          <input type="text" 
                 id="comm-lat-input" 
                 class="location-coord-field" 
                 placeholder="Latitude (e.g., 38.8977)"
                 autocomplete="off">
          <input type="text" 
                 id="comm-lon-input" 
                 class="location-coord-field" 
                 placeholder="Longitude (e.g., -77.0365)"
                 autocomplete="off">
          <button type="button" id="comm-latlon-go" class="location-go-btn">Go</button>
        </div>
      `;
    }

    renderMaidenInput() {
      return `
        <div class="location-input-hint">Enter Maidenhead grid locator (e.g., FM18lw)</div>
        <div class="location-coord-input">
          <input type="text" 
                 id="comm-maiden-input" 
                 class="location-search-input" 
                 placeholder="Grid square..."
                 autocomplete="off"
                 maxlength="8">
          <button type="button" id="comm-maiden-go" class="location-go-btn">Go</button>
        </div>
      `;
    }

    renderLocationDisplay() {
      if (!this.selectedLocation) {
        return '';
      }

      const loc = this.selectedLocation;
      const idents = loc.identifiers || this.buildIdentifiers(loc.coords);

      return `
        <div class="comm-location-lines">
          <div class="loc-group">
            <span class="loc-label">Selected</span>
            <span class="loc-primary">${escapeHtml(loc.label || 'Unknown')}</span>
          </div>
          <div class="loc-group">
            <span class="loc-label">Coordinates</span>
            <span class="loc-value">${escapeHtml(idents.latlon || '')}</span>
          </div>
          ${idents.mgrs ? `
          <div class="loc-group">
            <span class="loc-label">MGRS</span>
            <span class="loc-value">${escapeHtml(idents.mgrs)}</span>
          </div>
          ` : ''}
          ${idents.maiden ? `
          <div class="loc-group">
            <span class="loc-label">Grid</span>
            <span class="loc-value">${escapeHtml(idents.maiden)}</span>
          </div>
          ` : ''}
        </div>
      `;
    }

    renderRecentList() {
      if (!this.recentLocations.length) {
        return '<div class="comm-placeholder" style="font-size:0.8rem;">No recent locations</div>';
      }

      return this.recentLocations.map((loc, idx) => {
        const sub = loc.identifiers?.latlon || '';
        return `
          <button type="button" class="recent-location-pill" data-index="${idx}">
            <span class="recent-label">${escapeHtml(loc.label || 'Unknown')}</span>
            ${sub ? `<span class="recent-sub">${escapeHtml(sub)}</span>` : ''}
          </button>
        `;
      }).join('');
    }

    afterRender() {
      this.bindTabEvents();
      this.bindInputEvents();
      this.bindRecentEvents();
    }

    // ============================================================
    // Event Binding
    // ============================================================

    bindTabEvents() {
      this.$$('.location-mode-tab').forEach(btn => {
        btn.addEventListener('click', () => {
          this.setMode(btn.dataset.mode);
        });
      });
    }

    bindInputEvents() {
      // Search mode
      const searchInput = this.$('#comm-location-search');
      if (searchInput) {
        searchInput.addEventListener('input', (e) => this.handleSearchInput(e));
        searchInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') this.handleSearchSubmit();
        });
      }

      // MGRS mode
      const mgrsInput = this.$('#comm-mgrs-input');
      const mgrsGo = this.$('#comm-mgrs-go');
      if (mgrsInput && mgrsGo) {
        mgrsGo.addEventListener('click', () => this.handleMgrsSubmit());
        mgrsInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') this.handleMgrsSubmit();
        });
      }

      // Lat/Lon mode
      const latInput = this.$('#comm-lat-input');
      const lonInput = this.$('#comm-lon-input');
      const latlonGo = this.$('#comm-latlon-go');
      if (latInput && lonInput && latlonGo) {
        latlonGo.addEventListener('click', () => this.handleLatLonSubmit());
        [latInput, lonInput].forEach(input => {
          input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.handleLatLonSubmit();
          });
        });
      }

      // Maidenhead mode
      const maidenInput = this.$('#comm-maiden-input');
      const maidenGo = this.$('#comm-maiden-go');
      if (maidenInput && maidenGo) {
        maidenGo.addEventListener('click', () => this.handleMaidenSubmit());
        maidenInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') this.handleMaidenSubmit();
        });
      }
    }

    bindRecentEvents() {
      const clearBtn = this.$('#comm-clear-recents');
      if (clearBtn) {
        clearBtn.addEventListener('click', () => this.clearRecent());
      }

      this.$$('.recent-location-pill').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.dataset.index, 10);
          const loc = this.recentLocations[idx];
          if (loc) this.applyLocation(loc);
        });
      });
    }

    // ============================================================
    // Mode Switching
    // ============================================================

    setMode(mode) {
      if (!Object.values(INPUT_MODES).includes(mode)) return;
      this.mode = mode;

      // Update tabs
      this.$$('.location-mode-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
      });

      // Re-render input area
      const inputArea = this.$('#comm-location-input-area');
      if (inputArea) {
        inputArea.innerHTML = this.renderInputArea();
        this.bindInputEvents();
      }
    }

    // ============================================================
    // Search Input Handling
    // ============================================================

    handleSearchInput(e) {
      const query = e.target.value.trim();
      clearTimeout(this.autocompleteTimeout);

      if (query.length < 2) {
        this.clearAutocomplete();
        return;
      }

      this.autocompleteTimeout = setTimeout(() => {
        this.fetchAutocomplete(query);
      }, 300);
    }

    async fetchAutocomplete(query) {
      try {
        const url = `${NOMINATIM_URL}/search?format=json&q=${encodeURIComponent(query)}&limit=5`;
        const resp = await fetch(url, {
          headers: { 'User-Agent': 'CommDashboard/1.0' }
        });

        if (!resp.ok) throw new Error('Geocoder error');

        const results = await resp.json();
        this.autocompleteResults = results;
        this.renderAutocomplete(results);
      } catch (err) {
        console.warn('[LocationCard] Autocomplete error:', err);
        // Try backup geocoder
        this.fetchAutocompleteBackup(query);
      }
    }

    async fetchAutocompleteBackup(query) {
      try {
        const url = `${BACKUP_GEOCODER}?q=${encodeURIComponent(query)}&limit=5`;
        const resp = await fetch(url);
        if (!resp.ok) return;

        const results = await resp.json();
        this.autocompleteResults = results;
        this.renderAutocomplete(results);
      } catch (err) {
        console.warn('[LocationCard] Backup geocoder error:', err);
      }
    }

    renderAutocomplete(results) {
      const list = this.$('#comm-autocomplete-list');
      if (!list) return;

      if (!results.length) {
        list.innerHTML = '';
        list.classList.remove('active');
        return;
      }

      list.innerHTML = results.map((r, i) => `
        <div class="autocomplete-item" data-index="${i}">
          ${escapeHtml(r.display_name || r.name || 'Unknown')}
        </div>
      `).join('');

      list.classList.add('active');

      // Bind click events
      list.querySelectorAll('.autocomplete-item').forEach(item => {
        item.addEventListener('click', () => {
          const idx = parseInt(item.dataset.index, 10);
          const result = this.autocompleteResults[idx];
          if (result) this.selectAutocompleteResult(result);
        });
      });
    }

    clearAutocomplete() {
      const list = this.$('#comm-autocomplete-list');
      if (list) {
        list.innerHTML = '';
        list.classList.remove('active');
      }
      this.autocompleteResults = [];
    }

    selectAutocompleteResult(result) {
      const lat = parseFloat(result.lat);
      const lon = parseFloat(result.lon);

      if (isNaN(lat) || isNaN(lon)) return;

      const loc = {
        label: this.formatLocationLabel(result),
        coords: { lat, lon },
        source: 'search',
        identifiers: this.buildIdentifiers({ lat, lon })
      };

      this.applyLocation(loc);
      this.clearAutocomplete();

      const input = this.$('#comm-location-search');
      if (input) input.value = '';
    }

    handleSearchSubmit() {
      // If we have autocomplete results, select the first one
      if (this.autocompleteResults.length) {
        this.selectAutocompleteResult(this.autocompleteResults[0]);
      }
    }

    // ============================================================
    // MGRS Input
    // ============================================================

    handleMgrsSubmit() {
      const input = this.$('#comm-mgrs-input');
      if (!input) return;

      const mgrs = input.value.trim().toUpperCase();
      if (!mgrs) return;

      try {
        const coords = this.mgrsToLatLon(mgrs);
        if (!coords) {
          alert('Invalid MGRS coordinate');
          return;
        }

        const loc = {
          label: mgrs,
          coords,
          source: 'mgrs',
          identifiers: this.buildIdentifiers(coords)
        };

        this.applyLocation(loc);
        input.value = '';
      } catch (err) {
        alert('Invalid MGRS coordinate');
      }
    }

    // ============================================================
    // Lat/Lon Input
    // ============================================================

    handleLatLonSubmit() {
      const latInput = this.$('#comm-lat-input');
      const lonInput = this.$('#comm-lon-input');
      if (!latInput || !lonInput) return;

      const lat = parseFloat(latInput.value.trim());
      const lon = parseFloat(lonInput.value.trim());

      if (isNaN(lat) || isNaN(lon)) {
        alert('Please enter valid latitude and longitude');
        return;
      }

      if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        alert('Coordinates out of range');
        return;
      }

      const coords = { lat, lon };
      const loc = {
        label: `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
        coords,
        source: 'latlon',
        identifiers: this.buildIdentifiers(coords)
      };

      this.applyLocation(loc);
      latInput.value = '';
      lonInput.value = '';
    }

    // ============================================================
    // Maidenhead Input
    // ============================================================

    handleMaidenSubmit() {
      const input = this.$('#comm-maiden-input');
      if (!input) return;

      const grid = input.value.trim().toUpperCase();
      if (!grid) return;

      const coords = this.maidenToLatLon(grid);
      if (!coords) {
        alert('Invalid grid square');
        return;
      }

      const loc = {
        label: grid,
        coords,
        source: 'maiden',
        identifiers: this.buildIdentifiers(coords)
      };

      this.applyLocation(loc);
      input.value = '';
    }

    // ============================================================
    // Location Application
    // ============================================================

    applyLocation(loc, addToRecent = true) {
      this.selectedLocation = loc;

      if (addToRecent) {
        this.addRecent(loc);
      }

      this.saveSelected();
      this.updateDisplay();
      this.updateStatus();

      // Emit event for other cards to consume
      Events.emit('comm:location-changed', loc);
    }

    updateDisplay() {
      const display = this.$('#comm-location-display');
      if (display) {
        display.innerHTML = this.renderLocationDisplay();
      }
      Layout.queue();
    }

    // ============================================================
    // Recent Locations
    // ============================================================

    loadRecent() {
      const saved = Storage.get(STORAGE_KEYS.RECENT, []);
      this.recentLocations = saved.map(r => ({
        ...r,
        identifiers: r.identifiers || this.buildIdentifiers(r.coords)
      }));
    }

    saveRecent() {
      Storage.set(STORAGE_KEYS.RECENT, this.recentLocations);
    }

    addRecent(loc) {
      if (!loc || !loc.coords) return;

      // Remove duplicates (same coords within ~0.001 degrees)
      this.recentLocations = this.recentLocations.filter(r => {
        const dLat = Math.abs(r.coords.lat - loc.coords.lat);
        const dLon = Math.abs(r.coords.lon - loc.coords.lon);
        return dLat > 0.001 || dLon > 0.001;
      });

      // Add to front
      this.recentLocations.unshift(loc);

      // Trim to max
      if (this.recentLocations.length > MAX_RECENT) {
        this.recentLocations = this.recentLocations.slice(0, MAX_RECENT);
      }

      this.saveRecent();
      this.updateRecentList();
    }

    clearRecent() {
      this.recentLocations = [];
      Storage.remove(STORAGE_KEYS.RECENT);
      this.updateRecentList();
    }

    updateRecentList() {
      const list = this.$('#comm-recent-list');
      if (list) {
        list.innerHTML = this.renderRecentList();
        this.bindRecentEvents();
      }
    }

    // ============================================================
    // Selected Location Persistence
    // ============================================================

    loadSelected() {
      const saved = Storage.get(STORAGE_KEYS.SELECTED, null);
      if (saved && saved.coords) {
        saved.identifiers = saved.identifiers || this.buildIdentifiers(saved.coords);
        this.selectedLocation = saved;
      }
    }

    saveSelected() {
      if (this.selectedLocation) {
        Storage.set(STORAGE_KEYS.SELECTED, this.selectedLocation);
      } else {
        Storage.remove(STORAGE_KEYS.SELECTED);
      }
    }

    // ============================================================
    // Coordinate Conversion Utilities
    // ============================================================

    buildIdentifiers(coords) {
      if (!coords) return {};

      const { lat, lon } = coords;
      return {
        latlon: this.formatLatLon(lat, lon),
        mgrs: this.latLonToMgrs(lat, lon),
        maiden: this.latLonToMaiden(lat, lon)
      };
    }

    formatLatLon(lat, lon) {
      const latDir = lat >= 0 ? 'N' : 'S';
      const lonDir = lon >= 0 ? 'E' : 'W';
      return `${Math.abs(lat).toFixed(4)}° ${latDir}, ${Math.abs(lon).toFixed(4)}° ${lonDir}`;
    }

    formatLocationLabel(result) {
      if (!result) return 'Unknown';

      // Handle Nominatim response
      if (result.address) {
        const a = result.address;
        const parts = [
          a.city || a.town || a.village || a.municipality,
          a.state || a.region,
          a.country
        ].filter(Boolean);
        return parts.join(', ') || result.display_name || 'Unknown';
      }

      return result.display_name || result.name || 'Unknown';
    }

    // MGRS conversion (simplified - for full accuracy use a library)
    latLonToMgrs(lat, lon) {
      // Simplified MGRS - returns approximate zone + grid
      // For production, use mgrs.js library
      try {
        const zone = Math.floor((lon + 180) / 6) + 1;
        const letter = this.getUtmLatitudeBand(lat);
        const easting = Math.round(((lon + 180) % 6) / 6 * 100000);
        const northing = Math.round((lat + 90) / 180 * 10000000) % 100000;
        return `${zone}${letter} ${String(easting).padStart(5, '0')} ${String(northing).padStart(5, '0')}`;
      } catch (e) {
        return null;
      }
    }

    getUtmLatitudeBand(lat) {
      const bands = 'CDEFGHJKLMNPQRSTUVWX';
      if (lat < -80) return 'A';
      if (lat > 84) return 'Z';
      const idx = Math.floor((lat + 80) / 8);
      return bands[Math.min(idx, bands.length - 1)];
    }

    mgrsToLatLon(mgrs) {
      // Simplified MGRS parsing
      // For production, use mgrs.js library
      try {
        const match = mgrs.match(/^(\d{1,2})([C-X])([A-Z]{2})(\d+)$/i);
        if (!match) return null;

        const zone = parseInt(match[1], 10);
        const digits = match[4];
        const precision = digits.length / 2;
        const easting = parseInt(digits.slice(0, precision), 10);
        const northing = parseInt(digits.slice(precision), 10);

        // Very rough conversion
        const lon = (zone - 1) * 6 - 180 + 3 + (easting / Math.pow(10, precision)) * 6;
        const lat = (northing / Math.pow(10, precision)) * 180 - 90;

        return { lat, lon };
      } catch (e) {
        return null;
      }
    }

    // Maidenhead grid conversion
    latLonToMaiden(lat, lon) {
      try {
        const adjLon = lon + 180;
        const adjLat = lat + 90;

        const field1 = String.fromCharCode(65 + Math.floor(adjLon / 20));
        const field2 = String.fromCharCode(65 + Math.floor(adjLat / 10));

        const square1 = Math.floor((adjLon % 20) / 2);
        const square2 = Math.floor(adjLat % 10);

        const subsq1 = String.fromCharCode(97 + Math.floor((adjLon % 2) * 12));
        const subsq2 = String.fromCharCode(97 + Math.floor((adjLat % 1) * 24));

        return `${field1}${field2}${square1}${square2}${subsq1}${subsq2}`;
      } catch (e) {
        return null;
      }
    }

    maidenToLatLon(grid) {
      try {
        grid = grid.toUpperCase();
        if (grid.length < 4) return null;

        const lon = (grid.charCodeAt(0) - 65) * 20 - 180;
        const lat = (grid.charCodeAt(1) - 65) * 10 - 90;

        let lonOffset = parseInt(grid[2], 10) * 2;
        let latOffset = parseInt(grid[3], 10);

        if (grid.length >= 6) {
          lonOffset += (grid.charCodeAt(4) - 65) / 12;
          latOffset += (grid.charCodeAt(5) - 65) / 24;
        }

        return {
          lat: lat + latOffset + 0.5,
          lon: lon + lonOffset + 1
        };
      } catch (e) {
        return null;
      }
    }

    // ============================================================
    // Status Display
    // ============================================================

    getMetaText() {
      if (!this.selectedLocation) {
        return '';
      }
      return escapeHtml(this.selectedLocation.label || 'Location set');
    }

    // ============================================================
    // Public API
    // ============================================================

    getSelectedLocation() {
      return this.selectedLocation;
    }

    setLocation(lat, lon, label) {
      const coords = { lat, lon };
      const loc = {
        label: label || `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
        coords,
        source: 'api',
        identifiers: this.buildIdentifiers(coords)
      };
      this.applyLocation(loc);
    }
  }

  // ============================================================
  // Register Card
  // ============================================================
  window.CommDashboard.LocationCard = LocationCard;

})();
