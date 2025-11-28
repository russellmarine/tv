#!/bin/bash
set -euo pipefail
OUT_DIR="/var/www/russelltv/news-cache"
RSS_PY="/usr/local/bin/rss-to-json.py"
mkdir -p "$OUT_DIR"

run() {
  local name="$1"
  local url="$2"
  local source="$3"
  local limit="${4:-10}"
  echo "[rss-fetch] ${name} <- ${url}"
  if ! "$RSS_PY" "$url" "$source" "$limit" >"${OUT_DIR}/${name}.json".tmp 2>/dev/null; then
    echo "[rss-fetch] ERROR fetching ${name} from ${url}" >&2
    rm -f "${OUT_DIR}/${name}.json".tmp
    return
  fi
  mv "${OUT_DIR}/${name}.json".tmp "${OUT_DIR}/${name}.json"
}

echo "[rss-fetch] Starting RSS fetch run..."

# ----- LOCAL BROADCASTS (NY AFFILIATES APPROX) -----
# CBS New York
run "cbs-ny"  "https://www.cbsnews.com/latest/rss/main"             "CBS News"           10

# NBC via Google News (UPDATED - FRESH!)
run "nbc-ny"  "https://news.google.com/rss/search?q=site:nbcnews.com&hl=en-US&gl=US&ceid=US:en"  "NBC News"  10

# Fox US (for local-ish 5.1)
run "fox-ny"  "https://moxie.foxnews.com/google-publisher/us.xml"   "Fox News (US)"      10

# ABC national
run "abc"     "https://abcnews.go.com/abcnews/topstories"           "ABC News"           10

# ----- GLOBAL NEWS CHANNELS -----
# Bloomberg via Google News search (no clean direct RSS but fresh)
run "bloomberg" "https://news.google.com/rss/search?q=Bloomberg+market+news+finance+stocks&hl=en-US&gl=US&ceid=US:en" "Bloomberg (via Google News)" 10

run "skynews"   "https://feeds.skynews.com/feeds/rss/home.xml"      "Sky News"           10

# France 24 (Europe feed)
run "france24"  "https://www.france24.com/en/europe/rss"            "France 24 English"  10

# DW: Atom feed
run "dw"        "https://rss.dw.com/atom/rss-en-all"                "DW / Deutsche Welle" 10

run "euronews"  "https://www.euronews.com/rss?format=mrss&level=theme&name=news" "Euronews" 10

run "aljazeera" "https://www.aljazeera.com/xml/rss/all.xml"         "Al Jazeera English" 10

# AsiaOne regional
run "asiaone"   "https://asiaone24.rssing.com/chan-61444450/index-latest.php" "AsiaOne" 10

# Fox Nation "national" feed
run "fox-news"  "https://moxie.foxnews.com/google-publisher/latest.xml" "Fox News"       10

# TRT World "global headlines" feed
run "trt-world" "https://www.trtworld.com/feed/rss.xml"             "TRT World"          10

# GI Joe fun feed via Google News
run "gi-joe"    "https://news.google.com/rss/search?q=%22G.I.+Joe%22+OR+%22GI+Joe%22&hl=en-US&gl=US&ceid=US:en" "GI Joe (via Google News)" 10

# ----- MARINE CORPS NEWS (via Google News) -----
run "marines"   "https://news.google.com/rss/search?q=%22United+States+Marine+Corps%22+OR+%22US+Marine+Corps%22&hl=en-US&gl=US&ceid=US:en" "United States Marine Corps" 10

echo "[rss-fetch] Done."
