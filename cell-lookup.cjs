// cell-lookup.cjs
// Centralized MCC/MNC + carrier lookup logic for RussellTV cell panel
// Now DB-backed (Postgres) with JSON fallback.

const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

// ---------- HELPERS ----------------------------------------------------

function pick(row, ...names) {
  if (!row) return null;
  for (const n of names) {
    if (row[n] !== undefined && row[n] !== null && row[n] !== '') {
      return row[n];
    }
  }
  return null;
}

function isoToFlag(iso2) {
  if (!iso2 || iso2.length !== 2) return '';
  const upper = iso2.toUpperCase();
  const codePoints = [...upper].map(c => 0x1F1E6 + (c.charCodeAt(0) - 65));
  return String.fromCodePoint(...codePoints);
}

const MCC_MNC_MAP = new Map();          // "mcc-mnc" (strings)
const MCC_MNC_NUMERIC_MAP = new Map();  // "mcc-Number(mnc)"
const MCC_TO_ISO = new Map();           // mcc -> ISO2
const STRUCTURED_BANDS_MAP = new Map(); // "mcc-Number(mnc)" -> row with bands_structured

let mccMncData = [];
let loadedFromDb = false;

// ---------- PRIMARY DATA LOAD (Postgres, then JSON fallback) ----------

function loadFromDb() {
  const host = process.env.RTV_DB_HOST || 'localhost';
  const port = String(process.env.RTV_DB_PORT || 5432);
  const user = process.env.RTV_DB_USER || 'rtvapp';
  const db   = process.env.RTV_DB_NAME || 'russelltv';

  const env = Object.assign({}, process.env);
  if (process.env.RTV_DB_PASSWORD) {
    env.PGPASSWORD = process.env.RTV_DB_PASSWORD;
  }

  const sql =
    "SELECT coalesce(json_agg(row_to_json(t)),'[]'::json) " +
    "FROM (SELECT mcc,mnc,plmn,region,country,iso,operator,brand,tadig,bands,bands_structured " +
    "FROM mcc_mnc_carriers) t;";

  const args = [
    '-h', host,
    '-p', port,
    '-U', user,
    '-d', db,
    '-At',
    '-c', sql
  ];

  const out = execFileSync('psql', args, { encoding: 'utf8', env });
  const trimmed = (out || '').trim();
  if (!trimmed) return [];

  const arr = JSON.parse(trimmed);
  if (!Array.isArray(arr)) {
    throw new Error('Unexpected JSON from Postgres for MCC/MNC data');
  }
  return arr;
}

try {
  mccMncData = loadFromDb();
  loadedFromDb = true;
  console.log(`[CellLookup] Loaded ${mccMncData.length} MCC/MNC rows from Postgres`);
} catch (err) {
  console.warn('[CellLookup] Failed to load MCC/MNC from Postgres, falling back to JSON:', err.message);
  loadedFromDb = false;

  const MCC_MNC_PATH = path.join(__dirname, 'cell-data', 'mcc-mnc.json');
  mccMncData = JSON.parse(fs.readFileSync(MCC_MNC_PATH, 'utf8'));
}

// Optional converted data for fallback / extra structure if DB is not used
let mccMncConverted = [];
if (!loadedFromDb) {
  try {
    mccMncConverted = require('./cell-data/mcc-mnc-converted.json');
  } catch (e) {
    console.warn('[CellLookup] mcc-mnc-converted.json not found; structured bands will be empty.');
  }
}

// ---------- INDEXES ----------------------------------------------------

// Build from canonical dataset (DB rows or JSON)
for (const row of mccMncData) {
  const mccRaw = pick(row, 'mcc', 'MCC', '\uFEFFMCC');
  const mncRaw = pick(row, 'mnc', 'MNC');
  if (!mccRaw || !mncRaw) continue;

  const mccStr = String(mccRaw).trim();
  const mncStr = String(mncRaw).trim();

  const exactKey = `${mccStr}-${mncStr}`;
  MCC_MNC_MAP.set(exactKey, row);

  const numKey = `${mccStr}-${Number(mncStr)}`;
  if (!MCC_MNC_NUMERIC_MAP.has(numKey)) {
    MCC_MNC_NUMERIC_MAP.set(numKey, row);
  }

  const iso = pick(row, 'iso', 'ISO');
  if (mccStr && iso && !MCC_TO_ISO.has(mccStr)) {
    MCC_TO_ISO.set(mccStr, String(iso).toUpperCase());
  }

  // If we loaded from DB and have bands_structured on this row, use it
  if (loadedFromDb && row.bands_structured) {
    STRUCTURED_BANDS_MAP.set(numKey, row);
  }
}

// If not loaded from DB, fall back to converted JSON for structured bands
if (!loadedFromDb) {
  for (const row of mccMncConverted) {
    const mccRaw = pick(row, 'mcc', 'MCC', '\uFEFFMCC');
    const mncRaw = pick(row, 'mnc', 'MNC');
    if (!mccRaw || !mncRaw) continue;

    const mccStr = String(mccRaw).trim();
    const mncNum = Number(mncRaw);
    const key = `${mccStr}-${mncNum}`;
    STRUCTURED_BANDS_MAP.set(key, row);
  }
}

// ---------- CUSTOM OVERRIDES (US etc.) ---------------------------------


const CUSTOM_CARRIERS = {};

// ---------- COUNTRY HELPERS --------------------------------------------

function getCountryCode(mcc) {
  const key = String(mcc);
  return MCC_TO_ISO.get(key) || null;
}

function getCountryFlag(input) {
  if (!input) return '';
  const s = String(input);
  let iso;

  if (/^\d+$/.test(s)) {
    iso = getCountryCode(s);
  } else {
    iso = s.toUpperCase();
  }

  if (!iso) return '';
  if (iso === 'XX') return '🌐';
  return isoToFlag(iso);
}

// ---------- MAIN LOOKUP ------------------------------------------------

function getCarrierInfo(mcc, mnc) {
  const mccStr = String(mcc);
  const mncStr = String(mnc);
  const exactKey = `${mccStr}-${mncStr}`;
  const numericKey = `${mccStr}-${Number(mncStr)}`;

  const override = CUSTOM_CARRIERS[exactKey] || CUSTOM_CARRIERS[numericKey] || {};

  const base = MCC_MNC_MAP.get(exactKey) || MCC_MNC_NUMERIC_MAP.get(numericKey) || null;
  const structured = STRUCTURED_BANDS_MAP.get(numericKey) || null;

  const iso =
    (structured && pick(structured, 'iso', 'ISO')) ||
    (base && pick(base, 'iso', 'ISO')) ||
    null;

  const country =
    (structured && pick(structured, 'country', 'Country')) ||
    (base && pick(base, 'country', 'Country')) ||
    null;

  const brand =
    override.brand ||
    (base && pick(base, 'brand', 'Brand')) ||
    (structured && pick(structured, 'brand', 'Brand')) ||
    null;

  const operator =
    override.operator ||
    (base && pick(base, 'operator', 'Operator')) ||
    (structured && pick(structured, 'operator', 'Operator')) ||
    null;

  const name =
    override.name ||
    (brand || operator) ||
    `MCC ${mcc} / MNC ${mnc}`;

  // Bands priority:
  // 1) override.bands
  // 2) structured.bands_structured (flattened)
  // 3) base.bands / base.Bands string
  let bands = override.bands || [];

  if (!bands.length && structured && structured.bands_structured) {
    const flat = [...new Set(
      Object.values(structured.bands_structured || {})
        .flat()
        .map(b => String(b).trim())
        .filter(Boolean)
    )];
    bands = flat;
  }

  if (!bands.length && base) {
    const bandsStr = pick(base, 'bands', 'Bands');
    if (bandsStr) {
      bands = bandsStr
        .split(/[\/,]/)
        .map(b => b.trim())
        .filter(Boolean);
    }
  }

  const bandsStrAll =
    (structured && (pick(structured, 'Bands', 'bands') || '')) ||
    (base && (pick(base, 'Bands', 'bands') || '')) ||
    '';

  const isMvno = /mvno/i.test(bandsStrAll);

  const region =
    (base && pick(base, 'region', 'Region')) ||
    (structured && pick(structured, 'region', 'Region')) ||
    null;

  const tadig =
    (base && pick(base, 'tadig', 'TADIG')) ||
    (structured && pick(structured, 'tadig', 'TADIG')) ||
    null;

  const finalIso = iso ? String(iso).toUpperCase() : null;

  return {
    name,
    country,
    iso: finalIso,
    flag: finalIso ? getCountryFlag(finalIso) : (base ? getCountryFlag(mccStr) : ''),
    bands,
    mcc: mccStr,
    mnc: mncStr,
    operator: operator || null,
    brand: brand || null,
    region,
    tadig,
    mvno: isMvno
  };
}

// Stub — you can wire bounding-box logic later if you want.
function getExpectedCountry(lat, lon) {
  return null;
}

module.exports = {
  getCarrierInfo,
  getCountryCode,
  getCountryFlag,
  getExpectedCountry
};
