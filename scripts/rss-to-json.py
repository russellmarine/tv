#!/usr/bin/env python3
import sys
import json
import html
from datetime import datetime
from html.parser import HTMLParser
from urllib import request, error
import xml.etree.ElementTree as ET


class MLStripper(HTMLParser):
    def __init__(self):
        super().__init__()
        self._buf = []

    def handle_data(self, d):
        self._buf.append(d)

    def get_data(self):
        return "".join(self._buf)


def strip_tags(text):
    if not text:
        return ""
    s = MLStripper()
    s.feed(text)
    return s.get_data()


def clean_google_title(title: str) -> str:
    if not title:
        return title
    # Google News style: "Headline - Source"
    parts = title.rsplit(" - ", 1)
    if len(parts) == 2 and len(parts[1]) < 60:
        return parts[0]
    return title


def fetch_xml(url: str) -> bytes:
    ua = (
        "Mozilla/5.0 (X11; Linux x86_64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0 Safari/537.36"
    )
    req = request.Request(url, headers={"User-Agent": ua})
    with request.urlopen(req, timeout=15) as resp:
        return resp.read()


def find_first_text(node: ET.Element, suffixes):
    """
    Find first non-empty text in any descendant whose tag ends with one of suffixes.
    suffixes should be lowercase, like ['title', 'description'].
    """
    for e in node.iter():
        tag = e.tag
        if not isinstance(tag, str):
            continue
        low = tag.lower()
        if any(low.endswith(suf) for suf in suffixes):
            txt = (e.text or "").strip()
            if txt:
                return txt
    return ""


def extract_link(node: ET.Element) -> str:
    # Try Atom-style <link href="...">
    for e in node.iter():
        tag = e.tag
        if not isinstance(tag, str):
            continue
        low = tag.lower()
        if low.endswith("link"):
            href = e.attrib.get("href")
            if href:
                return href.strip()
    # Fallback: RSS-style <link>text</link>
    txt = find_first_text(node, ["link"])
    return txt


def parse_feed(xml_bytes: bytes, default_source_name: str, limit: int, is_google_url: bool):
    root = ET.fromstring(xml_bytes)

    # Prefer RSS <item>, else Atom <entry>
    items = root.findall(".//item")
    if not items:
        items = root.findall(".//{*}entry")

    articles = []

    for item in items[:limit]:
        raw_title = find_first_text(item, ["title"])
        title = (raw_title or "").strip()

        link = extract_link(item)

        # Description / summary content
        raw_summary = find_first_text(
            item, ["description", "summary", "encoded", "content"]
        )
        summary = strip_tags(raw_summary).strip()

        # Published / updated
        published = find_first_text(
            item, ["pubdate", "published", "updated", "dc:date"]
        )

        # Try to get per-article source name (Google News, etc.)
        per_article_source = strip_tags(find_first_text(item, ["source"])) or ""
        src_name = per_article_source.strip() or default_source_name

        # Google News cleanup on the title
        if is_google_url or "news.google.com" in (link or ""):
            title = clean_google_title(title)

        # Unescape HTML entities
        title = html.unescape(title)
        summary = html.unescape(summary)
        src_name = html.unescape(src_name)

        # Drop summary if it's basically just the title repeated
        norm_title = (title or "").strip()
        norm_summary = (summary or "").strip()
        if norm_title and norm_summary:
            if norm_summary == norm_title:
                summary = ""
            elif norm_summary.startswith(norm_title):
                tail = norm_summary[len(norm_title):].lstrip(" -–:•\u00a0")
                if len(tail) <= 60:
                    summary = ""

        article = {
            "source": {"id": None, "name": src_name},
            "author": None,
            "title": title or "(no title)",
            "description": summary,
            "url": link or "",
            "urlToImage": None,
            "publishedAt": (published or "").strip(),
            "content": None,
        }
        articles.append(article)

    return articles


def main():
    if len(sys.argv) < 3:
        print(
            f"Usage: {sys.argv[0]} <rss_url> <source_name> [limit]",
            file=sys.stderr,
        )
        sys.exit(1)

    url = sys.argv[1]
    source_name = sys.argv[2]
    limit = int(sys.argv[3]) if len(sys.argv) > 3 else 10

    try:
        xml_bytes = fetch_xml(url)
    except error.HTTPError as e:
        print(f"[rss-to-json] HTTP error fetching {url}: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"[rss-to-json] ERROR fetching {url}: {e}", file=sys.stderr)
        sys.exit(1)

    try:
        is_google = "news.google.com" in url
        articles = parse_feed(xml_bytes, source_name, limit, is_google)
    except Exception as e:
        print(f"[rss-to-json] ERROR parsing {url}: {e}", file=sys.stderr)
        sys.exit(1)

    out = {
        "status": "ok",
        "fetchedAt": datetime.utcnow().isoformat() + "Z",
        "totalResults": len(articles),
        "articles": articles,
    }
    print(json.dumps(out, ensure_ascii=False))


if __name__ == "__main__":
    main()
