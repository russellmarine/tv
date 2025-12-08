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
    'comm-card-gnss',
    'comm-card-hf',
    'comm-card-satcom',
    'comm-card-satangles',
    'comm-card-cellular'
  ];

  // ============================================================
  // Card Registration
  // ============================================================
  function registerCards() {
    const { LocationCard, SpaceWeatherCard, WeatherCard, GnssCard } = window.CommDashboard;
    
    CardRegistry.register('comm-card-location', new LocationCard());
    CardRegistry.register('comm-card-spacewx', new SpaceWeatherCard());
    CardRegistry.register('comm-card-weather', new WeatherCard());
    CardRegistry.register)'comm-card-gnss', new GnssCard());
    
    // Initialize all registered cards
    CardRegistry.init();
  }

  // ============================================================
  // Cross-Card Event Handlers
  // ============================================================
  function setupEventHandlers() {
    Events.on('comm:location-changed', (location) => {
      console.log('[CommPlanner] Location changed:', location.label);
    });

    Events.on('spaceweather:data-updated', (data) => {
      console.log('[CommPlanner] Space weather updated:', data);
    });
  }

  // ============================================================
  // Initialization
  // ============================================================
  function init() {
    initCore({ panelIds: PANEL_IDS });

    registerCards();
    setupEventHandlers();

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
