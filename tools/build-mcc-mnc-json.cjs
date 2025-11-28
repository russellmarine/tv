// tools/build-mcc-mnc-json.cjs
// Simple CSV -> JSON converter for mcc-mnc.net dataset

const fs = require('fs');
const path = require('path');

const input = path.join(__dirname, '..', 'cell-data', 'mcc-mnc.csv');
const output = path.join(__dirname, '..', 'cell-data', 'mcc-mnc.json');

const raw = fs.readFileSync(input, 'utf8');

// CSV uses ";" as separator
const lines = raw.split(/\r?\n/).filter(l => l.trim().length > 0);
const header = lines[0].split(';').map(h => h.trim());

const data = lines.slice(1).map(line => {
  const cols = line.split(';').map(c => c.trim());
  const row = {};
  header.forEach((key, idx) => {
    row[key.toLowerCase()] = cols[idx] ?? '';
  });

  return {
    mcc: row.mcc,
    mnc: row.mnc,
    plmn: row.plmn,
    region: row.region,
    country: row.country,
    iso: row.iso || null,
    operator: row.operator || null,
    brand: row.brand || null,
    tadig: row.tadig || null,
    bands: row.bands || null
  };
});

// Write compact JSON
fs.writeFileSync(output, JSON.stringify(data, null, 2), 'utf8');
console.log(`Wrote ${data.length} MCC/MNC rows to ${output}`);
