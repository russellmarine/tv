// Global carrier + bands lookup using mcc-mnc-converted.json

const db = require('./cell-data/mcc-mnc-converted.json');

// ISO 3166-1 alpha-2 → emoji flag (e.g. "VE" → 🇻🇪)
function convertISOToFlag(iso2) {
  if (!iso2) return '';
  return [...iso2.toUpperCase()]
    .map(c => String.fromCodePoint(c.charCodeAt(0) + 0x1F1A5))
    .join('');
}

// Normalize MCC/MNC: convert to string and strip leading zeros
function normalizeCode(code) {
  const s = String(code);
  const stripped = s.replace(/^0+/, '');
  // If everything was zeros, keep a single "0"
  return stripped === '' ? '0' : stripped;
}

/**
 * Flatten bands_structured into a simple array of strings
 * Example:
 *   { "2G": ["3"], "4G": ["B20", "B3"] }
 * → ["2G 3", "4G B20", "4G B3"]
 */
function flattenBandsStructured(rec) {
  const bands = rec.bands_structured || {};
  const out = [];

  for (const [gen, arr] of Object.entries(bands)) {
    if (!Array.isArray(arr)) continue;
    for (const code of arr) {
      if (code == null) continue;
      out.push(\`\${gen} \${String(code)}\`);
    }
  }

  // Deduplicate
  return [...new Set(out)];
}

function getCarrierInfo(mcc, mnc) {
  const mccNorm = normalizeCode(mcc);
  const mncNorm = normalizeCode(mnc);

  const rec = db.find(r =>
    normalizeCode(r.mcc) === mccNorm &&
    normalizeCode(r.mnc) === mncNorm
  );

  if (!rec) {
    return {
      name: \`MCC \${mccNorm} / MNC \${mncNorm}\`,
      country: undefined,
      flag: '',
      bands: [],
    };
  }

  const name = rec.brand || rec.operator || \`MCC \${mccNorm} / MNC \${mncNorm}\`;
  const country = rec.country || rec.region;
  const flag = rec.iso ? convertISOToFlag(rec.iso) : '';

  return {
    name,
    country,
    flag,
    bands: flattenBandsStructured(rec),  // e.g. ["4G B20", "4G B3"]
  };
}

module.exports = {
  getCarrierInfo,
};
