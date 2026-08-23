from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml


@dataclass(frozen=True)
class PostSpec:
    index: int
    title: str
    subtitle: str
    publish_date: str
    publish_time: str | None
    source_bundle: Path
    source_title: str
    audience: str
    email: bool


@dataclass(frozen=True)
class RelayManifest:
    path: Path
    publication: str
    dashboard_url: str
    posts_url: str
    timezone: str
    posts: tuple[PostSpec, ...]


def _require(mapping: dict[str, Any], key: str) -> Any:
    value = mapping.get(key)
    if value is None or value == "":
        raise ValueError(f"manifest field {key!r} is required")
    return value


def load_manifest(path: str | Path) -> RelayManifest:
    manifest_path = Path(path).expanduser().resolve()
    raw = yaml.safe_load(manifest_path.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        raise ValueError("manifest root must be a mapping")

    publication = str(_require(raw, "publication"))
    dashboard_url = str(_require(raw, "dashboard_url")).rstrip("/")
    posts_url = str(raw.get("posts_url") or f"{dashboard_url.rsplit('/publish', 1)[0]}/publish/posts").rstrip("/")
    timezone = str(raw.get("timezone") or "UTC")

    raw_posts = raw.get("posts")
    if not isinstance(raw_posts, list) or not raw_posts:
        raise ValueError("manifest posts must be a non-empty list")

    posts: list[PostSpec] = []
    for index, item in enumerate(raw_posts, start=1):
        if not isinstance(item, dict):
            raise ValueError(f"post {index}: expected mapping")
        bundle = Path(str(_require(item, "source_bundle")))
        if not bundle.is_absolute():
            bundle = (manifest_path.parent / bundle).resolve()

        publish_time = item.get("publish_time")
        posts.append(
            PostSpec(
                index=index,
                title=str(_require(item, "title")),
                subtitle=str(item.get("subtitle") or ""),
                publish_date=str(_require(item, "publish_date")),
                publish_time=str(publish_time) if publish_time else None,
                source_bundle=bundle,
                source_title=str(item.get("source_title") or _require(item, "title")),
                audience=str(item.get("audience") or "everyone").lower(),
                email=bool(item.get("email", True)),
            )
        )

    return RelayManifest(
        path=manifest_path,
        publication=publication,
        dashboard_url=dashboard_url,
        posts_url=posts_url,
        timezone=timezone,
        posts=tuple(posts),
    )
