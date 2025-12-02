(function () {
  'use strict';

  const Events = window.RussellTV?.Events;
  if (!Events || typeof L === 'undefined') return;

  const WEATHER_TILE_KEY = window.OPENWEATHER_TILE_KEY || window.OPENWEATHER_API_KEY || '';
  const RADAR_PROXY_BASE = window.RADAR_PROXY_BASE || '/wx-tiles/{z}/{x}/{y}.png';
  const RAINVIEWER_TILE = 'https://tilecache.rainviewer.com/v2/radar/last/{z}/{x}/{y}/2/1_1.png';
  const CELL_API = '/cell';
  const CABLE_URL = 'https://raw.githubusercontent.com/telegeography/www.submarinecablemap.com/master/web/public/api/cable.geo.json';
  const LANDING_URL = 'https://raw.githubusercontent.com/telegeography/www.submarinecablemap.com/master/web/public/api/landing-point.geo.json';
  const IXP_PROXY = window.PEERINGDB_PROXY_BASE || '';

  const toggleBtn = document.getElementById('comm-map-toggle');
  const card = document.getElementById('comm-card-overlay');
  const statusEl = document.getElementById('comm-overlay-status');
  const body = document.getElementById('comm-overlay-body');

  let map = null;
  let baseLayer = null;
  let weatherLayer = null;
  let cellLayer = null;
  let cableLayer = null;
  let landingLayer = null;
  let ixpLayer = null;
  let lastLocation = null;
  let cablesLoaded = false;
  let landingsLoaded = false;
  let ixpLoaded = false;

  function renderShell() {
    if (!body) return;
    body.innerHTML = [
      '<div class="overlay-map-body">',
      '  <div class="overlay-map-controls">',
      '    <label><input type="checkbox" data-layer="weather" checked> Weather</label>',
      '    <label><input type="checkbox" data-layer="cell" checked> Cell towers</label>',
      '    <label><input type="checkbox" data-layer="cables" checked> Undersea cables</label>',
      '    <label><input type="checkbox" data-layer="landing" checked> Landing stations</label>',
      '    <label><input type="checkbox" data-layer="ixp"> IXPs</label>',
      '  </div>',
      '  <div class="overlay-map-frame">',
      '    <div id="comm-overlay-map" class="overlay-map-canvas"></div>',
      '  </div>',
      '  <div class="comm-card-micro comm-card-footer">Sources: OSM · OpenWeather/RainViewer tiles · OpenCellID · TeleGeography submarine cables · PeeringDB (IXP, via proxy)</div>',
      '</div>'
    ].join('');
  }

  function ensureMap(loc) {
    if (!card || card.classList.contains('comm-hidden')) return;
    if (!map) {
      const canvas = document.getElementById('comm-overlay-map');
      if (!canvas) return;
      map = L.map(canvas, { zoomControl: true, attributionControl: false });
      baseLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 12, crossOrigin: true });
      baseLayer.addTo(map);
    }

    const coords = loc?.coords || {};
    const lat = Number(coords.lat) || 0;
    const lon = Number(coords.lon) || 0;
    map.setView([lat, lon], 6);

    refreshOverlays(loc);
    setTimeout(() => map.invalidateSize(), 100);
  }

  function clearLayer(layerRef) {
    if (layerRef && map) map.removeLayer(layerRef);
    return null;
  }

  function buildWeatherLayer() {
    const template = RADAR_PROXY_BASE.includes('{layer}')
      ? RADAR_PROXY_BASE.replace('{layer}', 'precipitation_new')
      : RADAR_PROXY_BASE;
    const url = template || (WEATHER_TILE_KEY
      ? `https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${WEATHER_TILE_KEY}`
      : RAINVIEWER_TILE);
    return L.tileLayer(url, { opacity: 0.55, crossOrigin: true, tileSize: 256, maxZoom: 12, maxNativeZoom: 12 });
  }

  async function buildCellLayer(loc) {
    const coords = loc?.coords || {};
    if (!coords.lat || !coords.lon) return null;
    try {
      const res = await fetch(`${CELL_API}?lat=${coords.lat}&lon=${coords.lon}`);
      if (!res.ok) throw new Error('cell fetch ' + res.status);
      const data = await res.json();
      const towers = Array.isArray(data?.towers) ? data.towers : [];
      const group = L.layerGroup();
      (towers || []).forEach(t => {
        if (!t.lat || !t.lon) return;
        const marker = L.circleMarker([t.lat, t.lon], {
          radius: 6,
          color: '#ffb36b',
          fillColor: '#ff7f2a',
          fillOpacity: 0.7
        }).bindPopup(`<strong>${t.carrier || 'Carrier'}</strong><br>${t.technology || t.radio || 'Tech'} · ${Math.round(t.distance || 0)}m`);
        marker.addTo(group);
      });
      return group;
    } catch (e) {
      console.warn('[CommOverlay] Cell overlay failed', e);
      return null;
    }
  }

  async function buildCableLayers() {
    if (!cablesLoaded) {
      try {
        const res = await fetch(CABLE_URL);
        if (res.ok) {
          const data = await res.json();
          cableLayer = L.geoJSON(data, { color: '#ffa64d', weight: 1, opacity: 0.65 });
        }
        cablesLoaded = true;
      } catch (e) {
        console.warn('[CommOverlay] Cable fetch failed', e);
      }
    }
    if (!landingsLoaded) {
      try {
        const res = await fetch(LANDING_URL);
        if (res.ok) {
          const data = await res.json();
          landingLayer = L.geoJSON(data, {
            pointToLayer: (f, latlng) => L.circleMarker(latlng, { radius: 5, color: '#ffd27a', fillColor: '#ffb14d', fillOpacity: 0.8 })
              .bindPopup(`<strong>${f.properties?.name || 'Landing Station'}</strong>`)
          });
        }
        landingsLoaded = true;
      } catch (e) {
        console.warn('[CommOverlay] Landing fetch failed', e);
      }
    }
  }

  async function buildIxps() {
    if (ixpLoaded || !IXP_PROXY) return;
    try {
      const res = await fetch(IXP_PROXY.replace(/\/$/, '') + '/ix');
      if (res.ok) {
        const data = await res.json();
        const entries = Array.isArray(data?.data) ? data.data : [];
        ixpLayer = L.layerGroup(entries.map(ix => {
          if (!ix.latitude || !ix.longitude) return null;
          return L.circleMarker([ix.latitude, ix.longitude], {
            radius: 4,
            color: '#7fe3ff',
            fillColor: '#35c7ff',
            fillOpacity: 0.7
          }).bindPopup(`<strong>${ix.name}</strong><br>ASN count: ${ix.asn_count || 'n/a'}`);
        }).filter(Boolean));
      }
      ixpLoaded = true;
    } catch (e) {
      console.warn('[CommOverlay] IXP fetch failed', e);
    }
  }

  async function refreshOverlays(loc) {
    if (!map) return;
    const controls = body?.querySelectorAll('.overlay-map-controls input[type="checkbox"]') || [];
    const enabled = {};
    controls.forEach(cb => enabled[cb.dataset.layer] = cb.checked);

    weatherLayer = clearLayer(weatherLayer);
    cellLayer = clearLayer(cellLayer);
    cableLayer = clearLayer(cableLayer);
    landingLayer = clearLayer(landingLayer);
    ixpLayer = clearLayer(ixpLayer);

    if (enabled.weather) {
      weatherLayer = buildWeatherLayer();
      if (weatherLayer) weatherLayer.addTo(map);
    }

    if (enabled.cell) {
      cellLayer = await buildCellLayer(loc);
      if (cellLayer) cellLayer.addTo(map);
    }

    if (enabled.cables || enabled.landing) {
      await buildCableLayers();
      if (enabled.cables && cableLayer) cableLayer.addTo(map);
      if (enabled.landing && landingLayer) landingLayer.addTo(map);
    }

    if (enabled.ixp) {
      await buildIxps();
      if (ixpLayer) ixpLayer.addTo(map);
    }
  }

  function wireControls() {
    body?.addEventListener('change', (ev) => {
      const target = ev.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (!target.dataset.layer) return;
      refreshOverlays(lastLocation);
    });
  }

  function toggleCard(forceState) {
    if (!card) return;
    const showing = !card.classList.contains('comm-hidden');
    const next = forceState !== undefined ? forceState : !showing;
    card.classList.toggle('comm-hidden', !next);
    if (statusEl) statusEl.textContent = next ? 'on' : 'off';
    if (next) {
      renderShell();
      ensureMap(lastLocation);
      wireControls();
    }
    if (window.RussellTV?.CommPlanner?.queueLayout) window.RussellTV.CommPlanner.queueLayout();
  }

  toggleBtn?.addEventListener('click', () => toggleCard());

  Events.on('comm:location-changed', (loc) => {
    lastLocation = loc;
    if (!card || card.classList.contains('comm-hidden')) return;
    ensureMap(loc);
  });

})();
