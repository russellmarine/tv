/**
 * Channel config for Russell TV
 * Edit this file to add/remove channels.
 */

window.STREAMS = {
  cbs: "/channels/cbs/hls/stream.m3u8",
  nbc: "/channels/nbc/hls/stream.m3u8",
  fox: "/channels/fox/hls/stream.m3u8"
};

window.YT_CHANNELS = {
  bloomberg: "/yt/bloomberg/index.m3u8",
  foxnation: "/yt/foxnation/index.m3u8",
  skynews:   "/yt/skynews/index.m3u8",
  france24:  "/yt/france24/index.m3u8",
  dw:        "/yt/dw/index.m3u8",
  gijoe:     "/yt/gijoe/index.m3u8",
  euronews:  "/yt/euronews/index.m3u8",
  aljazeera: "/yt/aljazeera/index.m3u8",
  abc:       "/yt/abc/index.m3u8",
  trt:       "/yt/trt/index.m3u8"
};

window.CHANNELS = {
  cbs:       { type: "hls", label: "CBS 2.1",       url: window.STREAMS.cbs },
  nbc:       { type: "hls", label: "NBC 4.1",       url: window.STREAMS.nbc },
  fox:       { type: "hls", label: "FOX 5.1",       url: window.STREAMS.fox },

  bloomberg: { type: "hls", label: "Bloomberg",     url: window.YT_CHANNELS.bloomberg },
  foxnation: { type: "hls", label: "Fox Nation",    url: window.YT_CHANNELS.foxnation },
  skynews:   { type: "hls", label: "Sky News",      url: window.YT_CHANNELS.skynews },
  france24:  { type: "hls", label: "France 24",     url: window.YT_CHANNELS.france24 },
  dw:        { type: "hls", label: "DW",            url: window.YT_CHANNELS.dw },
  gijoe:     { type: "hls", label: "GI Joe",        url: window.YT_CHANNELS.gijoe },
  euronews:  { type: "hls", label: "Euronews",      url: window.YT_CHANNELS.euronews },
  aljazeera: { type: "hls", label: "Al Jazeera",    url: window.YT_CHANNELS.aljazeera },
  abc:       { type: "hls", label: "ABC News",      url: window.YT_CHANNELS.abc },
  trt:       { type: "hls", label: "TRT World",     url: window.YT_CHANNELS.trt }
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
