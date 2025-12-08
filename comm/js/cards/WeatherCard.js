/**
 * WeatherCard.js
 * Local weather card with current conditions, hourly charts, historical averages, and 9-day forecast
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

  // SVG Icons
  const ICONS = {
    humidity: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2.5c0 0-6 7-6 11.5a6 6 0 1 0 12 0c0-4.5-6-11.5-6-11.5z" stroke="#6bd9ff" stroke-width="1.5" fill="rgba(107,217,255,0.2)"/>
      <path d="M9 14a3 3 0 0 0 3 3" stroke="#a7f0ff" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,
    pressure: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="8" stroke="#ffc46b" stroke-width="1.5" fill="rgba(255,196,107,0.1)"/>
      <path d="M12 4v2M12 18v2M4 12h2M18 12h2" stroke="#ffdba3" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M12 12l4-3" stroke="#ffe5a3" stroke-width="2" stroke-linecap="round"/>
      <circle cx="12" cy="12" r="1.5" fill="#ffc46b"/>
    </svg>`,
    wind: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 10h12a3 3 0 1 0-3-3" stroke="#7fd3ff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M4 14h14a3 3 0 1 1-3 3" stroke="#ffe27a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
    visibility: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" stroke="#b8f0ff" stroke-width="1.5" fill="rgba(184,240,255,0.1)"/>
      <circle cx="12" cy="12" r="3" stroke="#7fd3ff" stroke-width="1.5" fill="rgba(127,211,255,0.2)"/>
    </svg>`,
    time: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="9" stroke="#ffd580" stroke-width="1.5" fill="rgba(255,213,128,0.1)"/>
      <path d="M12 6v6l4 2" stroke="#ffe5a3" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,
    sunrise: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 18h16" stroke="#ffb347" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M6 18a6 6 0 1 1 12 0" stroke="#ffe5a3" stroke-width="1.5" fill="rgba(255,229,163,0.15)"/>
      <path d="M12 2v3M5 5l2 2M19 5l-2 2" stroke="#ffd580" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,
    sunset: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 18h16" stroke="#ff7b54" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M6 18a6 6 0 1 1 12 0" stroke="#ffb088" stroke-width="1.5" fill="rgba(255,120,80,0.15)"/>
      <path d="M12 8v3M5 11l2-2M19 11l-2-2" stroke="#ff9966" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,
    history: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" stroke="#a0d8ef" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M3 3v5h5" stroke="#a0d8ef" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M12 7v5l3 3" stroke="#c8e6f0" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`
  };

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
      this.hourly = null;
      this.historical = null;
      this.location = null;
      this.clockInterval = null;
    }

    init() {
      super.init();
      this.loadCached();

      this.subscribe('comm:location-changed', (loc) => {
        this.location = loc;
        if (loc?.coords) {
          this.fetchWeather(loc.coords.lat, loc.coords.lon);
        }
      });

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
        const [weather, forecastData, historical] = await Promise.all([
          this.fetchCurrentWeather(lat, lon),
          this.fetchForecastAndHourly(lat, lon),
          this.fetchHistoricalAverages(lat, lon)
        ]);

        if (weather) {
          this.currentWeather = weather;
          this.forecast = forecastData?.daily || null;
          this.hourly = forecastData?.hourly || null;
          this.historical = historical;
          this.cacheData();
          this.render();
          Events.emit('weather:data-updated', { weather, forecast: this.forecast, hourly: this.hourly });
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

    async fetchForecastAndHourly(lat, lon) {
      try {
        const unitParam = this.tempUnit === 'C' ? 'celsius' : 'fahrenheit';
        const url = `${FORECAST_API}?latitude=${lat}&longitude=${lon}&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max,windspeed_10m_max&hourly=temperature_2m,precipitation_probability,precipitation&temperature_unit=${unitParam}&windspeed_unit=mph&precipitation_unit=inch&forecast_days=10&timezone=auto`;
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.json();
        return {
          daily: data.daily,
          hourly: data.hourly,
          utc_offset_seconds: data.utc_offset_seconds
        };
      } catch (err) {
        console.warn('[WeatherCard] Forecast fetch failed:', err);
        return null;
      }
    }

    async fetchHistoricalAverages(lat, lon) {
      try {
        const month = new Date().getMonth() + 1;
        const unitParam = this.tempUnit === 'C' ? 'celsius' : 'fahrenheit';
    
        // Single request to Climate API for 30-year normals (1991-2020)
        const url = `${CLIMATE_API}?latitude=${lat}&longitude=${lon}&start_year=1991&end_year=2020&month=${month}&daily=temperature_2m_max_mean,temperature_2m_min_mean,temperature_2m_max_max,temperature_2m_min_min&temperature_unit=${unitParam}`;
    
        const res = await fetch(url);
        if (!res.ok) return null;
    
        const data = await res.json();
        const daily = data.daily;
    
        if (!daily) return null;
  
        // Climate API returns arrays of daily values for the month
        // We need to find today's date within the month
        const today = new Date().getDate();
        const idx = Math.min(today - 1, (daily.temperature_2m_max_mean?.length || 1) - 1);
    
        const avgHigh = daily.temperature_2m_max_mean?.[idx];
        const avgLow = daily.temperature_2m_min_mean?.[idx];
        const recordHigh = daily.temperature_2m_max_max?.[idx];
        const recordLow = daily.temperature_2m_min_min?.[idx];
    
        if (avgHigh == null && avgLow == null) return null;
    
        return {
          avgHigh: avgHigh != null ? Math.round(avgHigh) : null,
          avgLow: avgLow != null ? Math.round(avgLow) : null,
          recordHigh: recordHigh != null ? Math.round(recordHigh) : null,
          recordLow: recordLow != null ? Math.round(recordLow) : null,
          yearsOfData: '30yr normals'  // Changed from number to string
        };
      } catch (err) {
        console.warn('[WeatherCard] Climate normals fetch failed:', err);
        return null;
      }
    }

        const results = await Promise.all(promises);
        const validResults = results.filter(r => r && r.high != null && r.low != null);

        if (validResults.length === 0) return null;

        const avgHigh = validResults.reduce((sum, r) => sum + r.high, 0) / validResults.length;
        const avgLow = validResults.reduce((sum, r) => sum + r.low, 0) / validResults.length;
        const recordHigh = Math.max(...validResults.map(r => r.high));
        const recordLow = Math.min(...validResults.map(r => r.low));

        return {
          avgHigh: Math.round(avgHigh),
          avgLow: Math.round(avgLow),
          recordHigh: Math.round(recordHigh),
          recordLow: Math.round(recordLow),
          yearsOfData: validResults.length
        };
      } catch (err) {
        console.warn('[WeatherCard] Historical fetch failed:', err);
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
        this.hourly = cached.hourly;
        this.historical = cached.historical;
        this.tempUnit = cached.tempUnit || 'F';
      }
    }

    cacheData() {
      Storage.set(STORAGE_KEY, {
        weather: this.currentWeather,
        forecast: this.forecast,
        hourly: this.hourly,
        historical: this.historical,
        tempUnit: this.tempUnit,
        timestamp: Date.now()
      });
    }

    // ============================================================
    // Temperature to Color
    // ============================================================

    tempToColor(temp, unit = 'F') {
      if (temp == null || isNaN(temp)) return { hue: 30, sat: 60, light: 50 };
      
      let tempF = temp;
      if (unit === 'C') {
        tempF = (temp * 9/5) + 32;
      }
      
      const clamped = Math.max(0, Math.min(100, tempF));
      const hue = 240 - (clamped / 100) * 240;
      const sat = 70 + (Math.abs(50 - clamped) / 50) * 20;
      const light = 45 + (Math.abs(50 - clamped) / 50) * 10;
      
      return { hue, sat, light };
    }

    tempToGradient(temp, unit = 'F') {
      const { hue, sat, light } = this.tempToColor(temp, unit);
      return `linear-gradient(135deg, hsla(${hue}, ${sat}%, ${light}%, 0.25), hsla(${hue}, ${sat - 20}%, ${light - 15}%, 0.4))`;
    }

    tempToBorder(temp, unit = 'F') {
      const { hue, sat, light } = this.tempToColor(temp, unit);
      return `hsla(${hue}, ${sat}%, ${light + 20}%, 0.5)`;
    }

    // ============================================================
    // Rendering
    // ============================================================

    showLoading() {
      if (this.bodyElement) {
        this.bodyElement.innerHTML = '<p class="comm-placeholder">Loading weather…</p>';
      }
      this.updateStatus('<span class="status-pill severity-fair">Loading…</span>');
    }

    showError(message) {
      if (this.bodyElement) {
        this.bodyElement.innerHTML = `<p class="comm-placeholder">${escapeHtml(message)}</p>`;
      }
      this.updateStatus('Weather unavailable');
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

      const severity = this.getSeverityClass(main.main, humidity);
      const locationLabel = this.location?.label || 'Selected location';
      const desc = main.description || main.main || 'Weather';

      const heroGradient = this.tempToGradient(tempF, 'F');
      const heroBorder = this.tempToBorder(tempF, 'F');

      this.updateStatus(`
        <div class="weather-meta-bar">
          <span class="status-pill ${severity}">${escapeHtml(this.toTitleCase(desc))}</span>
          <button type="button" id="temp-unit-toggle" class="temp-toggle">°${this.tempUnit === 'F' ? 'C' : 'F'}</button>
        </div>
      `);

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

      const windDir = this.degreesToCardinal(wind.deg);
      const sunriseLabel = wx.sys?.sunrise ? this.formatLocalTime(wx.sys.sunrise, timezone) : null;
      const sunsetLabel = wx.sys?.sunset ? this.formatLocalTime(wx.sys.sunset, timezone) : null;

      const historicalHtml = this.renderHistoricalAverages();
      const hourlyChartsHtml = this.renderHourlyCharts();
      const forecastHtml = this.renderForecast();

      return `
        <div class="comm-weather-body">
          <div class="comm-weather-hero" style="background: ${heroGradient}; border-color: ${heroBorder};">
            <div class="comm-weather-hero-inner">
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
              ${historicalHtml}
            </div>
          </div>

          <div class="comm-weather-grid">
            ${humidity != null ? this.metricHtml('Humidity', `${humidity}%`, ICONS.humidity) : ''}
            ${pressure != null ? this.metricHtml('Pressure', `${pressure} hPa`, ICONS.pressure) : ''}
            ${wind.speed != null ? this.metricHtml('Wind', `${Math.round(wind.speed)} mph${windDir ? ' ' + windDir : ''}`, ICONS.wind) : ''}
            ${visibility != null ? this.metricHtml('Visibility', `${(visibility / 1609).toFixed(1)} mi`, ICONS.visibility) : ''}
            ${this.metricHtml('Local Time', this.formatLocalClock(timezone), ICONS.time, 'weather-local-time')}
            ${this.metricHtml('UTC Time', this.formatUtcClock(), ICONS.time, 'weather-utc-time')}
            ${sunriseLabel ? this.metricHtml('Sunrise', sunriseLabel, ICONS.sunrise) : ''}
            ${sunsetLabel ? this.metricHtml('Sunset', sunsetLabel, ICONS.sunset) : ''}
          </div>

          ${hourlyChartsHtml}

          ${forecastHtml}

          <div class="comm-card-micro comm-card-footer">
            Source: <a class="inline-link" href="https://openweathermap.org/" target="_blank" rel="noopener noreferrer">OpenWeather</a> / <a class="inline-link" href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo</a> • ${escapeHtml(updatedLocal)}
          </div>
        </div>
      `;
    }

    renderHistoricalAverages() {
      if (!this.historical) {
        if (!this.forecast?.temperature_2m_max || !this.forecast?.temperature_2m_min) {
          return '';
        }
        const todayHigh = this.forecast.temperature_2m_max[0];
        const todayLow = this.forecast.temperature_2m_min[0];
        if (todayHigh == null && todayLow == null) return '';

        return `
          <div class="comm-weather-right">
            <div class="weather-historical">
              <div class="historical-label">${ICONS.history} Today's Forecast</div>
              <div class="historical-values">
                <div class="historical-item">
                  <span class="hist-label">High</span>
                  <span class="hist-value">${this.formatTempValue(todayHigh)}</span>
                </div>
                <div class="historical-item">
                  <span class="hist-label">Low</span>
                  <span class="hist-value">${this.formatTempValue(todayLow)}</span>
                </div>
              </div>
            </div>
          </div>
        `;
      }

      const h = this.historical;
      return `
        <div class="comm-weather-right">
          <div class="weather-historical">
            <div class="historical-label">${ICONS.history} Historical Avg (${h.yearsOfData})</div>
            <div class="historical-values">
              <div class="historical-item">
                <span class="hist-label">Avg High</span>
                <span class="hist-value">${this.formatTempValue(h.avgHigh)}</span>
              </div>
              <div class="historical-item">
                <span class="hist-label">Avg Low</span>
                <span class="hist-value">${this.formatTempValue(h.avgLow)}</span>
              </div>
              <div class="historical-item record">
                <span class="hist-label">Record</span>
                <span class="hist-value">${this.formatTempValue(h.recordHigh)} / ${this.formatTempValue(h.recordLow)}</span>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    renderHourlyCharts() {
      if (!this.hourly?.time || !this.hourly?.temperature_2m) return '';

      const temps = this.hourly.temperature_2m.slice(0, 24);
      const precip = this.hourly.precipitation?.slice(0, 24) || [];
      const times = this.hourly.time.slice(0, 24);

      if (temps.length < 12) return '';

      const tempChart = this.renderTempChart(temps, times);
      const precipChart = this.renderPrecipChart(precip, times);

      return `
        <div class="weather-hourly-charts">
          <div class="hourly-chart-container">
            <div class="chart-label">Temperature (24hr)</div>
            ${tempChart}
          </div>
          <div class="hourly-chart-container">
            <div class="chart-label">Precipitation (24hr)</div>
            ${precipChart}
          </div>
        </div>
      `;
    }

    renderTempChart(temps, times) {
      const width = 280;
      const height = 100;
      const padLeft = 36;
      const padRight = 12;
      const padTop = 10;
      const padBottom = 22;
      const chartWidth = width - padLeft - padRight;
      const chartHeight = height - padTop - padBottom;
      
      const validTemps = temps.filter(t => t != null);
      if (validTemps.length === 0) return '';
      
      // Round to nice numbers for axis
      const dataMin = Math.min(...validTemps);
      const dataMax = Math.max(...validTemps);
      const minTemp = Math.floor(dataMin / 5) * 5;
      const maxTemp = Math.ceil(dataMax / 5) * 5;
      const range = maxTemp - minTemp || 10;

      // Generate data line
      const points = temps.map((temp, i) => {
        const x = padLeft + (i / (temps.length - 1)) * chartWidth;
        const y = padTop + chartHeight - ((temp - minTemp) / range) * chartHeight;
        return `${x},${y}`;
      }).join(' ');

      // Fill polygon
      const fillPoints = `${padLeft},${padTop + chartHeight} ${points} ${padLeft + chartWidth},${padTop + chartHeight}`;

      // Color based on average temp
      const avgTemp = validTemps.reduce((a, b) => a + b, 0) / validTemps.length;
      const { hue } = this.tempToColor(avgTemp, this.tempUnit);

      // Y-axis gridlines and labels (3 lines: min, mid, max)
      const yValues = [minTemp, minTemp + range/2, maxTemp];
      const gridLines = yValues.map(val => {
        const y = padTop + chartHeight - ((val - minTemp) / range) * chartHeight;
        return `<line x1="${padLeft}" y1="${y}" x2="${width - padRight}" y2="${y}" stroke="rgba(255,210,170,0.2)" stroke-width="0.5" stroke-dasharray="2,2"/>`;
      }).join('');
      
      const yLabels = yValues.map(val => {
        const y = padTop + chartHeight - ((val - minTemp) / range) * chartHeight;
        return `<text x="${padLeft - 6}" y="${y + 3}" text-anchor="end" class="chart-axis-label">${Math.round(val)}°</text>`;
      }).join('');

      // X-axis labels (0, 6, 12, 18, 24)
      const xLabels = [0, 6, 12, 18, 23].map(idx => {
        const x = padLeft + (idx / (temps.length - 1)) * chartWidth;
        const hour = idx === 23 ? '24' : String(idx).padStart(2, '0');
        return `<text x="${x}" y="${height - 6}" text-anchor="middle" class="chart-axis-label">${hour}:00</text>`;
      }).join('');

      return `
        <svg class="hourly-chart temp-chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="hsla(${hue}, 80%, 60%, 0.5)"/>
              <stop offset="100%" stop-color="hsla(${hue}, 80%, 40%, 0.05)"/>
            </linearGradient>
          </defs>
          ${gridLines}
          <polygon points="${fillPoints}" fill="url(#tempGrad)"/>
          <polyline points="${points}" fill="none" stroke="hsla(${hue}, 90%, 70%, 0.9)" stroke-width="2"/>
          ${yLabels}
          ${xLabels}
        </svg>
      `;
    }

    renderPrecipChart(precip, times) {
      const width = 280;
      const height = 100;
      const padLeft = 36;
      const padRight = 12;
      const padTop = 10;
      const padBottom = 22;
      const chartWidth = width - padLeft - padRight;
      const chartHeight = height - padTop - padBottom;

      // Find max precipitation, minimum 0.1 inch for scale
      const maxPrecip = Math.max(0.1, ...precip.filter(p => p != null));
      // Round up to nice number
      const yMax = maxPrecip <= 0.1 ? 0.1 : Math.ceil(maxPrecip * 10) / 10;

      const barWidth = chartWidth / precip.length;

      const bars = precip.map((p, i) => {
        if (p == null || p === 0) return '';
        const x = padLeft + i * barWidth;
        const barHeight = (p / yMax) * chartHeight;
        const y = padTop + chartHeight - barHeight;
        const opacity = 0.4 + (p / yMax) * 0.6;
        return `<rect x="${x + 1}" y="${y}" width="${barWidth - 2}" height="${barHeight}" fill="rgba(100, 180, 255, ${opacity})" rx="1"/>`;
      }).join('');

      // Y-axis gridlines and labels
      const yValues = [0, yMax / 2, yMax];
      const gridLines = yValues.map(val => {
        const y = padTop + chartHeight - (val / yMax) * chartHeight;
        return `<line x1="${padLeft}" y1="${y}" x2="${width - padRight}" y2="${y}" stroke="rgba(255,210,170,0.2)" stroke-width="0.5" stroke-dasharray="2,2"/>`;
      }).join('');
      
      const yLabels = yValues.map(val => {
        const y = padTop + chartHeight - (val / yMax) * chartHeight;
        const label = val === 0 ? '0"' : val.toFixed(2) + '"';
        return `<text x="${padLeft - 6}" y="${y + 3}" text-anchor="end" class="chart-axis-label">${label}</text>`;
      }).join('');

      // X-axis labels
      const xLabels = [0, 6, 12, 18, 23].map(idx => {
        const x = padLeft + (idx / (precip.length - 1)) * chartWidth;
        const hour = idx === 23 ? '24' : String(idx).padStart(2, '0');
        return `<text x="${x}" y="${height - 6}" text-anchor="middle" class="chart-axis-label">${hour}:00</text>`;
      }).join('');

      // Check if there's any precipitation
      const hasPrecip = precip.some(p => p > 0);
      const noPrecipText = !hasPrecip ? 
        `<text x="${padLeft + chartWidth/2}" y="${padTop + chartHeight/2 + 4}" text-anchor="middle" class="chart-no-data">No precipitation expected</text>` : '';

      return `
        <svg class="hourly-chart precip-chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
          ${gridLines}
          ${bars}
          ${noPrecipText}
          ${yLabels}
          ${xLabels}
        </svg>
      `;
    }

    metricHtml(label, value, icon, valueId) {
      const idAttr = valueId ? ` id="${valueId}"` : '';
      return `
        <div class="comm-weather-metric">
          <div class="metric-icon">${icon}</div>
          <div class="metric-text">
            <span class="label">${escapeHtml(label)}</span>
            <span class="value"${idAttr}>${escapeHtml(value)}</span>
          </div>
        </div>
      `;
    }

    renderForecast() {
      if (!this.forecast?.time) return '';

      const days = this.forecast.time;
      const highs = this.forecast.temperature_2m_max || [];
      const lows = this.forecast.temperature_2m_min || [];
      const codes = this.forecast.weathercode || [];
      const pop = this.forecast.precipitation_probability_max || [];
      const winds = this.forecast.windspeed_10m_max || [];

      // Start from index 1 (tomorrow) and get 9 days
      const items = days.slice(1, 10).map((dateStr, idx) => {
        const actualIdx = idx + 1;
        const parts = String(dateStr).split('-');
        let dt;
        if (parts.length === 3) {
          dt = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        } else {
          dt = new Date(dateStr);
        }

        const dayLabel = dt.toLocaleDateString(undefined, { weekday: 'short' });
        const dateLabel = dt.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
        const mainWeather = this.weatherCodeToMain(codes[actualIdx]);
        const icon = this.getWeatherIcon(mainWeather);
        const high = highs[actualIdx];
        const low = lows[actualIdx];
        const highDisplay = high != null ? this.formatTempValue(high) : '—';
        const lowDisplay = low != null ? this.formatTempValue(low) : '—';

        const avgTemp = high != null ? high : null;
        const cardGradient = this.tempToGradient(avgTemp, this.tempUnit);
        const cardBorder = this.tempToBorder(avgTemp, this.tempUnit);

        const details = [];
        if (pop[actualIdx] != null && pop[actualIdx] > 0) details.push(`${pop[actualIdx]}%`);
        if (winds[actualIdx] != null) details.push(`${Math.round(winds[actualIdx])} mph`);
        const detail = details.join(' · ');

        return `
          <div class="forecast-card" style="background: ${cardGradient}; border-color: ${cardBorder};">
            <div class="forecast-day">${escapeHtml(dayLabel)}</div>
            <div class="forecast-date">${escapeHtml(dateLabel)}</div>
            <div class="forecast-icon">${icon}</div>
            <div class="forecast-temps"><span>${escapeHtml(highDisplay)}</span><span>${escapeHtml(lowDisplay)}</span></div>
            ${detail ? `<div class="forecast-detail">${escapeHtml(detail)}</div>` : ''}
          </div>
        `;
      }).join('');

      if (!items) return '';

      return `
        <div class="weather-forecast">
          <div class="forecast-head">9-Day Outlook</div>
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
      if (temp == null || isNaN(temp)) return '--';
      return `${Math.round(temp)}°`;
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

  window.CommDashboard.WeatherCard = WeatherCard;

})();
