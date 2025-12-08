/**
 * WeatherCard.js
 * Local weather card with current conditions, forecast, and climate data
 * Listens for: 'comm:location-changed'
 */

(function () {
  'use strict';

  const { BaseCard, Events, Storage, Layout, escapeHtml } = window.CommDashboard;

  // ============================================================
  // Constants
  // ============================================================
  const STORAGE_KEY = 'commWeatherCache';
  const WEATHER_PROXY = '/weather';
  const FORECAST_API = 'https://api.open-meteo.com/v1/forecast';
  const CLIMATE_API = 'https://climate-api.open-meteo.com/v1/climate';

  // ============================================================
  // WeatherCard Class
  // ============================================================
  class WeatherCard extends BaseCard {
    constructor() {
      super({
        id: 'comm-card-weather',
        title: 'Local Weather',
        metaId: 'comm-weather-meta'
      });

      this.tempUnit = Storage.get('commTempUnit', 'F');
      this.currentWeather = null;
      this.forecast = null;
      this.climate = null;
      this.location = null;
      this.clockInterval = null;
    }

    init() {
      super.init();
      this.loadCached();

      // Listen for location changes
      this.subscribe('comm:location-changed', (loc) => {
        this.location = loc;
        if (loc?.coords) {
          this.fetchWeather(loc.coords.lat, loc.coords.lon);
        }
      });

      // Check if we have a location already
      const locationCard = window.CommDashboard?.CardRegistry?.get('comm-card-location');
      const existingLoc = locationCard?.getSelectedLocation?.();
      if (existingLoc?.coords) {
        this.location = existingLoc;
        this.fetchWeather(existingLoc.coords.lat, existingLoc.coords.lon);
      }
    }

    destroy() {
      if (this.clockInterval) clearInterval(this.clockInterval);
      super.destroy();
    }

    // ============================================================
    // Data Fetching
    // ============================================================

    async fetchWeather(lat, lon) {
      this.showLoading();

      try {
        const [weather, forecast, climate] = await Promise.all([
          this.fetchCurrentWeather(lat, lon),
          this.fetchForecast(lat, lon),
          this.fetchClimate(lat, lon)
        ]);

        if (weather) {
          this.currentWeather = weather;
          this.forecast = forecast;
          this.climate = climate;
          this.cacheData();
          this.render();
          Events.emit('weather:data-updated', { weather, forecast, climate });
        }
      } catch (err) {
        console.warn('[WeatherCard] Fetch error:', err);
        this.showError('Unable to load weather. Ensure the weather proxy is running.');
      }
    }

    async fetchCurrentWeather(lat, lon) {
      const res = await fetch(`${WEATHER_PROXY}?lat=${lat}&lon=${lon}`);
      if (!res.ok) throw new Error(`Weather HTTP ${res.status}`);
      return res.json();
    }

    async fetchForecast(lat, lon) {
      try {
        const unitParam = this.tempUnit === 'C' ? 'celsius' : 'fahrenheit';
        const url = `${FORECAST_API}?latitude=${lat}&longitude=${lon}&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max,windspeed_10m_max,sunrise,sunset&temperature_unit=${unitParam}&windspeed_unit=mph&forecast_days=10&timezone=auto`;
        const res = await fetch(url);
        if (!res.ok) return null;
        return res.json();
      } catch (err) {
        console.warn('[WeatherCard] Forecast fetch failed:', err);
        return null;
      }
    }

    async fetchClimate(lat, lon) {
      try {
        const unitParam = this.tempUnit === 'C' ? 'celsius' : 'fahrenheit';
        const month = new Date().getMonth() + 1;
        const url = `${CLIMATE_API}?latitude=${lat}&longitude=${lon}&start_year=1991&end_year=2020&month=${month}&daily=temperature_2m_max_mean,temperature_2m_min_mean,temperature_2m_max_max,temperature_2m_min_min&temperature_unit=${unitParam}`;
        const res = await fetch(url);
        if (!res.ok) return null;
        return res.json();
      } catch (err) {
        console.warn('[WeatherCard] Climate fetch failed:', err);
        return null;
      }
    }

    // ============================================================
    // Caching
    // ============================================================

    loadCached() {
      const cached = Storage.get(STORAGE_KEY, null);
      if (cached && cached.weather) {
        this.currentWeather = cached.weather;
        this.forecast = cached.forecast;
        this.climate = cached.climate;
        this.tempUnit = cached.tempUnit || 'F';
      }
    }

    cacheData() {
      Storage.set(STORAGE_KEY, {
        weather: this.currentWeather,
        forecast: this.forecast,
        climate: this.climate,
        tempUnit: this.tempUnit,
        timestamp: Date.now()
      });
    }

    // ============================================================
    // Rendering
    // ============================================================

    showLoading() {
      if (this.bodyElement) {
        this.bodyElement.innerHTML = '<p class="comm-placeholder">Loading weather for selected location…</p>';
      }
      this.updateStatus('<span class="status-pill severity-fair">Loading…</span>');
      this.clearCardAccent();
    }

    showError(message) {
      if (this.bodyElement) {
        this.bodyElement.innerHTML = `<p class="comm-placeholder">${escapeHtml(message)}</p>`;
      }
      this.updateStatus('Weather unavailable');
      this.clearCardAccent();
    }

    clearCardAccent() {
      if (this.element) {
        this.element.style.removeProperty('--card-accent');
        this.element.style.removeProperty('--card-glow');
      }
    }

    renderBody() {
      if (!this.currentWeather || !this.currentWeather.main) {
        return '<p class="comm-placeholder">Select a location to view weather.</p>';
      }

      const wx = this.currentWeather;
      const main = wx.weather?.[0] || {};
      const wind = wx.wind || {};
      
      const tempF = wx.main?.temp != null ? Math.round(wx.main.temp) : null;
      const feelsF = wx.main?.feels_like != null ? Math.round(wx.main.feels_like) : null;
      const humidity = wx.main?.humidity;
      const pressure = wx.main?.pressure;
      const visibility = wx.visibility;
      const clouds = wx.clouds?.all;
      const timezone = wx.timezone || 0;

      const accent = this.tempToAccent(tempF);
      if (this.element && accent) {
        this.element.style.setProperty('--card-accent', accent);
        this.element.style.setProperty('--card-glow', this.colorWithAlpha(accent, 0.45));
      }

      const heroClass = accent ? 'comm-weather-hero accented' : 'comm-weather-hero';
      const severity = this.getSeverityClass(main.main, humidity);
      const locationLabel = this.location?.label || 'Selected location';

      // Summary line
      const summaryParts = [];
      if (wx.main?.temp_max != null && wx.main?.temp_min != null) {
        summaryParts.push(`High/Low ${this.formatTemp(wx.main.temp_max)} / ${this.formatTemp(wx.main.temp_min)}`);
      }
      if (clouds != null) {
        summaryParts.push(`Clouds ${clouds}%`);
      }

      // Climate normals
      const climateRow = this.renderClimateRow();

      // Metrics
      const metrics = this.buildMetrics(wx, timezone);

      // Forecast
      const forecastBlock = this.renderForecast();

      // Update meta
      const desc = main.description || main.main || 'Weather';
      this.updateStatus(`
        <div class="weather-meta-bar">
          <span class="status-pill ${severity}">${escapeHtml(this.toTitleCase(desc))}</span>
          <button type="button" id="temp-unit-toggle" class="temp-toggle">°${this.tempUnit === 'F' ? 'C' : 'F'}</button>
        </div>
      `);

      const updatedLocal = wx.dt 
        ? `Last Updated: ${this.formatUserStamp(wx.dt * 1000)}`
        : 'Last Updated: --';

      return `
        <div class="comm-weather-body">
          <div class="${heroClass}" style="--weather-accent:${accent || ''};">
            <div class="comm-weather-left">
              <div class="comm-weather-location">${escapeHtml(locationLabel)}</div>
              <div class="comm-weather-temp-row">
                <div class="comm-weather-icon">${this.getWeatherIcon(main.main)}</div>
                <div class="comm-weather-mainline">
                  <div class="comm-weather-temp">${this.formatTemp(tempF)}</div>
                  <div class="comm-weather-desc">${escapeHtml(desc)}</div>
                  <div class="comm-weather-feels">Feels like ${this.formatTemp(feelsF)}</div>
                </div>
              </div>
              ${summaryParts.length ? `<div class="comm-weather-summary-row">${summaryParts.map(s => escapeHtml(s)).join('<span>•</span>')}</div>` : ''}
              ${climateRow}
            </div>
          </div>
          ${metrics.length ? `<div class="comm-weather-grid">${metrics.join('')}</div>` : ''}
          ${forecastBlock ? `<div class="weather-extended">${forecastBlock}</div>` : ''}
          <div class="comm-card-micro comm-card-footer weather-footer">
            Source: <a class="inline-link" href="https://openweathermap.org/" target="_blank" rel="noopener noreferrer">OpenWeather</a> • ${escapeHtml(updatedLocal)}
          </div>
        </div>
      `;
    }

    buildMetrics(wx, timezone) {
      const metrics = [];
      const wind = wx.wind || {};
      const humidity = wx.main?.humidity;
      const pressure = wx.main?.pressure;
      const visibility = wx.visibility;

      if (humidity != null) {
        metrics.push(this.metricHtml('Humidity', `${humidity}%`, this.getMetricIcon('humidity')));
      }
      if (pressure != null) {
        metrics.push(this.metricHtml('Pressure', `${pressure} hPa`, this.getMetricIcon('pressure')));
      }
      if (wind.speed != null) {
        const dir = this.degreesToCardinal(wind.deg);
        metrics.push(this.metricHtml('Wind', `${Math.round(wind.speed)} mph${dir ? ' ' + dir : ''}`, this.getMetricIcon('wind')));
      }
      if (visibility != null) {
        metrics.push(this.metricHtml('Visibility', `${(visibility / 1609).toFixed(1)} mi`, this.getMetricIcon('visibility')));
      }

      // Local time
      const localTime = this.formatLocalClock(timezone);
      metrics.push(this.metricHtml('Local Time', localTime, this.getMetricIcon('time'), 'weather-local-time'));

      // UTC time
      const utcTime = this.formatUtcClock();
      metrics.push(this.metricHtml('UTC Time', utcTime, this.getMetricIcon('time'), 'weather-utc-time'));

      // Sunrise/Sunset
      const sunrise = wx.sys?.sunrise;
      const sunset = wx.sys?.sunset;
      if (sunrise) {
        metrics.push(this.metricHtml('Sunrise', this.formatLocalTime(sunrise, timezone), this.getMetricIcon('sunrise')));
      }
      if (sunset) {
        metrics.push(this.metricHtml('Sunset', this.formatLocalTime(sunset, timezone), this.getMetricIcon('sunset')));
      }

      return metrics;
    }

    metricHtml(label, value, icon, valueId) {
      const idAttr = valueId ? ` id="${valueId}"` : '';
      return `
        <div class="comm-weather-metric">
          <div class="icon">${icon}</div>
          <div class="metric-text">
            <span class="label">${escapeHtml(label)}</span>
            <span class="value"${idAttr}>${escapeHtml(value)}</span>
          </div>
        </div>
      `;
    }

    renderClimateRow() {
      const daily = this.climate?.daily;
      if (!daily) return '';

      const avgHigh = this.firstNumber(daily.temperature_2m_max_mean);
      const avgLow = this.firstNumber(daily.temperature_2m_min_mean);
      const recHigh = this.firstNumber(daily.temperature_2m_max_max);
      const recLow = this.firstNumber(daily.temperature_2m_min_min);

      if (avgHigh == null && avgLow == null && recHigh == null && recLow == null) {
        return '';
      }

      return `
        <div class="comm-weather-climo">
          <div><span>Avg Hi/Lo</span><strong>${this.formatTemp(avgHigh)} / ${this.formatTemp(avgLow)}</strong></div>
          <div><span>Record Hi/Lo</span><strong>${this.formatTemp(recHigh)} / ${this.formatTemp(recLow)}</strong></div>
        </div>
      `;
    }

    renderForecast() {
      if (!this.forecast?.daily?.time) return '';

      const days = this.forecast.daily.time;
      const highs = this.forecast.daily.temperature_2m_max || [];
      const lows = this.forecast.daily.temperature_2m_min || [];
      const codes = this.forecast.daily.weathercode || [];
      const pop = this.forecast.daily.precipitation_probability_max || [];
      const winds = this.forecast.daily.windspeed_10m_max || [];

      const items = days.slice(0, 10).map((dateStr, idx) => {
        const parts = String(dateStr).split('-');
        let dt;
        if (parts.length === 3) {
          dt = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        } else {
          dt = new Date(dateStr);
        }

        const dayLabel = dt.toLocaleDateString(undefined, { weekday: 'short' });
        const dateLabel = dt.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
        const main = this.weatherCodeToMain(codes[idx]);
        const icon = this.getWeatherIcon(main);
        const high = highs[idx] != null ? this.formatTemp(highs[idx]) : '—';
        const low = lows[idx] != null ? this.formatTemp(lows[idx]) : '—';

        const details = [];
        if (pop[idx] != null) details.push(`${pop[idx]}% rain`);
        if (winds[idx] != null) details.push(`${Math.round(winds[idx])} mph wind`);
        const detail = details.join(' · ');

        return `
          <div class="forecast-card">
            <div class="forecast-day">${escapeHtml(dayLabel)}</div>
            <div class="forecast-date">${escapeHtml(dateLabel)}</div>
            <div class="forecast-icon">${icon}</div>
            <div class="forecast-temps"><span>${escapeHtml(high)}</span><span>${escapeHtml(low)}</span></div>
            ${detail ? `<div class="forecast-detail">${escapeHtml(detail)}</div>` : ''}
          </div>
        `;
      }).join('');

      if (!items) return '';

      return `
        <div class="weather-forecast">
          <div class="forecast-head">10-Day Outlook</div>
          <div class="forecast-row">${items}</div>
        </div>
      `;
    }

    afterRender() {
      this.bindTempToggle();
      this.startClock();
      this.tagTimeElements();
    }

    bindTempToggle() {
      const toggle = this.$('#temp-unit-toggle');
      if (toggle) {
        toggle.addEventListener('click', () => {
          this.tempUnit = this.tempUnit === 'F' ? 'C' : 'F';
          Storage.set('commTempUnit', this.tempUnit);
          // Refetch with new unit
          if (this.location?.coords) {
            this.fetchWeather(this.location.coords.lat, this.location.coords.lon);
          }
        });
      }
    }

    tagTimeElements() {
      // Tag time elements for live clock updates
      const metrics = this.element?.querySelectorAll('.comm-weather-metric');
      metrics?.forEach(m => {
        const label = m.querySelector('.label')?.textContent?.trim();
        const valueEl = m.querySelector('.value');
        if (!valueEl || !label) return;
        if (label === 'Local Time') valueEl.id = 'weather-local-time';
        if (label === 'UTC Time') valueEl.id = 'weather-utc-time';
      });
    }

    startClock() {
      if (this.clockInterval) clearInterval(this.clockInterval);

      const localEl = this.$('#weather-local-time');
      const utcEl = this.$('#weather-utc-time');
      if (!localEl && !utcEl) return;

      const timezone = this.currentWeather?.timezone || 0;

      const tick = () => {
        if (utcEl) {
          utcEl.textContent = this.formatUtcClock();
        }
        if (localEl) {
          localEl.textContent = this.formatLocalClock(timezone);
        }
      };

      tick();
      this.clockInterval = this.setInterval(tick, 30000);
    }

    // ============================================================
    // Utility Methods
    // ============================================================

    formatTemp(temp) {
      if (temp == null || isNaN(temp)) return '--';
      let value = temp;
      if (this.tempUnit === 'C' && this.currentWeather) {
        // Data from API is already in the requested unit for forecast/climate
        // OpenWeather returns F by default via our proxy
        value = temp;
      }
      return `${Math.round(value)}°${this.tempUnit}`;
    }

    tempToAccent(tempF) {
      if (tempF == null || isNaN(tempF)) return '';
      const clamped = Math.max(-10, Math.min(110, tempF));
      const norm = (clamped + 10) / 120;
      const hue = 210 - (norm * 190);
      return `hsl(${hue}deg 90% 60%)`;
    }

    colorWithAlpha(color, alpha) {
      return color.replace('hsl', 'hsla').replace(')', ` / ${alpha})`);
    }

    getSeverityClass(main, humidity) {
      const m = (main || '').toLowerCase();
      if (m.includes('thunder') || m.includes('tornado') || m.includes('hurricane')) {
        return 'severity-critical';
      }
      if (m.includes('snow') || m.includes('blizzard') || m.includes('ice')) {
        return 'severity-poor';
      }
      if (m.includes('rain') || m.includes('drizzle')) {
        return 'severity-fair';
      }
      if (humidity && humidity > 85) {
        return 'severity-fair';
      }
      return 'severity-good';
    }

    getWeatherIcon(main) {
      const m = (main || '').toLowerCase();
      let icon = 'wind';

      if (m.includes('thunder')) icon = 'storm';
      else if (m.includes('rain') || m.includes('drizzle')) icon = 'rain';
      else if (m.includes('snow')) icon = 'snow';
      else if (m.includes('cloud')) icon = 'cloudy';
      else if (m.includes('mist') || m.includes('fog') || m.includes('haze')) icon = 'fog';
      else if (m.includes('clear')) icon = 'sunny';

      const alt = (main || 'Weather') + ' icon';
      return `<img class="weather-icon-img weather-${icon}" src="/icons/weather/${icon}.svg" alt="${escapeHtml(alt)}" loading="lazy" />`;
    }

    weatherCodeToMain(code) {
      const c = Number(code);
      if ([71, 73, 75, 77, 85, 86].includes(c)) return 'snow';
      if ([51, 53, 55, 56, 57].includes(c)) return 'drizzle';
      if ([61, 63, 65, 80, 81, 82].includes(c)) return 'rain';
      if ([45, 48].includes(c)) return 'fog';
      if ([95, 96, 99].includes(c)) return 'thunderstorm';
      if (c === 0) return 'clear';
      if ([1, 2, 3].includes(c)) return 'clouds';
      return 'clouds';
    }

    degreesToCardinal(deg) {
      if (deg == null || isNaN(deg)) return '';
      const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
      const idx = Math.round(deg / 45) % 8;
      return dirs[idx];
    }

    formatLocalClock(offsetSeconds) {
      const off = Number.isFinite(offsetSeconds) ? offsetSeconds : 0;
      const nowUtcSec = Math.floor(Date.now() / 1000);
      const locSec = nowUtcSec + off;
      const d = new Date(locSec * 1000);
      const h = String(d.getUTCHours()).padStart(2, '0');
      const m = String(d.getUTCMinutes()).padStart(2, '0');
      return `${h}${m}L`;
    }

    formatUtcClock() {
      const d = new Date();
      const h = String(d.getUTCHours()).padStart(2, '0');
      const m = String(d.getUTCMinutes()).padStart(2, '0');
      return `${h}${m}Z`;
    }

    formatLocalTime(epoch, offsetSeconds) {
      if (!epoch) return '';
      const off = Number.isFinite(offsetSeconds) ? offsetSeconds : 0;
      const d = new Date((epoch + off) * 1000);
      const h = String(d.getUTCHours()).padStart(2, '0');
      const m = String(d.getUTCMinutes()).padStart(2, '0');
      return `${h}:${m}`;
    }

    formatUserStamp(dateVal) {
      if (!dateVal && dateVal !== 0) return '';
      const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
      const h = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const month = d.toLocaleDateString(undefined, { month: 'short' });
      const year = d.getFullYear().toString().slice(-2);
      return `${h}${min} ${day} ${month} ${year}`;
    }

    toTitleCase(str) {
      if (!str) return '';
      return str.replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
    }

    firstNumber(arr) {
      if (!Array.isArray(arr) || !arr.length) return null;
      const val = Number(arr[0]);
      return Number.isFinite(val) ? val : null;
    }

    getMetricIcon(type) {
      const icons = {
        humidity: '<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="humGradient" x1="0" x2="1" y1="0" y2="1"><stop offset="0%" stop-color="#6bd9ff"/><stop offset="60%" stop-color="#2ac6ff"/><stop offset="100%" stop-color="#0fa3b1"/></linearGradient></defs><path d="M12 3s-5.5 6.1-5.5 10A5.5 5.5 0 0 0 12 18.5 5.5 5.5 0 0 0 17.5 13C17.5 9.1 12 3 12 3Z" fill="url(#humGradient)" stroke="#a7f0ff" stroke-width="0.6"/></svg>',
        pressure: '<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="8" stroke="#ffc46b" stroke-width="1.7" fill="rgba(255,200,120,0.12)"/><path d="M12 6v6l3 2" stroke="#ffdba3" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        wind: '<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M4 9.5h10a2.2 2.2 0 1 0-2.2-2.2" stroke="#7fd3ff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M3.5 14h11a2.7 2.7 0 1 1-2.7 2.7" stroke="#ffe27a" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        visibility: '<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M3 12s3.6-5.2 9-5.2S21 12 21 12s-3.6 5.2-9 5.2S3 12 3 12Z" fill="rgba(255,255,255,0.08)" stroke="#b8f0ff" stroke-width="1.5"/><circle cx="12" cy="12" r="2.6" fill="#12202d" stroke="#7fd3ff" stroke-width="1.4"/></svg>',
        time: '<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="9" stroke="#ffd580" stroke-width="1.5" fill="rgba(255,200,120,0.1)"/><path d="M12 6v6l4 2" stroke="#ffe5a3" stroke-width="1.6" stroke-linecap="round"/></svg>',
        sunrise: '<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M5 15h14" stroke="#ffb347" stroke-width="1.8" stroke-linecap="round"/><path d="M7 15a5 5 0 0 1 10 0" stroke="#ffe5a3" stroke-width="1.6"/><path d="m12 6 0-3" stroke="#ffd580" stroke-width="1.6" stroke-linecap="round"/><path d="m5.5 8 2 2M18.5 8l-2 2" stroke="#ffc066" stroke-width="1.6" stroke-linecap="round"/></svg>',
        sunset: '<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M5 15h14" stroke="#ff7b54" stroke-width="1.8" stroke-linecap="round"/><path d="M7 15a5 5 0 0 1 10 0" stroke="#ffb088" stroke-width="1.6"/><path d="m12 9 0 3" stroke="#ff9966" stroke-width="1.6" stroke-linecap="round"/><path d="m5.5 11 2-2M18.5 11l-2-2" stroke="#ff8855" stroke-width="1.6" stroke-linecap="round"/></svg>'
      };
      return icons[type] || icons.time;
    }

    // ============================================================
    // Status Display
    // ============================================================

    getMetaText() {
      return 'Select a location';
    }
  }

  // ============================================================
  // Register Card
  // ============================================================
  window.CommDashboard.WeatherCard = WeatherCard;

})();
