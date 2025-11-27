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

app.listen(PORT, () => {
  console.log(`Weather proxy running on port ${PORT}`);
});
