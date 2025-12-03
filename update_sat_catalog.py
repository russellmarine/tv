#!/usr/bin/env python3
import time
import requests
import psycopg2

DB_DSN = "dbname=russelltv user=rtv host=192.168.99.38"
N2YO_BASE = "http://127.0.0.1/api/n2yo"

# Curated SATCOM set (mil + commercial you'd actually plan on)
SATELLITES = {
    # === MILSATCOM ===
    "wgs": {
        "constellation": "wgs",
        "role": "milsatcom",
        "band": "X/Ka",
        "orbit_type": "GEO",
        "operator": "US DoD",
        "satellites": [
            {"norad_id": 32258, "name": "WGS-1"},
            {"norad_id": 33055, "name": "WGS-2"},
            {"norad_id": 34713, "name": "WGS-3"},
            {"norad_id": 38070, "name": "WGS-4"},
            {"norad_id": 39168, "name": "WGS-5"},
            {"norad_id": 39222, "name": "WGS-6"},
            {"norad_id": 40746, "name": "WGS-7"},
            {"norad_id": 41879, "name": "WGS-8"},
            {"norad_id": 42075, "name": "WGS-9"},
            {"norad_id": 44071, "name": "WGS-10"},
            {"norad_id": 53937, "name": "WGS-11"},
        ],
    },
    "aehf": {
        "constellation": "aehf",
        "role": "milsatcom",
        "band": "EHF",
        "orbit_type": "GEO",
        "operator": "US DoD",
        "satellites": [
            {"norad_id": 36868, "name": "AEHF-1"},
            {"norad_id": 38254, "name": "AEHF-2"},
            {"norad_id": 39256, "name": "AEHF-3"},
            {"norad_id": 43651, "name": "AEHF-4"},
            {"norad_id": 44481, "name": "AEHF-5"},
            {"norad_id": 45465, "name": "AEHF-6"},
        ],
    },
    "muos": {
        "constellation": "muos",
        "role": "milsatcom",
        "band": "UHF",
        "orbit_type": "GEO",
        "operator": "US Navy",
        "satellites": [
            {"norad_id": 38093, "name": "MUOS-1"},
            {"norad_id": 39206, "name": "MUOS-2"},
            {"norad_id": 40374, "name": "MUOS-3"},
            {"norad_id": 40887, "name": "MUOS-4"},
            {"norad_id": 41622, "name": "MUOS-5"},
        ],
    },

    # === COMMERCIAL: global / regional SATCOM you’d actually use ===
    "intelsat": {
        "constellation": "intelsat",
        "role": "commercial",
        "band": "C/Ku",
        "orbit_type": "GEO",
        "operator": "Intelsat",
        "satellites": [
            {"norad_id": 28358, "name": "IS 10-02"},
            {"norad_id": 38740, "name": "IS 20"},
            {"norad_id": 38098, "name": "IS 22"},
            {"norad_id": 42950, "name": "IS 37e"},
            {"norad_id": 40874, "name": "IS 34"},
            {"norad_id": 39476, "name": "IS 30"},
            {"norad_id": 42741, "name": "IS 35e"},
            {"norad_id": 40982, "name": "IS 36"},
            {"norad_id": 43823, "name": "IS 38"},
            {"norad_id": 44476, "name": "IS 39"},
        ],
    },
    "eutelsat": {
        "constellation": "eutelsat",
        "role": "commercial",
        "band": "Ku/Ka",
        "orbit_type": "GEO",
        "operator": "Eutelsat",
        "satellites": [
            {"norad_id": 40875, "name": "E 8WB"},
            {"norad_id": 39163, "name": "E 7B"},
            {"norad_id": 37836, "name": "E 16A"},
            {"norad_id": 38652, "name": "E 25B"},
            {"norad_id": 35953, "name": "E 36B"},
            {"norad_id": 40272, "name": "E 9B"},
            {"norad_id": 42432, "name": "E 172B"},
            {"norad_id": 45026, "name": "E 7C"},
            {"norad_id": 44334, "name": "E KONNECT"},
        ],
    },
    "ses": {
        "constellation": "ses",
        "role": "commercial",
        "band": "C/Ku/Ka",
        "orbit_type": "GEO",
        "operator": "SES",
        "satellites": [
            {"norad_id": 26958, "name": "Astra 2C"},
            {"norad_id": 36831, "name": "Astra 1N"},
            {"norad_id": 38778, "name": "Astra 2E"},
            {"norad_id": 40364, "name": "Astra 2G"},
            {"norad_id": 37775, "name": "SES-4"},
            {"norad_id": 40946, "name": "SES-9"},
            {"norad_id": 41382, "name": "SES-10"},
            {"norad_id": 43157, "name": "SES-14"},
            {"norad_id": 44334, "name": "SES-17"},
            {"norad_id": 41903, "name": "SES-15"},
        ],
    },
    "telesat": {
        "constellation": "telesat",
        "role": "commercial",
        "band": "C/Ku",
        "orbit_type": "GEO",
        "operator": "Telesat",
        "satellites": [
            {"norad_id": 42951, "name": "Telstar 19V"},
            {"norad_id": 43562, "name": "Telstar 18V"},
            {"norad_id": 26824, "name": "Telstar 11N"},
            {"norad_id": 37602, "name": "Telstar 14R"},
        ],
    },
    "mena": {
        "constellation": "mena",
        "role": "commercial",
        "band": "C/Ku/Ka",
        "orbit_type": "GEO",
        "operator": "Regional MENA",
        "satellites": [
            {"norad_id": 37816, "name": "Yamal 402"},
            {"norad_id": 40733, "name": "Turksat 4B"},
            {"norad_id": 39020, "name": "Yahsat 1B"},
            {"norad_id": 41036, "name": "Yahsat 1C"},
            {"norad_id": 37777, "name": "Arabsat 5C"},
            {"norad_id": 40878, "name": "Arabsat 6B"},
            {"norad_id": 43039, "name": "Al Yah 3"},
            {"norad_id": 44333, "name": "Amos 17"},
            {"norad_id": 41028, "name": "Amos 5"},
        ],
    },
    "asia": {
        "constellation": "asia",
        "role": "commercial",
        "band": "C/Ku",
        "orbit_type": "GEO",
        "operator": "Asia-Pacific regional",
        "satellites": [
            {"norad_id": 42934, "name": "AsiaSat 9"},
            {"norad_id": 40424, "name": "ABS-3A"},
            {"norad_id": 41589, "name": "ABS-2A"},
            {"norad_id": 37933, "name": "Apstar 7"},
            {"norad_id": 43875, "name": "Apstar 5C"},
            {"norad_id": 40425, "name": "JCSAT-14"},
            {"norad_id": 41729, "name": "JCSAT-16"},
            {"norad_id": 40271, "name": "Thaicom 6"},
            {"norad_id": 39500, "name": "Thaicom 7"},
        ],
    },
}

def get_tle(norad_id: int):
    """Fetch TLE via your N2YO proxy. Handles both JSON and raw text."""
    url = f"{N2YO_BASE}/tle/{norad_id}"
    try:
        resp = requests.get(url, timeout=15)
        resp.raise_for_status()
    except Exception as e:
        print(f"[WARN] TLE request failed for {norad_id}: {e}")
        return None, None

    tle1 = tle2 = None

    # Try JSON first
    try:
        data = resp.json()
        # N2YO format: usually a 'tle' field with multi-line text
        if isinstance(data, dict) and "tle" in data:
            raw = data["tle"]
        else:
            # If API proxy exposes 'line1' / 'line2'
            line1 = data.get("line1") or data.get("tle1")
            line2 = data.get("line2") or data.get("tle2")
            if line1 and line2:
                return line1.strip(), line2.strip()
            raw = None
    except ValueError:
        # Not JSON, assume plain text TLE
        raw = resp.text

    if not raw:
        print(f"[WARN] No TLE payload for {norad_id}")
        return None, None

    # Split out last two non-empty lines as TLE1 / TLE2
    lines = [ln.strip() for ln in str(raw).splitlines() if ln.strip()]
    if len(lines) >= 2:
        tle1, tle2 = lines[-2], lines[-1]
    else:
        print(f"[WARN] Could not parse TLE lines for {norad_id}")
        return None, None

    return tle1, tle2


def main():
    conn = psycopg2.connect(DB_DSN)
    conn.autocommit = False
    cur = conn.cursor()

    total = 0
    updated = 0

    try:
        for const_key, meta in SATELLITES.items():
            constellation = meta["constellation"]
            role = meta["role"]
            band = meta["band"]
            orbit_type = meta["orbit_type"]
            operator = meta["operator"]

            for sat in meta["satellites"]:
                norad_id = sat["norad_id"]
                name = sat["name"]
                total += 1

                # Upsert basic catalog info
                cur.execute(
                    """
                    INSERT INTO sat_catalog
                        (norad_id, name, operator, constellation, role, band, orbit_type, source)
                    VALUES
                        (%s, %s, %s, %s, %s, %s, %s, 'n2yo-daily')
                    ON CONFLICT (norad_id) DO UPDATE
                    SET name          = EXCLUDED.name,
                        operator      = EXCLUDED.operator,
                        constellation = EXCLUDED.constellation,
                        role          = EXCLUDED.role,
                        band          = EXCLUDED.band,
                        orbit_type    = EXCLUDED.orbit_type,
                        source        = EXCLUDED.source,
                        last_updated  = now();
                    """,
                    (norad_id, name, operator, constellation, role, band, orbit_type),
                )

                # Fetch and upsert TLE
                tle1, tle2 = get_tle(norad_id)
                if tle1 and tle2:
                    cur.execute(
                        """
                        INSERT INTO sat_tle (norad_id, tle1, tle2)
                        VALUES (%s, %s, %s)
                        ON CONFLICT (norad_id) DO UPDATE
                        SET tle1 = EXCLUDED.tle1,
                            tle2 = EXCLUDED.tle2,
                            last_updated = now();
                        """,
                        (norad_id, tle1, tle2),
                    )
                    updated += 1

                # Be nice to N2YO / your proxy
                time.sleep(0.5)

        conn.commit()
        print(f"[INFO] Processed {total} satellites, TLE updated for {updated}.")
    except Exception as e:
        conn.rollback()
        print(f"[ERROR] Rolling back due to: {e}")
        raise
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()
