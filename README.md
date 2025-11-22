# 📺 **RussellTV**
*A lightweight, self-hosted livestream & news dashboard powered by HLS, YouTube Live, and automated RSS aggregation.*

![RussellTV Screenshot](docs/assets/russelltv-screenshot.png)
> *(Replace the screenshot above with your actual PNG image.)*

---

## ⭐ Features

### 🎥 **Multi-Source Livestream Viewer**
- Supports **HLS (.m3u8)** streams (CBS, NBC, FOX OTA rebroadcasts)
- Supports **YouTube Live** streams (Bloomberg, Sky News, TRT World, etc.)
- Automatic quality handling via **HLS.js** and YouTube IFrame API

### 📰 **Integrated Headline Feeds**
- Per-channel top headlines
- Marine Corps top stories sidebar
- Fire-style hover highlights
- Cached locally for fast loading

### 🖥️ **Two Viewing Modes**
- **Single View:** Large player + headlines
- **Grid Mode:** Watch four channels simultaneously

### 📱 **Mobile-Friendly**
- Auto-scroll ticker bar  
- Mobile-optimized controls  
- Smooth channel switching

### ⚡ **Fully Local System**
- No cloud dependencies  
- All RSS → JSON processed locally  
- Easy to extend with new channels  

---

## 📂 Project Structure

```
tv/
│
├── index.html                 # Main application UI
├── background.png             # Wallpaper
├── favicon.png                # Browser icon
│
├── config/
│   ├── channels.js            # Stream definitions (HLS, YouTube)
│   ├── news-config.js         # Headline → JSON mapping
│   ├── time-config.js         # Footer time zones
│   ├── weather-config.js      # Weather API config
│   └── info-bar.js            # Time + weather + ticker logic
│
├── js/
│   ├── news.js                # Sidebar headline loader
│   └── (future: player.js)    # Stream player logic (optional split)
│
├── scripts/
│   ├── news-fetch.sh          # Cron-safe RSS fetcher
│   └── rss-to-json.py         # Converts RSS → JSON
│
├── news-cache/                # Local headline cache (ignored by Git)
│
└── docs/
    ├── ADDING_CHANNELS.md     # How to add new channels
    └── assets/
        └── russelltv-screenshot.png
```

---

## 🚀 Installation

### **Clone the repo locally**

```
git clone https://github.com/russellmarine/tv
cd tv
```

### **Deploy to your web server**
RussellTV is a static web app:

- Works on Apache
- Works on Nginx
- Works on Caddy
- Works on any simple file server

Just copy the repo into your document root:

```
/var/www/russelltv
```

Make sure your web server serves this directory publicly.

---

## 📰 Automated RSS Fetching

The news system uses two scripts:

### **1. `scripts/news-fetch.sh`**
- Downloads each RSS feed  
- Converts it to JSON via `rss-to-json.py`  
- Writes into `/news-cache/`  

### **2. `scripts/rss-to-json.py`**
- Parses RSS / XML / Atom  
- Normalizes into a consistent JSON structure  
- Outputs clean titles, URLs, timestamps, and source labels  

### **Cron Example**

Add this:

```
*/20 * * * * /usr/local/bin/news-fetch.sh
```

This keeps all headlines fresh every 20 minutes.

---

## 🛠️ Adding New Channels

See:

```
docs/ADDING_CHANNELS.md
```

This guide walks you through:

- Adding YouTube or HLS streams  
- Adding a button + mobile dropdown support  
- Adding headline JSON support  
- Adding an RSS source  
- Testing & verification  

---

## 🔧 Customization

You can customize:

- Background image  
- Channel ordering  
- Grid layout size (4, 6, 9 windows, etc.)  
- Info bar colors  
- Mobile behavior  
- Hover color effects  

If you want a fully customizable “theme system,” I can generate one.

---

## 🧩 Roadmap (Optional Features)

Here are features we can easily add if you want them:

- 🔴 **Live channel icons in the menu**
- 🌐 **EPG (program schedule) integration**
- 🎨 **Theme switcher (Dark/Fire/Blue)**
- 📺 **Picture-in-picture support**
- 📡 **Automatic stream failover**
- 🔐 **Password-protected channels**
- 🚀 **GitHub → LXC auto-deploy pipeline**

Just say the word and I’ll generate the code.

---

## 🤝 Contributing

If you want others to help, this section works as a starting point:

1. Fork the repo  
2. Create a feature branch  
3. Commit changes  
4. Submit a pull request  

RussellTV is intentionally simple, readable, and modular — easy for anyone to extend.

---

## 📜 License

This project is licensed under the **MIT License**, meaning:

- You may copy, modify, and distribute  
- Attribution recommended but not required  

I can add the `LICENSE` file if you want.

---

## 📬 Contact

For questions, improvements, or extensions, reach out through GitHub issues — or just ask ChatGPT and we’ll continue building RussellTV into the ultimate command center dashboard.
