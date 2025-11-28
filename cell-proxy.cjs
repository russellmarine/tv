// Cell Tower Proxy for OpenCelliD API
// Run with: node cell-proxy.cjs
// Listens on port 4011

require('dotenv').config();

const http = require('http');
const https = require('https');
const url = require('url');

// Big data tables are in cell-data.cjs
const {
  US_CARRIERS,
  INTL_CARRIERS,
  MCC_COUNTRIES,
  COUNTRY_FLAGS,
  ALL_CARRIERS
} = require('./cell-data.cjs');

const PORT = 4011;
const OPENCELLID_TOKEN = process.env.OPENCELLID_TOKEN;

if (!OPENCELLID_TOKEN) {
  console.error('[Cell] ERROR: OPENCELLID_TOKEN not set in environment or .env file');
  process.exit(1);
}

// Simple in-memory cache (cell data is fairly static)
const cache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

// ---------- Country helpers ----------

function getCountryFlag(mcc) {
  const country = MCC_COUNTRIES[String(mcc)];
  return country ? (COUNTRY_FLAGS[country] || '') : '';
}

function getCountryCode(mcc) {
  return MCC_COUNTRIES[String(mcc)] || null;
}

function getCarrierInfo(mcc, mnc) {
  const key = `${mcc}-${mnc}`;
  const flag = getCountryFlag(mcc);
  const country = MCC_COUNTRIES[String(mcc)] || 'Unknown';

  if (ALL_CARRIERS[key]) {
    return {
      ...ALL_CARRIERS[key],
      flag,
      country
    };
  }
  // Generic fallback
  return {
    name: `MCC ${mcc} / MNC ${mnc}`,
    country,
    flag,
    bands: []
  };
}

// Detect expected country based on coordinates (approximate, by bounding boxes)
function getExpectedCountry(lat, lon) {
  // === NORTH AMERICA ===
  // USA (continental)
  if (lat >= 24 && lat <= 50 && lon >= -125 && lon <= -66) return 'US';
  // Alaska
  if (lat >= 51 && lat <= 72 && lon >= -180 && lon <= -129) return 'US';
  // Hawaii
  if (lat >= 18 && lat <= 23 && lon >= -161 && lon <= -154) return 'US';
  // Puerto Rico
  if (lat >= 17.5 && lat <= 18.6 && lon >= -68 && lon <= -65) return 'PR';
  // Guam
  if (lat >= 13 && lat <= 14 && lon >= 144 && lon <= 145) return 'GU';
  // Canada
  if (lat >= 42 && lat <= 84 && lon >= -141 && lon <= -52) return 'CA';
  // Mexico
  if (lat >= 14 && lat <= 33 && lon >= -118 && lon <= -86) return 'MX';

  // === EUROPE (subset of what you already had) ===
  if (lat >= 49 && lat <= 61 && lon >= -11 && lon <= 2) return 'GB'; // UK
  if (lat >= 51 && lat <= 56 && lon >= -11 && lon <= -5) return 'IE'; // Ireland
  if (lat >= 47 && lat <= 55 && lon >= 5 && lon <= 15) return 'DE';   // Germany
  if (lat >= 41 && lat <= 51 && lon >= -5 && lon <= 10) return 'FR';  // France
  if (lat >= 36 && lat <= 44 && lon >= -10 && lon <= 4) return 'ES';  // Spain
  if (lat >= 36 && lat <= 47 && lon >= 6 && lon <= 19) return 'IT';   // Italy
  if (lat >= 49 && lat <= 55 && lon >= 14 && lon <= 24) return 'PL';  // Poland
  if (lat >= 58 && lat <= 72 && lon >= 4 && lon <= 31) return 'NO';   // Norway
  if (lat >= 55 && lat <= 70 && lon >= 10 && lon <= 25) return 'SE';  // Sweden
  if (lat >= 59 && lat <= 70 && lon >= 20 && lon <= 32) return 'FI';  // Finland
  if (lat >= 54 && lat <= 58 && lon >= 7 && lon <= 16) return 'DK';   // Denmark
  if (lat >= 50.5 && lat <= 54 && lon >= 3 && lon <= 7.5) return 'NL';// Netherlands
  if (lat >= 49.5 && lat <= 51.5 && lon >= 2.5 && lon <= 6.5) return 'BE'; // Belgium
  if (lat >= 45.5 && lat <= 48 && lon >= 5.5 && lon <= 10.5) return 'CH';  // Switzerland
  if (lat >= 46 && lat <= 49 && lon >= 9 && lon <= 17) return 'AT';        // Austria
  if (lat >= 34 && lat <= 42 && lon >= 19 && lon <= 30) return 'GR';       // Greece
  if (lat >= 36 && lat <= 42 && lon >= 26 && lon <= 45) return 'TR';       // Turkey
  if (lat >= 43 && lat <= 48 && lon >= 20 && lon <= 30) return 'RO';       // Romania
  if (lat >= 44 && lat <= 53 && lon >= 22 && lon <= 40) return 'UA';       // Ukraine

  // === MIDDLE EAST (subset) ===
  if (lat >= 29 && lat <= 38 && lon >= 38 && lon <= 49) return 'IQ';
  if (lat >= 28.5 && lat <= 30.5 && lon >= 46 && lon <= 49) return 'KW';
  if (lat >= 16 && lat <= 33 && lon >= 34 && lon <= 56) return 'SA';
  if (lat >= 22 && lat <= 26 && lon >= 51 && lon <= 57) return 'AE';
  if (lat >= 24.5 && lat <= 26.5 && lon >= 50 && lon <= 52) return 'QA';
  if (lat >= 25.5 && lat <= 26.5 && lon >= 50 && lon <= 51) return 'BH';
  if (lat >= 16 && lat <= 27 && lon >= 52 && lon <= 60) return 'OM';
  if (lat >= 12 && lat <= 19 && lon >= 42 && lon <= 55) return 'YE';
  if (lat >= 29 && lat <= 33 && lon >= 34 && lon <= 39) return 'JO';
  if (lat >= 29 && lat <= 33.5 && lon >= 34 && lon <= 36) return 'IL';
  if (lat >= 32 && lat <= 37.5 && lon >= 35 && lon <= 42.5) return 'SY';
  if (lat >= 25 && lat <= 40 && lon >= 44 && lon <= 64) return 'IR';
  if (lat >= 29 && lat <= 39 && lon >= 60 && lon <= 75) return 'AF';

  // === EAST ASIA / PACIFIC (subset) ===
  if (lat >= 24 && lat <= 46 && lon >= 123 && lon <= 146) return 'JP';
  if (lat >= 33 && lat <= 39 && lon >= 124 && lon <= 132) return 'KR';
  if (lat >= 37.5 && lat <= 43 && lon >= 124 && lon <= 131) return 'KP';
  if (lat >= 18 && lat <= 54 && lon >= 73 && lon <= 135) return 'CN';
  if (lat >= 21.5 && lat <= 26 && lon >= 119 && lon <= 122.5) return 'TW';
  if (lat >= 4 && lat <= 21 && lon >= 116 && lon <= 127) return 'PH';
  if (lat >= 8 && lat <= 24 && lon >= 102 && lon <= 110) return 'VN';
  if (lat >= 5 && lat <= 21 && lon >= 97 && lon <= 106) return 'TH';
  if (lat >= 1 && lat <= 1.5 && lon >= 103 && lon <= 104.5) return 'SG';
  if (lat >= 0.5 && lat <= 8 && lon >= 99 && lon <= 120) return 'MY';
  if (lat >= -11 && lat <= 6 && lon >= 94 && lon <= 141) return 'ID';
  if (lat >= 6 && lat <= 36 && lon >= 68 && lon <= 98) return 'IN';
  if (lat >= 23 && lat <= 37 && lon >= 60 && lon <= 77) return 'PK';

  // === AFRICA (subset) ===
  if (lat >= 22 && lat <= 32 && lon >= 24 && lon <= 37) return 'EG';
  if (lat >= 19 && lat <= 34 && lon >= 9 && lon <= 25) return 'LY';
  if (lat >= 8 && lat <= 23 && lon >= 21 && lon <= 39) return 'SD';
  if (lat >= -2 && lat <= 12 && lon >= 40 && lon <= 52) return 'SO';
  if (lat >= 10.5 && lat <= 13 && lon >= 41 && lon <= 44) return 'DJ';
  if (lat >= -5 && lat <= 5 && lon >= 33 && lon <= 42) return 'KE';
  if (lat >= -35 && lat <= -22 && lon >= 16 && lon <= 33) return 'ZA';
  if (lat >= 4 && lat <= 14 && lon >= 2 && lon <= 15) return 'NG';

  // === SOUTH AMERICA (subset) ===
  if (lat >= -34 && lat <= 6 && lon >= -74 && lon <= -34) return 'BR';
  if (lat >= -5 && lat <= 14 && lon >= -82 && lon <= -66) return 'CO';
  if (lat >= -19 && lat <= 0 && lon >= -82 && lon <= -68) return 'PE';
  if (lat >= -56 && lat <= -21 && lon >= -74 && lon <= -53) return 'AR';
  if (lat >= -56 && lat <= -17 && lon >= -76 && lon <= -66) return 'CL';

  // === OCEANIA (subset) ===
  if (lat >= -44 && lat <= -10 && lon >= 113 && lon <= 154) return 'AU';
  if (lat >= -48 && lat <= -33 && lon >= 165 && lon <= 179) return 'NZ';

  return null;
}

// ---------- Cache key ----------

function getCacheKey(lat, lon, range) {
  // Round to ~100m precision for cache grouping
  const latRound = Math.round(lat * 1000) / 1000;
  const lonRound = Math.round(lon * 1000) / 1000;
  return `${latRound}_${lonRound}_${range}`;
}

// ---------- OpenCelliD fetch ----------

async function fetchFromOpenCelliD(lat, lon, range) {
  return new Promise((resolve, reject) => {
    // OpenCelliD limits BBOX to 4,000,000 sq meters (4 km²)
    // Max safe box is about 2km x 2km, so cap range at 1000m (creates 2km x 2km box)
    const maxRange = 1000; // 1km radius = 2km x 2km box = 4 km²
    const effectiveRange = Math.min(range, maxRange);

    // Create bounding box from center point and range (in meters)
    const rangeKm = effectiveRange / 1000;
    const latDelta = rangeKm / 111; // ~111km per degree latitude
    const lonDelta = rangeKm / (111 * Math.cos(lat * Math.PI / 180));

    const bbox = `${lat - latDelta},${lon - lonDelta},${lat + latDelta},${lon + lonDelta}`;

    const apiUrl = `https://opencellid.org/cell/getInArea?key=${OPENCELLID_TOKEN}&BBOX=${bbox}&format=json&limit=50`;

    console.log(`[Cell] Fetching: ${apiUrl.replace(OPENCELLID_TOKEN, 'TOKEN')}`);
    console.log(`[Cell] Range requested: ${range}m, effective: ${effectiveRange}m`);

    https.get(apiUrl, {
      headers: { 'User-Agent': 'RussellTV/1.0' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) {
            console.error(`[Cell] API error: ${res.statusCode} - ${data}`);
            reject(new Error(`API returned ${res.statusCode}`));
            return;
          }
          const json = JSON.parse(data);
          resolve(json);
        } catch (e) {
          console.error(`[Cell] Parse error: ${e.message}`);
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

// ---------- Haversine distance ----------

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// ---------- Result processing ----------

function processResults(data, centerLat, centerLon) {
  if (!data || !data.cells || !Array.isArray(data.cells)) {
    return {
      towers: [],
      carriers: {},
      technologies: {},
      summary: { total: 0, coverage: 'unknown' }
    };
  }

  const carriers = {};
  const technologies = { '5G': 0, 'LTE': 0, 'UMTS': 0, 'GSM': 0, 'CDMA': 0 };
  const countriesDetected = new Set();
  const signals = [];

  // Expected country from coordinates
  const expectedCountry = getExpectedCountry(centerLat, centerLon);

  const towers = data.cells.map(cell => {
    const distance = haversineDistance(centerLat, centerLon, cell.lat, cell.lon);
    const carrierKey = `${cell.mcc}-${cell.mnc}`;
    const carrierInfo = getCarrierInfo(cell.mcc, cell.mnc);
    const cellCountry = getCountryCode(cell.mcc);

    if (cellCountry) countriesDetected.add(cellCountry);

    // track signal
    if (cell.averageSignalStrength && cell.averageSignalStrength !== 0) {
      signals.push(cell.averageSignalStrength);
    }

    // Count carriers
    if (!carriers[carrierKey]) {
      carriers[carrierKey] = {
        ...carrierInfo,
        mcc: cell.mcc,
        mnc: cell.mnc,
        count: 0,
        technologies: {}
      };
    }
    carriers[carrierKey].count++;

    // Map radio type to technology bucket
    let tech = cell.radio || 'Unknown';
    if (tech === 'NR' || tech === 'NBIOT') tech = '5G';
    else if (tech === 'LTE' || tech === 'LTECATM') tech = 'LTE';
    else if (['UMTS', 'HSPA', 'HSPA+', 'HSDPA', 'HSUPA', 'TDSCDMA'].includes(tech)) tech = 'UMTS';
    else if (['GSM', 'GPRS', 'EDGE'].includes(tech)) tech = 'GSM';
    else if (['CDMA', '1xRTT', 'EVDO_0', 'EVDO_A', 'EVDO_B', 'eHRPD', 'IS95A', 'IS95B'].includes(tech)) tech = 'CDMA';

    if (technologies[tech] !== undefined) technologies[tech]++;
    if (!carriers[carrierKey].technologies[tech]) carriers[carrierKey].technologies[tech] = 0;
    carriers[carrierKey].technologies[tech]++;

    return {
      lat: cell.lat,
      lon: cell.lon,
      distance: Math.round(distance),
      mcc: cell.mcc,
      mnc: cell.mnc,
      carrier: carrierInfo.name,
      flag: carrierInfo.flag || '',
      country: carrierInfo.country,
      radio: cell.radio,
      technology: tech,
      lac: cell.lac || cell.tac,
      cellid: cell.cellid,
      signal: cell.averageSignalStrength,
      range: cell.range,
      samples: cell.samples
    };
  }).sort((a, b) => a.distance - b.distance);

  // Coverage qualitative label
  let coverage = 'none';
  const total = towers.length;
  if (total > 0) {
    const nearby = towers.filter(t => t.distance < 1000).length;
    if (nearby >= 5 || total >= 15) coverage = 'excellent';
    else if (nearby >= 2 || total >= 8) coverage = 'good';
    else if (nearby >= 1 || total >= 3) coverage = 'moderate';
    else coverage = 'limited';
  }

  // Roaming check
  const roamingCountries = [];
  if (expectedCountry) {
    for (const country of countriesDetected) {
      if (country !== expectedCountry) {
        roamingCountries.push({
          country,
          flag: COUNTRY_FLAGS[country] || ''
        });
      }
    }
  }

  // Signal statistics for the panel
  let signalStats = null;
  if (signals.length > 0) {
    const avg = signals.reduce((a, b) => a + b, 0) / signals.length;
    const min = Math.min(...signals);
    const max = Math.max(...signals);
    signalStats = {
      avg: Math.round(avg),
      min,
      max,
      samples: signals.length,
      quality: avg >= -70 ? 'excellent' :
               avg >= -85 ? 'good' :
               avg >= -100 ? 'fair' : 'poor'
    };
  }

  return {
    towers: towers.slice(0, 20),
    carriers: Object.values(carriers).sort((a, b) => b.count - a.count),
    technologies,
    summary: {
      total,
      coverage,
      nearestTower: towers[0] ? towers[0].distance : null,
      has5G: technologies['5G'] > 0,
      hasLTE: technologies['LTE'] > 0,
      expectedCountry,
      expectedCountryFlag: expectedCountry ? COUNTRY_FLAGS[expectedCountry] : null,
      roamingWarning: roamingCountries.length > 0,
      roamingCountries,
      signalStats
    }
  };
}

// ---------- HTTP server ----------

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);

  // Health check
  if (parsedUrl.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'cell-proxy' }));
    return;
  }

  // Main endpoint: /cell?lat=X&lon=Y&range=5000
  if (parsedUrl.pathname === '/cell' || parsedUrl.pathname === '/cell/nearby') {
    const { lat, lon, range = '5000' } = parsedUrl.query;

    if (!lat || !lon) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing lat or lon parameter' }));
      return;
    }

    const latNum = parseFloat(lat);
    const lonNum = parseFloat(lon);
    const rangeNum = parseInt(range, 10);

    if (isNaN(latNum) || isNaN(lonNum) || latNum < -90 || latNum > 90 || lonNum < -180 || lonNum > 180) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid coordinates' }));
      return;
    }

    try {
      const cacheKey = getCacheKey(latNum, lonNum, rangeNum);
      const cached = cache.get(cacheKey);
      if (cached && Date.now() - cached.time < CACHE_TTL) {
        console.log(`[Cell] Cache hit for ${cacheKey}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(cached.data));
        return;
      }

      const rawData = await fetchFromOpenCelliD(latNum, lonNum, rangeNum);
      const processed = processResults(rawData, latNum, lonNum);

      cache.set(cacheKey, { data: processed, time: Date.now() });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(processed));
    } catch (error) {
      console.error(`[Cell] Error: ${error.message}`);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'Failed to fetch cell data',
        message: error.message,
        towers: [],
        carriers: [],
        technologies: {},
        summary: { total: 0, coverage: 'unknown' }
      }));
    }
    return;
  }

  // Carrier info endpoint
  if (parsedUrl.pathname === '/cell/carriers') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      us_carriers: US_CARRIERS,
      mcc_countries: MCC_COUNTRIES
    }));
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`[Cell] Proxy server running on port ${PORT}`);
  console.log(`[Cell] Endpoints:`);
  console.log(`       GET /cell?lat=X&lon=Y&range=5000`);
  console.log(`       GET /cell/carriers`);
  console.log(`       GET /health`);
});
