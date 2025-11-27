// Cell Tower Proxy for OpenCelliD API
// Run with: node cell-proxy.cjs
// Listens on port 4011

require('dotenv').config();

const http = require('http');
const https = require('https');
const url = require('url');

const PORT = 4011;
const OPENCELLID_TOKEN = process.env.OPENCELLID_TOKEN;

if (!OPENCELLID_TOKEN) {
  console.error('[Cell] ERROR: OPENCELLID_TOKEN not set in environment or .env file');
  process.exit(1);
}

// Simple in-memory cache (cell data is fairly static)
const cache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

// MCC/MNC to carrier name mapping (US carriers)
const US_CARRIERS = {
  '310-410': { name: 'AT&T', bands: ['B2', 'B4', 'B5', 'B12', 'B14', 'B17', 'B29', 'B30', 'B66', 'n5', 'n77', 'n260'] },
  '310-260': { name: 'T-Mobile', bands: ['B2', 'B4', 'B12', 'B66', 'B71', 'n41', 'n71', 'n258', 'n260', 'n261'] },
  '311-480': { name: 'Verizon', bands: ['B2', 'B4', 'B5', 'B13', 'B66', 'n2', 'n5', 'n77', 'n261'] },
  '310-120': { name: 'Sprint (T-Mobile)', bands: ['B25', 'B26', 'B41', 'n41'] },
  '311-490': { name: 'Verizon LTE', bands: ['B4', 'B13'] },
  '312-530': { name: 'Sprint (T-Mobile)', bands: ['B25', 'B41'] },
  '310-150': { name: 'AT&T', bands: ['B2', 'B4', 'B5', 'B12', 'B17'] },
  '311-882': { name: 'AT&T FirstNet', bands: ['B14'] },
  '310-030': { name: 'AT&T', bands: ['B2', 'B4', 'B5'] },
  '310-070': { name: 'AT&T', bands: ['B2', 'B4', 'B5'] },
  '310-560': { name: 'US Cellular', bands: ['B2', 'B4', 'B5', 'B12', 'n71'] },
  '311-220': { name: 'US Cellular', bands: ['B2', 'B4', 'B5', 'B12'] },
  '310-990': { name: 'Inland Cellular', bands: ['B2', 'B4', 'B12'] },
  '312-250': { name: 'Cellular One', bands: ['B4', 'B12'] }
};

// Additional MCC mappings for countries
const MCC_COUNTRIES = {
  '310': 'US', '311': 'US', '312': 'US', '313': 'US', '316': 'US',
  '302': 'CA', '334': 'MX', '722': 'AR', '724': 'BR',
  '234': 'GB', '262': 'DE', '208': 'FR', '222': 'IT', '214': 'ES',
  '440': 'JP', '450': 'KR', '460': 'CN', '520': 'TH', '515': 'PH',
  '505': 'AU', '530': 'NZ'
};

function getCarrierInfo(mcc, mnc) {
  const key = `${mcc}-${mnc}`;
  if (US_CARRIERS[key]) {
    return US_CARRIERS[key];
  }
  // Return generic info
  return {
    name: `MCC ${mcc} / MNC ${mnc}`,
    country: MCC_COUNTRIES[String(mcc)] || 'Unknown',
    bands: []
  };
}

function getCacheKey(lat, lon, range) {
  // Round to ~100m precision for cache grouping
  const latRound = Math.round(lat * 1000) / 1000;
  const lonRound = Math.round(lon * 1000) / 1000;
  return `${latRound}_${lonRound}_${range}`;
}

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
      headers: {
        'User-Agent': 'RussellTV/1.0'
      }
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
  
  // Calculate distance for each tower
  const towers = data.cells.map(cell => {
    const distance = haversineDistance(centerLat, centerLon, cell.lat, cell.lon);
    const carrierKey = `${cell.mcc}-${cell.mnc}`;
    const carrierInfo = getCarrierInfo(cell.mcc, cell.mnc);
    
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
    
    // Map radio type to technology
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
      radio: cell.radio,
      technology: tech,
      lac: cell.lac || cell.tac,
      cellid: cell.cellid,
      signal: cell.averageSignalStrength,
      range: cell.range,
      samples: cell.samples
    };
  }).sort((a, b) => a.distance - b.distance);
  
  // Determine coverage quality
  let coverage = 'none';
  const total = towers.length;
  if (total > 0) {
    const nearby = towers.filter(t => t.distance < 1000).length;
    if (nearby >= 5 || total >= 15) coverage = 'excellent';
    else if (nearby >= 2 || total >= 8) coverage = 'good';
    else if (nearby >= 1 || total >= 3) coverage = 'moderate';
    else coverage = 'limited';
  }
  
  return {
    towers: towers.slice(0, 20), // Return top 20 closest
    carriers: Object.values(carriers).sort((a, b) => b.count - a.count),
    technologies,
    summary: {
      total,
      coverage,
      nearestTower: towers[0] ? towers[0].distance : null,
      has5G: technologies['5G'] > 0,
      hasLTE: technologies['LTE'] > 0
    }
  };
}

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

const server = http.createServer(async (req, res) => {
  // CORS headers
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
      // Check cache
      const cacheKey = getCacheKey(latNum, lonNum, rangeNum);
      const cached = cache.get(cacheKey);
      if (cached && Date.now() - cached.time < CACHE_TTL) {
        console.log(`[Cell] Cache hit for ${cacheKey}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(cached.data));
        return;
      }
      
      // Fetch from API
      const rawData = await fetchFromOpenCelliD(latNum, lonNum, rangeNum);
      const processed = processResults(rawData, latNum, lonNum);
      
      // Cache result
      cache.set(cacheKey, { data: processed, time: Date.now() });
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(processed));
      
    } catch (error) {
      console.error(`[Cell] Error: ${error.message}`);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        error: 'Failed to fetch cell data',
        message: error.message,
        // Return empty but valid structure
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
  
  // 404 for unknown routes
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
