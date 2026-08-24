#!/usr/bin/env python3
"""Static, dependency-free checks for CloveLearn's public Part 1 pages."""

from __future__ import annotations

from html.parser import HTMLParser
from pathlib import Path
import re
import sys
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parents[1]
PAGES = (
    ROOT / "index.html",
    ROOT / "evidence.html",
    ROOT / "corrections.html",
    ROOT / "relay.html",
    ROOT / "temperance.html",
)
FORBIDDEN_TRACKING = re.compile(
    r"(?:googletagmanager|google-analytics|gtag\s*\(|plausible\.io|hotjar|mixpanel|segment\.com|clarity\.ms)",
    re.I,
)
FORBIDDEN_SALES = re.compile(
    r"(?:donate|donation|paywall|premium\s+truth|upgrade\s+now|buy\s+now|subscribe\s+now)",
    re.I,
)
ACCOUNT_REQUIRED = re.compile(
    r"(?:account|sign\s+in|log\s+in).{0,40}(?:required|to\s+continue|to\s+use)",
    re.I,
)


class PageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.links: list[tuple[str, str, str]] = []
        self.images_without_alt: list[str] = []
        self.scripts: list[str] = []
        self.stylesheets: list[str] = []
        self.titles: list[str] = []
        self.descriptions: list[str] = []
        self.lang: str | None = None
        self.heading_count = 0
        self.positive_tabindexes: list[str] = []
        self._text_stack: list[list[str]] = []
        self.interactive_text: list[tuple[str, str]] = []
        self.ids: set[str] = set()
        self.duplicate_ids: set[str] = set()

    def handle_starttag(self, tag: str, attrs_list: list[tuple[str, str | None]]) -> None:
        attrs = dict(attrs_list)
        if tag == "html":
            self.lang = attrs.get("lang")
        element = f"<{tag}>"
        if tag in {"a", "button"}:
            self._text_stack.append([])
            self.interactive_text.append((element, attrs.get("aria-label") or attrs.get("title") or ""))
        elif self._text_stack:
            self._text_stack[-1].append(element)

        if tag in {"a", "link"} and attrs.get("href"):
            self.links.append((tag, attrs["href"] or "", element))
        if tag == "script" and attrs.get("src"):
            self.scripts.append(attrs["src"] or "")
        if tag == "link" and "stylesheet" in (attrs.get("rel") or "").lower().split():
            if attrs.get("href"):
                self.stylesheets.append(attrs["href"] or "")
        if tag == "img" and not (attrs.get("alt") or "").strip():
            self.images_without_alt.append(element)
        if tag == "meta" and attrs.get("name", "").lower() == "description":
            if attrs.get("content"):
                self.descriptions.append(attrs["content"] or "")
        if tag == "title":
            self._text_stack.append([])
        if tag == "h1":
            self.heading_count += 1
        if attrs.get("tabindex", "").strip().isdigit() and int(attrs["tabindex"] or "0") > 0:
            self.positive_tabindexes.append(element)
        if attrs.get("id"):
            identifier = attrs["id"] or ""
            if identifier in self.ids:
                self.duplicate_ids.add(identifier)
            self.ids.add(identifier)

    def handle_endtag(self, tag: str) -> None:
        if tag == "title" and self._text_stack:
            self.titles.append(" ".join(self._text_stack.pop()).strip())
        elif tag in {"a", "button"} and self._text_stack:
            text = " ".join(self._text_stack.pop()).strip()
            index = len(self.interactive_text) - 1
            element, label = self.interactive_text[index]
            self.interactive_text[index] = (element, " ".join(part for part in (label, text) if part))
        elif self._text_stack:
            self._text_stack[-1].append(f"</{tag}>")

    def handle_data(self, data: str) -> None:
        if self._text_stack and data.strip():
            self._text_stack[-1].append(data.strip())


def local_target(url: str, page: Path) -> Path | None:
    parsed = urlsplit(url)
    if parsed.scheme or parsed.netloc or parsed.path.startswith("#"):
        return None
    path = unquote(parsed.path)
    if not path:
        return None
    candidate = ROOT / path.lstrip("/") if path.startswith("/") else page.parent / path
    if path.endswith("/"):
        candidate /= "index.html"
    return candidate.resolve()


def check_page(page: Path) -> tuple[list[str], int]:
    errors: list[str] = []
    source = page.read_text(encoding="utf-8")
    parser = PageParser()
    parser.feed(source)

    if parser.lang is None:
        errors.append("missing <html lang>")
    if len(parser.titles) != 1 or not parser.titles[0]:
        errors.append("missing or duplicate <title>")
    if len(parser.descriptions) != 1 or not parser.descriptions[0].strip():
        errors.append("missing or duplicate meta description")
    if 'name="viewport"' not in source and "name='viewport'" not in source:
        errors.append("missing viewport metadata")
    if parser.heading_count != 1:
        errors.append(f"expected exactly one h1, found {parser.heading_count}")
    if parser.images_without_alt:
        errors.append(f"images missing alt text: {', '.join(parser.images_without_alt)}")
    if parser.positive_tabindexes:
        errors.append("positive tabindex values undermine keyboard order")
    if parser.duplicate_ids:
        errors.append(f"duplicate ids: {', '.join(sorted(parser.duplicate_ids))}")
    for element, label in parser.interactive_text:
        if not label.strip():
            errors.append(f"interactive element has no accessible name: {element}")

    if FORBIDDEN_TRACKING.search(source):
        errors.append("tracking/analytics marker found")
    if FORBIDDEN_SALES.search(source):
        errors.append("sales/donation language found")
    if ACCOUNT_REQUIRED.search(source):
        errors.append("account/sign-in requirement language found")

    references = parser.links + [("script", src, "<script>") for src in parser.scripts]
    references += [("stylesheet", src, "<link>") for src in parser.stylesheets]
    checked = 0
    for kind, url, element in references:
        target = local_target(url, page)
        if target is None:
            continue
        checked += 1
        if not target.is_file():
            errors.append(f"broken {kind} {url!r} ({element})")

    for stylesheet in parser.stylesheets:
        target = local_target(stylesheet, page)
        if target and target.is_file():
            css = target.read_text(encoding="utf-8")
            if "@media" not in css or "max-width" not in css:
                errors.append(f"stylesheet has no mobile breakpoint: {stylesheet}")

    return errors, checked


def main() -> int:
    errors: list[str] = []
    checked_refs = 0
    for page in PAGES:
        if not page.is_file():
            errors.append(f"missing public page: {page.relative_to(ROOT)}")
            continue
        page_errors, count = check_page(page)
        checked_refs += count
        for error in page_errors:
            errors.append(f"{page.relative_to(ROOT)}: {error}")

    if errors:
        for error in errors:
            print(f"FAIL: {error}", file=sys.stderr)
        return 1
    print(f"PUBLIC_SURFACE_PASS: {len(PAGES)} pages, {checked_refs} local links/assets checked")
    print("ACCESSIBILITY_PASS: titles, descriptions, language, h1, labels, ids, and keyboard order")
    print("PRIVACY_COPY_PASS: no tracking, account-gate, or sales/donation requirement detected")
    print("MOBILE_PASS: referenced stylesheets include responsive breakpoints")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
