/**
 * comm-planner.js
 * Main orchestrator for the Comm Dashboard
 * Registers cards, initializes the dashboard, and coordinates events
 */

(function () {
  'use strict';

  const { Events, CardRegistry, Layout, PanelToggles, init: initCore } = window.CommDashboard;
  const { LocationCard } = window.CommDashboard;
  // Future cards will be imported here:
  // const { SpaceWeatherCard } = window.CommDashboard;
  // const { WeatherCard } = window.CommDashboard;
  // etc.

  // ============================================================
  // Panel Configuration
  // ============================================================
  const PANEL_IDS = [
    'comm-card-location',
    'comm-card-spacewx',
    'comm-card-overlay',
    'comm-card-weather',
    'comm-card-gps',
    'comm-card-hf',
    'comm-card-satcom',
    'comm-card-satangles',
    'comm-card-cellular'
  ];

  // ============================================================
  // Card Registration
  // ============================================================
  function registerCards() {
    // Location Card (refactored)
    CardRegistry.register('comm-card-location', new LocationCard());

    // Placeholder cards - these will be refactored one by one
    // For now, they'll be handled by legacy code or show placeholders

    // Future registrations:
    // CardRegistry.register('comm-card-spacewx', new SpaceWeatherCard());
    // CardRegistry.register('comm-card-weather', new WeatherCard());
    // CardRegistry.register('comm-card-gps', new GpsCard());
    // CardRegistry.register('comm-card-hf', new HfPropagationCard());
    // CardRegistry.register('comm-card-satcom', new SatcomWeatherCard());
    // CardRegistry.register('comm-card-satangles', new SatcomPlannerCard());
    // CardRegistry.register('comm-card-cellular', new CellularCard());
  }

  // ============================================================
  // Initialization
  // ============================================================
  function init() {
    // Don't initialize if not on the comm page
    if (!document.querySelector('.comm-layout-grid')) {
      return;
    }

    // Initialize core systems
    initCore({ panelIds: PANEL_IDS });

    // Register all cards
    registerCards();

    // Initialize registered cards
    CardRegistry.init();

    // Set up cross-card event handlers
    setupEventHandlers();

    Events.emit('comm:dashboard-ready', null, true);
    console.log('[CommPlanner] Dashboard initialized');
  }

  // ============================================================
  // Cross-Card Event Handlers
  // ============================================================
  function setupEventHandlers() {
    // When location changes, other cards need to update
    Events.on('comm:location-changed', (loc) => {
      console.log('[CommPlanner] Location changed:', loc?.label);
      
      // Future: trigger updates on weather, cellular, etc.
      // CardRegistry.get('comm-card-weather')?.update(loc);
      // CardRegistry.get('comm-card-cellular')?.update(loc);
    });
  }

  // ============================================================
  // Public API
  // ============================================================
  window.CommDashboard.Planner = {
    init,
    
    // Convenience accessors
    getLocation: () => CardRegistry.get('comm-card-location')?.getSelectedLocation(),
    
    // Manual refresh
    refresh: () => {
      Layout.queue();
      CardRegistry.getAll().forEach(card => {
        if (typeof card.render === 'function') {
          card.render();
        }
      });
    }
  };

  // ============================================================
  // Auto-Initialize on DOM Ready
  // ============================================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
