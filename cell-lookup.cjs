// cell-lookup.cjs
// Centralized MCC/MNC + carrier lookup logic for RussellTV cell panel

const path = require('path');
const fs = require('fs');

// --- DATA SOURCES ------------------------------------------------------

// Canonical MCC/MNC dataset (original big JSON)
const MCC_MNC_PATH = path.join(__dirname, 'cell-data', 'mcc-mnc.json');
const mccMncData = JSON.parse(fs.readFileSync(MCC_MNC_PATH, 'utf8'));

// Optional: converted dataset with bands_structured, etc.
let mccMncConverted = [];
try {
  mccMncConverted = require('./cell-data/mcc-mnc-converted.json');
} catch (e) {
  console.warn('[CellLookup] mcc-mnc-converted.json not found; structured bands will be empty.');
}

// --- INDEXES -----------------------------------------------------------

// Map as-is: "mcc-mnc" exactly like in mcc-mnc.json
const MCC_MNC_MAP = new Map();

// Numeric-normalized map: "mcc-<Number(mnc)>" to handle 004 vs 4
const MCC_MNC_NUMERIC_MAP = new Map();

// ISO lookup: mcc -> ISO2 code
const MCC_TO_ISO = new Map();

// Structured bands map: "mcc-<Number(mnc)>" -> converted row (with bands_structured)
const STRUCTURED_BANDS_MAP = new Map();

// Build from canonical dataset
for (const row of mccMncData) {
  const mccStr = String(row.mcc);
  const mncStr = String(row.mnc);

  const exactKey = `${mccStr}-${mncStr}`;
  MCC_MNC_MAP.set(exactKey, row);

  const numKey = `${mccStr}-${Number(mncStr)}`;
  if (!MCC_MNC_NUMERIC_MAP.has(numKey)) {
    MCC_MNC_NUMERIC_MAP.set(numKey, row);
  }

  if (row.mcc && row.iso && !MCC_TO_ISO.has(mccStr)) {
    MCC_TO_ISO.set(mccStr, row.iso.toUpperCase());
  }
}

// Build structured bands index (if file exists)
for (const row of mccMncConverted) {
  const mccStr = String(row.mcc);
  const mncNum = Number(row.mnc);
  const key = `${mccStr}-${mncNum}`;
  STRUCTURED_BANDS_MAP.set(key, row);
}

// --- CUSTOM OVERRIDES (US, etc.) --------------------------------------

const CUSTOM_CARRIERS = {
  // US examples (you already had these)
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
  '312-250': { name: 'Cellular One', bands: ['B4', 'B12'] },
  // You can paste more intl overrides here if you want to hard-code them.
};

// --- HELPERS -----------------------------------------------------------

function isoToFlag(iso2) {
  if (!iso2 || iso2.length !== 2) return '';
  const upper = iso2.toUpperCase();
  const codePoints = [...upper].map(c => 0x1F1E6 + (c.charCodeAt(0) - 65));
  return String.fromCodePoint(...codePoints);
}

function getCountryCode(mcc) {
  const key = String(mcc);
  return MCC_TO_ISO.get(key) || null;
}

function getCountryFlag(input) {
  if (!input) return '';
  const s = String(input);
  let iso;

  if (/^\d+$/.test(s)) {
    // Looks like an MCC
    iso = getCountryCode(s);
  } else {
    iso = s.toUpperCase();
  }

  if (!iso) return '';
  if (iso === 'XX') return '🌐';
  return isoToFlag(iso);
}

// Main lookup: mcc + mnc -> carrier info
function getCarrierInfo(mcc, mnc) {
  const mccStr = String(mcc);
  const mncStr = String(mnc);
  const exactKey = `${mccStr}-${mncStr}`;
  const numericKey = `${mccStr}-${Number(mncStr)}`;

  const override = CUSTOM_CARRIERS[exactKey] || CUSTOM_CARRIERS[numericKey] || {};

  // Base row from canonical dataset
  let base = MCC_MNC_MAP.get(exactKey) || MCC_MNC_NUMERIC_MAP.get(numericKey) || null;

  // Structured bands row
  const structured = STRUCTURED_BANDS_MAP.get(numericKey) || null;

  const iso =
    (structured && structured.iso && structured.iso.toUpperCase()) ||
    (base && base.iso && base.iso.toUpperCase()) ||
    null;

  const country =
    (structured && structured.country) ||
    (base && base.country) ||
    null;

  const name =
    override.name ||
    (base && (base.brand || base.operator)) ||
    (structured && (structured.brand || structured.operator)) ||
    `MCC ${mcc} / MNC ${mnc}`;

  // Bands priority:
  // 1) override.bands
  // 2) structured.bands_structured flattened
  // 3) base.bands string split on "/" or ","
  let bands = override.bands || [];

  if (!bands.length && structured && structured.bands_structured) {
    const flat = [...new Set(
      Object.values(structured.bands_structured)
        .flat()
        .map(b => String(b).trim())
        .filter(Boolean)
    )];
    bands = flat;
  }

  if (!bands.length && base && base.bands) {
    bands = base.bands
      .split(/[\/,]/)
      .map(b => b.trim())
      .filter(Boolean);
  }

  return {
    name,
    country,
    iso,
    flag: iso ? getCountryFlag(iso) : (base ? getCountryFlag(mccStr) : ''),
    bands,
    mcc: mccStr,
    mnc: mncStr,
    operator: base ? base.operator : (structured ? structured.operator : null),
    brand: base ? base.brand : (structured ? structured.brand : null),
    region: base ? base.region : (structured ? structured.region : null),
    tadig: base ? base.tadig : (structured ? structured.tadig : null)
  };
}

// Stub for now – you can wire your bounding-box logic back in later
function getExpectedCountry(lat, lon) {
  return null;
}

module.exports = {
  getCarrierInfo,
  getCountryCode,
  getCountryFlag,
  getExpectedCountry
};
