#!/usr/bin/env python3
import json
import re
from pathlib import Path

src_path = Path("mcc-mnc.json")
dst_path = Path("mcc-mnc-converted.json")

# Some CSVs include a BOM in the header, so keys can show up as "\\ufeffMCC"
BOM_MCC_KEY = "\ufeffMCC"

def normalize_record_keys(rec: dict) -> dict:
    out = dict(rec)

    # Normalize MCC key (handle BOM) → always ensure we have a plain 'MCC'
    if BOM_MCC_KEY in out and "MCC" not in out:
        out["MCC"] = out.pop(BOM_MCC_KEY)

    # Normalize Bands → keep original 'Bands' but also mirror into lowercase 'bands'
    if "Bands" in out and "bands" not in out:
        out["bands"] = out["Bands"]
    elif "bands" in out and "Bands" not in out:
        out["Bands"] = out["bands"]

    return out

def normalize_bands(band_str: str):
    if not band_str:
        return {}

    parts = re.split(r"/|,|\+|\s+and\s+", band_str)
    bands = {"2G": [], "3G": [], "4G": [], "5G": []}

    for p in parts:
        p = p.strip().upper()
        if not p:
            continue

        # 5G NR
        if "NR" in p or p.startswith("N"):
            m = re.search(r"(\\d+)", p)
            if m:
                bands["5G"].append(f"n{m.group(1)}")
            continue

        # LTE is 4G
        if "LTE" in p:
            m = re.search(r"(\\d+)", p)
            if m:
                mhz = int(m.group(1))
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
                    bands["4G"].append(f"B{mhz}")
            continue

        # GSM is 2G
        if "GSM" in p:
            m = re.search(r"(\\d+)", p)
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
            m = re.search(r"(\\d+)", p)
            if m:
                bands["3G"].append(m.group(1))
            continue

    # Strip empty techs
    return {gen: arr for gen, arr in bands.items() if arr}

with src_path.open("r", encoding="utf-8") as f:
    raw = json.load(f)

out = []

for rec in raw:
    # Normalize keys (fix BOM + Bands/bands)
    rec = normalize_record_keys(rec)

    # Build structured bands from either 'bands' or 'Bands'
    band_str = rec.get("bands") or rec.get("Bands") or ""
    rec["bands_structured"] = normalize_bands(band_str)

    out.append(rec)

dst_path.write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
print(f"Converted {len(out)} records \u2192 {dst_path}")
