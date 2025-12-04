(function () {
  'use strict';

  const PANEL_ID = 'step-status-panel';
  const panelEl = document.getElementById(PANEL_ID);
  if (!panelEl) return;

  const Events = window.RussellTV?.Events;
  const STEP_WX_ENDPOINT = '/weather'; // backend proxy

  // Teleport / hub sites (clean display names)
  const STEP_SITES = [
    { id: 'TELEPORT-NW-VA', name: 'Northwest · VA', lat: 36.819, lon: -76.383 },
    { id: 'TELEPORT-CA',    name: 'Camp Roberts · CA', lat: 35.764, lon: -120.765 },
    { id: 'TELEPORT-HI',    name: 'Wahiawā · HI', lat: 21.501, lon: -158.035 },
    { id: 'TELEPORT-DE',    name: 'Landstuhl · DE', lat: 49.414, lon: 7.566 },
    { id: 'TELEPORT-IT',    name: 'Lago Patria · IT', lat: 40.894, lon: 14.043 },
    { id: 'TELEPORT-JP',    name: 'Fort Buckner · JP', lat: 26.296238, lon: 127.776264 }
  ];

  function directionArrow(deg) {
    if (typeof deg !== 'number') return '';
    const dirs = ['↑','↗','→','↘','↓','↙','←','↖'];
    return dirs[Math.round(deg / 45) % 8];
  }

  function classifyImpact(wx) {
    if (!wx) return { className: 'step-impact-unknown', label: 'Unknown', bands: [] };

    const id = wx.weather?.[0]?.id || 0;
    const desc = (wx.weather?.[0]?.description || '').toLowerCase();
    const wind = wx.wind?.speed || 0;
    const gust = wx.wind?.gust || wind;
    const rainRate = (wx.rain && (wx.rain['1h'] || wx.rain['3h'])) || 0;
    const snowRate = (wx.snow && (wx.snow['1h'] || wx.snow['3h'])) || 0;

    let level = 'green';
    const bands = new Set();

    // Dust / sand
    if (desc.includes('dust') || desc.includes('sand') || desc.includes('ash')) {
      level = 'yellow'; bands.add('X/Ku');
    }

    // Rain/snow/fog
    if (rainRate > 0 || snowRate > 0 || desc.includes('fog') || desc.includes('mist') || desc.includes('haze') || desc.includes('smoke')) {
      level = level === 'green' ? 'yellow' : level;
      bands.add('Ka');
    }

    if (rainRate > 10 || snowRate > 5 || id >= 200 && id < 300) {
      level = 'yellow'; bands.add('Ka/Ku');
    }

    if (wind >= 20) {
      level = 'yellow'; bands.add('Ka/Ku');
    }
    if (gust >= 35 || desc.includes('tropical') || desc.includes('hurricane')) {
      level = 'red'; bands.add('All');
    }

    if (level === 'green' && bands.size === 0) bands.add('All');

    return {
      className: { green: 'step-impact-green', yellow: 'step-impact-yellow', red: 'step-impact-red' }[level],
      label: { green: 'Nominal', yellow: 'Degraded', red: 'Severe' }[level],
      bands: [...bands]
    };
  }

  function formatWx(wx) {
    if (!wx) return { iconChar:'❓', iconClass:'step-wx-emoji-generic', text:'No data', windText:'' };

    const id = wx.weather?.[0]?.id || 0;
    const main = wx.weather?.[0]?.main || '';
    const temp = wx.main?.temp;
    const windSpeed = wx.wind?.speed;
    const windDeg = wx.wind?.deg;

    let isNight = false;
    if (wx.dt && wx.sys?.sunrise && wx.sys?.sunset)
      isNight = wx.dt < wx.sys.sunrise || wx.dt > wx.sys.sunset;

    let icon='❓', iconClass='step-wx-emoji-generic';
    if (id >= 200 && id < 300) { icon='⛈️'; iconClass='step-wx-emoji-storm'; }
    else if (id >= 300 && id < 600) { icon='🌧️'; iconClass='step-wx-emoji-rain'; }
    else if (id >= 600 && id < 700) { icon='❄️'; iconClass='step-wx-emoji-snow'; }
    else if (id >= 700 && id < 800) { icon='🌫️'; iconClass='step-wx-emoji-fog'; }
    else if (id === 800) { icon = isNight ? '🌙' : '☀️'; iconClass = isNight ? 'step-wx-emoji-moon' : 'step-wx-emoji-sun'; }
    else if (id > 800) { icon='☁️'; iconClass='step-wx-emoji-clouds'; }

    const text = `${main} · ${Math.round(temp)}°F`;
    const windText = (windSpeed && windDeg !== undefined)
      ? `${directionArrow(windDeg)} ${Math.round(windSpeed * 1.94384)} kt`
      : '';

    return { iconChar:icon, iconClass, text, windText };
  }

  async function fetchWx(site) {
    try {
      const res = await fetch(`${STEP_WX_ENDPOINT}?lat=${site.lat}&lon=${site.lon}&units=imperial`);
      return res.ok ? res.json() : null;
    } catch { return null; }
  }

  async function refreshPanel() {
    panelEl.classList.add('step-status-card');

    let html = `
      <div class="comm-card-header">
        <div class="comm-card-title"><span>STEP &amp; Teleport Weather</span></div>
      </div>
      <div class="comm-card-body">
        <table class="step-status-table"><tbody>
    `;

    let latestTime = null;

    for (const site of STEP_SITES) {
      const wx = await fetchWx(site);
      if (wx?.dt && (!latestTime || wx.dt > latestTime)) latestTime = wx.dt;

      const imp = classifyImpact(wx);
      const w = formatWx(wx);
      const tooltip =
        imp.className === 'step-impact-green'
          ? `${site.name}: No degraded RF risk`
          : `${site.name}: ${imp.label} — likely impact to ${imp.bands.join(', ')}`;

      html += `
        <tr class="${imp.className}">
          <td class="step-status-main-cell">
            <div class="step-status-line" title="${tooltip.replace(/"/g,'&quot;')}">
              <span class="step-status-name">${site.name}</span>
              <span class="step-wx-emoji ${w.iconClass}">${w.iconChar}</span>
              <span class="step-wx-text">${w.text}</span>
              ${w.windText ? `<span class="step-wx-wind">${w.windText}</span>` : ''}
            </div>
          </td>
        </tr>
      `;
    }

    html += `
        </tbody></table>
      </div>
    `;

    if (latestTime) {
      const time = new Date(latestTime * 1000).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
      html += `
        <div class="step-status-footer">
          <span>Source: OpenWeather</span>
          <span class="step-status-updated">Updated ${time} local</span>
        </div>
      `;
    }

    panelEl.innerHTML = html;
  }

  refreshPanel();
  if (Events?.on) Events.on('comm:location-changed', refreshPanel);
})();
