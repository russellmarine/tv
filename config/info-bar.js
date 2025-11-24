// RussellTV Combined Time + Weather Footer (with SVG icons, tooltips & temp color)
// Uses: window.TIME_ZONES, window.WEATHER_QUERIES, window.fetchWeather, optional window.WU_LINKS

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
      align-items: center;
      backdrop-filter: blur(4px);
      border-top: 1px solid rgba(255,255,255,0.1);
      overflow: visible !important; /* allow tooltip beyond the bar */
    }

    .info-block {
      padding: 2px 10px;
      border-radius: 999px;
      white-space: nowrap;
      border: 1px solid rgba(255,255,255,0.12);
      background: rgba(255,255,255,0.04);
      cursor: default;
      position: relative;
      display: inline-flex;           /* center contents */
      align-items: center;
      justify-content: center;
      gap: 0.35rem;                   /* space between icon and text */
    }

    .info-block strong {
      font-weight: 600;
    }

    /* Temperature color bands */
    .temp-neutral { background: rgba(255,255,255,0.05); }

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

    /* ======== TOOLTIP SYSTEM ======== */

    .info-block.has-tooltip::after {
      content: attr(data-tooltip);
      position: absolute;
      left: 50%;
      bottom: 135%;
      transform: translateX(-50%);
      padding: 6px 10px;
      font-size: 0.70rem;
      white-space: pre-line;
      max-width: 260px;
      border-radius: 4px;
      background: rgba(0,0,0,0.85); /* fallback for neutral/no-weather */
      border: 1px solid rgba(255,255,255,0.45);
      color: #000;                  /* readable dark text on bright backgrounds */
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

    /* ======== TEMP-COLORED TOOLTIP BACKGROUNDS (SOLID) ======== */
    .temp-freezing.has-tooltip::after {
      background: rgba(135,206,250,1.0);
      border-color: rgba(135,206,250,1.0);
    }
    .temp-freezing.has-tooltip::before {
      border-color: rgba(135,206,250,1.0) transparent transparent transparent;
    }

    .temp-cold.has-tooltip::after {
      background: rgba(100,149,237,1.0);
      border-color: rgba(100,149,237,1.0);
    }
    .temp-cold.has-tooltip::before {
      border-color: rgba(100,149,237,1.0) transparent transparent transparent;
    }

    .temp-mild.has-tooltip::after {
      background: rgba(144,238,144,1.0);
      border-color: rgba(144,238,144,1.0);
    }
    .temp-mild.has-tooltip::before {
      border-color: rgba(144,238,144,1.0) transparent transparent transparent;
    }

    .temp-warm.has-tooltip::after {
      background: rgba(255,165,0,1.0);
      border-color: rgba(255,165,0,1.0);
    }
    .temp-warm.has-tooltip::before {
      border-color: rgba(255,165,0,1.0) transparent transparent transparent;
    }

    .temp-hot.has-tooltip::after {
      background: rgba(220,20,60,1.0);
      border-color: rgba(220,20,60,1.0);
    }
    .temp-hot.has-tooltip::before {
      border-color: rgba(220,20,60,1.0) transparent transparent transparent;
    }

    /* Hover to show */
    .info-block.has-tooltip:hover::after,
    .info-block.has-tooltip:hover::before {
      opacity: 1;
    }

    /* ======== WEATHER ICONS (SVG + STRONGER ANIMATION) ======== */

    .wx-icon-wrap {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-right: 2px;
    }

    .wx-icon {
      width: 20px;
      height: 20px;
      display: inline-block;
      vertical-align: middle;
      transform-origin: center center;
    }

    .wx-sunny  { animation: wx-sun-pulse   3s ease-in-out infinite; }
    .wx-cloudy { animation: wx-cloud-drift 5s ease-in-out infinite; }
    .wx-rain   { animation: wx-rain-bob    1.6s ease-in-out infinite; }
    .wx-storm  { animation: wx-storm-flash 2.3s ease-in-out infinite; }
    .wx-snow   { animation: wx-snow-float  3.2s ease-in-out infinite; }
    .wx-wind   { animation: wx-wind-sway   3s ease-in-out infinite; }
    .wx-fog    { animation: wx-fog-breathe 4.5s ease-in-out infinite; }

    @keyframes wx-sun-pulse {
      0%, 100% { transform: scale(1);    filter: brightness(1) saturate(1); }
      50%      { transform: scale(1.12); filter: brightness(1.3) saturate(1.1); }
    }

    @keyframes wx-cloud-drift {
      0%, 100% { transform: translateX(0);   filter: brightness(1); }
      50%      { transform: translateX(4px); filter: brightness(1.1); }
    }

    @keyframes wx-rain-bob {
      0%, 100% { transform: translateY(0);   filter: brightness(1); }
      50%      { transform: translateY(3px); filter: brightness(1.15); }
    }

    @keyframes wx-storm-flash {
      0%, 100% { filter: brightness(1);   transform: translateY(0); }
      40%      { filter: brightness(1);   transform: translateY(0); }
      50%      { filter: brightness(1.7); transform: translateY(1px); }
      60%      { filter: brightness(1);   transform: translateY(0); }
    }

    @keyframes wx-snow-float {
      0%, 100% { transform: translateY(0);    filter: brightness(1); }
      50%      { transform: translateY(-3px); filter: brightness(1.1); }
    }

    @keyframes wx-wind-sway {
      0%, 100% { transform: translateX(0);    filter: brightness(1); }
      50%      { transform: translateX(-4px); filter: brightness(1.1); }
    }

    @keyframes wx-fog-breathe {
      0%, 100% { opacity: 1;   filter: brightness(1); }
      50%      { opacity: 0.6; filter: brightness(0.9); }
    }
  `;
  document.head.appendChild(style);

  // ---------- Create bar ----------
  const bar = document.createElement("div");
  bar.id = "info-bar";
  document.body.appendChild(bar);

  // Weather cache
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

  // ---------- Weather icon key ----------
  function iconKeyFor(main, desc) {
    const w = `${main} ${desc}`.toLowerCase();
    if (w.includes("thunder")) return "storm";
    if (w.includes("storm"))   return "storm";
    if (w.includes("rain") || w.includes("drizzle")) return "rain";
    if (w.includes("snow") || w.includes("sleet"))   return "snow";
    if (w.includes("wind"))    return "wind";
    if (w.includes("cloud"))   return "cloudy";
    if (w.includes("fog") || w.includes("mist") || w.includes("haze") || w.includes("smoke")) return "fog";
    return "sunny";
  }

  // ---------- Fetch weather ----------
  async function updateWeather() {
    if (!window.WEATHER_QUERIES || typeof window.fetchWeather !== "function") {
      weatherMap = {};
      render();
      return;
    }

    const newMap = {};
    for (const [label, query] of Object.entries(window.WEATHER_QUERIES)) {
      const isZulu = /zulu/i.test(label);
      if (isZulu) {
        newMap[label] = null;
        continue;
      }

      try {
        const d = await window.fetchWeather(query);
        if (!d || (d.cod && d.cod !== 200)) {
          newMap[label] = null;
          continue;
        }

        const main = d.weather?.[0]?.main || "";
        const desc = d.weather?.[0]?.description || "";
        const temp = Math.round(d.main.temp);
        const hi   = Math.round(d.main.temp_max);
        const lo   = Math.round(d.main.temp_min);
        const humidity = Math.round(d.main.humidity);
        const wind = d.wind?.speed ? Math.round(d.wind.speed) : null;

        newMap[label] = { main, desc, temp, hi, lo, humidity, wind };
      } catch {
        newMap[label] = null;
      }
    }

    weatherMap = newMap;
    render();
  }

  // ---------- Render ----------
  function render() {
    const bar = document.getElementById("info-bar");
    if (!bar) return;

    // Remove existing time/weather blocks ONLY
    Array.from(bar.querySelectorAll(".info-block")).forEach(el => el.remove());

    // Grab reference to space-weather container so we can stay in front of it
    const spaceWeather = document.getElementById("space-weather-indicators");

    window.TIME_ZONES.forEach(loc => {
      const time = new Date().toLocaleString("en-US", {
        timeZone: loc.tz,
        hour12: false,
        hour: "2-digit",
        minute: "2-digit"
      });

      const isZulu = /zulu/i.test(loc.label);
      const w = weatherMap[loc.label];

      let cls = "info-block temp-neutral";
      let content = `<strong>${loc.label}</strong> ${time}`;
      let tooltip = null;

      if (!isZulu && w) {
        cls = "info-block " + tempClass(w.temp) + " has-tooltip";

        const key = iconKeyFor(w.main, w.desc);
        const iconUrl = `/icons/weather/${key}.svg`;
        const iconClass = `wx-icon wx-${key}`;

        const iconHtml = `
          <span class="wx-icon-wrap">
            <img class="${iconClass}" src="${iconUrl}" alt="${w.main || "Weather"} icon">
          </span>
        `.trim();

        content += ` ${iconHtml} ${w.hi}°/${w.lo}°`;

        tooltip =
          `${loc.label}\n` +
          `Time: ${time}\n` +
          `Conditions: ${w.main} (${w.desc})\n` +
          `Current: ${w.temp}°F\n` +
          `High/Low: ${w.hi}°F / ${w.lo}°F` +
          (w.humidity != null ? `\nHumidity: ${w.humidity}%` : "") +
          (w.wind != null ? `\nWind: ${w.wind} mph` : "");
      }

      const div = document.createElement("div");
      div.className = cls;
      div.innerHTML = content;

      if (tooltip) {
        div.setAttribute("data-tooltip", tooltip);
      }

      const wuUrl = window.WU_LINKS && window.WU_LINKS[loc.label];
      if (wuUrl && !isZulu) {
        div.style.cursor = "pointer";
        div.addEventListener("click", () => {
          window.open(wuUrl, "_blank", "noopener");
        });
      }

      // Insert each pill *before* the space-weather cluster if it exists,
      // otherwise just append. This keeps space-weather as the last flex item.
      if (spaceWeather && bar.contains(spaceWeather)) {
        bar.insertBefore(div, spaceWeather);
      } else {
        bar.appendChild(div);
      }
    });
  }

  // ---------- Start ----------
  render();
  updateWeather();
  setInterval(render, 10 * 1000);
  setInterval(updateWeather, 10 * 60 * 1000);
})();
