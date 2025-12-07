(function () {
  'use strict';

  const root = window;
  root.RussellTV = root.RussellTV || {};
  const RTV = root.RussellTV;
  const Utils = RTV.Utils || {};

  const Layout = {
    dashboards: {},
    activeDashboard: null
  };

  // ---------- Dashboard registration ----------
  Layout.registerDashboard = function (id, initFn) {
    if (!id || typeof initFn !== 'function') return;
    Layout.dashboards[id] = initFn;
  };

  Layout.initDashboard = function (id) {
    const fn = Layout.dashboards[id];
    if (!fn) return;
    Layout.activeDashboard = id;
    fn();
  };

  // ---------- Panel toggles ----------
  // Usage:
  //   <button data-panel-toggle="defensive">...</button>
  //   <section data-panel-id="defensive">...</section>
  function initPanelToggles() {
    const all = (Utils.$$ ? Utils.$$('[data-panel-toggle]') :
      Array.prototype.slice.call(document.querySelectorAll('[data-panel-toggle]')));

    all.forEach(function (btn) {
      btn.addEventListener('click', function () {
        const id = btn.getAttribute('data-panel-toggle');
        if (!id) return;
        const panel = document.querySelector('[data-panel-id="' + id + '"]');
        if (!panel) return;
        panel.classList.toggle('rtv-panel-hidden');
      });
    });
  }

  // ---------- Masonry-ish layout ----------
  function initMasonryContainers() {
    const containers = document.querySelectorAll('[data-layout="masonry"]');
    containers.forEach(function (el) {
      el.classList.add('rtv-masonry-ready');
      // Future: plug Masonry or CSS grid enhancements here.
    });
  }

  // ---------- Export hook ----------
  Layout.exportDashboard = function (dashboardId) {
    const id = dashboardId || Layout.activeDashboard || 'unknown';
    // Stub for now; wire this to your PPTX export stack later.
    alert('Export for dashboard "' + id + '" not wired yet.');
  };

  // ---------- EventBus integration ----------
  function hookEvents() {
    const Events = RTV.Events;
    if (!Events || typeof Events.on !== 'function') return;

    Events.on('dashboard:export', function (payload) {
      Layout.exportDashboard(payload && payload.id);
    });
  }

  // ---------- Top-level init ----------
  Layout.init = function () {
    initPanelToggles();
    initMasonryContainers();
    hookEvents();
  };

  const onReady = Utils.onReady || function (fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  };

  onReady(function () {
    Layout.init();
    // Individual dashboards will call Layout.registerDashboard(...)
  });

  RTV.Layout = Layout;
})();
