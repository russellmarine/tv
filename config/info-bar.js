// RussellTV Combined Time + Weather Footer (with readable temp-colored tooltips)
// Uses: window.TIME_ZONES, optional window.WEATHER_QUERIES + window.fetchWeather

(function() {
  if (!window.TIME_ZONES) {
    console.warn("TIME_ZONES missing; footer not initialized.");
    return;
  }

  // ---------- Styles ----------
  const style = document.createElement("style");
  style.textContent = `
    #info-bar {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: rgba(0,0,0,0.90);
      color: #fff;
      padding: 6px 10px;
      font-size: 0.78rem;
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      z-index: 9999;
      box-sizing: border-box;
      justify-content: center;
      backdrop-filter: blur(4px);
      border-top: 1px solid rgba(255,255,255,0.1);
    }
    .info-block {
      padding: 2px 8px;
      border-radius: 999px;
      white-space: nowrap;
      border: 1px solid rgba(255,255,255,0.12);
      background: rgba(255,255,255,0.04);
      cursor: default;
      position: relative; /* needed for tooltip positioning */
    }
    .info-block strong {
      font-weight: 600;
    }

    /* Temperature color bands (based on current temp, °F) */
    .temp-neutral {
      background: rgba(255,255,255,0.05);
    }
    .temp-freezing {
      background: rgba(135,206,250,0.30);
      border-color: rgba(135,206,250,0.9);
    }
    .temp-cold {
      background: rgba(100,149,237,0.30);
      border-color: rgba(100,149,237,0.9);
    }
    .temp-mild {
      background: rgba(144,238,144,0.30);
      border-color: rgba(144,238,144,0.9);
    }
    .temp-warm {
      background: rgba(255,165,0,0.28);
      border-color: rgba(255,165,0,0.9);
    }
    .temp-hot {
      background: rgba(220,20,60,0.30);
      border-color: rgba(220,20,60,0.9);
    }

    /* ---------- Readable custom tooltips (use title text) ---------- */
    .info-block.has-tooltip::after {
      content: attr(title);
      position: absolute;
      left: 50%;
      bottom: 135%;                 /* little above the pill row */
      transform: translateX(-50%);
      padding: 6px 10px;
      font-size: 0.70rem;
      white-space: pre-line;        /* respect \\n in title */
      max-width: 260px;
      border-radius: 4px;
      background: rgba(0,0,0,0.94); /* solid dark background for readability */
      border: 1px solid rgba(255,255,255,0.45);
      color: #fff;
      opacity: 0;
      pointer-events: none;
      z-index: 10000;
      box-shadow: 0 0 10px rgba(0,0,0,0.9);
      transition: opacity 0.12s ease-out, transform 0.12s ease-out;
    }

    .info-block.has-tooltip::before {
      content: "";
      position: absolute;
      left: 50%;
      bottom: 125%;
      transform: translateX(-50%);
      border-width: 6px;
      border-style: solid;
      border-color: rgba(255,255,255,0.45) transparent transparent transparent;
      opacity: 0;
      pointer-events: none;
      z-index: 9999;
      transition: opacity 0.12s ease-out;
    }

    /* Accent arrow + border by temp band */
    .temp-freezing.has-tooltip::after {
      border-color: rgba(135,206,250,0.9);
    }
    .temp-freezing.has-tooltip::before {
      border-color: rgba(135,206,250,0.9) transparent transparent transparent;
    }

    .temp-cold.has-tooltip::after {
      border-color: rgba(100,149,237,0.9);
    }
    .temp-cold.has-tooltip::before {
      border-color: rgba(100,149,237,0.9) transparent transparent transparent;
    }

    .temp-mild.has-tooltip::after {
      border-color: rgba(144,238,144,0.9);
    }
    .temp-mild.has-tooltip::before {
      border-color: rgba(144,238,144,0.9) transparent transparent transparent;
    }

    .temp-warm.has-tooltip::after {
      border-color: rgba(255,165,0,0.9);
    }
    .temp-warm.has-tooltip::before {
      border-color: rgba(255,165,0,0.9) transparent transparent transparent;
    }

    .temp-hot.has-tooltip::after {
      border-color: rgba(220,20,60,0.9);
    }
    .temp-hot.has-tooltip::before {
      border-color: rgba(220,20,60,0.9) transparent transparent transparent;
    }

    /* Show on hover */
    .info-block.has-tooltip:hover::after,
    .info-block.has-tooltip:hover::before {
      opacity: 1;
    }
  `;
  document.head.appendChild(style);

  // ---------- Create bar ----------
  const bar = document.createElement("div");
  bar.id = "info-bar";
  document.body.appendChild(bar);

  // Weather details cache keyed by TIME_ZONES label
  // { icon, temp, hi, lo, main, desc, humidity, wind }
  let weatherMap = {};

  // ---------- Temp -> class ----------
  function tempClass(temp) {
    if (temp == null || isNaN(temp)) return "temp-neutral";
    if (temp <= 32) return "temp-freezing";
    if (temp <= 50) return "temp-cold";
    if (temp <= 70) return "temp-mild";
    if (temp <= 85) return "temp-warm";
    return "temp-hot";
  }

  // ---------- Icon logic ----------
  function iconFor(main, desc) {
    const w = `${main} ${desc}`.toLowerCase();
    if (w.includes("thunder")) return "⛈";
    if (w.includes("storm"))   return "⛈";
    if (w.includes("rain") || w.includes("drizzle")) return "🌧";
    if (w.includes("snow") || w.includes("sleet"))   return "❄️";
    if (w.includes("wind"))    return "💨";
    if (w.includes("cloud"))   return "☁️";
    return "☀️";
  }

  // ---------- Fetch weather for all mapped locations ----------
  async function updateWeather() {
    // If we don't have queries or fetchWeather, just clear weather & render time-only
    if (!window.WEATHER_QUERIES || typeof window.fetchWeather !== "function") {
      weatherMap = {};
      render();
      return;
    }

    const entries = Object.entries(window.WEATHER_QUERIES);
    const newMap = {};

    for (const [label, query] of entries) {
      // Skip Zulu / pure time locations if they somehow end up configured
      const isZulu = /zulu/i.test(label);
      if (isZulu) {
        newMap[label] = null;
        continue;
      }

      try {
        const d = await window.fetchWeather(query);
        if (!d || (d.cod && d.cod !== 200)) {
          console.warn("Weather data error for", label, d && d.cod);
          newMap[label] = null;
          continue;
        }

        const main = d.weather?.[0]?.main || "";
        const desc = d.weather?.[0]?.description || "";
        const temp = Math.round(d.main.temp);
        const hi = Math.round(d.main.temp_max);
        const lo = Math.round(d.main.temp_min);
        const humidity = Math.round(d.main.humidity);
        const wind = d.wind && typeof d.wind.speed === "number"
          ? Math.round(d.wind.speed)
          : null;
        const icon = iconFor(main, desc);

        newMap[label] = {
          icon,
          temp,
          hi,
          lo,
          main,
          desc,
          humidity,
          wind
        };
      } catch (e) {
        console.warn("Weather fetch failed for", label, e);
        newMap[label] = null;
      }
    }

    weatherMap = newMap;
    render();
  }

  // ---------- Render combined time + (optional) weather ----------
  function render() {
    bar.innerHTML = "";

    window.TIME_ZONES.forEach(loc => {
      const time = new Date().toLocaleString("en-US", {
        timeZone: loc.tz,
        hour12: false,
        hour: "2-digit",
        minute: "2-digit"
      });

      let cls = "info-block temp-neutral has-tooltip";
      let content = `<strong>${loc.label}</strong> ${time}`;
      let tooltip = `${loc.label} — ${time}`;

      const isZulu = /zulu/i.test(loc.label);
      const w = weatherMap[loc.label];

      if (!isZulu && w) {
        cls = "info-block " + tempClass(w.temp) + " has-tooltip";
        content += ` • ${w.icon} ${w.hi}°/${w.lo}°`;
        let tip = `${loc.label}\n`;
        tip += `Time: ${time}\n`;
        tip += `Conditions: ${w.main} (${w.desc})\n`;
        tip += `Current: ${w.temp}°F\n`;
        tip += `High/Low: ${w.hi}°F / ${w.lo}°F`;
        if (w.humidity != null) tip += `\nHumidity: ${w.humidity}%`;
        if (w.wind != null) tip += `\nWind: ${w.wind} mph`;
        tooltip = tip;
      } else if (isZulu) {
        tooltip = `${loc.label}\nTime (UTC): ${time}`;
      }

      const div = document.createElement("div");
      div.className = cls;
      div.innerHTML = content;

      // Keep native title tooltip as a fallback AND use it for CSS content
      div.title = tooltip;

      bar.appendChild(div);
    });
  }

  // ---------- Loops ----------
  render();                                   // times only at first
  updateWeather();                            // attempt weather now (or no-op)
  setInterval(render, 10 * 1000);             // update times every 10s
  setInterval(updateWeather, 10 * 60 * 1000); // refresh weather every 10m
})();
