#!/usr/bin/env python3
import json
import os
from pathlib import Path

import psycopg2

BASE = Path(__file__).resolve().parent
CONVERTED_PATH = BASE / "mcc-mnc-converted.json"

def digits(val):
    if val is None:
        return ""
    return "".join(ch for ch in str(val) if ch.isdigit())

def main():
    if not CONVERTED_PATH.exists():
        raise SystemExit(f"{CONVERTED_PATH} not found; run update_mcc_mnc.py first.")

    data = json.loads(CONVERTED_PATH.read_text(encoding="utf-8"))
    print(f"[sync_bands] Loaded {len(data)} converted rows from {CONVERTED_PATH.name}")

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

        updated = 0
        missed = 0

        for r in data:
            mcc_s = digits(r.get("MCC") or r.get("mcc"))
            mnc_s = digits(r.get("MNC") or r.get("mnc"))
            plmn_s = digits(r.get("PLMN") or r.get("plmn")) or None

            if not mcc_s or not mnc_s:
                missed += 1
                continue

            mcc_i = int(mcc_s)
            mnc_i = int(mnc_s)

            bands_text = (r.get("bands") or r.get("Bands") or "").strip() or None
            bands_structured = r.get("bands_structured") or {}

            if plmn_s:
                cur.execute(
                    '''
                    UPDATE mcc_mnc_carriers
                    SET bands = COALESCE(%s, bands),
                        bands_structured = %s::jsonb
                    WHERE mcc = %s AND mnc = %s AND plmn = %s
                    ''',
                    (bands_text, json.dumps(bands_structured), mcc_i, mnc_i, plmn_s),
                )
            else:
                cur.execute(
                    '''
                    UPDATE mcc_mnc_carriers
                    SET bands = COALESCE(%s, bands),
                        bands_structured = %s::jsonb
                    WHERE mcc = %s AND mnc = %s
                    ''',
                    (bands_text, json.dumps(bands_structured), mcc_i, mnc_i),
                )

            if cur.rowcount > 0:
                updated += cur.rowcount
            else:
                missed += 1

        conn.commit()
        print(f"[sync_bands] Updated {updated} rows in mcc_mnc_carriers (missed {missed})")
    except Exception as e:
        conn.rollback()
        print(f"[sync_bands] ERROR while syncing bands to Postgres: {e}")
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    main()
