/**
 * comm-map.js
 * Overlay map module for the Comm Dashboard
 * Handles toggleable map layers: weather, cell towers, submarine cables, landing stations, IXPs
 * 
 * Future additions:
 * - VHF/UHF propagation estimation
 * - Link budget calculator overlay
 * - Terrain/elevation analysis
 */

(function () {
  'use strict';

  // Ensure CommDashboard exists
  if (!window.CommDashboard) {
    console.warn('[CommMap] CommDashboard not found, waiting...');
    return;
  }

  const { Events, $, escapeHtml, Layout } = window.CommDashboard;

  // ============================================================
  // Configuration
  // ============================================================
  const CONFIG = {
    WEATHER_TILE_KEY: window.OPENWEATHER_TILE_KEY || window.OPENWEATHER_API_KEY || '',
    RADAR_PROXY_BASE: window.RADAR_PROXY_BASE || '/wx-tiles/{z}/{x}/{y}.png',
    CELL_API: '/cell',
    CABLE_URL: 'https://raw.githubusercontent.com/telegeography/www.submarinecablemap.com/master/web/public/api/cable.geo.json',
    LANDING_URL: 'https://raw.githubusercontent.com/telegeography/www.submarinecablemap.com/master/web/public/api/landing-point.geo.json',
    IXP_PROXY: window.PEERINGDB_PROXY_BASE || '',
    DEFAULT_CENTER: [39.8283, -98.5795], // US center
    DEFAULT_ZOOM: 4
  };

  // ============================================================
  // State
  // ============================================================
  const state = {
    map: null,
    baseLayer: null,
    layers: {
      weather: null,
      cell: null,
      cables: null,
      landing: null,
      ixp: null
    },
    layerData: {
      cablesLoaded: false,
      landingsLoaded: false,
      ixpLoaded: false
    },
    lastLocation: null,
    initialized: false
  };

  // ============================================================
  // DOM Elements
  // ============================================================
  const elements = {
    get card() { return document.getElementById('comm-card-overlay'); },
    get toggleBtn() { return document.getElementById('comm-map-toggle'); },
    get statusEl() { return document.getElementById('comm-overlay-status'); },
    get body() { return document.getElementById('comm-overlay-body'); }
  };

  // ============================================================
  // Rendering
  // ============================================================
  function renderShell() {
    const { body } = elements;
    if (!body) return;

    body.innerHTML = `
      <div class="overlay-map-body">
        <div class="overlay-map-controls">
          <label><input type="checkbox" data-layer="weather" checked> Weather</label>
          <label><input type="checkbox" data-layer="cell"> Cell towers</label>
          <label><input type="checkbox" data-layer="cables"> Undersea cables</label>
          <label><input type="checkbox" data-layer="landing"> Landing stations</label>
          <label><input type="checkbox" data-layer="ixp"> IXPs</label>
        </div>
        <div class="overlay-map-frame">
          <div id="comm-overlay-map" class="overlay-map-canvas"></div>
        </div>
        <div class="comm-card-micro comm-card-footer">
          Sources: OSM · OpenWeather · OpenCelliD · TeleGeography · PeeringDB
        </div>
      </div>
    `;
  }

  // ============================================================
  // Map Initialization
  // ============================================================
  function initMap(location) {
    if (typeof L === 'undefined') {
      console.warn('[CommMap] Leaflet not loaded');
      return;
    }

    const mapEl = document.getElementById('comm-overlay-map');
    if (!mapEl) return;

    // Determine center
    const center = location?.coords 
      ? [location.coords.lat, location.coords.lon]
      : CONFIG.DEFAULT_CENTER;

    // Create map
    state.map = L.map(mapEl, {
      zoomControl: true,
      attributionControl: false,
      scrollWheelZoom: true
    }).setView(center, CONFIG.DEFAULT_ZOOM);

    // Add base layer
    state.baseLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      crossOrigin: true
    }).addTo(state.map);

    // Initial layer refresh
    refreshLayers();

    state.initialized = true;
  }

  function ensureMap(location) {
    if (!state.map) {
      initMap(location);
    } else if (location?.coords) {
      state.map.setView([location.coords.lat, location.coords.lon], state.map.getZoom());
    }
    
    // Invalidate size after any DOM changes
    setTimeout(() => state.map?.invalidateSize(), 100);
  }

  // ============================================================
  // Layer Management
  // ============================================================
  function clearLayer(layer) {
    if (layer) {
      layer.remove();
    }
    return null;
  }

  function getEnabledLayers() {
    const controls = elements.body?.querySelectorAll('.overlay-map-controls input[type="checkbox"]') || [];
    const enabled = {};
    controls.forEach(cb => {
      enabled[cb.dataset.layer] = cb.checked;
    });
    return enabled;
  }

  async function refreshLayers() {
    if (!state.map) return;

    const enabled = getEnabledLayers();

    // Clear all layers first
    Object.keys(state.layers).forEach(key => {
      state.layers[key] = clearLayer(state.layers[key]);
    });

    // Weather layer
    if (enabled.weather) {
      state.layers.weather = buildWeatherLayer();
      if (state.layers.weather) {
        state.layers.weather.addTo(state.map);
      }
    }

    // Cell towers
    if (enabled.cell) {
      state.layers.cell = await buildCellLayer();
      if (state.layers.cell) {
        state.layers.cell.addTo(state.map);
      }
    }

    // Submarine cables & landing stations
    if (enabled.cables || enabled.landing) {
      await loadCableData();
      if (enabled.cables && state.layers.cables) {
        state.layers.cables.addTo(state.map);
      }
      if (enabled.landing && state.layers.landing) {
        state.layers.landing.addTo(state.map);
      }
    }

    // IXPs
    if (enabled.ixp) {
      await loadIxpData();
      if (state.layers.ixp) {
        state.layers.ixp.addTo(state.map);
      }
    }
  }

  // ============================================================
  // Layer Builders
  // ============================================================
  function buildWeatherLayer() {
    const key = CONFIG.WEATHER_TILE_KEY;
    if (!key) {
      // Use proxy if no key
      return L.tileLayer(CONFIG.RADAR_PROXY_BASE, {
        opacity: 0.7,
        maxZoom: 18
      });
    }

    return L.tileLayer(
      `https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${key}`,
      { opacity: 0.6, maxZoom: 18 }
    );
  }

  async function buildCellLayer() {
    // Cell tower data requires backend API
    // Returns empty layer group as placeholder
    return L.layerGroup([]);
  }

  async function loadCableData() {
    if (state.layerData.cablesLoaded) return;

    try {
      // Fetch submarine cables
      const cableResp = await fetch(CONFIG.CABLE_URL);
      if (cableResp.ok) {
        const cableData = await cableResp.json();
        state.layers.cables = L.geoJSON(cableData, {
          style: {
            color: '#00bfff',
            weight: 2,
            opacity: 0.7
          },
          onEachFeature: (feature, layer) => {
            if (feature.properties?.name) {
              layer.bindPopup(`<strong>${escapeHtml(feature.properties.name)}</strong>`);
            }
          }
        });
      }

      // Fetch landing points
      const landingResp = await fetch(CONFIG.LANDING_URL);
      if (landingResp.ok) {
        const landingData = await landingResp.json();
        state.layers.landing = L.geoJSON(landingData, {
          pointToLayer: (feature, latlng) => {
            return L.circleMarker(latlng, {
              radius: 5,
              color: '#ff6b6b',
              fillColor: '#ff4444',
              fillOpacity: 0.8
            });
          },
          onEachFeature: (feature, layer) => {
            if (feature.properties?.name) {
              layer.bindPopup(`<strong>${escapeHtml(feature.properties.name)}</strong>`);
            }
          }
        });
      }

      state.layerData.cablesLoaded = true;
      state.layerData.landingsLoaded = true;
    } catch (e) {
      console.warn('[CommMap] Failed to load cable data:', e);
    }
  }

  async function loadIxpData() {
    if (state.layerData.ixpLoaded || !CONFIG.IXP_PROXY) return;

    try {
      const resp = await fetch(CONFIG.IXP_PROXY);
      if (!resp.ok) return;

      const data = await resp.json();
      const entries = Array.isArray(data) ? data : (data.data || []);

      state.layers.ixp = L.layerGroup(
        entries
          .filter(ix => ix.latitude && ix.longitude)
          .map(ix => {
            return L.circleMarker([ix.latitude, ix.longitude], {
              radius: 4,
              color: '#7fe3ff',
              fillColor: '#35c7ff',
              fillOpacity: 0.7
            }).bindPopup(`<strong>${escapeHtml(ix.name)}</strong><br>ASN count: ${ix.asn_count || 'n/a'}`);
          })
      );

      state.layerData.ixpLoaded = true;
    } catch (e) {
      console.warn('[CommMap] Failed to load IXP data:', e);
    }
  }

  // ============================================================
  // Card Toggle
  // ============================================================
  function toggleCard(forceState) {
    const { card, statusEl } = elements;
    if (!card) return;

    const showing = !card.classList.contains('comm-hidden');
    const next = forceState !== undefined ? forceState : !showing;

    card.classList.toggle('comm-hidden', !next);
    
    if (statusEl) {
      statusEl.textContent = next ? 'on' : 'off';
    }

    if (next) {
      if (!state.initialized) {
        renderShell();
        wireControls();
      }
      ensureMap(state.lastLocation);
    }

    Layout.queue();
  }

  // ============================================================
  // Event Wiring
  // ============================================================
  function wireControls() {
    const { body } = elements;
    
    body?.addEventListener('change', (ev) => {
      const target = ev.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (!target.dataset.layer) return;
      refreshLayers();
    });
  }

  function init() {
    const { toggleBtn, card } = elements;

    // Toggle button
    toggleBtn?.addEventListener('click', () => toggleCard());

    // Listen for location changes
    Events.on('comm:location-changed', (loc) => {
      state.lastLocation = loc;
      if (card && !card.classList.contains('comm-hidden')) {
        ensureMap(loc);
      }
    });

    // Auto-show on load if card exists
    if (card) {
      toggleCard(true);
    }

    console.log('[CommMap] Initialized');
  }

  // ============================================================
  // Public API
  // ============================================================
  window.CommDashboard.Map = {
    init,
    toggle: toggleCard,
    refresh: refreshLayers,
    getMap: () => state.map
  };

  // ============================================================
  // Auto-Initialize
  // ============================================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
