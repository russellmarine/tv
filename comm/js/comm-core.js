/**
 * comm-core.js
 * Core utilities, event system, and shared functionality for the Comm Dashboard
 * Self-contained — no external dependencies
 */

(function () {
  'use strict';

  // ============================================================
  // Namespace
  // ============================================================
  window.CommDashboard = window.CommDashboard || {};

  // ============================================================
  // Event System (pub/sub)
  // ============================================================
  const Events = (function () {
    const listeners = {};
    const stickyEvents = {};

    return {
      /**
       * Subscribe to an event
       * @param {string} event - Event name
       * @param {Function} callback - Handler function
       * @returns {Function} Unsubscribe function
       */
      on(event, callback) {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(callback);

        // If this is a sticky event that already fired, call immediately
        if (stickyEvents[event]) {
          callback(stickyEvents[event].data);
        }

        return () => this.off(event, callback);
      },

      /**
       * Unsubscribe from an event
       */
      off(event, callback) {
        if (!listeners[event]) return;
        listeners[event] = listeners[event].filter(cb => cb !== callback);
      },

      /**
       * Emit an event
       * @param {string} event - Event name
       * @param {*} data - Event data
       * @param {boolean} sticky - If true, late subscribers get this event
       */
      emit(event, data, sticky = false) {
        if (sticky) {
          stickyEvents[event] = { data };
        }
        if (!listeners[event]) return;
        listeners[event].forEach(cb => {
          try {
            cb(data);
          } catch (e) {
            console.error(`[CommDashboard] Event handler error for "${event}":`, e);
          }
        });
      },

      /**
       * Subscribe to an event, auto-unsubscribe after first call
       */
      once(event, callback) {
        const unsub = this.on(event, (data) => {
          unsub();
          callback(data);
        });
        return unsub;
      }
    };
  })();

  // ============================================================
  // DOM Utilities
  // ============================================================
  function $(selector, context = document) {
    return context.querySelector(selector);
  }

  function $$(selector, context = document) {
    return Array.from(context.querySelectorAll(selector));
  }

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function createElement(tag, attrs = {}, children = []) {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([key, val]) => {
      if (key === 'className') el.className = val;
      else if (key === 'dataset') Object.assign(el.dataset, val);
      else if (key.startsWith('on') && typeof val === 'function') {
        el.addEventListener(key.slice(2).toLowerCase(), val);
      } else {
        el.setAttribute(key, val);
      }
    });
    children.forEach(child => {
      if (typeof child === 'string') {
        el.appendChild(document.createTextNode(child));
      } else if (child instanceof Node) {
        el.appendChild(child);
      }
    });
    return el;
  }

  // ============================================================
  // Formatting Utilities
  // ============================================================
  function toTitleCase(str) {
    if (!str) return '';
    return str.replace(/\b\w/g, c => c.toUpperCase());
  }

  function degreesToCardinal(deg) {
    if (deg == null || isNaN(deg)) return '';
    const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    return dirs[Math.round(deg / 22.5) % 16];
  }

  function formatCoord(val, isLat) {
    if (val == null) return '';
    const abs = Math.abs(val);
    const dir = isLat ? (val >= 0 ? 'N' : 'S') : (val >= 0 ? 'E' : 'W');
    return abs.toFixed(4) + '° ' + dir;
  }

  function formatLatLon(lat, lon) {
    return formatCoord(lat, true) + ', ' + formatCoord(lon, false);
  }

  function padZero(n, len = 2) {
    return String(n).padStart(len, '0');
  }

  function formatUtcClock(includeSeconds = true) {
    const d = new Date();
    const hh = padZero(d.getUTCHours());
    const mm = padZero(d.getUTCMinutes());
    if (!includeSeconds) return `${hh}:${mm}`;
    const ss = padZero(d.getUTCSeconds());
    return `${hh}:${mm}:${ss}`;
  }

  function formatLocalTime(epochSeconds, timezoneOffset) {
    if (!epochSeconds) return '';
    const d = new Date((epochSeconds + (timezoneOffset || 0)) * 1000);
    let h = d.getUTCHours();
    const m = padZero(d.getUTCMinutes());
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
  }

  function formatUserStamp(date) {
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleString();
  }

  function formatUtcStamp(date) {
    const d = date instanceof Date ? date : new Date(date);
    return d.toISOString().slice(0, 19).replace('T', ' ');
  }

  // ============================================================
  // Storage Utilities
  // ============================================================
  const Storage = {
    get(key, fallback = null) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (e) {
        return fallback;
      }
    },

    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (e) {
        return false;
      }
    },

    remove(key) {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        // ignore
      }
    }
  };

  // ============================================================
  // Layout Engine (Masonry-style)
  // ============================================================
  const Layout = (function () {
    const ROW_HEIGHT = 4;
    let timer = null;
    let observer = null;

    function apply() {
      const grid = $('.comm-layout-grid');
      if (!grid) return;

      const gap = parseFloat(getComputedStyle(grid).rowGap || '0') || 0;

      grid.querySelectorAll('.comm-card').forEach(card => {
        const height = card.getBoundingClientRect().height;
        const span = Math.ceil((height + gap) / (ROW_HEIGHT + gap));
        card.style.setProperty('--row-span', span);
      });
    }

    function queue() {
      clearTimeout(timer);
      timer = setTimeout(apply, 120);
    }

    function initObserver() {
      const grid = $('.comm-layout-grid');
      if (!grid || observer) return;

      observer = new ResizeObserver(() => queue());
      grid.querySelectorAll('.comm-card').forEach(card => observer.observe(card));
    }

    function observeCard(card) {
      if (observer && card) {
        observer.observe(card);
      }
    }

    return { apply, queue, initObserver, observeCard };
  })();

  // ============================================================
  // Panel Toggle System
  // ============================================================
  const PanelToggles = (function () {
    const STATE_KEY = 'commPanelVisibility';
    let panelIds = [];
    let state = {};

    function init(ids) {
      panelIds = ids;
      state = ids.reduce((acc, id) => {
        const card = document.getElementById(id);
        acc[id] = card ? !card.classList.contains('comm-hidden') : true;
        return acc;
      }, {});

      // Merge saved state
      const saved = Storage.get(STATE_KEY, {});
      Object.assign(state, saved);

      apply();
      bindEvents();
    }

    function apply() {
      const bar = $('#comm-panel-toggle-bar');
      const allBtn = $('#comm-panel-toggle-all');

      panelIds.forEach(id => {
        const on = state[id] !== false;
        const card = document.getElementById(id);
        const btn = bar?.querySelector(`[data-target="${id}"]`);

        if (card) card.classList.toggle('comm-hidden', !on);
        if (btn) btn.classList.toggle('active', on);
      });

      Layout.queue();
      Storage.set(STATE_KEY, state);

      if (allBtn) {
        const anyOff = panelIds.some(id => state[id] === false);
        allBtn.textContent = anyOff ? 'All On' : 'All Off';
      }
    }

    function toggle(id) {
      if (!panelIds.includes(id)) return;
      state[id] = !(state[id] !== false);
      apply();
      Events.emit('panel:toggled', { id, visible: state[id] });
    }

    function toggleAll() {
      const anyOff = panelIds.some(id => state[id] === false);
      panelIds.forEach(id => { state[id] = anyOff; });
      apply();
    }

    function bindEvents() {
      const bar = $('#comm-panel-toggle-bar');
      if (!bar) return;

      bar.querySelectorAll('.panel-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.target;
          if (id) toggle(id);
        });
      });

      const allBtn = $('#comm-panel-toggle-all');
      if (allBtn) {
        allBtn.addEventListener('click', toggleAll);
      }
    }

    function isVisible(id) {
      return state[id] !== false;
    }

    return { init, toggle, toggleAll, isVisible };
  })();

  // ============================================================
  // Card Registry
  // ============================================================
  const CardRegistry = (function () {
    const cards = new Map();

    return {
      register(id, cardInstance) {
        cards.set(id, cardInstance);
      },

      get(id) {
        return cards.get(id);
      },

      getAll() {
        return Array.from(cards.values());
      },

      init() {
        cards.forEach(card => {
          if (typeof card.init === 'function') {
            card.init();
          }
        });
      },

      destroy() {
        cards.forEach(card => {
          if (typeof card.destroy === 'function') {
            card.destroy();
          }
        });
        cards.clear();
      }
    };
  })();

  // ============================================================
  // Export Utilities
  // ============================================================
  async function exportToPptx() {
    if (!window.PptxGenJS || !window.html2canvas) {
      alert('Export libraries not loaded.');
      return;
    }

    const cards = $$('.comm-card').filter(card => !card.classList.contains('comm-hidden'));
    if (!cards.length) return;

    const pptx = new PptxGenJS();
    pptx.layout = '16x9';

    const slideMargin = 0.3;
    const colWidth = 4.4;
    const rowHeight = 2.7;

    let slide = pptx.addSlide();
    let x = slideMargin;
    let y = slideMargin;

    for (const card of cards) {
      try {
        const canvas = await window.html2canvas(card, {
          backgroundColor: '#0b0b0d',
          scale: 2,
          logging: false
        });
        const data = canvas.toDataURL('image/png');
        slide.addImage({ data, x, y, w: colWidth });

        x += colWidth + 0.25;
        if (x + colWidth > 10) {
          x = slideMargin;
          y += rowHeight;
        }
        if (y + rowHeight > 7) {
          slide = pptx.addSlide();
          x = slideMargin;
          y = slideMargin;
        }
      } catch (e) {
        console.warn('[CommDashboard] PPTX export skipped card', e);
      }
    }

    await pptx.writeFile({ fileName: 'comm-dashboard.pptx' });
  }

  // ============================================================
  // Initialization
  // ============================================================
  function init(config = {}) {
    const { panelIds = [] } = config;

    if (panelIds.length) {
      PanelToggles.init(panelIds);
    }

    Layout.initObserver();
    Layout.queue();

    // Bind export button
    const exportBtn = $('#comm-export-pptx');
    if (exportBtn) {
      exportBtn.addEventListener('click', exportToPptx);
    }

    // Window resize handling
    window.addEventListener('resize', Layout.queue);
    window.addEventListener('load', Layout.queue);

    Events.emit('comm:core-ready', null, true);
    console.log('[CommDashboard] Core initialized');
  }

  // ============================================================
  // Public API
  // ============================================================
  window.CommDashboard = {
    Events,
    Storage,
    Layout,
    PanelToggles,
    CardRegistry,
    
    // Utilities
    $,
    $$,
    escapeHtml,
    createElement,
    toTitleCase,
    degreesToCardinal,
    formatCoord,
    formatLatLon,
    formatUtcClock,
    formatLocalTime,
    formatUserStamp,
    formatUtcStamp,
    padZero,
    
    // Init
    init,
    exportToPptx
  };

})();
