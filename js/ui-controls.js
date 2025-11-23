/**
 * ui-controls.js - UI control management
 * Handles channel buttons, dropdowns, and user interactions
 */

window.RussellTV = window.RussellTV || {};

window.RussellTV.UIControls = (function() {
  'use strict';

  const headerBtnContainer = document.getElementById('dynamic-buttons');

  function buildChannelButtons() {
    if (!window.CHANNEL_ORDER || !window.CHANNELS || !headerBtnContainer) return;

    headerBtnContainer.innerHTML = '';

    window.CHANNEL_ORDER.forEach(key => {
      const channel = window.CHANNELS[key];
      if (!channel) return;

      const btn = document.createElement('button');
      btn.id = `btn-${key}`;
      btn.className = 'btn';
      btn.textContent = channel.label;
      btn.dataset.channelKey = key;

      btn.addEventListener('click', () => {
        if (window.RussellTV.ViewManager) {
          window.RussellTV.ViewManager.showSingle(key);
        }
      });

      headerBtnContainer.appendChild(btn);
    });
  }

  function highlightButton(key) {
    clearButtonHighlights();
    if (!key) return;

    const btn = document.getElementById(`btn-${key}`);
    if (btn) {
      btn.classList.add('active');
    }
  }

  function clearButtonHighlights() {
    if (!headerBtnContainer) return;
    headerBtnContainer
      .querySelectorAll('.btn')
      .forEach(btn => btn.classList.remove('active'));
  }

  function buildGrid() {
    const wrapper = document.querySelector('#grid-view .grid-wrapper');
    if (!wrapper) return;

    wrapper.innerHTML = '';

    for (let cell = 1; cell <= 4; cell++) {
      const div = document.createElement('div');
      div.className = 'grid-cell';
      div.dataset.cell = cell;

      // Header with dropdown
      const header = document.createElement('div');
      header.className = 'grid-header';

      const label = document.createElement('div');
      label.className = 'grid-label';
      label.id = `label-cell-${cell}`;
      header.appendChild(label);

      const select = document.createElement('select');
      select.className = 'grid-select';
      select.dataset.cell = cell;

      // Populate dropdown with channels
      Object.keys(window.CHANNELS || {}).forEach(key => {
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = window.CHANNELS[key].label;
        select.appendChild(opt);
      });

      select.addEventListener('change', (e) => {
        const cellNum = parseInt(e.target.dataset.cell, 10);
        const channelKey = e.target.value;
        if (window.RussellTV.GridPlayer) {
          window.RussellTV.GridPlayer.playCell(cellNum, channelKey);
        }
      });

      header.appendChild(select);
      div.appendChild(header);

      // Body with video
      const body = document.createElement('div');
      body.className = 'grid-body';

      const frame = document.createElement('div');
      frame.className = 'grid-frame';

      const video = document.createElement('video');
      video.id = `grid-video-${cell}`;
      video.autoplay = true;
      video.muted = true;
      video.controls = true;
      video.playsInline = true;
      video.setAttribute('playsinline', '');

      frame.appendChild(video);
      body.appendChild(frame);
      div.appendChild(body);

      wrapper.appendChild(div);
    }
  }

  // Public API
  return {
    buildChannelButtons,
    buildGrid,
    highlightButton,
    clearButtonHighlights
  };
})();
