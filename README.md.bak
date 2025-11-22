📄 ADDING_CHANNELS.md
How to Add a New Channel to RussellTV

This guide explains the full process for adding a new streaming channel to RussellTV, including:

Button & dropdown support (desktop + mobile)

Video playback support (HLS or YouTube)

News headline integration (RSS → JSON → sidebar)

Grid view integration

✔️ Overview

Every channel in RussellTV touches four places:

/config/channels.js — defines the channel (HLS or YouTube)

/config/news-config.js — defines the matching news JSON file

/usr/local/bin/news-fetch.sh — fetches RSS and writes JSON

/news-cache/*.json — output of the fetch script (auto-generated)

Once all three configs are updated, the channel appears automatically on:

Desktop channel buttons

Mobile channel dropdown

Single view

Grid view

Sidebar headlines

1️⃣ Add the Channel Stream (Video Feed)

Edit:

config/channels.js

If the channel uses YouTube

Add the embed URL in window.YT_CHANNELS:

window.YT_CHANNELS.trt = "https://www.youtube.com/embed/nuunj2Gpcrg?autoplay=1&mute=1";


Add the channel entry in window.CHANNELS:

window.CHANNELS.trt = {
  type: "yt",
  label: "TRT World",
  url: window.YT_CHANNELS.trt
};

If the channel uses HLS (.m3u8)

Add the stream in window.STREAMS:

window.STREAMS.trt = "/channels/trt/hls/stream.m3u8";


Then define the channel:

window.CHANNELS.trt = {
  type: "hls",
  label: "TRT World",
  url: window.STREAMS.trt
};

2️⃣ Add the Channel to the Order List

Still in:

config/channels.js


Find:

window.CHANNEL_ORDER = [ ... ];


Add "trt" wherever you want it to appear:

window.CHANNEL_ORDER = [
  "cbs",
  "nbc",
  "fox",
  "trt",      // 👈 Added
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


This controls:

Desktop buttons

Mobile dropdown ordering

3️⃣ Enable Headlines for the Channel

Edit:

config/news-config.js


Add a matching block (file must match the JSON output name):

trt: {
  label: "TRT World – Global Headlines",
  file: "trt-world.json"
}

4️⃣ Add the Channel’s RSS Feed to the Fetch Script

Edit:

scripts/news-fetch.sh


Add a run line.
If the channel has no official RSS, use a Google News RSS search (works great):

run "trt-world" \
  "https://news.google.com/rss/search?q=%22TRT+World%22+world+news&hl=en-US&gl=US&ceid=US:en" \
  "TRT World (via Google News)" \
  10


If the channel does have an RSS feed, use that instead:

run "trt-world" "https://example.com/rss" "TRT World" 10


This creates:

/var/www/russelltv/news-cache/trt-world.json

5️⃣ Run the Fetch Script

SSH into the server:

/usr/local/bin/news-fetch.sh


Verify the file:

ls news-cache | grep trt
head -c 400 news-cache/trt-world.json; echo


If you see JSON with "status": "ok" — you’re good.

6️⃣ Pull Changes and Reload the Site

On the server:

cd /var/www/russelltv
git pull


Then reload the site in the browser:

Desktop: Ctrl + Shift + R

Mobile: Hard refresh or clear cache

🚀 Channel Is Now Fully Integrated

You should now see:

A new desktop button

A new mobile dropdown option

The channel loads in Single View

It is selectable in Grid View

Sidebar shows TRT Headlines fetched nightly

🧩 Troubleshooting
Channel button appears, but headlines don’t?

Check /news-cache/trt-world.json

Make sure news-fetch.sh created it

Ensure filename matches file: in news-config.js

Headlines appear, but channel doesn’t load?

Check stream URL (YouTube embed vs. m3u8)

Ensure "trt" exists in both:

window.CHANNELS

window.CHANNEL_ORDER

Mobile dropdown missing TRT?

Clear cache (mobile browsers are stubborn)

Ensure window.CHANNELS.trt exists

Ensure window.CHANNEL_ORDER includes "trt"

🎉 Done!

Your channel is now fully wired into all parts of RussellTV.
