(function () {
  'use strict';

  const RTV = window.RussellTV || {};
  const Utils = RTV.Utils || {
    setText: function (sel, t) {
      const el = document.querySelector(sel);
      if (el) el.textContent = t;
    },
    formatUserStamp: function (d) { return new Date(d).toLocaleString(); },
    now: function () { return new Date(); }
  };

  function updateLastUpdate() {
    const el = document.querySelector('#cyber-last-update [data-value="time"]');
    if (!el) return;
    el.textContent = Utils.formatUserStamp(Utils.now());
  }

  function setPosture(level) {
    const pill = document.getElementById('cyber-status-pill');
    if (!pill) return;

    pill.classList.remove('cyber-status-normal', 'cyber-status-elevated', 'cyber-status-critical');

    let label = 'NORMAL';
    if (level === 'elevated') {
      pill.classList.add('cyber-status-elevated');
      label = 'ELEVATED';
    } else if (level === 'critical') {
      pill.classList.add('cyber-status-critical');
      label = 'CRITICAL';
    } else {
      pill.classList.add('cyber-status-normal');
    }

    pill.textContent = 'CYBER POSTURE: ' + label;
  }

  function initMenu() {
    const btn = document.getElementById('cyber-menu-btn');
    const menu = document.getElementById('cyber-menu-dropdown');
    if (!btn || !menu) return;

    btn.addEventListener('click', function (evt) {
      evt.stopPropagation();
      menu.classList.toggle('rtv-menu-open');
    });

    document.addEventListener('click', function (evt) {
      if (!menu.contains(evt.target) && evt.target !== btn) {
        menu.classList.remove('rtv-menu-open');
      }
    });

    menu.addEventListener('click', function (evt) {
      const item = evt.target.closest('.rtv-menu-item');
      if (!item) return;
      const action = item.dataset.action;
      handleMenuAction(action);
      menu.classList.remove('rtv-menu-open');
    });
  }

  function handleMenuAction(action) {
    const Layout = (window.RussellTV || {}).Layout;

    switch (action) {
      case 'export-dashboard':
        if (Layout && typeof Layout.exportDashboard === 'function') {
          Layout.exportDashboard('cyber');
        } else {
          alert('Export not wired yet for Cyber dashboard.');
        }
        break;
      case 'toggle-defensive':
        toggleSection('#cyber-defensive');
        break;
      case 'toggle-netops':
        toggleSection('#cyber-netops');
        break;
      default:
        break;
    }
  }

  function toggleSection(selector) {
    const el = document.querySelector(selector);
    if (!el) return;
    el.classList.toggle('rtv-panel-hidden');
  }

  // Use ThreatMap panel for meta / severity
  function renderThreatMapMeta() {
    const CyberThreatMap = (window.RussellTV || {}).CyberThreatMap;
    if (CyberThreatMap && typeof CyberThreatMap.refresh === 'function') {
      CyberThreatMap.refresh();
    }
  }

  function renderIncidents() {
    const list = document.getElementById('cyber-incidents-list');
    if (!list) return;

    const sample = [
      {
        severity: 'High',
        label: 'Ransomware activity targeting regional utilities',
        region: 'North America / EU',
        time: 'Last 24 hrs'
      },
      {
        severity: 'Medium',
        label: 'Phishing campaign imitating O365 login portals',
        region: 'Global',
        time: 'Ongoing'
      }
    ];

    list.innerHTML = sample.map(function (item) {
      return (
        '<li class="cyber-item">' +
          '<span class="cyber-tag cyber-tag-' + item.severity.toLowerCase() + '">' + item.severity + '</span>' +
          '<div class="cyber-item-main">' +
            '<div class="cyber-item-title">' + item.label + '</div>' +
            '<div class="cyber-item-meta">' + item.region + ' · ' + item.time + '</div>' +
          '</div>' +
        '</li>'
      );
    }).join('');
  }

  function renderKEV() {
    const list = document.getElementById('cyber-kev-list');
    if (!list) return;

    const sample = [
      {
        cve: 'CVE-2024-12345',
        product: 'Example VPN Appliance',
        detail: 'RCE actively exploited in the wild',
        due: 'Patch ASAP'
      },
      {
        cve: 'CVE-2023-56789',
        product: 'Example Web Gateway',
        detail: 'Auth bypass under active exploitation',
        due: 'Prioritize remediation'
      }
    ];

    list.innerHTML = sample.map(function (item) {
      return (
        '<li class="cyber-item">' +
          '<div class="cyber-item-title">' + item.cve + ' – ' + item.product + '</div>' +
          '<div class="cyber-item-meta">' + item.detail + ' · ' + item.due + '</div>' +
        '</li>'
      );
    }).join('');
  }

  function renderNetHealth() {
    const list = document.getElementById('cyber-nethealth-list');
    if (!list) return;

    const sample = [
      {
        region: 'Global Backbone',
        status: 'Stable',
        note: 'No major outages reported'
      },
      {
        region: 'Cloud / SaaS',
        status: 'Minor Issues',
        note: 'Isolated latency spikes in one region'
      }
    ];

    list.innerHTML = sample.map(function (item) {
      return (
        '<li class="cyber-item">' +
          '<div class="cyber-item-title">' + item.region + '</div>' +
          '<div class="cyber-item-meta">' + item.status + ' – ' + item.note + '</div>' +
        '</li>'
      );
    }).join('');

    Utils.setText('#cyber-nethealth-badge', 'Stable');
  }

  function renderBGP() {
    const list = document.getElementById('cyber-bgp-list');
    if (!list) return;

    const sample = [
      {
        type: 'Suspicious Route Leak',
        asn: 'AS64500',
        region: 'APAC',
        note: 'Temporary propagation of more-specific prefixes'
      },
      {
        type: 'Misconfig',
        asn: 'AS12345',
        region: 'EU',
        note: 'Short-lived hijack of /24, now resolved'
      }
    ];

    list.innerHTML = sample.map(function (item) {
      return (
        '<li class="cyber-item">' +
          '<span class="cyber-tag cyber-tag-med">BGP</span>' +
          '<div class="cyber-item-main">' +
            '<div class="cyber-item-title">' + item.type + ' – ' + item.asn + '</div>' +
            '<div class="cyber-item-meta">' + item.region + ' · ' + item.note + '</div>' +
          '</div>' +
        '</li>'
      );
    }).join('');
  }

  function renderCloudStatus() {
    const list = document.getElementById('cyber-cloud-list');
    if (!list) return;

    const sample = [
      { name: 'AWS', status: 'Operational' },
      { name: 'Azure', status: 'Operational' },
      { name: 'Microsoft 365', status: 'Minor Advisory' },
      { name: 'Google Cloud', status: 'Operational' }
    ];

    list.innerHTML = sample.map(function (item) {
      return (
        '<li class="cyber-item">' +
          '<div class="cyber-item-title">' + item.name + '</div>' +
          '<div class="cyber-item-meta">' + item.status + '</div>' +
        '</li>'
      );
    }).join('');
  }

  function initCyberDashboard() {
    initMenu();
    updateLastUpdate();
    renderThreatMapMeta();
    renderIncidents();
    renderKEV();
    renderNetHealth();
    renderBGP();
    renderCloudStatus();
    setPosture('normal');
  }

  function bootstrap() {
    const RTV = window.RussellTV || {};
    const Layout = RTV.Layout;
    const Events = RTV.Events;

    if (Layout && typeof Layout.registerDashboard === 'function') {
      Layout.registerDashboard('cyber', initCyberDashboard);
      Layout.initDashboard('cyber');
      return;
    }

    if (Events && typeof Events.on === 'function') {
      Events.on('app:ready', initCyberDashboard);
      return;
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initCyberDashboard);
    } else {
      initCyberDashboard();
    }
  }

  bootstrap();

  window.RussellTV = window.RussellTV || {};
  window.RussellTV.Cyber = {
    refresh: function () {
      updateLastUpdate();
    },
    setPosture: setPosture
  };
})();
