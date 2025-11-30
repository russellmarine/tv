#!/usr/bin/env python3
import csv
import json
import os
import subprocess
import sys
import urllib.request
from pathlib import Path

import psycopg2
from psycopg2.extras import execute_values

BASE = Path(__file__).resolve().parent

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

def _digits(val):
    if val is None:
        return ""
    return "".join(ch for ch in str(val) if ch.isdigit())

def load_into_postgres(rows):
    print(f"[mcc-mnc] Loading {len(rows)} rows into Postgres...")

    db_params = {
        "host": os.environ.get("RTV_DB_HOST", "localhost"),
        "port": int(os.environ.get("RTV_DB_PORT", "5432")),
        "dbname": os.environ.get("RTV_DB_NAME", "russelltv"),
        "user": os.environ.get("RTV_DB_USER", "rtvapp"),
        "password": os.environ.get("RTV_DB_PASSWORD", "changeme"),
    }

    conn = psycopg2.connect(**db_params)
    try:
        conn.autocommit = False
        cur = conn.cursor()
        cur.execute("TRUNCATE mcc_mnc_carriers;")

        values = []
        skipped = 0

        for r in rows:
            mcc_s = _digits(r.get("MCC"))
            mnc_s = _digits(r.get("MNC"))
            plmn_s = _digits(r.get("PLMN"))

            mcc_i = int(mcc_s) if mcc_s else None
            mnc_i = int(mnc_s) if mnc_s else None

            # Derive MCC/MNC from PLMN if MCC missing
            if mcc_i is None and plmn_s and len(plmn_s) >= 3:
                mcc_i = int(plmn_s[:3])
                if mnc_i is None and len(plmn_s) > 3:
                    mnc_i = int(plmn_s[3:])

            if mcc_i is None or mnc_i is None:
                skipped += 1
                continue

            values.append((
                mcc_i,
                mnc_i,
                (r.get("PLMN") or "").strip() or None,
                (r.get("Region") or "").strip() or None,
                (r.get("Country") or "").strip() or None,
                (r.get("ISO") or "").strip() or None,
                (r.get("Operator") or "").strip() or None,
                (r.get("Brand") or "").strip() or None,
                (r.get("TADIG") or "").strip() or None,
                (r.get("Bands") or "").strip() or None,
            ))

        print(f"[mcc-mnc] Prepared {len(values)} rows for insert (skipped {skipped} invalid rows)")

        if not values:
            raise SystemExit("[mcc-mnc] No valid rows to insert into Postgres, aborting")

        sql = """
            INSERT INTO mcc_mnc_carriers
                (mcc, mnc, plmn, region, country, iso, operator, brand, tadig, bands)
            VALUES %s
        """
        execute_values(cur, sql, values)
        conn.commit()
        print("[mcc-mnc] Postgres load complete")
    except Exception as e:
        conn.rollback()
        print(f"[mcc-mnc] ERROR while loading Postgres: {e}")
        raise
    finally:
        conn.close()

def csv_to_json(csv_path, json_path):
    print(f"[mcc-mnc] Converting {csv_path.name} -> {json_path.name}")
    with csv_path.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f, delimiter=";")
        rows = [dict(row) for row in reader]
    if not rows:
        raise SystemExit("[mcc-mnc] Parsed 0 rows from CSV, aborting")

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
    load_into_postgres(rows)

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
