(function () {
  'use strict';

  const PANEL_ID = 'step-status-panel';
  const panelEl = document.getElementById(PANEL_ID);
  if (!panelEl) return;

  const Events = window.RussellTV?.Events;
  const STEP_WX_ENDPOINT = '/weather'; // your backend proxy on :4010 via nginx

  // Teleport / hub sites (teleports first, no Fort Detrick)
  const STEP_SITES = [
    {
      id: 'TELEPORT-NW-VA',
      name: 'Northwest · Chesapeake, VA',
      lat: 36.819,
      lon: -76.383
    },
    {
      id: 'TELEPORT-CA',
      name: 'Camp Roberts · CA',
      lat: 35.764,
      lon: -120.765
    },
    {
      id: 'TELEPORT-HI',
      name: 'Wahiawā · HI',
      lat: 21.501,
      lon: -158.035
    },
    {
      id: 'TELEPORT-DE',
      name: 'Landstuhl · DE',
      lat: 49.414,
      lon: 7.566
    },
    {
      id: 'TELEPORT-IT',
      name: 'Lago Patria · IT',
      lat: 40.894,
      lon: 14.043
    },
    {
      id: 'TELEPORT-JP',
      name: 'Fort Buckner · JP',
      lat: 26.29623795490969,
      lon: 127.77626368126411
    }
  ];

  function directionArrow(deg) {
    if (typeof deg !== 'number') return '';
    const dirs = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];
    const idx = Math.round(deg / 45) % 8;
    return dirs[idx];
  }

  function classifyImpact(wx) {
    if (!wx) {
      return {
        className: 'step-impact-unknown',
        label: 'Unknown',
        bands: []
      };
    }

    const id = wx.weather?.[0]?.id || 0;
    const desc = (wx.weather?.[0]?.description || '').toLowerCase();
    const wind = wx.wind?.speed || 0; // m/s or whatever backend returns
    const gust = wx.wind?.gust || wind;
    const rainRate = (wx.rain && (wx.rain['1h'] || wx.rain['3h'])) || 0;
    const snowRate = (wx.snow && (wx.snow['1h'] || wx.snow['3h'])) || 0;

    const hasThunder = id >= 200 && id < 300;
    const hasRain = id >= 500 && id < 600;
    const hasSnow = id >= 600 && id < 700;
    const metDust = desc.includes('dust') || desc.includes('sand') || desc.includes('ash');
    const metFog = desc.includes('fog') || desc.includes('mist') || desc.includes('haze') || desc.includes('smoke');
    const isHurricaneForce = gust >= 35 || desc.includes('hurricane') || desc.includes('tropical storm');

    let level = 'green';
    const bands = new Set();

    // Dust / sand – X/Ku hit
    if (metDust) {
      level = 'yellow';
      bands.add('X/Ku');
    }

    // Rain/snow/fog – Ka/Ku fade
    if (hasRain || hasSnow || metFog) {
      if (rainRate > 10 || snowRate > 5 || hasThunder) {
        level = 'yellow';
        bands.add('Ka/Ku');
      } else if (rainRate > 0 || snowRate > 0) {
        if (level === 'green') level = 'yellow';
        bands.add('Ka');
      }
    }

    // Strong winds – hardware risk / pointing
    if (wind >= 15 || gust >= 20) {
      if (level === 'green') level = 'yellow';
      bands.add('Ka/Ku');
    }

    // Convective + higher winds = more serious
    if (wind >= 25 || gust >= 30 || hasThunder) {
      level = 'yellow';
      bands.add('Ka/Ku');
    }

    // Hurricane / tropical storm level = "red" – serious teleport risk
    if (isHurricaneForce) {
      level = 'red';
      bands.add('All');
    }

    // Clean nominal case
    if (level === 'green' && bands.size === 0) {
      bands.add('All');
    }

    const classMap = {
      green: 'step-impact-green',
      yellow: 'step-impact-yellow',
      red: 'step-impact-red'
    };
    const labelMap = {
      green: 'Nominal',
      yellow: 'Degraded',
      red: 'Severe'
    };

    return {
      className: classMap[level] || 'step-impact-unknown',
      label: labelMap[level] || 'Unknown',
      bands: Array.from(bands)
    };
  }

  function formatWx(wx) {
    if (!wx) {
      return {
        iconChar: '❓',
        iconClass: 'step-wx-emoji-generic',
        text: 'No data',
        windText: ''
      };
    }

    const weather = wx.weather?.[0] || {};
    const id = weather.id || 0;
    const main = weather.main || '';
    const temp = wx.main?.temp;
    const windSpeed = wx.wind?.speed;
    const windDeg = wx.wind?.deg;

    let icon = '❓';
    let iconClass = 'step-wx-emoji-generic';

    if (id >= 200 && id < 300) {
      icon = '⛈️';
      iconClass = 'step-wx-emoji-storm';
    } else if (id >= 300 && id < 400) {
      icon = '🌦️';
      iconClass = 'step-wx-emoji-rain';
    } else if (id >= 500 && id < 600) {
      icon = '🌧️';
      iconClass = 'step-wx-emoji-rain';
    } else if (id >= 600 && id < 700) {
      icon = '❄️';
      iconClass = 'step-wx-emoji-snow';
    } else if (id >= 700 && id < 800) {
      icon = '🌫️';
      iconClass = 'step-wx-emoji-fog';
    } else if (id === 800) {
      icon = '☀️';
      iconClass = 'step-wx-emoji-sun';
    } else if (id > 800 && id < 900) {
      icon = '☁️';
      iconClass = 'step-wx-emoji-clouds';
    }

    const parts = [];
    if (main) parts.push(main);
    if (temp != null) parts.push(`${Math.round(temp)}°F`);

    let windText = '';
    if (typeof windSpeed === 'number' && typeof windDeg === 'number') {
      const kts = Math.round(windSpeed * 1.94384);
      const arrow = directionArrow(windDeg);
      windText = `${arrow} ${kts} kt`;
    }

    return {
      iconChar: icon,
      iconClass,
      text: parts.join(' · ') || '—',
      windText
    };
  }

  function buildImpactTooltip(site, impact) {
    if (!impact || !impact.bands) return '';
    if (impact.className === 'step-impact-green') {
      return `${site.name}: No significant weather impact expected on teleport RF paths.`;
    }
    const bandsText = impact.bands.join(', ');
    return `${site.name}: Weather likely degrading ${bandsText} links (${impact.label}).`;
  }

  async function fetchWx(site) {
    // Use your backend proxy – no API key in browser
    const url = `${STEP_WX_ENDPOINT}?lat=${site.lat}&lon=${site.lon}&units=imperial`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`wx ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('[STEP WX] failed for', site.id, err);
      return null;
    }
  }

  async function refreshPanel() {
    if (!panelEl) return;

    panelEl.classList.add('step-status-card');

    const headerHtml = [
      '<div class="comm-card-header">',
      '  <div class="comm-card-title"><span>STEP &amp; Teleport Weather</span></div>',
      '  <div class="comm-card-meta">WX-driven RF risk by teleport</div>',
      '</div>'
    ].join('');

    const bodyParts = ['<div class="comm-card-body">', '<table class="step-status-table"><tbody>'];

    for (const site of STEP_SITES) {
      const wx = await fetchWx(site);
      const impact = classifyImpact(wx);
      const wxInfo = formatWx(wx);
      const tooltip = buildImpactTooltip(site, impact);
      const rowClass = `step-status-row ${impact.className}`;

      const wxHtmlParts = [
        '<div class="step-status-wx">',
        `<span class="step-wx-emoji ${wxInfo.iconClass}">${wxInfo.iconChar}</span>`,
        `<span class="step-wx-text">${wxInfo.text}</span>`
      ];
      if (wxInfo.windText) {
        wxHtmlParts.push(`<span class="step-wx-wind">${wxInfo.windText}</span>`);
      }
      wxHtmlParts.push('</div>');

      bodyParts.push(
        `<tr class="${rowClass}">`,
        '  <td class="step-status-main-cell">',
        `    <div class="step-status-line" title="${tooltip.replace(/"/g, '&quot;')}">`,
        `      <span class="step-status-name">${site.name}</span>`,
               wxHtmlParts.join(''),
        '    </div>',
        '  </td>',
        '</tr>'
      );
    }

    bodyParts.push('</tbody></table>', '</div>');
    panelEl.innerHTML = headerHtml + bodyParts.join('');
  }

  // Initial draw
  refreshPanel();

  // Optional: refresh when main comm location changes
  if (Events && Events.on) {
    Events.on('comm:location-changed', () => {
      refreshPanel();
    });
  }
})();
