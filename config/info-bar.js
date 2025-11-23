// RussellTV Combined Time + Weather Footer (with colored tooltips)
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
      z-index: 2147483647;
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

    /* Global tooltip element */
    #info-tooltip {
      position: fixed;
      padding: 4px 8px;
      font-size: 0.70rem;
      white-space: pre-line;      /* honor newlines */
      max-width: 280px;
      border-radius: 4px;
      background: rgba(0,0,0,0.9);
      color: #fff;
      opacity: 0;
      pointer-events: none;
      z-index: 2147483647;
      box-shadow: 0 0 8px rgba(0,0,0,0.6);
      transform: translate(-50%, -8px);
      transition: opacity 0.08s ease-out;
    }
  `;
  document.head.appendChild(style);

  // ---------- Create bar ----------
  const bar = document.createElement("div");
  bar.id = "info-bar";
  document.body.appendChild(bar);

  // ---------- Global tooltip element ----------
  const tooltipEl = document.createElement("div");
  tooltipEl.id = "info-tooltip";
  document.body.appendChild(tooltipEl);

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

      let cls = "info-block temp-neutral";
      let content = `<strong>${loc.label}</strong> ${time}`;
      let tooltip = `${loc.label}\n${time}`;

      const isZulu = /zulu/i.test(loc.label);
      const w = weatherMap[loc.label];

      if (!isZulu && w) {
        cls = "info-block " + tempClass(w.temp);
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

      const tooltipText = tooltip;

      // Hover handlers for global tooltip
      div.addEventListener("mouseenter", () => {
        const rect = div.getBoundingClientRect();
        const pillStyle = window.getComputedStyle(div);

        const bg = pillStyle.backgroundColor || "rgba(0,0,0,0.9)";
        const borderColor = pillStyle.borderColor || "rgba(255,255,255,0.5)";

        tooltipEl.textContent = tooltipText;
        tooltipEl.style.left = (rect.left + rect.width / 2) + "px";
        tooltipEl.style.top = rect.top + "px";
        tooltipEl.style.backgroundColor = bg;
        tooltipEl.style.border = `1px solid ${borderColor}`;
        tooltipEl.style.opacity = "1";
      });

      div.addEventListener("mouseleave", () => {
        tooltipEl.style.opacity = "0";
      });

      bar.appendChild(div);
    });
  }

  // ---------- Loops ----------
  render();                                   // times only at first
  updateWeather();                            // attempt weather now (or no-op)
  setInterval(render, 10 * 1000);             // update times every 10s
  setInterval(updateWeather, 10 * 60 * 1000); // refresh weather every 10m
})();
