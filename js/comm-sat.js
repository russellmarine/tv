(function () {
  "use strict";

  window.RussellTV = window.RussellTV || {};

  const state = {
    els: {}
  };

  function init() {
    const card = document.getElementById("comm-card-satcom");
    if (!card) return;

    state.els.card = card;
    state.els.status = document.getElementById("comm-sat-status");
    state.els.summary = document.getElementById("comm-sat-summary");

    console.log("[CommSat] SATCOM card ready");
  }

  function setStatus(text) {
    if (state.els.status) {
      state.els.status.textContent = text;
    }
  }

  function setSummary(html) {
    if (state.els.summary) {
      state.els.summary.innerHTML = html;
    }
  }

  function refreshForLocation(loc) {
    if (!loc) return;
    init();

    setStatus("Ready");
    setSummary(`
      <div class="comm-sat-placeholder">
        <p>Location locked for SATCOM planning.</p>
        <p><strong>Lat:</strong> ${loc.lat.toFixed(4)}, <strong>Lon:</strong> ${loc.lon.toFixed(4)}</p>
        <p>Next step: wire to satellite-lookangles.js for real look angles.</p>
      </div>
    `);

    console.log("[CommSat] refreshForLocation", loc);
  }

  window.RussellTV.CommSat = {
    refreshForLocation
  };

  document.addEventListener("DOMContentLoaded", init);
})();
