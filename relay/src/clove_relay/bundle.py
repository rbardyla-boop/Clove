from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
import re


SEPARATOR = "=" * 60


@dataclass(frozen=True)
class BundleArticle:
    title: str
    subtitle: str
    schedule_date: str
    body: str

    @property
    def schedule_iso_date(self) -> str:
        return datetime.strptime(self.schedule_date, "%B %d, %Y").date().isoformat()


def _field(chunk: str, name: str) -> str:
    match = re.search(rf"(?m)^{re.escape(name)}:\s*(.+?)\s*$", chunk)
    if not match:
        raise ValueError(f"bundle article is missing {name}:")
    return match.group(1).strip()


def parse_bundle(path: str | Path) -> tuple[BundleArticle, ...]:
    bundle_path = Path(path)
    text = bundle_path.read_text(encoding="utf-8")
    articles: list[BundleArticle] = []
    for raw_chunk in text.split(SEPARATOR):
        chunk = raw_chunk.strip()
        if not re.search(r"(?m)^TITLE:\s*", chunk):
            continue

        title = _field(chunk, "TITLE")
        subtitle = _field(chunk, "SUBTITLE")
        schedule_date = _field(chunk, "SCHEDULE")

        schedule_match = re.search(r"(?m)^SCHEDULE:\s*.+?\s*$", chunk)
        assert schedule_match is not None
        body = chunk[schedule_match.end():].lstrip("\n").rstrip()
        if not body:
            raise ValueError(f"{bundle_path}: {title!r} has an empty body")

        articles.append(
            BundleArticle(
                title=title,
                subtitle=subtitle,
                schedule_date=schedule_date,
                body=body,
            )
        )
    return tuple(articles)


def find_article(path: str | Path, title: str) -> BundleArticle:
    matches = [article for article in parse_bundle(path) if article.title == title]
    if not matches:
        raise ValueError(f"{path}: no article titled {title!r}")
    if len(matches) != 1:
        raise ValueError(f"{path}: article title {title!r} appears {len(matches)} times")
    return matches[0]
