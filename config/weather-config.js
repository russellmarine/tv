// Weather config for RussellTV (NO API KEY IN FRONTEND)

// Map TIME_ZONES.label -> OpenWeather "q" query
// (city[,state],[country])
window.WEATHER_QUERIES = {
  "6th Comm - Brooklyn, NY":     "Brooklyn,NY,US",
  "Camp Lejeune, NC":            "Jacksonville,NC,US",
  "Camp Pendleton, CA":          "Oceanside,CA,US",   // Pendleton via Oceanside
  "Camp Smith, HI":              "Honolulu,HI,US",
  "Camp Foster, JP":             "Okinawa,JP",
  "MARFORRES - New Orleans, LA": "New Orleans,LA,US",
  "Manama, BH":                  "Manama,BH",
  "Stuttgart, DE":               "Stuttgart,DE",
  "Naples, IT":                  "Naples,IT",
  "Darwin, AU":                  "Darwin,AU"
};

// Helper: fetch weather via secure local proxy at /weather
window.fetchWeather = async function(query) {
  try {
    const r = await fetch(`/weather?q=${encodeURIComponent(query)}`);
    if (!r.ok) {
      console.error("Weather proxy HTTP error:", r.status);
      return null;
    }
    return await r.json();
  } catch (err) {
    console.error("Weather fetch failed", err);
    return null;
  }
};

// -----------------------------------------------
// Weather Underground deep links for each location
// -----------------------------------------------
window.WU_LINKS = {
  "6th Comm - Brooklyn, NY":     "https://www.wunderground.com/weather/us/ny/brooklyn",
  "Camp Lejeune, NC":            "https://www.wunderground.com/weather/us/nc/camp-lejeune",
  "Camp Pendleton, CA":          "https://www.wunderground.com/weather/us/ca/oceanside",
  "Camp Smith, HI":              "https://www.wunderground.com/weather/us/hi/honolulu",
  "Camp Foster, JP":             "https://www.wunderground.com/weather/jp/okinawa",
  "MARFORRES - New Orleans, LA": "https://www.wunderground.com/weather/us/la/new-orleans",
  "Manama, BH":                  "https://www.wunderground.com/weather/bh/manama",
  "Stuttgart, DE":               "https://www.wunderground.com/weather/de/stuttgart",
  "Naples, IT":                  "https://www.wunderground.com/weather/it/naples",
  "Darwin, AU":                  "https://www.wunderground.com/weather/au/darwin"
};
// Note: Zulu intentionally gets NO link → not clickable
