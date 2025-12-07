(function () {
  'use strict';

  // Only set this if nothing else has defined it yet
  window.TIME_ZONES = window.TIME_ZONES || {
    zulu:   { label: 'Zulu',   tz: 'UTC' },
    local:  { label: 'Local',  tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' }
  };
})();
