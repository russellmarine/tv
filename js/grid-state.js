// Remember per-cell grid selections in Grid view.
// This runs after the main inline script and reuses existing DOM + playGridCell().
(function () {
  const GRID_STORAGE_KEY = 'russelltv.gridSelections';

  function loadSelections() {
    try {
      const raw = localStorage.getItem(GRID_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (e) {
      return {};
    }
  }

  function saveSelection(cell, key) {
    try {
      const raw = localStorage.getItem(GRID_STORAGE_KEY);
      const map = raw ? JSON.parse(raw) : {};
      map[String(cell)] = key;
      localStorage.setItem(GRID_STORAGE_KEY, JSON.stringify(map));
    } catch (e) {
      // ignore storage errors
    }
  }

  function applySelections() {
    const gridView = document.getElementById('grid-view');
    if (!gridView) return;

    const saved = loadSelections();

    for (let cell = 1; cell <= 4; cell++) {
      const selector = gridView.querySelector('select[data-cell="' + cell + '"]');
      if (!selector) continue;

      const key = saved[String(cell)];
      if (!key) continue;

      // Set the dropdown value to the saved channel
      selector.value = key;

      // Ask the existing code to actually play that channel in this cell
      if (typeof window.playGridCell === 'function') {
        window.playGridCell(cell, key);
      }
    }
  }

  function hookChanges() {
    const gridView = document.getElementById('grid-view');
    if (!gridView) return;

    const selects = gridView.querySelectorAll('select[data-cell]');
    selects.forEach((sel) => {
      sel.addEventListener('change', (e) => {
        const cell = parseInt(e.target.dataset.cell, 10);
        const key = e.target.value;
        if (!cell || !key) return;
        saveSelection(cell, key);
      });
    });
  }

  window.addEventListener('load', function () {
    try {
      applySelections();
      hookChanges();
    } catch (e) {
      console.warn('grid-state.js error', e);
    }
  });
})();
