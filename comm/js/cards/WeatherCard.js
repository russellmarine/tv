/**
 * WeatherCard.js
 * Local weather card with current conditions from OpenWeather
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
        const res = await fetch(`${WEATHER_PROXY}?lat=${lat}&lon=${lon}`);
        if (!res.ok) throw new Error(`Weather HTTP ${res.status}`);
        const weather = await res.json();

        if (weather) {
          this.currentWeather = weather;
          this.cacheData();
          this.render();
          Events.emit('weather:data-updated', { weather });
        }
      } catch (err) {
        console.warn('[WeatherCard] Fetch error:', err);
        this.showError('Unable to load weather. Ensure the weather proxy is running.');
      }
    }

    // ============================================================
    // Caching
    // ============================================================

    loadCached() {
      const cached = Storage.get(STORAGE_KEY, null);
      if (cached && cached.weather) {
        this.currentWeather = cached.weather;
        this.tempUnit = cached.tempUnit || 'F';
      }
    }

    cacheData() {
      Storage.set(STORAGE_KEY, {
        weather: this.currentWeather,
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

          <div class="comm-card-micro comm-card-footer">
            Source: <a class="inline-link" href="https://openweathermap.org/" target="_blank" rel="noopener noreferrer">OpenWeather</a> • ${escapeHtml(updatedLocal)}
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
          this.render(); // Re-render with new unit
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
