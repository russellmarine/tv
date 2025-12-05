(function () {
  'use strict';

  const PANEL_ID = 'step-status-panel';
  const panelEl = document.getElementById(PANEL_ID);
  if (!panelEl) return;

  const Events = window.RussellTV?.Events;
  const WX_ENDPOINT = '/weather';

  // Master list (order here doesn't matter; UI is always alphabetical)
  const STEP_SITES = [
    {
      id: 'TELEPORT-KU',
      name: 'Arifjan · KW',
      lat: 29.221,
      lon: 47.933
    },
    {
      id: 'TELEPORT-CA-CR',
      name: 'Camp Roberts · CA',
      lat: 35.764,
      lon: -120.765
    },
    {
      id: 'TELEPORT-UK-CRU',
      name: 'Croughton · UK',
      lat: 51.983,
      lon: -1.221
    },
    {
      id: 'TELEPORT-JP-FB',
      name: 'Fort Buckner · JP',
      lat: 26.29623795490969,
      lon: 127.77626368126411
    },
    {
      id: 'TELEPORT-DE-LDS',
      name: 'Landstuhl · DE',
      lat: 49.414,
      lon: 7.566
    },
    {
      id: 'TELEPORT-AU-GER',
      name: 'RAF Geraldton · AU',
      lat: -28.801,
      lon: 114.697
    },
    {
      id: 'TELEPORT-DE-RMS',
      name: 'Rammstein · DE',
      lat: 49.438,
      lon: 7.602
    },
    {
      id: 'TELEPORT-IT-SIG',
      name: 'Sigonella · IT',
      lat: 37.408,
      lon: 14.922
    },
    {
      id: 'TELEPORT-NJ-VV',
      name: 'Vernon Valley · NJ',
      lat: 41.214,
      lon: -74.47
    },
    {
      id: 'TELEPORT-VA-NW',
      name: 'Northwest · VA',
      lat: 36.819,
      lon: -76.383
    },
    {
      id: 'TELEPORT-EG-NSA',
      name: 'NSA Bahrain · BH',
      lat: 26.208,
      lon: 50.608
    },
    {
      id: 'TELEPORT-HI-WH',
      name: 'Wahiawā · HI',
      lat: 21.501,
      lon: -158.035
    },
    {
      id: 'TELEPORT-IT-LP',
      name: 'Lago Patria · IT',
      lat: 40.894,
      lon: 14.043
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
    const wind = wx.wind?.speed || 0; // m/s from OW; proxy preserves fields
    const gust = wx.wind?.gust || wind;
    const rainRate = (wx.rain && (wx.rain['1h'] || wx.rain['3h'])) || 0;
    const snowRate = (wx.snow && (wx.snow['1h'] || wx.snow['3h'])) || 0;

    const hasThunder = id >= 200 && id < 300;
    const hasRain = id >= 500 && id < 600;
    const hasSnow = id >= 600 && id < 700;
    const metDust = desc.includes('dust') || desc.includes('sand') || desc.includes('ash');
    const metFog =
      desc.includes('fog') ||
      desc.includes('mist') ||
      desc.includes('haze') ||
      desc.includes('smoke');
    const isHurricaneForce =
      gust >= 35 || desc.includes('hurricane') || desc.includes('tropical storm');

    let level = 'green';
    const bands = new Set();

    // Dust / sand – X/Ku more at risk
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

    // Strong winds – pointing/hardware risk
    if (wind >= 15 || gust >= 20) {
      if (level === 'green') level = 'yellow';
      bands.add('Ka/Ku');
    }

    // Convective + higher winds = more serious
    if (wind >= 25 || gust >= 30 || hasThunder) {
      level = 'yellow';
      bands.add('Ka/Ku');
    }

    // Hurricane / TS = red
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

  function formatWx(wx, isNight) {
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
      icon = isNight ? '🌧️' : '🌦️';
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
      icon = isNight ? '🌙' : '☀️';
      iconClass = isNight ? 'step-wx-emoji-moon' : 'step-wx-emoji-sun';
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
    const url = `${WX_ENDPOINT}?lat=${site.lat}&lon=${site.lon}&units=imperial`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`wx ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('[STEP WX] failed for', site.id, err);
      return null;
    }
  }

  function isNightAtSite(wx) {
    if (!wx || !wx.sys || typeof wx.dt !== 'number') return false;
    const { sunrise, sunset } = wx.sys;
    if (typeof sunrise !== 'number' || typeof sunset !== 'number') return false;
    const t = wx.dt;
    // Handle weird polar edge cases simply
    if (sunset < sunrise) return false;
    return t < sunrise || t > sunset;
  }

  function attachRowClickHandlers() {
    const rows = panelEl.querySelectorAll('.step-status-row[data-site-id]');
    if (!rows.length) return;

    rows.forEach((row) => {
      row.addEventListener('click', () => {
        const siteId = row.getAttribute('data-site-id');
        const site = STEP_SITES.find((s) => s.id === siteId);
        if (!site) return;

        // Broadcast an event for anything else that cares
        if (Events && typeof Events.emit === 'function') {
          Events.emit('comm:map-focus', {
            source: 'step-status',
            lat: site.lat,
            lon: site.lon,
            label: site.name
          });
        }

        // Direct map jump if overlay map is exposed
        const map =
          window.CommOverlayMap ||
          window.commOverlayMap ||
          window.RussellTV?.CommOverlayMap;

        if (map && typeof map.setView === 'function') {
          try {
            map.setView([site.lat, site.lon], 6);
          } catch (err) {
            console.warn('[STEP WX] map.setView failed', err);
          }
        }
      });
    });
  }

  async function refreshPanel() {
    if (!panelEl) return;

    panelEl.classList.add('step-status-card');

    const headerHtml = [
      '<div class="comm-card-header">',
      '  <div class="comm-card-title"><span>STEP &amp; Teleport Weather</span></div>',
      '  <div class="comm-card-meta"></div>',
      '</div>'
    ].join('');

    const bodyParts = [
      '<div class="comm-card-body step-status-body-inner">',
      '<table class="step-status-table"><tbody>'
    ];

    // Always sort alphabetically by name for display
    const sites = STEP_SITES.slice().sort((a, b) => a.name.localeCompare(b.name));

    const siteWxList = [];
    for (const site of sites) {
      const wx = await fetchWx(site);
      siteWxList.push({ site, wx });
    }

    const now = new Date();

    for (const { site, wx } of siteWxList) {
      const impact = classifyImpact(wx);
      const isNight = isNightAtSite(wx);
      const wxInfo = formatWx(wx, isNight);
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
        `<tr class="${rowClass}" data-site-id="${site.id}">`,
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

    const updatedText = now.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });

    const footerHtml = [
      '<div class="comm-card-footer step-status-footer">',
      '  <span class="step-status-source">Source: OpenWeather via RussellTV weather proxy</span>',
      `  <span class="step-status-updated">Updated ${updatedText}</span>`,
      '</div>'
    ].join('');

    panelEl.innerHTML = headerHtml + bodyParts.join('') + footerHtml;

    // Make the body scrollable if we grow past ~12
    const bodyInner = panelEl.querySelector('.step-status-body-inner');
    if (bodyInner && sites.length > 12) {
      bodyInner.style.maxHeight = '360px';
      bodyInner.style.overflowY = 'auto';
      bodyInner.style.paddingRight = '0.25rem';
      bodyInner.style.marginRight = '-0.15rem';
    }

    attachRowClickHandlers();
  }

  // Initial draw
  refreshPanel();

  // Optional: re-poll when location changes if you want to tie into that event
  if (Events && Events.on) {
    Events.on('comm:location-changed', () => {
      refreshPanel();
    });
  }
})();
