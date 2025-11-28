#!/usr/bin/env python3
import json
import re
from pathlib import Path

src_path = Path("mcc-mnc.json")
dst_path = Path("mcc-mnc-converted.json")

with src_path.open("r", encoding="utf-8") as f:
    raw = json.load(f)

def normalize_bands(band_str: str):
    if not band_str:
        return {}
    
    parts = re.split(r"/|,|\+|\s+and\s+", band_str)
    bands = {"2G": [], "3G": [], "4G": [], "5G": []}

    for p in parts:
        p = p.strip().upper()
        if not p:
            continue

        # 5G NR (rare in your dataset for now)
        if "NR" in p or p.startswith("N"):
            m = re.search(r"(\d+)", p)
            if m:
                bands["5G"].append(f"n{m.group(1)}")
            continue

        # LTE is 4G
        if "LTE" in p:
            # Example: "LTE 1800" → band 3
            m = re.search(r"(\d+)", p)
            if m:
                mhz = int(m.group(1))
                # Mapping from MHz freq → band # (common subsets)
                LTE_FREQ_TO_BAND = {
                    700: "12",
                    800: "20",
                    850: "5",
                    900: "8",
                    1500: "32",
                    1700: "4",
                    1800: "3",
                    1900: "2",
                    2100: "1",
                    2600: "7",
                }
                band = LTE_FREQ_TO_BAND.get(mhz, None)
                if band:
                    bands["4G"].append(f"B{band}")
                else:
                    # Unknown LTE band → just prefix B
                    bands["4G"].append(f"B{mhz}")
            continue

        # GSM is 2G
        if "GSM" in p:
            m = re.search(r"(\d+)", p)
            if m:
                mhz = int(m.group(1))
                GSM_FREQ_TO_BAND = {
                    850: "5",
                    900: "8",
                    1800: "3",
                    1900: "2",
                }
                band = GSM_FREQ_TO_BAND.get(mhz, None)
                if band:
                    bands["2G"].append(band)
                else:
                    bands["2G"].append(str(mhz))
            continue

        # UMTS/WCDMA is 3G
        if "UMTS" in p or "WCDMA" in p or "HSPA" in p:
            m = re.search(r"(\d+)", p)
            if m:
                bands["3G"].append(m.group(1))
            continue

    # Strip empty techs
    return {gen: arr for gen, arr in bands.items() if arr}

out = []

for rec in raw:
    bands = normalize_bands(rec.get("bands", ""))
    rec["bands_structured"] = bands
    out.append(rec)

# Save upgraded version
dst_path.write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
print(f"Converted {len(out)} records → {dst_path}")
