/**
 * info-bar.js - Bottom info bar with time and weather
 * 
 * Events Emitted:
 * - 'infobar:ready' (sticky) - Bar element exists in DOM
 * - 'infobar:rendered' - Weather/time blocks have been updated
 * 
 * Events Listened:
 * - 'core:ready' - Start initialization
 */

(function() {
  'use strict';

  if (!window.TIME_ZONES) {
    console.warn('[InfoBar] TIME_ZONES missing; not initialized.');
    return;
  }

  const Events = window.RussellTV?.Events;
  if (!Events) {
    console.error('[InfoBar] RussellTV.Events not found. Load russelltv-core.js first.');
    return;
  }

  // ============ STYLES ============

  const styles = `
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
      overflow: visible !important;
    }

    #info-bar-content {
      display: contents;
    }

    .info-block {
      padding: 2px 10px;
      border-radius: 999px;
      white-space: nowrap;
      border: 1px solid rgba(255,255,255,0.12);
      background: rgba(255,255,255,0.04);
      cursor: default;
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.35rem;
    }

    .info-block strong { font-weight: 600; }

    /* Temperature bands */
    .temp-neutral { background: rgba(255,255,255,0.05); }
    .temp-freezing { background: rgba(135,206,250,0.30); border-color: rgba(135,206,250,0.9); }
    .temp-cold { background: rgba(100,149,237,0.30); border-color: rgba(100,149,237,0.9); }
    .temp-mild { background: rgba(144,238,144,0.30); border-color: rgba(144,238,144,0.9); }
    .temp-warm { background: rgba(255,165,0,0.28); border-color: rgba(255,165,0,0.9); }
    .temp-hot { background: rgba(220,20,60,0.30); border-color: rgba(220,20,60,0.9); }

    /* Tooltips */
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
      background: rgba(0,0,0,0.85);
      border: 1px solid rgba(255,255,255,0.45);
      color: #000;
      opacity: 0;
      pointer-events: none;
      z-index: 10000;
      box-shadow: 0 0 10px rgba(0,0,0,0.9);
      transition: opacity 0.12s ease-out;
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

    /* Tooltip colors by temp */
    .temp-freezing.has-tooltip::after { background: rgba(135,206,250,1.0); border-color: rgba(135,206,250,1.0); }
    .temp-freezing.has-tooltip::before { border-color: rgba(135,206,250,1.0) transparent transparent transparent; }
    .temp-cold.has-tooltip::after { background: rgba(100,149,237,1.0); border-color: rgba(100,149,237,1.0); }
    .temp-cold.has-tooltip::before { border-color: rgba(100,149,237,1.0) transparent transparent transparent; }
    .temp-mild.has-tooltip::after { background: rgba(144,238,144,1.0); border-color: rgba(144,238,144,1.0); }
    .temp-mild.has-tooltip::before { border-color: rgba(144,238,144,1.0) transparent transparent transparent; }
    .temp-warm.has-tooltip::after { background: rgba(255,165,0,1.0); border-color: rgba(255,165,0,1.0); }
    .temp-warm.has-tooltip::before { border-color: rgba(255,165,0,1.0) transparent transparent transparent; }
    .temp-hot.has-tooltip::after { background: rgba(220,20,60,1.0); border-color: rgba(220,20,60,1.0); }
    .temp-hot.has-tooltip::before { border-color: rgba(220,20,60,1.0) transparent transparent transparent; }

    .info-block.has-tooltip:hover::after,
    .info-block.has-tooltip:hover::before { opacity: 1; }

    /* Weather tooltips disabled state */
    body.weather-tooltips-disabled .info-block.has-tooltip::after,
    body.weather-tooltips-disabled .info-block.has-tooltip::before {
      display: none !important;
    }

    /* Weather icons */
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

    .wx-sunny  { animation: wx-sun-pulse 3s ease-in-out infinite; }
    .wx-cloudy { animation: wx-cloud-drift 5s ease-in-out infinite; }
    .wx-rain   { animation: wx-rain-bob 1.6s ease-in-out infinite; }
    .wx-storm  { animation: wx-storm-flash 2.3s ease-in-out infinite; }
    .wx-snow   { animation: wx-snow-float 3.2s ease-in-out infinite; }
    .wx-wind   { animation: wx-wind-sway 3s ease-in-out infinite; }
    .wx-fog    { animation: wx-fog-breathe 4.5s ease-in-out infinite; }

    @keyframes wx-sun-pulse {
      0%, 100% { transform: scale(1); filter: brightness(1); }
      50% { transform: scale(1.12); filter: brightness(1.3); }
    }
    @keyframes wx-cloud-drift {
      0%, 100% { transform: translateX(0); }
      50% { transform: translateX(4px); }
    }
    @keyframes wx-rain-bob {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(3px); }
    }
    @keyframes wx-storm-flash {
      0%, 40%, 60%, 100% { filter: brightness(1); }
      50% { filter: brightness(1.7); }
    }
    @keyframes wx-snow-float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-3px); }
    }
    @keyframes wx-wind-sway {
      0%, 100% { transform: translateX(0); }
      50% { transform: translateX(-4px); }
    }
    @keyframes wx-fog-breathe {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }
  `;

  // ============ STATE ============

  let weatherMap = {};
  let bar = null;
  let contentContainer = null;

  // ============ HELPERS ============

  function tempClass(temp) {
    if (temp == null || isNaN(temp)) return 'temp-neutral';
    if (temp <= 32) return 'temp-freezing';
    if (temp <= 50) return 'temp-cold';
    if (temp <= 70) return 'temp-mild';
    if (temp <= 85) return 'temp-warm';
    return 'temp-hot';
  }

  function iconKeyFor(main, desc) {
    const w = `${main} ${desc}`.toLowerCase();
    if (w.includes('thunder') || w.includes('storm')) return 'storm';
    if (w.includes('rain') || w.includes('drizzle')) return 'rain';
    if (w.includes('snow') || w.includes('sleet')) return 'snow';
    if (w.includes('wind')) return 'wind';
    if (w.includes('cloud')) return 'cloudy';
    if (w.includes('fog') || w.includes('mist') || w.includes('haze') || w.includes('smoke')) return 'fog';
    return 'sunny';
  }

  // ============ RENDERING ============

  function renderTimeWeatherBlocks() {
    if (!contentContainer) return;

    // Clear only the content container, not the whole bar
    contentContainer.innerHTML = '';

    window.TIME_ZONES.forEach(loc => {
      const time = new Date().toLocaleString('en-US', {
        timeZone: loc.tz,
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
      });

      const isZulu = /zulu/i.test(loc.label);
      const w = weatherMap[loc.label];

      let cls = 'info-block temp-neutral';
      let content = `<strong>${loc.label}</strong> ${time}`;
      let tooltip = null;

      if (!isZulu && w) {
        cls = 'info-block ' + tempClass(w.temp) + ' has-tooltip';

        const key = iconKeyFor(w.main, w.desc);
        const iconHtml = `
          <span class="wx-icon-wrap">
            <img class="wx-icon wx-${key}" src="/icons/weather/${key}.svg" alt="${w.main}">
          </span>
        `.trim();

        content += ` ${iconHtml} ${w.hi}°/${w.lo}°`;

        tooltip = `${loc.label}\nTime: ${time}\nConditions: ${w.main} (${w.desc})\nCurrent: ${w.temp}°F\nHigh/Low: ${w.hi}°F / ${w.lo}°F` +
          (w.humidity != null ? `\nHumidity: ${w.humidity}%` : '') +
          (w.wind != null ? `\nWind: ${w.wind} mph` : '');
      }

      const div = document.createElement('div');
      div.className = cls;
      div.innerHTML = content;

      if (tooltip) {
        div.setAttribute('data-tooltip', tooltip);
      }

      const wuUrl = window.WU_LINKS?.[loc.label];
      if (wuUrl && !isZulu) {
        div.style.cursor = 'pointer';
        div.addEventListener('click', () => window.open(wuUrl, '_blank', 'noopener'));
      }

      contentContainer.appendChild(div);
    });

    Events.emit('infobar:rendered');
  }

  async function fetchWeather() {
    if (!window.WEATHER_QUERIES || typeof window.fetchWeather !== 'function') {
      weatherMap = {};
      return;
    }

    const newMap = {};
    for (const [label, query] of Object.entries(window.WEATHER_QUERIES)) {
      if (/zulu/i.test(label)) {
        newMap[label] = null;
        continue;
      }

      try {
        const d = await window.fetchWeather(query);
        if (!d || (d.cod && d.cod !== 200)) {
          newMap[label] = null;
          continue;
        }

        newMap[label] = {
          main: d.weather?.[0]?.main || '',
          desc: d.weather?.[0]?.description || '',
          temp: Math.round(d.main.temp),
          hi: Math.round(d.main.temp_max),
          lo: Math.round(d.main.temp_min),
          humidity: Math.round(d.main.humidity),
          wind: d.wind?.speed ? Math.round(d.wind.speed) : null
        };
      } catch {
        newMap[label] = null;
      }
    }

    weatherMap = newMap;
  }

  // ============ INITIALIZATION ============

  function init() {
    // Add styles
    const styleEl = document.createElement('style');
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);

    // Create bar structure
    bar = document.createElement('div');
    bar.id = 'info-bar';

    // Content container for time/weather blocks (will be re-rendered)
    contentContainer = document.createElement('div');
    contentContainer.id = 'info-bar-content';
    bar.appendChild(contentContainer);

    document.body.appendChild(bar);

    // Signal that bar is ready
    Events.emit('infobar:ready', { bar }, { sticky: true });

    // Initial render
    renderTimeWeatherBlocks();

    // Fetch weather and re-render
    fetchWeather().then(() => {
      renderTimeWeatherBlocks();
    });

    // Update time every 10 seconds
    setInterval(renderTimeWeatherBlocks, 10000);

    // Update weather every 10 minutes
    setInterval(async () => {
      await fetchWeather();
      renderTimeWeatherBlocks();
    }, 600000);

    console.log('✅ [InfoBar] Initialized');
  }

  // Wait for core to be ready
  Events.whenReady('core:ready', init);

})();
