#!/usr/bin/env python3
"""Выгружает раздел «Вопросы с собеседований по годам» со старого сайта (Quartz) в inbox/garden/.

Список страниц берётся из static/contentIndex.json, сами страницы — из HTML,
потому что в плоском тексте индекса теряется вложенность списков (вопрос → уточнения).
Каждая страница сохраняется как markdown: заголовки разделов и вложенные списки.
"""

import json
import re
import sys
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from html.parser import HTMLParser
from pathlib import Path

BASE = "https://interview-garden.vercel.app/"
SECTION = "Вопросы-с-собеседований-по-годам/"
OUT = Path(__file__).resolve().parent.parent / "inbox" / "garden"


class ArticleToMarkdown(HTMLParser):
    """Переводит <article> Quartz в markdown: h1–h4, вложенные ul/ol, абзацы, код."""

    def __init__(self):
        super().__init__()
        self.lines: list[str] = []
        self.buf = ""
        self.depth = 0          # вложенность списков
        self.in_article = False
        self.skip = 0           # внутри svg / якорей заголовков / тегов-ссылок
        self.heading = 0
        self.pre = False

    def flush(self, prefix=""):
        text = re.sub(r"\s+", " ", self.buf).strip() if not self.pre else self.buf.rstrip()
        if text:
            self.lines.append(prefix + text)
        self.buf = ""

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "article":
            self.in_article = True
            return
        if not self.in_article:
            return
        if tag == "svg" or (tag == "a" and ("role" in a and a["role"] == "anchor" or "tag-link" in (a.get("class") or ""))):
            self.skip += 1
            return
        if tag in ("h1", "h2", "h3", "h4"):
            self.flush("  " * max(self.depth - 1, 0) + "- " if self.depth else "")
            self.heading = int(tag[1])
        elif tag in ("ul", "ol"):
            self.flush("  " * max(self.depth - 1, 0) + "- " if self.depth else "")
            self.depth += 1
        elif tag == "li":
            self.flush("  " * max(self.depth - 1, 0) + "- " if self.depth else "")
        elif tag == "pre":
            self.flush()
            self.pre = True
            self.buf = "```\n"
        elif tag == "br":
            self.buf += " "
        elif tag == "code" and not self.pre:
            self.buf += "`"
        elif tag == "img":
            self.buf += f" [картинка: {a.get('alt') or a.get('src', '')}] "

    def handle_endtag(self, tag):
        if not self.in_article:
            return
        if tag == "article":
            self.flush()
            self.in_article = False
            return
        if self.skip and (tag == "svg" or tag == "a"):
            self.skip -= 1
            return
        if tag in ("h1", "h2", "h3", "h4"):
            self.flush("\n" + "#" * self.heading + " ")
            self.heading = 0
        elif tag in ("ul", "ol"):
            self.flush("  " * max(self.depth - 1, 0) + "- ")
            self.depth -= 1
        elif tag == "li":
            self.flush("  " * max(self.depth - 1, 0) + "- ")
        elif tag == "p" and not self.depth:
            self.flush()
        elif tag == "pre":
            self.buf += "\n```"
            self.lines.append(self.buf)
            self.buf = ""
            self.pre = False
        elif tag == "code" and not self.pre:
            self.buf += "`"

    def handle_data(self, data):
        if self.in_article and not self.skip:
            self.buf += data


def fetch(url: str) -> str:
    with urllib.request.urlopen(url, timeout=30) as r:
        return r.read().decode("utf-8")


def scrape(slug: str, meta: dict) -> dict:
    html = fetch(BASE + urllib.parse.quote(slug))
    parser = ArticleToMarkdown()
    parser.feed(html)
    body = "\n".join(parser.lines).strip()
    parts = slug[len(SECTION):].split("/")
    name = "__".join(parts)
    header = [f"# {meta['title']}", "", f"- Путь: {' / '.join(parts)}"]
    if meta.get("tags"):
        header.append(f"- Теги: {', '.join(meta['tags'])}")
    (OUT / f"{name}.md").write_text("\n".join(header) + "\n\n" + body + "\n", encoding="utf-8")
    return {"name": name, "slug": slug, "title": meta["title"], "track": parts[0], "path": parts,
            "tags": meta.get("tags", []), "chars": len(body)}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    index = json.loads(fetch(BASE + "static/contentIndex.json"))
    # Листовые страницы раздела; папки-оглавления (…/index) и пустые заглушки пропускаем
    pages = {k: v for k, v in index.items()
             if k.startswith(SECTION) and not k.endswith("/index") and len(v.get("content", "").strip()) > 60}
    with ThreadPoolExecutor(8) as pool:
        results = list(pool.map(lambda kv: scrape(*kv), sorted(pages.items())))
    (OUT / "pages.json").write_text(json.dumps(results, ensure_ascii=False, indent=1), encoding="utf-8")
    skipped = sorted(k for k, v in index.items() if k.startswith(SECTION) and k not in pages)
    print(f"сохранено {len(results)} страниц в {OUT}; пропущено (пустые/оглавления): {len(skipped)}")
    for k in skipped:
        print("  -", k[len(SECTION):], f"({len(index[k].get('content', '').strip())} симв.)", file=sys.stderr)


if __name__ == "__main__":
    main()
