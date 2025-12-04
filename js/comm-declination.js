(function () {
  'use strict';

  if (!window.RussellTV) {
    window.RussellTV = {};
  }

  const Declination = {};

  // --- Helpers ----------------------------------------------------------

  function toDecimalYear(date) {
    const d = date || new Date();
    const year = d.getUTCFullYear();
    const start = Date.UTC(year, 0, 1);
    const next = Date.UTC(year + 1, 0, 1);
    const frac = (d.getTime() - start) / (next - start);
    return year + frac;
  }

  // Simple, **approximate** local fallback.
  // This is intentionally conservative and documented as a placeholder
  // until you either port a real WMM library or build a base/location grid.
  function estimateDeclinationLocal(lat, lon, date) {
    // Clamp inputs for sanity
    const phi = Math.max(-89.9, Math.min(89.9, lat));
    const lam = ((lon + 540) % 360) - 180; // wrap to [-180, 180)

    const decYear = toDecimalYear(date || new Date());

    // Very rough heuristic:
    // - Use latitude and longitude bands
    // - Add a small linear drift per year from a reference epoch
    //
    // This will generally be within ~10° in many places, but is NOT a
    // replacement for proper WMM. You should treat this as "better than 0"
    // but still approximate for tactical planning.
    const epoch = 2025.0;
    const dt = decYear - epoch;

    let base = 0;

    // Latitudinal trend
    if (phi > 0) {
      // Northern hemisphere: rough east-west variation
      if (lam < -60) {
        base = 10;   // western N. America tends to be east-ish
      } else if (lam < 0) {
        base = -5;   // eastern N. America tends to be west-ish
      } else if (lam < 60) {
        base = -5;   // Europe-ish
      } else {
        base = 0;    // Asia-ish
      }
    } else {
      // Southern hemisphere: extremely approximate
      if (lam < 0) {
        base = 5;
      } else {
        base = -5;
      }
    }

    // Small drift over time (totally heuristic)
    const driftPerYear = 0.2; // deg / year
    const drift = driftPerYear * dt;

    const value = base + drift;

    return value;
  }

  // --- Remote (NOAA WMM via nginx proxy) -------------------------------

  async function fetchDeclinationRemote(lat, lon, date) {
    const d = date || new Date();
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth() + 1;
    const day = d.getUTCDate();

    const params = new URLSearchParams({
      lat1: String(lat),
      lon1: String(lon),
      model: 'WMM',
      startYear: String(year),
      startMonth: String(month),
      startDay: String(day),
      resultFormat: 'json'
      // key is injected server-side in nginx proxy; never in the browser
    });

    const url = '/geomag-declination?' + params.toString();

    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      throw new Error('NOAA declination API error: ' + res.status);
    }

    const data = await res.json();

    // The NOAA geomag JSON format is usually:
    // {
    //   "result": [
    //     { "declination": -13.123, ... }
    //   ]
    // }
    const result = data && data.result && data.result[0];
    if (!result) {
      throw new Error('NOAA response missing result array');
    }

    const raw =
      result.declination ??
      result.decl ??
      result.dec ??
      null;

    if (raw === null || !isFinite(Number(raw))) {
      throw new Error('NOAA response missing declination field');
    }

    return Number(raw);
  }

  // --- Public API ------------------------------------------------------

  /**
   * Get magnetic declination at lat/lon.
   *
   * @param {number} lat  Latitude, degrees (north positive)
   * @param {number} lon  Longitude, degrees (east positive)
   * @param {object} [options]
   * @param {Date} [options.date]  Date for the model (defaults to now, UTC)
   * @returns {Promise<number>}  Declination in degrees, east positive.
   */
  async function get(lat, lon, options) {
    const date = options && options.date ? options.date : new Date();

    try {
      // Primary path: NOAA WMM via /geomag-declination nginx proxy
      return await fetchDeclinationRemote(lat, lon, date);
    } catch (err) {
      console.warn(
        '[RussellTV.Declination] NOAA WMM lookup failed, using local estimate.',
        err
      );
      return estimateDeclinationLocal(lat, lon, date);
    }
  }

  Declination.get = get;
  Declination.estimateLocal = estimateDeclinationLocal;

  window.RussellTV.Declination = Declination;
})();
