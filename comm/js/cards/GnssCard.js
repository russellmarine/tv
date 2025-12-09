/**
 * GnssCard.js
 * GPS & PNT Status card with constellation health, accuracy metrics, and interference monitoring
 * Listens for: 'comm:location-changed'
 */

(function () {
  'use strict';

  const { BaseCard, Events, Storage, escapeHtml } = window.CommDashboard;

  // ============================================================
  // Constants
  // ============================================================
  const STORAGE_KEY = 'commGnssCache';
  const CELESTRAK_BASE = '/api/gnss/celestrak';
  const REFRESH_INTERVAL = 60 * 60 * 1000; // 60 minutes

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
    satellite: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L9 9l-7 3 7 3 3 7 3-7 7-3-7-3-3-7z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" fill="rgba(255,255,255,0.1)"/>
    </svg>`,
    accuracy: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5"/>
      <circle cx="12" cy="12" r="5" stroke="currentColor" stroke-width="1.5"/>
      <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
    </svg>`,
    warning: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L2 22h20L12 2z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" fill="rgba(255,200,0,0.15)"/>
      <path d="M12 10v4M12 17v1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>`,
    check: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" fill="#2ecc71"/>
      <path d="M8 12l3 3 5-6" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
    alert: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" fill="#e74c3c"/>
      <path d="M12 8v5M12 15v1" stroke="white" stroke-width="2" stroke-linecap="round"/>
    </svg>`,
    degraded: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" fill="#f39c12"/>
      <path d="M8 12h8" stroke="white" stroke-width="2" stroke-linecap="round"/>
    </svg>`,
    expand: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
    collapse: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 15l6-6 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
    jamming: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2v4M4 12h4M16 12h4M12 18v4" stroke="#ff6b6b" stroke-width="2" stroke-linecap="round"/>
      <path d="M6.34 6.34l2.83 2.83M14.83 14.83l2.83 2.83M6.34 17.66l2.83-2.83M14.83 9.17l2.83-2.83" stroke="#ff6b6b" stroke-width="2" stroke-linecap="round"/>
      <circle cx="12" cy="12" r="3" stroke="#ff6b6b" stroke-width="2"/>
    </svg>`
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

      this.fetchAttempted = false;
      this.lastFetchError = null;
    }

    init() {
      super.init();
      this.loadCached();

      this.subscribe('comm:location-changed', (loc) => {
        this.location = loc;
        this.calculateDOP();
        this.checkInterference();
        this.render();
      });

      const locationCard = window.CommDashboard?.CardRegistry?.get('comm-card-location');
      const existingLoc = locationCard?.getSelectedLocation?.();
      if (existingLoc?.coords) {
        this.location = existingLoc;
      }

      this.fetchAllData();
      this.startRefreshTimer();
    }

    destroy() {
      if (this.refreshTimer) clearInterval(this.refreshTimer);
      super.destroy();
    }

    startRefreshTimer() {
      this.refreshTimer = this.setInterval(() => {
        this.fetchAllData();
      }, REFRESH_INTERVAL);
    }

    // ============================================================
    // Data Fetching
    // ============================================================

    async fetchAllData() {
      this.showLoading();
      this.fetchAttempted = true;
      this.lastFetchError = null;

      console.log('[GnssCard] fetchAllData started');

      let successCount = 0;

      try {
        const constellationPromises = Object.keys(CONSTELLATIONS).map(async (key) => {
          const ok = await this.fetchConstellation(key);
          if (ok) successCount++;
        });

        const sbasPromise = this.fetchSBAS();

        await Promise.all([...constellationPromises, sbasPromise]);

        if (successCount === 0) {
          this.lastFetchError = this.lastFetchError ||
            'No GNSS data returned from API (check /api/gnss/celestrak proxy).';
          console.warn('[GnssCard] No constellation data loaded');
        } else {
          console.log('[GnssCard] Loaded constellations:', Object.keys(this.constellationData));
        }

        this.calculateDOP();
        this.checkInterference();
        this.cacheData();
        this.render();

      } catch (err) {
        console.warn('[GnssCard] Fetch error:', err);
        this.lastFetchError = err && err.message ? err.message : String(err);
        this.render();
      }
    }

    async fetchConstellation(constellationId) {
      const config = CONSTELLATIONS[constellationId];
      if (!config) return false;

      const url = `${CELESTRAK_BASE}${config.endpoint}`;
      console.log(`[GnssCard] Fetching ${constellationId} from`, url);

      try {
        const res = await fetch(url);
        if (!res.ok) {
          console.warn(`[GnssCard] Failed to fetch ${constellationId}: ${res.status}`);
          this.lastFetchError = `HTTP ${res.status} for ${config.endpoint}`;
          return false;
        }

        const data = await res.json();
        const satellites = this.processGPData(data, constellationId);

        this.constellationData[constellationId] = {
          config,
          satellites,
          healthy: satellites.filter(s => s.operational).length,
          total: satellites.length,
          lastUpdate: Date.now()
        };

        console.log(`[GnssCard] ${constellationId}:`, satellites.length, 'satellites');
        return satellites.length > 0;

      } catch (err) {
        console.warn(`[GnssCard] Error fetching ${constellationId}:`, err);
        this.lastFetchError = err && err.message ? err.message : String(err);
        return false;
      }
    }

    processGPData(gpData, constellationId) {
      if (!Array.isArray(gpData)) return [];

      return gpData.map(sat => {
        const name = sat.OBJECT_NAME || '';
        const noradId = sat.NORAD_CAT_ID;

        const ecc = parseFloat(sat.ECCENTRICITY) || 0;
        const inc = parseFloat(sat.INCLINATION) || 0;
        const meanMotion = parseFloat(sat.MEAN_MOTION) || 0;

        let operational = true;
        let status = 'healthy';

        if (constellationId === 'gps') {
          if (inc < 50 || inc > 60 || meanMotion < 1.9 || meanMotion > 2.1) {
            operational = false;
            status = 'maintenance';
          }
        }

        let blockType = 'Unknown';
        if (name.includes('BLOCK')) {
          const blockMatch = name.match(/BLOCK\s+(\S+)/i);
          if (blockMatch) blockType = `Block ${blockMatch[1]}`;
        } else if (name.includes('IIF')) {
          blockType = 'Block IIF';
        } else if (name.includes('III')) {
          blockType = 'Block III';
        } else if (name.includes('IIR')) {
          blockType = 'Block IIR';
        }

        let prn = null;
        const prnMatch = name.match(/PRN\s*(\d+)/i);
        if (prnMatch) prn = parseInt(prnMatch[1]);

        return {
          name,
          noradId,
          prn,
          blockType,
          operational,
          status,
          inclination: inc,
          eccentricity: ecc,
          meanMotion,
          epoch: sat.EPOCH,
          raan: parseFloat(sat.RA_OF_ASC_NODE) || 0,
          argOfPerigee: parseFloat(sat.ARG_OF_PERICENTER) || 0,
          meanAnomaly: parseFloat(sat.MEAN_ANOMALY) || 0,
          bstar: parseFloat(sat.BSTAR) || 0
        };
      }).sort((a, b) => (a.prn || 0) - (b.prn || 0));
    }

    async fetchSBAS() {
      const url = `${CELESTRAK_BASE}/sbas`;
      console.log('[GnssCard] Fetching SBAS from', url);

      try {
        const res = await fetch(url);
        if (!res.ok) {
          console.warn('[GnssCard] Failed to fetch SBAS:', res.status);
          return;
        }

        const data = await res.json();

        this.sbasData = SBAS_SYSTEMS.map(system => {
          const sats = data.filter(sat => {
            const name = (sat.OBJECT_NAME || '').toUpperCase();
            if (system.id === 'waas') return name.includes('WAAS') || name.includes('GALAXY 15') || name.includes('INMARSAT');
            if (system.id === 'egnos') return name.includes('EGNOS') || name.includes('ASTRA');
            if (system.id === 'msas') return name.includes('MTSAT') || name.includes('MSAS');
            if (system.id === 'gagan') return name.includes('GSAT') || name.includes('GAGAN');
            if (system.id === 'sdcm') return name.includes('LUCH');
            return false;
          });

          return {
            ...system,
            satellites: sats.length,
            operational: sats.length > 0
          };
        });

        console.log('[GnssCard] SBAS mapped:', this.sbasData);
      } catch (err) {
        console.warn('[GnssCard] Error fetching SBAS:', err);
      }
    }

    // ============================================================
    // DOP Calculation (unchanged)
    // ============================================================

    calculateDOP() {
      if (!this.location?.coords) {
        this.dopValues = null;
        return;
      }

      const { lat, lon } = this.location.coords;
      const userPos = this.geodToECEF(lat, lon, 0);

      const visibleSats = [];

      Object.values(this.constellationData).forEach(constellation => {
        if (!constellation.satellites) return;

        constellation.satellites.forEach(sat => {
          if (!sat.operational) return;

          const satPos = this.calculateSatPosition(sat);
          if (!satPos) return;

          const { elevation, azimuth } = this.calculateElevationAzimuth(userPos, satPos, lat, lon);

          if (elevation > 5) {
            visibleSats.push({ ...sat, elevation, azimuth, position: satPos });
          }
        });
      });

      if (visibleSats.length < 4) {
        this.dopValues = { error: 'Insufficient satellites visible', visibleSatellites: visibleSats.length };
        return;
      }

      const dop = this.computeDOPFromSatellites(visibleSats, userPos, lat, lon);
      this.dopValues = {
        ...dop,
        visibleSatellites: visibleSats.length,
        timestamp: Date.now()
      };
    }

    geodToECEF(lat, lon, alt) {
      const a = 6378137;
      const e2 = 0.00669437999014;

      const latRad = lat * Math.PI / 180;
      const lonRad = lon * Math.PI / 180;

      const N = a / Math.sqrt(1 - e2 * Math.sin(latRad) ** 2);

      return {
        x: (N + alt) * Math.cos(latRad) * Math.cos(lonRad),
        y: (N + alt) * Math.cos(latRad) * Math.sin(lonRad),
        z: (N * (1 - e2) + alt) * Math.sin(latRad)
      };
    }

    calculateSatPosition(sat) {
      const mu = 398600.4418;
      const n = sat.meanMotion * 2 * Math.PI / 86400;
      const a = Math.pow(mu / (n * n), 1 / 3);

      const now = new Date();
      const epoch = new Date(sat.epoch);
      const dt = (now - epoch) / 1000;

      const M = (sat.meanAnomaly * Math.PI / 180 + n * dt) % (2 * Math.PI);

      const e = sat.eccentricity;
      let E = M;
      for (let i = 0; i < 5; i++) {
        E = M + e * Math.sin(E);
      }

      const nu = 2 * Math.atan2(
        Math.sqrt(1 + e) * Math.sin(E / 2),
        Math.sqrt(1 - e) * Math.cos(E / 2)
      );

      const r = a * (1 - e * Math.cos(E));
      const xOrb = r * Math.cos(nu);
      const yOrb = r * Math.sin(nu);

      const i = sat.inclination * Math.PI / 180;
      const omega = sat.argOfPerigee * Math.PI / 180;
      const RAAN = sat.raan * Math.PI / 180;

      const earthRotRate = 7.2921159e-5;
      const adjustedRAAN = RAAN - earthRotRate * dt;

      const x = xOrb * (Math.cos(omega) * Math.cos(adjustedRAAN) - Math.sin(omega) * Math.sin(adjustedRAAN) * Math.cos(i)) +
                yOrb * (-Math.sin(omega) * Math.cos(adjustedRAAN) - Math.cos(omega) * Math.sin(adjustedRAAN) * Math.cos(i));
      const y = xOrb * (Math.cos(omega) * Math.sin(adjustedRAAN) + Math.sin(omega) * Math.cos(adjustedRAAN) * Math.cos(i)) +
                yOrb * (-Math.sin(omega) * Math.sin(adjustedRAAN) + Math.cos(omega) * Math.cos(adjustedRAAN) * Math.cos(i));
      const z = xOrb * Math.sin(omega) * Math.sin(i) + yOrb * Math.cos(omega) * Math.sin(i);

      return { x: x * 1000, y: y * 1000, z: z * 1000 };
    }

    calculateElevationAzimuth(userPos, satPos, lat, lon) {
      const dx = satPos.x - userPos.x;
      const dy = satPos.y - userPos.y;
      const dz = satPos.z - userPos.z;

      const latRad = lat * Math.PI / 180;
      const lonRad = lon * Math.PI / 180;

      const east = -Math.sin(lonRad) * dx + Math.cos(lonRad) * dy;
      const north = -Math.sin(latRad) * Math.cos(lonRad) * dx - Math.sin(latRad) * Math.sin(lonRad) * dy + Math.cos(latRad) * dz;
      const up = Math.cos(latRad) * Math.cos(lonRad) * dx + Math.cos(latRad) * Math.sin(lonRad) * dy + Math.sin(latRad) * dz;

      const range = Math.sqrt(east * east + north * north + up * up);
      const elevation = Math.asin(up / range) * 180 / Math.PI;
      const azimuth = Math.atan2(east, north) * 180 / Math.PI;

      return { elevation, azimuth: (azimuth + 360) % 360 };
    }

    computeDOPFromSatellites(satellites) {
      const H = [];

      satellites.forEach(sat => {
        const el = sat.elevation * Math.PI / 180;
        const az = sat.azimuth * Math.PI / 180;

        const e = Math.sin(az) * Math.cos(el);
        const n = Math.cos(az) * Math.cos(el);
        const u = Math.sin(el);

        H.push([e, n, u, 1]);
      });

      const HtH = this.matrixMultiply(this.transpose(H), H);
      const Q = this.invertMatrix4x4(HtH);

      if (!Q) {
        return { gdop: null, pdop: null, hdop: null, vdop: null, tdop: null };
      }

      const gdop = Math.sqrt(Q[0][0] + Q[1][1] + Q[2][2] + Q[3][3]);
      const pdop = Math.sqrt(Q[0][0] + Q[1][1] + Q[2][2]);
      const hdop = Math.sqrt(Q[0][0] + Q[1][1]);
      const vdop = Math.sqrt(Q[2][2]);
      const tdop = Math.sqrt(Q[3][3]);

      return { gdop, pdop, hdop, vdop, tdop };
    }

    transpose(matrix) {
      return matrix[0].map((_, i) => matrix.map(row => row[i]));
    }

    matrixMultiply(A, B) {
      const result = [];
      for (let i = 0; i < A.length; i++) {
        result[i] = [];
        for (let j = 0; j < B[0].length; j++) {
          let sum = 0;
          for (let k = 0; k < B.length; k++) {
            sum += A[i][k] * B[k][j];
          }
          result[i][j] = sum;
        }
      }
      return result;
    }

    invertMatrix4x4(m) {
      const inv = Array(4).fill(null).map(() => Array(4).fill(0));

      inv[0][0] = m[1][1]*m[2][2]*m[3][3] - m[1][1]*m[2][3]*m[3][2] - m[2][1]*m[1][2]*m[3][3] + m[2][1]*m[1][3]*m[3][2] + m[3][1]*m[1][2]*m[2][3] - m[3][1]*m[1][3]*m[2][2];
      inv[0][1] = -m[0][1]*m[2][2]*m[3][3] + m[0][1]*m[2][3]*m[3][2] + m[2][1]*m[0][2]*m[3][3] - m[2][1]*m[0][3]*m[3][2] - m[3][1]*m[0][2]*m[2][3] + m[3][1]*m[0][3]*m[2][2];
      inv[0][2] = m[0][1]*m[1][2]*m[3][3] - m[0][1]*m[1][3]*m[3][2] - m[1][1]*m[0][2]*m[3][3] + m[1][1]*m[0][3]*m[3][2] + m[3][1]*m[0][2]*m[1][3] - m[3][1]*m[0][3]*m[1][2];
      inv[0][3] = -m[0][1]*m[1][2]*m[2][3] + m[0][1]*m[1][3]*m[2][2] + m[1][1]*m[0][2]*m[2][3] - m[1][1]*m[0][3]*m[2][2] - m[2][1]*m[0][2]*m[1][3] + m[2][1]*m[0][3]*m[1][2];
      inv[1][0] = -m[1][0]*m[2][2]*m[3][3] + m[1][0]*m[2][3]*m[3][2] + m[2][0]*m[1][2]*m[3][3] - m[2][0]*m[1][3]*m[3][2] - m[3][0]*m[1][2]*m[2][3] + m[3][0]*m[1][3]*m[2][2];
      inv[1][1] = m[0][0]*m[2][2]*m[3][3] - m[0][0]*m[2][3]*m[3][2] - m[2][0]*m[0][2]*m[3][3] + m[2][0]*m[0][3]*m[3][2] + m[3][0]*m[0][2]*m[2][3] - m[3][0]*m[0][3]*m[2][2];
      inv[1][2] = -m[0][0]*m[1][2]*m[3][3] + m[0][0]*m[1][3]*m[3][2] + m[1][0]*m[0][2]*m[3][3] - m[1][0]*m[0][3]*m[3][2] - m[3][0]*m[0][2]*m[1][3] + m[3][0]*m[0][3]*m[1][2];
      inv[1][3] = m[0][0]*m[1][2]*m[2][3] - m[0][0]*m[1][3]*m[2][2] - m[1][0]*m[0][2]*m[2][3] + m[1][0]*m[0][3]*m[2][2] + m[2][0]*m[0][2]*m[1][3] - m[2][0]*m[0][3]*m[1][2];
      inv[2][0] = m[1][0]*m[2][1]*m[3][3] - m[1][0]*m[2][3]*m[3][1] - m[2][0]*m[1][1]*m[3][3] + m[2][0]*m[1][3]*m[3][1] + m[3][0]*m[1][1]*m[2][3] - m[3][0]*m[1][3]*m[2][1];
      inv[2][1] = -m[0][0]*m[2][1]*m[3][3] + m[0][0]*m[2][3]*m[3][1] + m[2][0]*m[0][1]*m[3][3] - m[2][0]*m[0][3]*m[3][1] - m[3][0]*m[0][1]*m[2][3] + m[3][0]*m[0][3]*m[2][1];
      inv[2][2] = m[0][0]*m[1][1]*m[3][3] - m[0][0]*m[1][3]*m[3][1] - m[1][0]*m[0][1]*m[3][3] + m[1][0]*m[0][3]*m[3][1] + m[3][0]*m[0][1]*m[1][3] - m[3][0]*m[0][3]*m[1][1];
      inv[2][3] = -m[0][0]*m[1][1]*m[2][3] + m[0][0]*m[1][3]*m[2][1] + m[1][0]*m[0][1]*m[2][3] - m[1][0]*m[0][3]*m[2][1] - m[2][0]*m[0][1]*m[1][3] + m[2][0]*m[0][3]*m[1][1];
      inv[3][0] = -m[1][0]*m[2][1]*m[3][2] + m[1][0]*m[2][2]*m[3][1] + m[2][0]*m[1][1]*m[3][2] - m[2][0]*m[1][2]*m[3][1] - m[3][0]*m[1][1]*m[2][2] + m[3][0]*m[1][2]*m[2][1];
      inv[3][1] = m[0][0]*m[2][1]*m[3][2] - m[0][0]*m[2][2]*m[3][1] - m[2][0]*m[0][1]*m[3][2] + m[2][0]*m[0][2]*m[3][1] + m[3][0]*m[0][1]*m[2][2] - m[3][0]*m[0][2]*m[2][1];
      inv[3][2] = -m[0][0]*m[1][1]*m[3][2] + m[0][0]*m[1][2]*m[3][1] + m[1][0]*m[0][1]*m[3][2] - m[1][0]*m[0][2]*m[3][1] - m[3][0]*m[0][1]*m[1][2] + m[3][0]*m[0][2]*m[1][1];
      inv[3][3] = m[0][0]*m[1][1]*m[2][2] - m[0][0]*m[1][2]*m[2][1] - m[1][0]*m[0][1]*m[2][2] + m[1][0]*m[0][2]*m[2][1] + m[2][0]*m[0][1]*m[1][2] - m[2][0]*m[0][2]*m[1][1];

      let det = m[0][0]*inv[0][0] + m[0][1]*inv[1][0] + m[0][2]*inv[2][0] + m[0][3]*inv[3][0];

      if (Math.abs(det) < 1e-10) return null;

      det = 1.0 / det;

      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
          inv[i][j] *= det;
        }
      }

      return inv;
    }

    // ============================================================
    // Interference Checking
    // ============================================================

    checkInterference() {
      if (!this.location?.coords) {
        this.interferenceAlerts = [];
        return;
      }

      const { lat, lon } = this.location.coords;
      const alerts = [];

      INTERFERENCE_ZONES.forEach(zone => {
        const dist = this.haversineDistance(lat, lon, zone.lat, zone.lon);
        const distNm = dist * 0.539957;

        if (distNm < 2000) {
          alerts.push({
            ...zone,
            distance: Math.round(distNm),
            inRange: distNm < zone.radius
          });
        }
      });

      alerts.sort((a, b) => a.distance - b.distance);
      this.interferenceAlerts = alerts;
    }

    haversineDistance(lat1, lon1, lat2, lon2) {
      const R = 6371;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat/2) ** 2 +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon/2) ** 2;
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c;
    }

    // ============================================================
    // Caching
    // ============================================================

    loadCached() {
      const cached = Storage.get(STORAGE_KEY, null);
      if (cached) {
        this.constellationData = cached.constellations || {};
        this.sbasData = cached.sbas || [];
        this.dopValues = cached.dop || null;
      }
    }

    cacheData() {
      Storage.set(STORAGE_KEY, {
        constellations: this.constellationData,
        sbas: this.sbasData,
        dop: this.dopValues,
        timestamp: Date.now()
      });
    }

    // ============================================================
    // Rendering
    // ============================================================

    showLoading() {
      if (this.bodyElement) {
        this.bodyElement.innerHTML = '<p class="comm-placeholder">Loading GNSS data…</p>';
      }
      this.updateStatus('<span class="status-pill severity-fair">Loading…</span>');
    }

    getOverallStatus() {
      let totalHealthy = 0;
      let totalExpected = 0;

      Object.values(this.constellationData).forEach(c => {
        totalHealthy += c.healthy || 0;
        totalExpected += c.config?.minOperational || 0;
      });

      const hasInterference = this.interferenceAlerts.some(a => a.inRange);

      if (hasInterference) {
        return { status: 'degraded', label: 'Interference Detected', severity: 'severity-poor' };
      }

      if (totalHealthy >= totalExpected) {
        return { status: 'healthy', label: 'Operational', severity: 'severity-good' };
      }

      if (totalHealthy >= totalExpected * 0.7) {
        return { status: 'degraded', label: 'Degraded', severity: 'severity-fair' };
      }

      return { status: 'critical', label: 'Limited', severity: 'severity-poor' };
    }

    renderBody() {
      const hasData = Object.keys(this.constellationData).length > 0;

      // If we tried to fetch but got nothing, surface that instead of infinite "loading"
      if (!hasData && this.fetchAttempted) {
        const msg = this.lastFetchError ||
          'Unable to load GNSS data (no satellite data returned from API).';
        this.updateStatus('<span class="status-pill severity-poor">Offline</span>');
        return `
          <div class="gnss-body">
            <p class="comm-placeholder">${escapeHtml(msg)}</p>
          </div>
        `;
      }

      if (!hasData) {
        return '<p class="comm-placeholder">Loading constellation data…</p>';
      }

      const overall = this.getOverallStatus();
      this.updateStatus(`<span class="status-pill ${overall.severity}">${overall.label}</span>`);

      const constellationsHtml = this.renderConstellations();
      const dopHtml = this.renderDOP();
      const interferenceHtml = this.renderInterference();
      const sbasHtml = this.renderSBAS();

      const lastUpdate = Object.values(this.constellationData)[0]?.lastUpdate;
      const updateStr = lastUpdate ? this.formatTimestamp(lastUpdate) : '--';

      return `
        <div class="gnss-body">
          <div class="gnss-section">
            <div class="gnss-section-header">
              <span class="section-title">Constellation Health</span>
              <span class="section-hint">Click to expand</span>
            </div>
            <div class="gnss-constellations">${constellationsHtml}</div>
            <div class="gnss-expanded-panel" id="gnss-expanded-panel"></div>
          </div>

          ${dopHtml}
          ${interferenceHtml}
          ${sbasHtml}

          <div class="comm-card-micro comm-card-footer">
            Source: <a class="inline-link" href="https://celestrak.org" target="_blank" rel="noopener noreferrer">CelesTrak</a> • Updated: ${escapeHtml(updateStr)}
          </div>
        </div>
      `;
    }

    renderConstellations() {
      return Object.entries(CONSTELLATIONS).map(([id, config]) => {
        const data = this.constellationData[id];
        const healthy = data?.healthy || 0;
        const total = data?.total || 0;
        const nominal = config.nominalCount;

        const pct = nominal > 0 ? (healthy / nominal) * 100 : 0;
        let statusClass = 'healthy';
        if (pct < 70) statusClass = 'critical';
        else if (pct < 90) statusClass = 'degraded';

        const segments = Math.min(5, Math.ceil(pct / 20));
        const bars = Array(5).fill(null).map((_, i) =>
          `<span class="health-bar-segment ${i < segments ? 'active' : ''}" style="background: ${i < segments ? config.color : 'rgba(255,255,255,0.1)'}"></span>`
        ).join('');

        const isExpanded = this.expandedConstellation === id;

        return `
          <div class="gnss-constellation ${statusClass} ${isExpanded ? 'expanded' : ''}" 
               data-constellation="${id}"
               style="--constellation-color: ${config.color}">
            <div class="constellation-flag">${config.flag}</div>
            <div class="constellation-name">${config.name}</div>
            <div class="constellation-count">${healthy}/${total}</div>
            <div class="constellation-health-bar">${bars}</div>
          </div>
        `;
      }).join('');
    }

    renderExpandedPanel(constellationId) {
      const config = CONSTELLATIONS[constellationId];
      const data = this.constellationData[constellationId];

      if (!config || !data) return '';

      const satellites = data.satellites || [];

      const satRows = satellites.slice(0, 20).map(sat => {
        const statusIcon = sat.operational ? ICONS.check : ICONS.degraded;
        const prn = sat.prn ? `PRN ${sat.prn}` : sat.noradId;
        return `
          <div class="sat-row ${sat.operational ? 'healthy' : 'unhealthy'}">
            <span class="sat-status">${statusIcon}</span>
            <span class="sat-prn">${prn}</span>
            <span class="sat-name" title="${escapeHtml(sat.name)}">${escapeHtml(sat.blockType)}</span>
            <span class="sat-health">${sat.operational ? 'Operational' : sat.status}</span>
          </div>
        `;
      }).join('');

      const bandsHtml = config.bands.map(b => `<span class="band-tag">${escapeHtml(b)}</span>`).join('');

      return `
        <div class="expanded-header">
          <span class="expanded-title">${config.flag} ${config.fullName}</span>
          <button class="expanded-close" data-close="true">${ICONS.collapse}</button>
        </div>
        <div class="expanded-meta">
          <div class="meta-item">
            <span class="meta-label">Healthy</span>
            <span class="meta-value">${data.healthy} satellites</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Total Tracked</span>
            <span class="meta-value">${data.total} satellites</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Nominal</span>
            <span class="meta-value">${config.nominalCount} satellites</span>
          </div>
        </div>
        <div class="expanded-bands">
          <span class="bands-label">Frequency Bands:</span>
          ${bandsHtml}
        </div>
        <div class="expanded-satellites">
          <div class="sat-list-header">
            <span>Status</span>
            <span>ID</span>
            <span>Type</span>
            <span>Health</span>
          </div>
          <div class="sat-list">${satRows}</div>
          ${satellites.length > 20 ? `<div class="sat-more">+ ${satellites.length - 20} more satellites</div>` : ''}
        </div>
      `;
    }

    renderDOP() {
      if (!this.location?.coords) {
        return `
          <div class="gnss-section gnss-dop-section">
            <div class="gnss-section-header">
              <span class="section-title">${ICONS.accuracy} Position Accuracy</span>
            </div>
            <div class="dop-no-location">Select a location to calculate DOP values</div>
          </div>
        `;
      }

      const dop = this.dopValues || {};
      const locationName = this.location.label || 'Selected Location';

      const dopItems = [
        { key: 'gdop', label: 'GDOP', desc: 'Geometric', good: 4, fair: 8 },
        { key: 'pdop', label: 'PDOP', desc: 'Position', good: 3, fair: 6 },
        { key: 'hdop', label: 'HDOP', desc: 'Horizontal', good: 2, fair: 4 },
        { key: 'vdop', label: 'VDOP', desc: 'Vertical', good: 3, fair: 6 },
        { key: 'tdop', label: 'TDOP', desc: 'Time', good: 2, fair: 4 }
      ];

      const dopCards = dopItems.map(item => {
        const value = dop[item.key];
        let displayValue = '--';
        let quality = 'unknown';

        if (value != null && !isNaN(value)) {
          displayValue = value.toFixed(1);
          if (value <= item.good) quality = 'good';
          else if (value <= item.fair) quality = 'fair';
          else quality = 'poor';
        }

        return `
          <div class="dop-card ${quality}">
            <div class="dop-value">${displayValue}</div>
            <div class="dop-label">${item.label}</div>
            <div class="dop-desc">${item.desc}</div>
          </div>
        `;
      }).join('');

      const visibleSats = dop.visibleSatellites || 0;

      return `
        <div class="gnss-section gnss-dop-section">
          <div class="gnss-section-header">
            <span class="section-title">${ICONS.accuracy} Position Accuracy</span>
            <span class="section-location">@ ${escapeHtml(locationName)}</span>
          </div>
          <div class="dop-grid">${dopCards}</div>
          <div class="dop-footer">
            <span class="visible-sats">${visibleSats} satellites visible (>5° elevation)</span>
            <span class="dop-scale">
              <span class="scale-item good">●</span> Excellent
              <span class="scale-item fair">●</span> Moderate
              <span class="scale-item poor">●</span> Poor
            </span>
          </div>
        </div>
      `;
    }

    renderInterference() {
      if (!this.location?.coords) return '';

      const alerts = this.interferenceAlerts;

      if (alerts.length === 0) {
        return `
          <div class="gnss-section gnss-interference-section">
            <div class="gnss-section-header">
              <span class="section-title">${ICONS.jamming} Interference Status</span>
            </div>
            <div class="interference-clear">
              ${ICONS.check}
              <span>No known interference near your location</span>
            </div>
          </div>
        `;
      }

      const inRange = alerts.filter(a => a.inRange);
      const nearby = alerts.filter(a => !a.inRange).slice(0, 3);

      let statusClass = 'low';
      let statusText = 'Low Risk';

      if (inRange.length > 0) {
        statusClass = 'high';
        statusText = 'Active Interference';
      } else if (nearby.some(a => a.distance < 500)) {
        statusClass = 'elevated';
        statusText = 'Elevated Risk';
      }

      const alertItems = [...inRange, ...nearby].map(alert => `
        <div class="interference-item ${alert.inRange ? 'active' : ''}">
          <span class="interference-icon">${alert.inRange ? ICONS.alert : ICONS.warning}</span>
          <span class="interference-name">${escapeHtml(alert.name)}</span>
          <span class="interference-dist">${alert.distance} nm</span>
          <span class="interference-source">${escapeHtml(alert.source)}</span>
        </div>
      `).join('');

      return `
        <div class="gnss-section gnss-interference-section ${statusClass}">
          <div class="gnss-section-header">
            <span class="section-title">${ICONS.jamming} Interference Status</span>
            <span class="interference-status ${statusClass}">${statusText}</span>
          </div>
          <div class="interference-list">${alertItems}</div>
        </div>
      `;
    }

    renderSBAS() {
      if (!this.sbasData || this.sbasData.length === 0) return '';

      const items = this.sbasData.map(sys => {
        const icon = sys.operational ? ICONS.check : ICONS.degraded;
        return `
          <div class="sbas-item ${sys.operational ? 'operational' : 'unavailable'}" title="${escapeHtml(sys.fullName)}">
            <span class="sbas-flag">${sys.flag}</span>
            <span class="sbas-name">${sys.name}</span>
            <span class="sbas-status">${icon}</span>
          </div>
        `;
      }).join('');

      return `
        <div class="gnss-section gnss-sbas-section">
          <div class="gnss-section-header">
            <span class="section-title">Augmentation Systems (SBAS)</span>
          </div>
          <div class="sbas-grid">${items}</div>
        </div>
      `;
    }

    formatTimestamp(ts) {
      const d = new Date(ts);
      const h = String(d.getHours()).padStart(2, '0');
      const m = String(d.getMinutes()).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const month = d.toLocaleDateString(undefined, { month: 'short' });
      const year = String(d.getFullYear()).slice(-2);
      return `${h}${m} ${day} ${month} ${year}`;
    }

    afterRender() {
      this.bindConstellationClicks();
    }

    bindConstellationClicks() {
      const constellations = this.$$('.gnss-constellation');
      const panel = this.$('#gnss-expanded-panel');

      constellations.forEach(el => {
        el.addEventListener('click', () => {
          const id = el.dataset.constellation;

          if (this.expandedConstellation === id) {
            this.expandedConstellation = null;
            el.classList.remove('expanded');
            if (panel) panel.innerHTML = '';
            panel?.classList.remove('visible');
          } else {
            constellations.forEach(c => c.classList.remove('expanded'));
            this.expandedConstellation = id;
            el.classList.add('expanded');
            if (panel) {
              panel.innerHTML = this.renderExpandedPanel(id);
              panel.classList.add('visible');

              const closeBtn = panel.querySelector('[data-close]');
              if (closeBtn) {
                closeBtn.addEventListener('click', (e) => {
                  e.stopPropagation();
                  this.expandedConstellation = null;
                  constellations.forEach(c => c.classList.remove('expanded'));
                  panel.innerHTML = '';
                  panel.classList.remove('visible');
                });
              }
            }
          }
        });
      });
    }

    getMetaText() {
      return '';
    }
  }

  window.CommDashboard.GnssCard = GnssCard;

})();
