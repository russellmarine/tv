#!/usr/bin/env python3
import csv
import json
import subprocess
import sys
import urllib.request
from pathlib import Path

BASE = Path(__file__).resolve().parent

# Direct CSV from mcc-mnc.net (same schema as your sample)
CSV_URL = "https://mcc-mnc.net/mcc-mnc.csv"

CSV_PATH = BASE / "mcc-mnc.csv"
JSON_PATH = BASE / "mcc-mnc.json"

def download_csv():
    tmp_path = BASE / "mcc-mnc.csv.tmp"
    print(f"[mcc-mnc] Downloading latest MCC/MNC table from {CSV_URL}")
    with urllib.request.urlopen(CSV_URL, timeout=30) as resp:
        if resp.status != 200:
            raise SystemExit(f"HTTP {resp.status} while fetching MCC/MNC table")
        data = resp.read()
    if not data:
        raise SystemExit("Downloaded MCC/MNC CSV is empty, aborting")

    tmp_path.write_bytes(data)
    print(f"[mcc-mnc] Downloaded {len(data)} bytes to {tmp_path}")
    return tmp_path

def csv_to_json(csv_path, json_path):
    print(f"[mcc-mnc] Converting {csv_path.name} -> {json_path.name}")
    with csv_path.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f, delimiter=";")  # matches your sample
        rows = [dict(row) for row in reader]

    if not rows:
        raise SystemExit("[mcc-mnc] Parsed 0 rows from CSV, aborting")

    # Light normalization
    for r in rows:
        for key in ("MCC", "MNC", "PLMN", "Region", "Country", "ISO",
                    "Operator", "Brand", "TADIG", "Bands"):
            if key in r and isinstance(r[key], str):
                r[key] = r[key].strip()

    json_path.write_text(
        json.dumps(rows, indent=2, ensure_ascii=False),
        encoding="utf-8"
    )
    print(f"[mcc-mnc] Wrote JSON with {len(rows)} records to {json_path}")

def run_convert_bands():
    script = BASE / "convert_bands.py"
    if not script.exists():
        print(f"[mcc-mnc] WARNING: {script} not found, skipping band conversion")
        return

    print(f"[mcc-mnc] Running {script.name} ...")
    result = subprocess.run(
        [sys.executable, str(script)],
        cwd=str(BASE),
        check=False,
    )
    if result.returncode != 0:
        raise SystemExit(f"[mcc-mnc] convert_bands.py exited with {result.returncode}")
    print("[mcc-mnc] Band conversion complete (mcc-mnc-converted.json should be updated)")

def main():
    tmp_csv = download_csv()
    tmp_csv.replace(CSV_PATH)
    print(f"[mcc-mnc] Updated {CSV_PATH}")

    csv_to_json(CSV_PATH, JSON_PATH)
    run_convert_bands()
    print("[mcc-mnc] Update pipeline finished successfully")

if __name__ == "__main__":
    main()
