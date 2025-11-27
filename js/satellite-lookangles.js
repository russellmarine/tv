/**
 * sat-look-angles.js - GEO look angles + quick link budget + HF vs SATCOM tip
 *
 * Exposed API:
 *   window.RussellTV.SatLookAngles.render(containerEl)
 *
 * Depends on:
 *   - window.RussellTV.Propagation.getSelectedLocation()
 *   - window.RussellTV.SpaceWeather.getCurrentData()
 *   - window.RussellTV.InfoBar.getWeather(label)
 *   - window.RussellTV.Events (optional, for logging/extension)
 */

(function() {
  'use strict';

  window.RussellTV = window.RussellTV || {};
  const Events = window.RussellTV.Events;

  // Simple satellite presets (generic stand-ins for planning)
  const GEO_SATS = [
    {
      id: 'geo_conus',
      name: 'GEO SAT (CONUS)',
      lon: -70,         // Approx western Atlantic arc
      bandHint: 'X / Ka',
      role: 'Typical WGS-style CONUS coverage'
    },
    {
      id: 'geo_eu',
      name: 'GEO SAT (EUCOM)',
      lon: 10,          // Approx central European arc
      bandHint: 'X / Ku / Ka',
      role: 'Europe / AFRCOM coverage'
    },
    {
      id: 'geo_pac',
      name: 'GEO SAT (PACOM)',
      lon: 135,         // Western Pacific arc
      bandHint: 'X / Ka',
      role: 'Indo-PACOM coverage'
    }
  ];

  const EARTH_RADIUS_KM = 6378.0;
  const GEO_RADIUS_KM   = 42164.0; // Earth center to GEO satellite

  function deg2rad(d) { return d * Math.PI / 180; }
  function rad2deg(r) { return r * 180 / Math.PI; }

  /**
   * Compute GEO look angles for a location to a satellite at given longitude.
   * Returns elevation and azimuth in degrees.
   * This is a standard approximate geometry for GEO birds.
   */
  function computeGeoLookAngles(latDeg, lonDeg, satLonDeg) {
    const lat = deg2rad(latDeg);
    const lon = deg2rad(lonDeg);
    const satLon = deg2rad(satLonDeg);

    const relLon = satLon - lon;
    const cosPsi = Math.cos(lat) * Math.cos(relLon);

    // Elevation
    const numerator = cosPsi - (EARTH_RADIUS_KM / GEO_RADIUS_KM);
    const denom = Math.sqrt(1 - cosPsi * cosPsi);
    const elevRad = Math.atan2(numerator, denom);
    const elev = rad2deg(elevRad);

    // Azimuth (from north, clockwise)
    const azRad = Math.atan2(
      Math.sin(relLon),
      Math.cos(relLon) * Math.sin(lat) - Math.tan(0) * Math.cos(lat) // sub-sat lat = 0
    );
    const az = (rad2deg(azRad) + 360) % 360;

    return {
      elevation: elev,
      azimuth: az
    };
  }

  function classifyElev(elev) {
    if (elev < 5) return 'Obstructed / very low';
    if (elev < 10) return 'Low – watch terrain & masking';
    if (elev < 20) return 'Mid – some extra loss';
    if (elev < 60) return 'Good working geometry';
    return 'High look – ideal';
  }

  /**
   * Quick GEO link budget helper.
   * Uses FSPL only + a crude “extra fade” for weather.
   * You can treat this as "ballpark dB you must overcome with EIRP + G/T + link margin".
   */
  function computeLinkBudgetSummary(freqGHz, weather, kp, gScale) {
    const dKm = 39000; // nominal GEO slant range
    // FSPL (dB) for d[km], f[GHz]
    const fspl = 92.45 + 20 * Math.log10(dKm) + 20 * Math.log10(freqGHz);

    let rainExtra = 0;
    let weatherNote = 'No significant rain fade expected.';

    const main = (weather?.main || '').toLowerCase();
    const desc = (weather?.desc || '').toLowerCase();

    const wet = main.includes('rain') || main.includes('storm') || desc.includes('rain') || desc.includes('storm');
    const drizzle = main.includes('drizzle');
    const snow = main.includes('snow');
    const foggy = main.includes('fog') || main.includes('mist');

    // Rough “effective” fade by band
    if (wet) {
      if (freqGHz >= 30) {
        rainExtra = 15;
        weatherNote = 'Heavy rain – severe EHF fade (10–20+ dB).';
      } else if (freqGHz >= 26) {
        rainExtra = 8;
        weatherNote = 'Significant Ka-band rain fade (5–15 dB).';
      } else if (freqGHz >= 12) {
        rainExtra = 4;
        weatherNote = 'Moderate Ku-band rain fade (2–5 dB).';
      } else {
        rainExtra = 1.5;
        weatherNote = 'Minor additional attenuation.';
      }
    } else if (drizzle || snow || foggy) {
      if (freqGHz >= 30) {
        rainExtra = 6;
        weatherNote = 'Drizzle/snow/fog – noticeable EHF fade.';
      } else if (freqGHz >= 26) {
        rainExtra = 3;
        weatherNote = 'Some Ka-band fade.';
      } else {
        rainExtra = 1;
        weatherNote = 'Small additional loss.';
      }
    }

    // Geomagnetic “jitter” – doesn’t change FSPL but shows up in recommended margin for Ku/GPS
    let stormMargin = 0;
    if (gScale >= 3 || kp >= 6) {
      stormMargin = 3;
    } else if (gScale >= 2 || kp >= 4) {
      stormMargin = 1.5;
    }

    const suggestedMargin = 3 + rainExtra + stormMargin; // baseline 3 dB margin

    return {
      fspl: Math.round(fspl),
      rainExtra: Math.round(rainExtra * 10) / 10,
      stormMargin: Math.round(stormMargin * 10) / 10,
      suggestedMargin: Math.round(suggestedMargin * 10) / 10,
      weatherNote
    };
  }

  function buildHfVsSatcomTip(space, weather) {
    if (!space) {
      return `
        <p style="margin: 0 0 0.4rem 0;">
          Use this as a quick sanity check: HF likes ionosphere; SATCOM likes clear sky & geometry.
        </p>`;
    }

    const R = space.scales?.R || 0;
    const G = space.scales?.G || 0;
    const kp = space.kpIndex || 0;

    const main = (weather?.main || '').toLowerCase();
    const desc = (weather?.desc || '').toLowerCase();
    const wet = main.includes('rain') || main.includes('storm') || desc.includes('rain') || desc.includes('storm');

    const bullets = [];

    // HF side
    if (R >= 3) {
      bullets.push('X-ray (R3+) – expect HF blackouts on sunlit paths. Favor SATCOM for long-haul.');
    } else if (R >= 2) {
      bullets.push('R-scale elevated – HF will work, but lower bands may fade. Keep alternate paths in mind.');
    } else if (kp >= 5 || G >= 3) {
      bullets.push('High Kp / G-storm – polar HF paths degrade; equatorial/low-mid lat paths may still be usable.');
    } else {
      bullets.push('Quiet to minor space weather – HF is a solid primary for regional and theatre-wide paths.');
    }

    // SATCOM side
    if (wet) {
      bullets.push('Heavy rain/convective weather – protect Ka/EHF; prefer X/C/UHF SATCOM or HF where geometry is poor.');
    } else {
      bullets.push('No major precip – high-freq SATCOM (Ka/EHF) is efficient if you carry enough fade margin.');
    }

    if (G >= 3 || kp >= 6) {
      bullets.push('Severe geomag – GPS & timing may wander. Validate PNT; HF NVIS can still carry traffic locally.');
    }

    return `
      <p style="margin: 0 0 0.4rem 0;">
        <strong>HF vs SATCOM quick tip:</strong> Use HF when the ionosphere is cooperative or you need austere-node reach;
        lean on SATCOM when the sky is clear but space weather or terrain make HF sketchy.
      </p>
      <ul style="margin: 0; padding-left: 1.2rem; font-size: 0.8rem; line-height: 1.35;">
        ${bullets.map(b => `<li>${b}</li>`).join('')}
      </ul>
    `;
  }

  function render(containerEl) {
    if (!containerEl) return;

    const Prop = window.RussellTV.Propagation;
    const SW = window.RussellTV.SpaceWeather;
    const InfoBar = window.RussellTV.InfoBar;

    const loc = Prop?.getSelectedLocation?.();
    const space = SW?.getCurrentData?.();

    if (!loc) {
      containerEl.innerHTML = `
        <div style="margin-top: 0.5rem; padding: 0.75rem; font-size: 0.8rem; opacity: 0.7;">
          Select a location to compute GEO look angles and link budget cues.
        </div>
      `;
      return;
    }

    const weather = InfoBar?.getWeather?.(loc.label);

    // Look angles for each GEO preset
    const rows = GEO_SATS.map(sat => {
      const angles = computeGeoLookAngles(loc.lat, loc.lon, sat.lon);
      const elevNote = classifyElev(angles.elevation);

      return `
        <div style="display: flex; flex-direction: column; padding: 0.4rem 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.05);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.2rem;">
            <span style="font-size:0.8rem; font-weight:600;">${sat.name}</span>
            <span style="font-size:0.7rem; opacity:0.7;">${sat.bandHint}</span>
          </div>
          <div style="display:flex; gap:0.8rem; font-size:0.75rem;">
            <span>Az: <strong>${angles.azimuth.toFixed(0)}°</strong></span>
            <span>El: <strong>${angles.elevation.toFixed(1)}°</strong></span>
            <span style="opacity:0.75;">${elevNote}</span>
          </div>
          <div style="font-size:0.7rem; opacity:0.7; margin-top:0.2rem;">
            ${sat.role}
          </div>
        </div>
      `;
    }).join('');

    // Quick link budget block (Ka vs X example)
    const kp = space?.kpIndex || 0;
    const gScale = space?.scales?.G || 0;

    const kaBudget = computeLinkBudgetSummary(30, weather, kp, gScale); // Ka/EHF end
    const xBudget  = computeLinkBudgetSummary(8, weather, kp, gScale);  // X-band

    const hfVsSatTipHtml = buildHfVsSatcomTip(space, weather);

    containerEl.innerHTML = `
      <div style="margin-top: 0.75rem;">
        <div style="font-size:0.8rem; text-transform:uppercase; letter-spacing:0.06em; opacity:0.7; margin-bottom:0.25rem;">
          GEO Look Angles (Approx)
        </div>
        <div style="background:rgba(0,0,0,0.25); border-radius:8px; overflow:hidden;">
          ${rows}
        </div>

        <div style="margin-top:0.75rem; display:grid; grid-template-columns:1.1fr 1.1fr; gap:0.5rem;">
          <div style="background:rgba(0,0,0,0.25); border-radius:8px; padding:0.55rem 0.6rem; font-size:0.75rem;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.3rem;">
              <span style="font-weight:600;">Quick Link Budget</span>
              <span style="font-size:0.65rem; opacity:0.7;">GEO, 39 Mm</span>
            </div>
            <table style="width:100%; border-collapse:collapse; font-size:0.72rem;">
              <thead>
                <tr>
                  <th style="text-align:left; padding-bottom:0.2rem;">Band</th>
                  <th style="text-align:right; padding-bottom:0.2rem;">FSPL</th>
                  <th style="text-align:right; padding-bottom:0.2rem;">Wx Fade</th>
                  <th style="text-align:right; padding-bottom:0.2rem;">Margin</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="padding:0.15rem 0;">Ka/EHF</td>
                  <td style="padding:0.15rem 0; text-align:right;">${kaBudget.fspl} dB</td>
                  <td style="padding:0.15rem 0; text-align:right;">${kaBudget.rainExtra} dB</td>
                  <td style="padding:0.15rem 0; text-align:right;">${kaBudget.suggestedMargin} dB</td>
                </tr>
                <tr>
                  <td style="padding:0.15rem 0;">X-band</td>
                  <td style="padding:0.15rem 0; text-align:right;">${xBudget.fspl} dB</td>
                  <td style="padding:0.15rem 0; text-align:right;">${xBudget.rainExtra} dB</td>
                  <td style="padding:0.15rem 0; text-align:right;">${xBudget.suggestedMargin} dB</td>
                </tr>
              </tbody>
            </table>
            <div style="margin-top:0.3rem; font-size:0.7rem; opacity:0.75;">
              ${kaBudget.weatherNote}
            </div>
          </div>

          <div style="background:rgba(0,0,0,0.25); border-radius:8px; padding:0.55rem 0.6rem; font-size:0.75rem;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.3rem;">
              <span style="font-weight:600;">HF vs SATCOM</span>
              ${space ? `<span style="font-size:0.65rem; opacity:0.7;">Kp ${space.kpIndex.toFixed(1)} · R${space.scales.R} S${space.scales.S} G${space.scales.G}</span>` : ''}
            </div>
            ${hfVsSatTipHtml}
          </div>
        </div>
      </div>
    `;

    if (Events) {
      Events.emit('satla:rendered', { location: loc.label });
    }
  }

  window.RussellTV.SatLookAngles = {
    render
  };

})();
