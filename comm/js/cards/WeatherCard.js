/**
 * WeatherCard.js
 * Local weather card with current conditions and 10-day forecast
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
        const [weather, forecast] = await Promise.all([
          this.fetchCurrentWeather(lat, lon),
          this.fetchForecast(lat, lon)
        ]);

        if (weather) {
          this.currentWeather = weather;
          this.forecast = forecast;
          this.cacheData();
          this.render();
          Events.emit('weather:data-updated', { weather, forecast });
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
        const url = `${FORECAST_API}?latitude=${lat}&longitude=${lon}&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max,windspeed_10m_max&temperature_unit=${unitParam}&windspeed_unit=mph&forecast_days=10&timezone=auto`;
        const res = await fetch(url);
        if (!res.ok) return null;
        return res.json();
      } catch (err) {
        console.warn('[WeatherCard] Forecast fetch failed:', err);
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
        this.tempUnit = cached.tempUnit || 'F';
      }
    }

    cacheData() {
      Storage.set(STORAGE_KEY, {
        weather: this.currentWeather,
        forecast: this.forecast,
        tempUnit: this.tempUnit,
        timestamp: Date.now()
      });
    }

    // ============================================================
    // Rendering
    // ============================================================

    showLoading() {
      if (this.bodyElement) {
        this.bodyElement.innerHTML = '<p class="comm-placeholder">Loading weather…</p>';
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

      const severity = this.getSeverityClass(main.main, humidity);
      const locationLabel = this.location?.label || 'Selected location';
      const desc = main.description || main.main || 'Weather';

      // Update meta bar
      this.updateStatus(`
        <div class="weather-meta-bar">
          <span class="status-pill ${severity}">${escapeHtml(this.toTitleCase(desc))}</span>
          <button type="button" id="temp-unit-toggle" class="temp-toggle">°${this.tempUnit === 'F' ? 'C' : 'F'}</button>
        </div>
      `);

      // Summary line
      const summaryParts = [];
      if (wx.main?.temp_max != null && wx.main?.temp_min != null) {
        summaryParts.push(`High/Low ${this.formatTemp(wx.main.temp_max)} / ${this.formatTemp(wx.main.temp_min)}`);
      }
      if (clouds != null) {
        summaryParts.push(`Clouds ${clouds}%`);
      }

      const updatedLocal = wx.dt 
        ? `Last Updated: ${this.formatUserStamp(wx.dt * 1000)}`
        : 'Last Updated: --';

      // Build metrics grid
      const windDir = this.degreesToCardinal(wind.deg);
      const sunriseLabel = wx.sys?.sunrise ? this.formatLocalTime(wx.sys.sunrise, timezone) : null;
      const sunsetLabel = wx.sys?.sunset ? this.formatLocalTime(wx.sys.sunset, timezone) : null;

      // Build forecast
      const forecastHtml = this.renderForecast();

      return `
        <div class="comm-weather-body">
          <div class="comm-weather-hero${accent ? ' accented' : ''}" style="--weather-accent:${accent || 'transparent'};">
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
              ${summaryParts.length ? `<div class="comm-weather-summary-row">${summaryParts.map(s => escapeHtml(s)).join(' <span>•</span> ')}</div>` : ''}
            </div>
          </div>

          <div class="comm-weather-grid">
            ${humidity != null ? this.metricHtml('Humidity', `${humidity}%`) : ''}
            ${pressure != null ? this.metricHtml('Pressure', `${pressure} hPa`) : ''}
            ${wind.speed != null ? this.metricHtml('Wind', `${Math.round(wind.speed)} mph${windDir ? ' ' + windDir : ''}`) : ''}
            ${visibility != null ? this.metricHtml('Visibility', `${(visibility / 1609).toFixed(1)} mi`) : ''}
            ${this.metricHtml('Local Time', this.formatLocalClock(timezone), 'weather-local-time')}
            ${this.metricHtml('UTC Time', this.formatUtcClock(), 'weather-utc-time')}
            ${sunriseLabel ? this.metricHtml('Sunrise', sunriseLabel) : ''}
            ${sunsetLabel ? this.metricHtml('Sunset', sunsetLabel) : ''}
          </div>

          ${forecastHtml}

          <div class="comm-card-micro comm-card-footer">
            Source: <a class="inline-link" href="https://openweathermap.org/" target="_blank" rel="noopener noreferrer">OpenWeather</a> / <a class="inline-link" href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo</a> • ${escapeHtml(updatedLocal)}
          </div>
        </div>
      `;
    }

    metricHtml(label, value, valueId) {
      const idAttr = valueId ? ` id="${valueId}"` : '';
      return `
        <div class="comm-weather-metric">
          <div class="metric-text">
            <span class="label">${escapeHtml(label)}</span>
            <span class="value"${idAttr}>${escapeHtml(value)}</span>
          </div>
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
        const high = highs[idx] != null ? this.formatTempValue(highs[idx]) : '—';
        const low = lows[idx] != null ? this.formatTempValue(lows[idx]) : '—';

        const details = [];
        if (pop[idx] != null && pop[idx] > 0) details.push(`${pop[idx]}%`);
        if (winds[idx] != null) details.push(`${Math.round(winds[idx])} mph`);
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
    }

    bindTempToggle() {
      const toggle = this.$('#temp-unit-toggle');
      if (toggle) {
        toggle.addEventListener('click', () => {
          this.tempUnit = this.tempUnit === 'F' ? 'C' : 'F';
          Storage.set('commTempUnit', this.tempUnit);
          // Refetch to get forecast in new unit
          if (this.location?.coords) {
            this.fetchWeather(this.location.coords.lat, this.location.coords.lon);
          }
        });
      }
    }

    startClock() {
      if (this.clockInterval) clearInterval(this.clockInterval);

      const localEl = this.$('#weather-local-time');
      const utcEl = this.$('#weather-utc-time');
      if (!localEl && !utcEl) return;

      const timezone = this.currentWeather?.timezone || 0;

      const tick = () => {
        if (utcEl) utcEl.textContent = this.formatUtcClock();
        if (localEl) localEl.textContent = this.formatLocalClock(timezone);
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
      if (this.tempUnit === 'C') {
        value = ((temp - 32) * 5) / 9;
      }
      return `${Math.round(value)}°${this.tempUnit}`;
    }

    formatTempValue(temp) {
      // For forecast data that's already in the correct unit
      if (temp == null || isNaN(temp)) return '--';
      return `${Math.round(temp)}°`;
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

    getMetaText() {
      return '';
    }
  }

  // ============================================================
  // Register Card
  // ============================================================
  window.CommDashboard.WeatherCard = WeatherCard;

})();
