/**
 * info-bar.js - Unified bottom info bar
 * 
 * Combines: Time, Weather, Space Weather Indicators, Settings
 * 
 * Events Emitted:
 * - 'infobar:ready' (sticky) - Bar is ready
 * - 'infobar:rendered' - Content updated
 * 
 * Events Listened:
 * - 'core:ready' - Start initialization
 * - 'feature:toggle' - Show/hide features
 * - 'spaceweather:data-updated' - Refresh indicator colors
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
      gap: 0.4rem 0.5rem;
      z-index: 9999;
      box-sizing: border-box;
      justify-content: center;
      align-items: center;
      backdrop-filter: blur(4px);
      border-top: 1px solid rgba(255,255,255,0.1);
      overflow: visible !important;
      row-gap: 0.4rem;
    }

    /* Time/Weather blocks */
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
      flex-shrink: 0;
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

    /* ============ SPACE WEATHER SECTION ============ */
    
    #space-weather-section {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding-left: 0.6rem;
      margin-left: 0.2rem;
      border-left: 1px solid rgba(255, 255, 255, 0.2);
      flex-shrink: 0;
      flex-wrap: nowrap;
    }

    .sw-indicator {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      cursor: pointer;
      padding: 0.25rem 0.5rem;
      border-radius: 999px;
      transition: all 0.2s ease;
      background: rgba(0, 0, 0, 0.5);
      border: 1px solid rgba(255, 120, 0, 0.3);
      flex-shrink: 0;
      white-space: nowrap;
      min-width: fit-content;
    }

    .sw-indicator:hover {
      background: rgba(255, 120, 0, 0.15);
      border-color: rgba(255, 120, 0, 0.5);
    }

    .sw-indicator-label {
      font-size: 0.72rem;
      font-weight: bold;
      letter-spacing: 0.5px;
      color: rgba(200, 200, 200, 0.95);
    }

    .sw-status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #888;
      flex-shrink: 0;
    }

    /* Space weather tooltip */
    #sw-tooltip {
      position: fixed;
      background: linear-gradient(135deg, rgba(0, 0, 0, 0.98), rgba(20, 10, 0, 0.98));
      color: white;
      padding: 1rem 1.25rem;
      border-radius: 16px;
      font-size: 0.85rem;
      z-index: 10001;
      pointer-events: auto;
      border: 2px solid rgba(255, 120, 0, 0.6);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.8), 0 0 20px rgba(255, 120, 0, 0.3);
      min-width: 300px;
      max-width: 380px;
      backdrop-filter: blur(10px);
      display: none;
    }

    #sw-tooltip.visible {
      display: block;
    }
  `;

  // ============ STATE ============

  let weatherMap = {};
  let bar = null;
  let swTooltip = null;
  let currentTooltipBand = null;
  let tooltipLocked = false;
  let hideTooltipTimer = null;

  // Feature states (synced with feature-toggles.js)
  let featureStates = {
    'space-weather-indicators': true,
    'propagation-panel': true,
    'weather-tooltips': true
  };

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

  function formatTime(date) {
    if (!date) return 'Unknown';
    const now = new Date();
    const diff = Math.floor((now - date) / 60000);
    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff}m ago`;
    return `${Math.floor(diff / 60)}h ago`;
  }

  // ============ RENDERING ============

  function render() {
    if (!bar) return;

    bar.innerHTML = '';

    // Time/Weather blocks
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

      bar.appendChild(div);
    });

    // Space Weather Section
    renderSpaceWeatherSection();

    Events.emit('infobar:rendered');
  }

  function renderSpaceWeatherSection() {
    const section = document.createElement('div');
    section.id = 'space-weather-section';

    const config = window.SPACE_WEATHER_CONFIG;
    const showIndicators = featureStates['space-weather-indicators'];
    const showPropPanel = featureStates['propagation-panel'];

    // HF, GPS, SAT indicators
    if (config && showIndicators) {
      ['hf', 'gps', 'satcom'].forEach(bandKey => {
        const indicator = createIndicator(bandKey);
        section.appendChild(indicator);
      });
    }

    // Propagation panel button
    if (showPropPanel) {
      const propBtn = createPropButton();
      section.appendChild(propBtn);
    }

    // Settings button (always visible)
    const settingsBtn = createSettingsButton();
    section.appendChild(settingsBtn);

    bar.appendChild(section);

    // Update colors after rendering
    updateIndicatorColors();
    
    // Signal that space weather indicators are ready
    Events.emit('spaceweather:ready', null, { sticky: true });
  }

  function createIndicator(bandKey) {
    const config = window.SPACE_WEATHER_CONFIG;
    const band = config?.bands?.[bandKey];

    const span = document.createElement('span');
    span.id = `sw-indicator-${bandKey}`;
    span.className = 'sw-indicator';
    span.dataset.band = bandKey;

    const label = document.createElement('span');
    label.className = 'sw-indicator-label';
    label.textContent = bandKey === 'hf' ? 'HF' : bandKey === 'gps' ? 'GPS' : 'SAT';

    const dot = document.createElement('span');
    dot.className = 'sw-status-dot';

    span.appendChild(label);
    span.appendChild(dot);

    // Tooltip events
    span.addEventListener('mouseenter', () => {
      if (!tooltipLocked) {
        showSwTooltip(span, bandKey, false);
      }
    });

    span.addEventListener('mouseleave', () => {
      if (!tooltipLocked) {
        scheduleHideTooltip();
      }
    });

    span.addEventListener('click', (e) => {
      e.stopPropagation();
      if (tooltipLocked && currentTooltipBand === bandKey) {
        tooltipLocked = false;
        hideSwTooltip();
      } else {
        tooltipLocked = true;
        showSwTooltip(span, bandKey, true);
      }
    });

    return span;
  }

  function createPropButton() {
    const span = document.createElement('span');
    span.id = 'propagation-panel-btn';
    span.className = 'sw-indicator';
    span.title = 'Propagation Forecast';

    const label = document.createElement('span');
    label.className = 'sw-indicator-label';
    label.textContent = '⚡';

    span.appendChild(label);

    span.addEventListener('click', (e) => {
      e.stopPropagation();
      hideSwTooltip();
      tooltipLocked = false;

      const panel = document.getElementById('propagation-panel');
      if (panel) {
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
      }
    });

    return span;
  }

  function createSettingsButton() {
    const span = document.createElement('span');
    span.id = 'feature-settings-btn';
    span.className = 'sw-indicator';
    span.title = 'Display Settings';

    const label = document.createElement('span');
    label.className = 'sw-indicator-label';
    label.textContent = '⚙️';

    span.appendChild(label);

    span.addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.RussellTV?.Features?.toggleSettings) {
        window.RussellTV.Features.toggleSettings();
      }
    });

    return span;
  }

  // ============ SPACE WEATHER TOOLTIP ============

  function createSwTooltipElement() {
    if (swTooltip) return;

    swTooltip = document.createElement('div');
    swTooltip.id = 'sw-tooltip';
    document.body.appendChild(swTooltip);

    swTooltip.addEventListener('mouseenter', () => {
      cancelHideTooltip();
    });

    swTooltip.addEventListener('mouseleave', () => {
      if (!tooltipLocked) {
        scheduleHideTooltip();
      }
    });
  }

  function showSwTooltip(indicator, bandKey, locked) {
    cancelHideTooltip();
    currentTooltipBand = bandKey;

    const data = window.RussellTV?.SpaceWeather?.getCurrentData();
    const detailed = window.RussellTV?.SpaceWeather?.getDetailedStatus?.(bandKey);

    if (!data || !detailed) {
      return;
    }

    createSwTooltipElement();

    const rect = indicator.getBoundingClientRect();
    swTooltip.style.left = `${rect.left + rect.width / 2}px`;
    swTooltip.style.bottom = `${window.innerHeight - rect.top + 12}px`;
    swTooltip.style.transform = 'translateX(-50%)';

    swTooltip.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.5rem; padding-bottom: 0.75rem; border-bottom: 1px solid rgba(255, 120, 0, 0.3);">
        <span style="font-size: 1.3rem;">${detailed.icon}</span>
        <span style="font-size: 1rem;">${detailed.band}</span>
        <span style="margin-left: auto; font-size: 1.1rem;">${detailed.statusIcon}</span>
      </div>
      <div style="margin-bottom: 0.75rem;">
        <strong>Status:</strong> <span style="color: ${detailed.color}; font-weight: bold;">${detailed.status}</span>
      </div>
      <div style="margin-bottom: 0.75rem; font-size: 0.85rem; opacity: 0.95; line-height: 1.4;">
        ${detailed.description}
      </div>
      <div style="margin-bottom: 0.5rem; font-size: 0.85rem;">
        <strong style="color: rgba(255, 150, 0, 0.9);">Frequencies:</strong> ${detailed.frequencies}
      </div>
      <div style="font-size: 0.85rem; opacity: 0.9; margin-bottom: 0.75rem; line-height: 1.4;">
        <strong style="color: rgba(255, 150, 0, 0.9);">Uses:</strong> ${detailed.uses}
      </div>
      <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid rgba(255, 120, 0, 0.3); font-size: 0.75rem; opacity: 0.8;">
        <strong>Current Conditions:</strong><br>
        Radio: R${data.scales.R} | Solar: S${data.scales.S} | Geo: G${data.scales.G}<br>
        Kp Index: ${data.kpIndex.toFixed(1)}<br>
        Updated: ${formatTime(data.timestamp)}
      </div>
      <div style="text-align: center; margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid rgba(255, 120, 0, 0.3); font-size: 0.7rem; opacity: 0.6;">
        ${locked ? '🔒 Click indicator to unlock' : '💡 Click to lock'}
      </div>
    `;

    swTooltip.classList.add('visible');
  }

  function hideSwTooltip() {
    cancelHideTooltip();
    if (swTooltip) {
      swTooltip.classList.remove('visible');
    }
    currentTooltipBand = null;
  }

  function scheduleHideTooltip() {
    cancelHideTooltip();
    hideTooltipTimer = setTimeout(() => {
      if (!tooltipLocked) {
        hideSwTooltip();
      }
    }, 300);
  }

  function cancelHideTooltip() {
    if (hideTooltipTimer) {
      clearTimeout(hideTooltipTimer);
      hideTooltipTimer = null;
    }
  }

  // ============ INDICATOR COLORS ============

  function updateIndicatorColors() {
    const data = window.RussellTV?.SpaceWeather?.getCurrentData();
    const config = window.SPACE_WEATHER_CONFIG;

    if (!data || !config) return;

    ['hf', 'gps', 'satcom'].forEach(bandKey => {
      const indicator = document.getElementById(`sw-indicator-${bandKey}`);
      if (!indicator) return;

      const dot = indicator.querySelector('.sw-status-dot');
      const status = data.status[bandKey];
      const statusInfo = config.statusLevels?.[status];

      if (dot && statusInfo) {
        dot.style.background = statusInfo.color;
        dot.style.boxShadow = (status === 'red' || status === 'orange')
          ? `0 0 8px ${statusInfo.color}`
          : 'none';
      }
    });
  }

  // ============ WEATHER FETCHING ============

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

  // ============ FEATURE TOGGLE HANDLING ============

  function handleFeatureToggle({ feature, enabled }) {
    console.log(`[InfoBar] Received toggle: ${feature} = ${enabled}`);
    featureStates[feature] = enabled;

    // Re-render to apply changes instantly
    render();

    // Special case for weather tooltips (CSS class on body)
    if (feature === 'weather-tooltips') {
      document.body.classList.toggle('weather-tooltips-disabled', !enabled);
    }
    
    console.log(`[InfoBar] Re-rendered after toggle`);
  }

  // ============ INITIALIZATION ============

  function init() {
    // Add styles
    const styleEl = document.createElement('style');
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);

    // Create bar
    bar = document.createElement('div');
    bar.id = 'info-bar';
    document.body.appendChild(bar);

    // Load initial feature states from storage
    const stored = window.RussellTV?.Storage?.load?.('featureToggles');
    if (stored) {
      Object.assign(featureStates, stored);
    }

    // Apply weather tooltips state
    if (!featureStates['weather-tooltips']) {
      document.body.classList.add('weather-tooltips-disabled');
    }

    // Listen for feature toggles
    Events.on('feature:toggle', handleFeatureToggle);

    // Listen for space weather data updates
    Events.on('spaceweather:data-updated', updateIndicatorColors);

    // Close tooltip on outside click
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.sw-indicator') && !e.target.closest('#sw-tooltip')) {
        tooltipLocked = false;
        hideSwTooltip();
      }
    });

    // Signal ready
    Events.emit('infobar:ready', { bar }, { sticky: true });

    // Initial render
    render();

    // Fetch weather and re-render
    fetchWeather().then(() => render());

    // Update time every 10 seconds
    setInterval(render, 10000);

    // Update weather every 10 minutes
    setInterval(async () => {
      await fetchWeather();
      render();
    }, 600000);

    // Update indicator colors periodically
    setInterval(updateIndicatorColors, 60000);

    console.log('✅ [InfoBar] Unified bar initialized');
  }

  // Wait for core
  Events.whenReady('core:ready', init);

})();
