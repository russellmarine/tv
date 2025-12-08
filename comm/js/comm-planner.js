/**
 * comm-planner.js
 * Main orchestrator for the Comm Dashboard
 * Registers cards, initializes the dashboard, and coordinates events
 */
(function () {
  'use strict';

  const { Events, CardRegistry, Layout, PanelToggles, init: initCore } = window.CommDashboard;

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
    const { LocationCard, SpaceWeatherCard } = window.CommDashboard;
    
    CardRegistry.register(new LocationCard());
    CardRegistry.register(new SpaceWeatherCard());
    
    // Future cards will be added here as they're refactored
  }

  // ============================================================
  // Cross-Card Event Handlers
  // ============================================================
  function setupEventHandlers() {
    // When location changes, other cards can react
    Events.on('comm:location-changed', (location) => {
      console.log('[CommPlanner] Location changed:', location.label);
    });

    // When space weather updates, downstream cards react
    Events.on('spaceweather:data-updated', (data) => {
      console.log('[CommPlanner] Space weather updated:', data);
    });
  }

  // ============================================================
  // Initialization
  // ============================================================
  function init() {
    // Initialize core systems
    initCore(PANEL_IDS);

    // Register all cards
    registerCards();

    // Set up cross-card communication
    setupEventHandlers();

    // Queue initial layout
    Layout.queue();

    console.log('[CommPlanner] Dashboard initialized');
  }

  // ============================================================
  // DOM Ready
  // ============================================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
