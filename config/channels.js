/**
 * Channel config for Russell TV
 * Edit this file to add/remove channels.
 */

window.STREAMS = {
  cbs: "/channels/cbs/hls/stream.m3u8",
  nbc: "/channels/nbc/hls/stream.m3u8",
  fox: "/channels/fox/hls/stream.m3u8",
  // New: TRT World (remote HLS)
  trt: "https://tv-trtworld.live.trt.com.tr/master.m3u8"
};

window.YT_CHANNELS = {
  bloomberg: "https://www.youtube.com/embed/iEpJwprxDdk?autoplay=1&mute=1",
  foxnation: "https://www.youtube.com/embed/4nMfRpesYfw?autoplay=1&mute=1",
  skynews:   "https://www.youtube.com/embed/YDvsBbKfLPA?autoplay=1&mute=1",
  france24:  "https://www.youtube.com/embed/Ap-UM1O9RBU?autoplay=1&mute=1",
  dw:        "https://www.youtube.com/embed/LuKwFajn37U?autoplay=1&mute=1",
  gijoe:     "https://www.youtube.com/embed/TZ3mxF4U__k?autoplay=1&mute=1",
  euronews:  "https://www.youtube.com/embed/pykpO5kQJ98?autoplay=1&mute=1",
  aljazeera: "https://www.youtube.com/embed/gCNeDWCI0vo?autoplay=1&mute=1",
  abc:       "https://www.youtube.com/embed/iipR5yUp36o?autoplay=1&mute=1"
};

window.CHANNELS = {
  cbs:       { type: "hls", label: "CBS 2.1",       url: window.STREAMS.cbs },
  nbc:       { type: "hls", label: "NBC 4.1",       url: window.STREAMS.nbc },
  fox:       { type: "hls", label: "FOX 5.1",       url: window.STREAMS.fox },
  abc:       { type: "yt",  label: "ABC News",      url: window.YT_CHANNELS.abc },
  bloomberg: { type: "yt",  label: "Bloomberg",     url: window.YT_CHANNELS.bloomberg },
  foxnation: { type: "yt",  label: "Fox Nation",    url: window.YT_CHANNELS.foxnation },
  skynews:   { type: "yt",  label: "Sky News",      url: window.YT_CHANNELS.skynews },
  france24:  { type: "yt",  label: "France 24",     url: window.YT_CHANNELS.france24 },
  dw:        { type: "yt",  label: "DW",            url: window.YT_CHANNELS.dw },
  gijoe:     { type: "yt",  label: "GI Joe",        url: window.YT_CHANNELS.gijoe },
  euronews:  { type: "yt",  label: "Euronews",      url: window.YT_CHANNELS.euronews },
  aljazeera: { type: "yt",  label: "Al Jazeera",    url: window.YT_CHANNELS.aljazeera },
  trt:       { type: "hls", label: "TRT World",     url: window.STREAMS.trt }
};

window.CHANNEL_ORDER = [
  "cbs",
  "nbc",
  "fox",
  "abc",
  "bloomberg",
  "foxnation",
  "skynews",
  "france24",
  "dw",
  "gijoe",
  "euronews",
  "aljazeera",
  "trt"
];

window.GRID_DEFAULTS = {
  1: "cbs",
  2: "nbc",
  3: "fox",
  4: "bloomberg"
};
