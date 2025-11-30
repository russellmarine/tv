
/**
 * comm-planner.js
 * Lightweight Comm Planner controller for comm.html
 * - Handles location selection (search + browser location)
 * - Updates Local Weather card
 * - Renders global Space Weather summary
 */

(function () {
  'use strict';

  window.RussellTV = window.RussellTV || {};
  const Events = window.RussellTV.Events;

  let selectedLocation = null;
  let locationMode = 'search';
  let autocompleteResults = [];
  let autocompleteTimeout = null;
  let recentLocations = [];
  const MAX_RECENT = 7;
  const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

  // ---------- Storage helpers ----------

  function loadRecent() {
    try {
      const raw = localStorage.getItem('commRecentLocations');
      if (!raw) return;
      recentLocations = JSON.parse(raw);
    } catch (e) {
      recentLocations = [];
    }
  }

  function saveRecent() {
    try {
      localStorage.setItem('commRecentLocations', JSON.stringify(recentLocations));
    } catch (e) {
      // ignore
    }
  }

  function addRecent(loc) {
    if (!loc || !loc.label || !loc.coords) return;

    // de-dupe on coords
    recentLocations = recentLocations.filter(r =>
      Math.abs(r.coords.lat - loc.coords.lat) > 0.001 ||
      Math.abs(r.coords.lon - loc.coords.lon) > 0.001
    );
    recentLocations.unshift(loc);
    if (recentLocations.length > MAX_RECENT) {
      recentLocations = recentLocations.slice(0, MAX_RECENT);
    }
    saveRecent();
    renderRecentList();
  }

  // ---------- DOM helpers ----------

  function $(sel) {
    return document.querySelector(sel);
  }

  function updateLocationStatus() {
    const meta = $('#comm-location-status');
    if (!meta) return;
    if (!selectedLocation) {
      meta.textContent = 'No location selected';
    } else {
      const { lat, lon } = selectedLocation.coords;
      meta.textContent = `${selectedLocation.label} (${lat.toFixed(2)}°, ${lon.toFixed(2)}°)`;
    }
  }

  // ---------- Location UI ----------

  function setLocationMode(mode) {
    locationMode = mode;
    const tabs = document.querySelectorAll('#comm-card-location .location-mode-tab');
    tabs.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    renderLocationInputArea();
  }

  function renderLocationInputArea() {
    const container = $('#comm-location-input-area');
    if (!container) return;

    let html = '';

    if (locationMode === 'search') {
      html = [
        '<div class="location-input-hint">Search by city, base name, or postal code</div>',
        '<div class="location-search-container">',
        '  <input id="comm-location-input" class="location-search-input" ',
        '         type="search" autocomplete="off" ',
        '         placeholder="e.g., Camp Lejeune, Jacksonville NC, 28540">',
        '  <div id="comm-location-autocomplete" class="location-autocomplete"></div>',
        '</div>',
        '<div id="comm-location-error" class="location-error"></div>'
      ].join('');
    } else if (locationMode === 'mgrs') {
      html = [
        '<div class="location-input-hint">MGRS support coming soon. For now, use Search or Lat/Lon.</div>'
      ].join('');
    } else if (locationMode === 'latlon') {
      html = [
        '<div class="location-input-hint">Enter decimal degrees (Lat, Lon)</div>',
        '<div class="location-input-row">',
        '  <div class="location-input-field">',
        '    <label>Latitude</label>',
        '    <input id="comm-lat-input" type="text" placeholder="34.5042">',
        '  </div>',
        '  <div class="location-input-field">',
        '    <label>Longitude</label>',
        '    <input id="comm-lon-input" type="text" placeholder="-77.3528">',
        '  </div>',
        '  <button class="location-go-btn" id="comm-latlon-go">→</button>',
        '</div>',
        '<div id="comm-location-error" class="location-error"></div>'
      ].join('');
    } else {
      // maidenhead grid stub
      html = '<div class="location-input-hint">Maidenhead grid input coming soon.</div>';
    }

    container.innerHTML = html;

    // Wire up field listeners for current mode
    if (locationMode === 'search') {
      const input = $('#comm-location-input');
      if (input) {
        input.addEventListener('input', () => handleSearchInput(input.value));
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (autocompleteResults.length > 0) {
              applySearchResult(0);
            }
          }
        });
      }
    } else if (locationMode === 'latlon') {
      const btn = $('#comm-latlon-go');
      if (btn) {
        btn.addEventListener('click', () => {
          const latVal = $('#comm-lat-input')?.value.trim();
          const lonVal = $('#comm-lon-input')?.value.trim();
          handleLatLonSubmit(latVal, lonVal);
        });
      }
    }

    renderRecentList();
  }

  function showLocationError(msg) {
    const el = $('#comm-location-error');
    if (!el) return;
    el.textContent = msg || '';
    el.classList.toggle('visible', !!msg);
  }

  // ---------- Search / Geocoding ----------

  async function searchLocation(query) {
    if (!query || query.length < 3) {
      autocompleteResults = [];
      renderAutocomplete();
      return;
    }

    try {
      const url = NOMINATIM_URL +
        '?q=' + encodeURIComponent(query) +
        '&format=json&limit=6&addressdetails=1';

      const res = await fetch(url, {
        headers: { 'User-Agent': 'RussellTV-CommPlanner/1.0' }
      });

      if (!res.ok) {
        throw new Error('Geocoding failed');
      }

      const raw = await res.json();
      autocompleteResults = raw.map(r => {
        const addr = r.address || {};
        const city = r.name || addr.city || addr.town || addr.village || '';
        const state = addr.state || addr.county || '';
        const country = addr.country || '';
        const labelParts = [];
        if (city) labelParts.push(city);
        if (state && state !== city) labelParts.push(state);
        if (country && country !== state) labelParts.push(country);
        const label = labelParts.join(', ') || r.display_name.split(',')[0];

        return {
          label,
          fullName: r.display_name,
          coords: {
            lat: parseFloat(r.lat),
            lon: parseFloat(r.lon)
          }
        };
      });

      renderAutocomplete();
    } catch (e) {
      console.warn('[CommPlanner] Geocoding error:', e);
      autocompleteResults = [];
      renderAutocomplete();
      showLocationError('Geocoding failed. Try again.');
    }
  }

  function handleSearchInput(value) {
    showLocationError('');
    if (autocompleteTimeout) {
      clearTimeout(autocompleteTimeout);
    }
    autocompleteTimeout = setTimeout(() => {
      searchLocation(value);
    }, 300);
  }

  function renderAutocomplete() {
    const dropdown = $('#comm-location-autocomplete');
    if (!dropdown) return;

    if (!autocompleteResults.length) {
      dropdown.style.display = 'none';
      dropdown.innerHTML = '';
      return;
    }

    dropdown.innerHTML = autocompleteResults.map((r, idx) => (
      '<div class="location-autocomplete-item" data-idx="' + idx + '">' +
        '<span class="location-autocomplete-name">' + escapeHtml(r.label) + '</span>' +
        '<span class="location-autocomplete-detail">' + escapeHtml(r.fullName.split(',').slice(1, 3).join(', ')) + '</span>' +
      '</div>'
    )).join('');

    dropdown.style.display = 'block';

    dropdown.querySelectorAll('.location-autocomplete-item').forEach(el => {
      el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const idx = parseInt(el.dataset.idx, 10);
        applySearchResult(idx);
      });
    });
  }

  function applySearchResult(index) {
    const result = autocompleteResults[index];
    if (!result) return;
    autocompleteResults = [];
    renderAutocomplete();
    const input = $('#comm-location-input');
    if (input) input.value = result.label;
    applyLocation(result);
  }

  function handleLatLonSubmit(latVal, lonVal) {
    if (!latVal || !lonVal) {
      showLocationError('Enter both latitude and longitude');
      return;
    }
    const lat = parseFloat(latVal);
    const lon = parseFloat(lonVal);
    if (!isFinite(lat) || !isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      showLocationError('Invalid coordinates');
      return;
    }
    showLocationError('');
    const loc = {
      label: 'Custom Lat/Lon',
      coords: { lat, lon }
    };
    applyLocation(loc);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ---------- Location application & weather ----------

  async function applyLocation(loc) {
    selectedLocation = {
      label: loc.label,
      coords: {
        lat: loc.coords.lat,
        lon: loc.coords.lon
      }
    };
    updateLocationStatus();
    addRecent(selectedLocation);
    const weatherMeta = $('#comm-weather-meta');
    if (weatherMeta) {
      weatherMeta.textContent = 'Loading weather…';
    }
    const weatherCard = $('#comm-card-weather');
    if (weatherCard) {
      weatherCard.style.removeProperty('--card-accent');
      weatherCard.style.removeProperty('--card-glow');
    }
    fetchLocalWeather(selectedLocation.coords.lat, selectedLocation.coords.lon);

    if (Events && Events.emit) {
      Events.emit('comm:location-changed', selectedLocation);
    }
  }

  function renderRecentList() {
    const container = $('#comm-recent-list');
    if (!container) return;
    if (!recentLocations.length) {
      container.innerHTML = '';
      return;
    }
    container.innerHTML = recentLocations.map((r, idx) => (
      '<button type="button" class="recent-location-pill" data-idx="' + idx + '">' +
        escapeHtml(r.label) +
      '</button>'
    )).join('');

    container.querySelectorAll('.recent-location-pill').forEach(el => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.dataset.idx, 10);
        const r = recentLocations[idx];
        if (r) {
          applyLocation(r);
        }
      });
    });
  }

  async function fetchLocalWeather(lat, lon) {
    const body = $('#comm-weather-body');
    const meta = $('#comm-weather-meta');
    const card = $('#comm-card-weather');
    if (!body) return;

    try {
      body.textContent = 'Loading detailed weather for selected location…';

      const res = await fetch('/weather?lat=' + lat + '&lon=' + lon);
      if (!res.ok) throw new Error('Weather HTTP ' + res.status);
      const data = await res.json();

      const wx = data || {};
      const main = (wx.weather && wx.weather[0]) || {};
      const temp = wx.main ? Math.round(wx.main.temp) : null;
      const feels = wx.main ? Math.round(wx.main.feels_like) : null;
      const humidity = wx.main ? wx.main.humidity : null;
      const pressure = wx.main ? wx.main.pressure : null;
      const visibility = wx.visibility;
      const wind = wx.wind || {};
      const clouds = wx.clouds ? wx.clouds.all : null;
      const sunrise = wx.sys ? wx.sys.sunrise : null;
      const sunset = wx.sys ? wx.sys.sunset : null;
      const timezone = wx.timezone || 0;
      const updatedLocal = wx.dt ? formatLocalTime(wx.dt, timezone) : 'Just now';
      const localTime = formatLocalTime(Date.now() / 1000, timezone, true);

      const accent = tempToAccent(temp);
      if (card && accent) {
        card.style.setProperty('--card-accent', accent);
        card.style.setProperty('--card-glow', colorMixWithTransparency(accent, 0.45));
      }

      const heroClass = accent ? 'comm-weather-hero accented' : 'comm-weather-hero';
      const summaryLine = [];
      if (wx.main && wx.main.temp_max != null && wx.main.temp_min != null) {
        summaryLine.push('High/Low ' + Math.round(wx.main.temp_max) + '° / ' + Math.round(wx.main.temp_min) + '°');
      }
      if (clouds != null) {
        summaryLine.push('Clouds ' + clouds + '%');
      }

      const windDirection = degreesToCardinal(wind.deg);
      const metrics = [];
      if (humidity !== null) metrics.push(metricHtml('Humidity', humidity + '%'));
      if (pressure !== null) metrics.push(metricHtml('Pressure', pressure + ' hPa'));
      if (wind.speed != null) metrics.push(metricHtml('Wind', Math.round(wind.speed) + ' mph' + (windDirection ? ' ' + windDirection : '')));
      if (visibility != null) metrics.push(metricHtml('Visibility', (visibility / 1609).toFixed(1) + ' mi'));
      metrics.push(metricHtml('Local Time', localTime));
      if (sunrise) metrics.push(metricHtml('Sunrise', formatLocalTime(sunrise, timezone)));
      if (sunset) metrics.push(metricHtml('Sunset', formatLocalTime(sunset, timezone)));

      body.innerHTML = [
        '<div class="comm-weather-body">',
        '  <div class="' + heroClass + '" style="--weather-accent:' + (accent || '') + ';">',
        '    <div class="comm-weather-left">',
        '      <div class="comm-weather-location">' + escapeHtml(selectedLocation?.label || 'Selected location') + '</div>',
        '      <div class="comm-weather-temp-row">',
        '        <div class="comm-weather-icon">' + getWeatherGlyph(main.main) + '</div>',
        '        <div class="comm-weather-mainline">',
        '          <div class="comm-weather-temp">' + (temp !== null ? temp + '°F' : '--') + '</div>',
        '          <div class="comm-weather-desc">' + escapeHtml(main.description || main.main || 'Weather') + '</div>',
        '          <div class="comm-weather-feels">Feels like ' + (feels !== null ? feels + '°F' : '—') + '</div>',
        '        </div>',
        '      </div>',
        summaryLine.length ? '      <div class="comm-weather-summary-row">' + summaryLine.map(escapeHtml).join('<span>•</span>') + '</div>' : '',
        '      <div class="comm-weather-meta-row comm-card-micro">',
        '        <span class="comm-weather-source">Data: OpenWeather</span>',
        '        <span class="comm-weather-updated">Updated ' + escapeHtml(updatedLocal) + '</span>',
        '      </div>',
        '    </div>',
        '  </div>',
        metrics.length ? '  <div class="comm-weather-grid">' + metrics.join('') + '</div>' : '',
        '</div>'
      ].join('');

      if (meta) meta.textContent = 'OpenWeather • Updated ' + updatedLocal;
    } catch (e) {
      console.warn('[CommPlanner] Weather fetch failed:', e);
      body.textContent = 'Unable to load weather for this location. Ensure the weather proxy is running with an OpenWeather API key.';
      if (meta) meta.textContent = 'Weather proxy not reachable';
    }
  }

  // ---------- Space weather card ----------

  function getScaleColor(v) {
    if (v >= 4) return '#ff4444';
    if (v >= 3) return '#ff8800';
    if (v >= 2) return '#ffcc00';
    if (v >= 1) return '#88cc44';
    return '#44cc44';
  }

  function getScaleDescription(type, value) {
    const desc = {
      R: ['None', 'Minor', 'Moderate', 'Strong', 'Severe', 'Extreme'],
      S: ['None', 'Minor', 'Moderate', 'Strong', 'Severe', 'Extreme'],
      G: ['Quiet', 'Minor', 'Moderate', 'Strong', 'Severe', 'Extreme']
    };
    return (desc[type] && desc[type][value]) || 'Unknown';
  }

  function updateSpaceWeatherCard() {
    const card = $('#comm-card-spacewx');
    if (!card || !window.RussellTV.SpaceWeather || !window.SPACE_WEATHER_CONFIG) return;

    const data = window.RussellTV.SpaceWeather.getCurrentData();
    if (!data) return;

    const body = card.querySelector('.comm-card-body');
    const meta = $('#comm-spacewx-meta');
    if (!body) return;

    const kpColor = data.kpIndex >= 5 ? '#ff8800' : (data.kpIndex >= 4 ? '#ffcc00' : '#44cc44');

    const updated = window.RussellTV.SpaceWeather.getLastUpdate();
    const updatedText = updated ? 'NOAA SWPC • Updated ' + updated.toUTCString() : 'NOAA SWPC';

    body.innerHTML = [
      '<div class="spacewx-scales-row">',
      '  <div class="spacewx-scale-card">',
      '    <div class="label">Radio</div>',
      '    <div class="value" style="color:' + getScaleColor(data.scales.R) + '">R' + data.scales.R + '</div>',
      '    <div class="desc">' + getScaleDescription('R', data.scales.R) + '</div>',
      '  </div>',
      '  <div class="spacewx-scale-card">',
      '    <div class="label">Solar</div>',
      '    <div class="value" style="color:' + getScaleColor(data.scales.S) + '">S' + data.scales.S + '</div>',
      '    <div class="desc">' + getScaleDescription('S', data.scales.S) + '</div>',
      '  </div>',
      '  <div class="spacewx-scale-card">',
      '    <div class="label">Geomag</div>',
      '    <div class="value" style="color:' + getScaleColor(data.scales.G) + '">G' + data.scales.G + '</div>',
      '    <div class="desc">' + getScaleDescription('G', data.scales.G) + '</div>',
      '  </div>',
      '</div>',
      '<div class="spacewx-kp-row">',
      '  <span class="label">Kp Index</span>',
      '  <span class="value" style="color:' + kpColor + ';">' + data.kpIndex.toFixed(2) + '</span>',
      '  <span class="status">' + (data.kpIndex >= 5 ? 'Stormy' : data.kpIndex >= 4 ? 'Unsettled' : 'Quiet') + '</span>',
      '</div>',
      '<div class="comm-card-micro">' + escapeHtml(updatedText) + '</div>'
    ].join('');

    if (meta) meta.textContent = updatedText;
  }

  // ---------- Init ----------

  function initLocationCard() {
    const card = $('#comm-card-location');
    if (!card) return;

    loadRecent();
    renderLocationInputArea();
    updateLocationStatus();

    // Tabs
    const tabs = card.querySelectorAll('.location-mode-tab');
    tabs.forEach(btn => {
      btn.addEventListener('click', () => {
        setLocationMode(btn.dataset.mode);
      });
    });

    const browserBtn = $('#comm-use-browser');
    if (browserBtn && navigator.geolocation) {
      browserBtn.addEventListener('click', () => {
        browserBtn.disabled = true;
        browserBtn.textContent = 'Locating…';
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const lat = pos.coords.latitude;
            const lon = pos.coords.longitude;
            let label = 'Browser location';
            try {
              // Quick reverse lookup via Nominatim for a nicer label
              const url = 'https://nominatim.openstreetmap.org/reverse?format=json&lat=' +
                lat + '&lon=' + lon + '&zoom=10&addressdetails=1';
              const res = await fetch(url, {
                headers: { 'User-Agent': 'RussellTV-CommPlanner/1.0' }
              });
              if (res.ok) {
                const data = await res.json();
                if (data && data.display_name) {
                  label = data.display_name.split(',').slice(0, 2).join(', ');
                }
              }
            } catch (e) {
              // fall back to generic
            }
            applyLocation({ label, coords: { lat, lon } });
            browserBtn.disabled = false;
            browserBtn.textContent = 'Use browser location';
          },
          (err) => {
            console.warn('[CommPlanner] Geolocation error:', err);
            showLocationError('Browser location failed: ' + err.message);
            browserBtn.disabled = false;
            browserBtn.textContent = 'Use browser location';
          }
        );
      });
    }
  }

  function initSpaceWeatherCard() {
    updateSpaceWeatherCard();
    if (Events && Events.on) {
      Events.on('spaceweather:data-updated', updateSpaceWeatherCard);
    }
  }

  function init() {
    if (!document.querySelector('.comm-layout-grid')) return;
    initLocationCard();
    initSpaceWeatherCard();
    console.log('[CommPlanner] Dashboard initialized');
  }

  document.addEventListener('DOMContentLoaded', init);

  function metricHtml(label, value, hint) {
    return '<div class="comm-weather-metric">' +
      '<span class="label">' + escapeHtml(label) + '</span>' +
      '<span class="value">' + escapeHtml(value) + '</span>' +
      (hint ? '<span class="hint">' + escapeHtml(hint) + '</span>' : '') +
      '</div>';
  }

  function formatLocalTime(epochSeconds, offsetSeconds, includeDate) {
    if (!epochSeconds && epochSeconds !== 0) return '';
    const tzOffset = offsetSeconds || 0;
    const date = new Date((epochSeconds + tzOffset) * 1000);
    const opts = { hour: '2-digit', minute: '2-digit' };
    if (includeDate) {
      opts.month = 'short';
      opts.day = 'numeric';
    }
    return date.toLocaleString(undefined, opts);
  }

  function tempToAccent(tempF) {
    if (tempF === null || tempF === undefined || isNaN(tempF)) return '';
    const clamped = Math.max(-10, Math.min(110, tempF));
    const norm = (clamped + 10) / 120; // 0..1
    const hue = 210 - (norm * 190); // blue to warm
    return `hsl(${hue}deg 90% 60%)`;
  }

  function colorMixWithTransparency(color, alpha) {
    return color.replace('hsl', 'hsla').replace(')', ` / ${alpha})`);
  }

  function degreesToCardinal(deg) {
    if (deg === null || deg === undefined || isNaN(deg)) return '';
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const idx = Math.round(deg / 45) % 8;
    return dirs[idx];
  }

  function getWeatherGlyph(main) {
    const m = (main || '').toLowerCase();
    let icon = 'wind';

    if (m.includes('thunder')) icon = 'storm';
    else if (m.includes('rain') || m.includes('drizzle')) icon = 'rain';
    else if (m.includes('snow')) icon = 'snow';
    else if (m.includes('cloud')) icon = 'cloudy';
    else if (m.includes('mist') || m.includes('fog') || m.includes('haze')) icon = 'fog';
    else if (m.includes('clear')) icon = 'sunny';

    const alt = (main || 'Weather') + ' icon';
    return '<img src="/icons/weather/' + icon + '.svg" alt="' + escapeHtml(alt) + '" loading="lazy" />';
  }

  // Public API (for other modules later)
  window.RussellTV.CommPlanner = {
    getSelectedLocation: function () { return selectedLocation; }
  };

})();
