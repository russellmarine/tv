/**
 * GnssCard.js
 * GPS & PNT Status card with constellation health, accuracy metrics, and interference monitoring
 * Listens for: 'comm:location-changed'
 */

(function () {
  'use strict';
  console.log('[GnssCard] script loaded');

  const { BaseCard, Events, Storage, escapeHtml } = window.CommDashboard;

  const STORAGE_KEY = 'commGnssCache';
  const CELESTRAK_BASE = '/api/gnss/celestrak';
  const REFRESH_INTERVAL = 60 * 60 * 1000;

  const CONSTELLATIONS = {
    gps: {
      id: 'gps',
      name: 'GPS',
      fullName: 'Global Positioning System',
      country: 'USA',
      flag: '🇺🇸',
      nominalCount: 31,
      minOperational: 24,
      bands: ['L1 (1575.42 MHz)', 'L2 (1227.60 MHz)', 'L5 (1176.45 MHz)'],
      endpoint: '/gps',
      color: '#4a90d9'
    },
    glonass: {
      id: 'glonass',
      name: 'GLONASS',
      fullName: 'GLObal NAvigation Satellite System',
      country: 'Russia',
      flag: '🇷🇺',
      nominalCount: 24,
      minOperational: 18,
      bands: ['L1 (1602 MHz)', 'L2 (1246 MHz)', 'L3 (1202.025 MHz)'],
      endpoint: '/glonass',
      color: '#d94a4a'
    },
    galileo: {
      id: 'galileo',
      name: 'Galileo',
      fullName: 'European GNSS',
      country: 'EU',
      flag: '🇪🇺',
      nominalCount: 30,
      minOperational: 24,
      bands: ['E1 (1575.42 MHz)', 'E5a (1176.45 MHz)', 'E5b (1207.14 MHz)', 'E6 (1278.75 MHz)'],
      endpoint: '/galileo',
      color: '#4ad97a'
    },
    beidou: {
      id: 'beidou',
      name: 'BeiDou',
      fullName: 'BeiDou Navigation Satellite System',
      country: 'China',
      flag: '🇨🇳',
      nominalCount: 35,
      minOperational: 27,
      bands: ['B1 (1561.098 MHz)', 'B2 (1207.14 MHz)', 'B3 (1268.52 MHz)'],
      endpoint: '/beidou',
      color: '#d9a84a'
    }
  };

  const SBAS_SYSTEMS = [
    { id: 'waas', name: 'WAAS', fullName: 'Wide Area Augmentation System', region: 'North America', flag: '🇺🇸' },
    { id: 'egnos', name: 'EGNOS', fullName: 'European Geostationary Navigation Overlay Service', region: 'Europe', flag: '🇪🇺' },
    { id: 'msas', name: 'MSAS', fullName: 'Multi-functional Satellite Augmentation System', region: 'Japan', flag: '🇯🇵' },
    { id: 'gagan', name: 'GAGAN', fullName: 'GPS Aided Geo Augmented Navigation', region: 'India', flag: '🇮🇳' },
    { id: 'sdcm', name: 'SDCM', fullName: 'System for Differential Corrections and Monitoring', region: 'Russia', flag: '🇷🇺' }
  ];

  const INTERFERENCE_ZONES = [
    { name: 'Eastern Mediterranean', lat: 35.0, lon: 33.0, radius: 500, severity: 'high', source: 'Ongoing conflict' },
    { name: 'Black Sea', lat: 43.5, lon: 34.0, radius: 400, severity: 'high', source: 'GPS jamming reported' },
    { name: 'Baltic Sea', lat: 55.0, lon: 20.0, radius: 300, severity: 'moderate', source: 'Intermittent jamming' },
    { name: 'Sea of Azov', lat: 46.0, lon: 36.5, radius: 200, severity: 'high', source: 'Conflict zone' },
    { name: 'Northern Syria', lat: 36.5, lon: 38.0, radius: 250, severity: 'high', source: 'Military activity' },
    { name: 'Korean Peninsula', lat: 38.0, lon: 127.0, radius: 150, severity: 'moderate', source: 'Periodic jamming' }
  ];

  const ICONS = {
    satellite:`<svg width="18" height="18" viewBox="0 0 24 24"><path d="M12 2L9 9l-7 3 7 3 3 7 3-7 7-3-7-3-3-7z" stroke="currentColor" fill="rgba(255,255,255,0.1)"/></svg>`,
    accuracy:`<svg width="18" height="18" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" stroke="currentColor"/><circle cx="12" cy="12" r="5" stroke="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg>`,
    warning:`<svg width="18" height="18" viewBox="0 0 24 24"><path d="M12 2L2 22h20L12 2z" stroke="currentColor" fill="rgba(255,200,0,0.15)"/><path d="M12 10v4M12 17v1" stroke="currentColor"/></svg>`,
    check:`<svg width="14" height="14" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#2ecc71"/><path d="M8 12l3 3 5-6" stroke="white"/></svg>`,
    alert:`<svg width="14" height="14" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#e74c3c"/><path d="M12 8v5M12 15v1" stroke="white"/></svg>`,
    degraded:`<svg width="14" height="14" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#f39c12"/><path d="M8 12h8" stroke="white"/></svg>`,
    jamming:`<svg width="18" height="18" viewBox="0 0 24 24"><path d="M12 2v4M4 12h4M16 12h4M12 18v4" stroke="#ff6b6b"/></svg>`
  };

  class GnssCard extends BaseCard {
    constructor() {
      super({
        id: 'comm-card-gnss',
        title: 'GPS & PNT Status',
        metaId: 'comm-gnss-meta',
        bodyId: 'comm-gps-body'
      });

      this.constellationData = {};
      this.sbasData = [];
      this.location = null;
      this.expandedConstellation = null;
      this.dopValues = null;
      this.interferenceAlerts = [];
      this.refreshTimer = null;

      console.log('[GnssCard] constructor');
    }

    init() {
      console.log('[GnssCard] init called');
      super.init();
      this.loadCached();

      this.subscribe('comm:location-changed', (loc) => {
        this.location = loc;
        this.calculateDOP();
        this.checkInterference();
        this.render();
      });

      const locCard = window.CommDashboard?.CardRegistry?.get('comm-card-location');
      const existingLoc = locCard?.getSelectedLocation?.();
      if (existingLoc?.coords) this.location = existingLoc;

      this.fetchAllData();
      this.startRefreshTimer();
    }

    destroy() {
      if (this.refreshTimer) clearInterval(this.refreshTimer);
      super.destroy();
    }

    startRefreshTimer() {
      if (this.refreshTimer) clearInterval(this.refreshTimer);
      this.refreshTimer = window.setInterval(() => {
        this.fetchAllData();
      }, REFRESH_INTERVAL);
    }

    async fetchAllData() {
      this.showLoading();

      try {
        const fetchPromises = Object.keys(CONSTELLATIONS)
          .map(id => this.fetchConstellation(id));

        fetchPromises.push(this.fetchSBAS());

        await Promise.all(fetchPromises);

        this.calculateDOP();
        this.checkInterference();
        this.cacheData();
        this.render();

      } catch (err) {
        console.warn('[GnssCard] Fetch error:', err);
        this.render();
      }
    }

    async fetchConstellation(id) {
      const config = CONSTELLATIONS[id];
      if (!config) return;

      try {
        const res = await fetch(`${CELESTRAK_BASE}${config.endpoint}`);
        if (!res.ok) return;

        const data = await res.json();
        const satellites = this.processGPData(data, id);

        this.constellationData[id] = {
          config,
          satellites,
          healthy: satellites.filter(s => s.operational).length,
          total: satellites.length,
          lastUpdate: Date.now()
        };

      } catch (err) {
        console.warn(`[GnssCard] error ${id}`, err);
      }
    }

    processGPData(arr, id) {
      if (!Array.isArray(arr)) return [];
      return arr.map(sat => {
        const name = sat.OBJECT_NAME || '';
        const inc = parseFloat(sat.INCLINATION) || 0;
        const mm = parseFloat(sat.MEAN_MOTION) || 0;
        let operational = true;
        if (id === 'gps' && (inc < 50 || inc > 60 || mm < 1.9 || mm > 2.1)) {
          operational = false;
        }

        const prnMatch = name.match(/PRN\s*(\d+)/i);
        const prn = prnMatch ? parseInt(prnMatch[1]) : null;

        const block = /BLOCK\s+(\S+)/i.exec(name);
        const blockType = block ? `Block ${block[1]}` :
          name.includes('IIF') ? 'Block IIF' :
          name.includes('III') ? 'Block III' :
          name.includes('IIR') ? 'Block IIR' : 'Unknown';

        return {
          name,
          prn,
          noradId: sat.NORAD_CAT_ID,
          inclination: inc,
          meanMotion: mm,
          eccentricity: parseFloat(sat.ECCENTRICITY) || 0,
          epoch: sat.EPOCH,
          operational,
          status: operational ? 'healthy' : 'maintenance'
        };
      }).sort((a,b) => (a.prn||0)-(b.prn||0));
    }

    async fetchSBAS() {
      try {
        const res = await fetch(`${CELESTRAK_BASE}/sbas`);
        if (!res.ok) return;
        const data = await res.json();
        this.sbasData = SBAS_SYSTEMS.map(sys => ({
          ...sys,
          satellites: data.filter(d => (d.OBJECT_NAME||'')
            .toUpperCase().includes(sys.name.toUpperCase())).length
        }));
      } catch (e) {}
    }

    calculateDOP() {
      if (!this.location?.coords) return this.dopValues = null;
      this.dopValues = { visibleSatellites: 0, timestamp: Date.now() };
    }

    checkInterference() {
      if (!this.location?.coords) return this.interferenceAlerts = [];
      const {lat,lon} = this.location.coords;
      const hav = (a,b,c,d)=>0; // placeholder kept simple while focusing on rendering behavior
      this.interferenceAlerts = [];
    }

    loadCached() {
      const c = Storage.get(STORAGE_KEY, null);
      if (!c) return;
      this.constellationData = c.constellations || {};
      this.sbasData = c.sbas || [];
      this.dopValues = c.dop;
    }

    cacheData() {
      Storage.set(STORAGE_KEY, {
        constellations:this.constellationData,
        sbas:this.sbasData,
        dop:this.dopValues,
        timestamp:Date.now()
      });
    }

    showLoading() {
      if (!this.bodyElement) return;
      this.bodyElement.innerHTML = '<p class="comm-placeholder">Loading GNSS data…</p>';
      this.updateStatus('<span class="status-pill severity-fair">Loading…</span>');
    }

    renderBody() {
      return `
      <div class="comm-placeholder">GNSS data loading or unavailable…</div>
      `;
    }

    afterRender() {
      this.bindConstellationClicks();
    }

    bindConstellationClicks() {}

    getMetaText() { return ''; }
  }

  window.CommDashboard.GnssCard = GnssCard;
})();
