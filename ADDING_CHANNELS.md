# 📺 **RussellTV — Adding a New Channel**
*A complete guide for adding video streams + headlines + mobile support*

<img width="1700" height="1108" alt="image" src="https://github.com/user-attachments/assets/50451c3f-4d4a-41a5-bdff-0d4f0f5c78f0" />


---

## 📌 Overview

Adding a new channel to RussellTV requires updating **three** core systems:

1. 🎥 **Streaming Configuration** (`channels.js`)  
2. 📰 **Headline Configuration** (`news-config.js`)  
3. 🧩 **RSS Fetch Pipeline** (`news-fetch.sh` + `rss-to-json.py`)

Once these are updated, the channel instantly appears:

- on desktop buttons  
- in the mobile dropdown  
- in Single View  
- in Grid Mode  
- with its own headline feed in the sidebar  

This guide walks you through the exact steps.

---

# 1️⃣ Add the Video Stream  
**File:** `config/channels.js`

Channels live inside these objects:

- `window.YT_CHANNELS` — for YouTube live streams  
- `window.STREAMS` — for HLS (`.m3u8`) streams  
- `window.CHANNELS` — master list of channels  
- `window.CHANNEL_ORDER` — controls button/dropdown order  

---

## **A. YouTube Channel Example (TRT World)**

**1. Add the YouTube embed link:**

```js
window.YT_CHANNELS.trt = "https://www.youtube.com/embed/nuunj2Gpcrg?autoplay=1&mute=1";
```

**2. Register the channel:**

```js
window.CHANNELS.trt = {
  type: "yt",
  label: "TRTR World",
  url: window.YT_CHANNELS.trt
};
```

---

## **B. HLS Channel Example**

```js
window.STREAMS.trt = "/channels/trt/hls/stream.m3u8";

window.CHANNELS.trt = {
  type: "hls",
  label: "TRT World",
  url: window.STREAMS.trt
};
```

---

## **C. Add the Channel to the Order List**

```js
window.CHANNEL_ORDER = [
  "cbs",
  "nbc",
  "fox",
  "trt",       // 👈 Added here
  "abc",
  "bloomberg",
  "foxnation",
  "skynews",
  "france24",
  "dw",
  "gijoe",
  "euronews",
  "aljazeera"
];
```

This controls:

- Desktop buttons  
- Mobile dropdown options  

---

# 2️⃣ Add Channel Headlines  
**File:** `config/news-config.js`

Each channel maps to a JSON file produced by the fetch script.

Add:

```js
trt: {
  label: "TRT World – Global Headlines",
  file: "trt-world.json"
}
```

This ensures that selecting the TRT channel loads the matching headline file from:

```
/news-cache/trt-world.json
```

---

# 3️⃣ Add the RSS Source  
**File:** `scripts/news-fetch.sh`

Since TRT does not expose a public RSS reliably, we use Google News RSS (you already use this pattern for Bloomberg, GI Joe, etc).

Add this line under **GLOBAL NEWS CHANNELS**:

```bash
# TRT World – global headlines (via Google News)
run "trt-world" \
  "https://news.google.com/rss/search?q=%22TRT+World%22+world+news&hl=en-US&gl=US&ceid=US:en" \
  "TRT World (via Google News)" \
  10
```

This automatically generates:

```
news-cache/trt-world.json
```

Every time the fetch script runs (cron or manual).

---

# 4️⃣ Fetch & Verify the Feed

Run the fetch script manually after adding TRT:

```bash
/usr/local/bin/news-fetch.sh
```

Verify JSON output:

```bash
ls news-cache | grep trt
head -c 400 news-cache/trt-world.json; echo
```

If `"status": "ok"` appears — it’s working.

---

# 5️⃣ Pull & Refresh

On the server:

```bash
cd /var/www/russelltv
git pull
```

Then in your browser:

- **Desktop:** `Ctrl + Shift + R`
- **Mobile:** Clear cache or open in a private tab  

You should now see:

- TRT button (desktop)  
- TRT in mobile dropdown  
- TRT in Grid mode  
- TRT headlines in the sidebar  

---

# 🎉 Done!

You have successfully added a fully functioning channel to RussellTV.
