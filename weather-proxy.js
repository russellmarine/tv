import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config({ path: "/var/www/russelltv/.env" });

const app = express();
const PORT = 4010;

// Simple health check
app.get("/healthz", (req, res) => {
  res.json({ status: "ok" });
});

// /weather?q=Brooklyn,NY,US  OR  /weather?lat=41.49&lon=-81.69
app.get("/weather", async (req, res) => {
  const { q, lat, lon } = req.query;
  
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "No API key configured" });
  }

  let url;
  
  if (lat && lon) {
    // Lat/lon query
    url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=imperial&appid=${apiKey}`;
  } else if (q) {
    // City name query
    url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(q)}&units=imperial&appid=${apiKey}`;
  } else {
    return res.status(400).json({ error: "Missing ?q=cityname or ?lat=XX&lon=YY" });
  }

  try {
    const r = await fetch(url);
    const data = await r.json();
    res.json(data);
  } catch (err) {
    console.error("Weather proxy error:", err);
    res.status(500).json({ error: "Weather fetch failed" });
  }
});

// Radar tile helper (OpenWeather precipitation/clouds tiles)
async function proxyRadarTile(layerRaw, z, x, y, res) {
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) return res.status(500).send("No API key configured");

  const layer = layerRaw === "clouds" || layerRaw === "clouds_new" ? "clouds_new" : "precipitation_new";
  const url = `https://tile.openweathermap.org/map/${layer}/${z}/${x}/${y}.png?appid=${apiKey}`;

  try {
    const r = await fetch(url);
    if (!r.ok) return res.status(r.status).send("Radar unavailable");
    const buf = Buffer.from(await r.arrayBuffer());
    res.set("Content-Type", r.headers.get("content-type") || "image/png");
    res.send(buf);
  } catch (err) {
    console.error("Radar proxy error", err);
    res.status(500).send("Radar fetch failed");
  }
}

// Legacy lat/lon radar helper
app.get("/weather/radar", async (req, res) => {
  const { lat, lon, z, x, y, layer } = req.query;
  const zoom = Number(z) || 6;
  let tileX = x != null ? Number(x) : null;
  let tileY = y != null ? Number(y) : null;

  if ((lat == null || lon == null) && (tileX == null || tileY == null)) {
    return res.status(400).send("Missing lat/lon");
  }

  if (tileX == null || tileY == null) {
    const scale = Math.pow(2, zoom);
    tileX = Math.floor(((Number(lon) + 180) / 360) * scale);
    const latRad = Number(lat) * Math.PI / 180;
    tileY = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * scale);
  }

  return proxyRadarTile(layer, zoom, tileX, tileY, res);
});

// Tile-friendly pattern: /weather/radar/{layer}/{z}/{x}/{y}.png
app.get("/weather/radar/:layer/:z/:x/:y.png", async (req, res) => {
  const { layer, z, x, y } = req.params;
  return proxyRadarTile(layer, Number(z), Number(x), Number(y), res);
});

// Solar cycle proxy to avoid client-side CORS failures
app.get("/spaceweather/solar-cycle", async (_req, res) => {
  const url = "https://services.swpc.noaa.gov/json/solar-cycle/observed-solar-cycle.json";
  try {
    const r = await fetch(url);
    if (!r.ok) return res.status(r.status).send("Solar cycle unavailable");
    const data = await r.json();
    res.json(data);
  } catch (err) {
    console.error("Solar cycle proxy error", err);
    res.status(500).send("Solar cycle fetch failed");
  }
});

app.listen(PORT, () => {
  console.log(`Weather proxy running on port ${PORT}`);
});
