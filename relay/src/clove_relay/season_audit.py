from __future__ import annotations

from dataclasses import dataclass
import hashlib
from pathlib import Path
import re
from urllib.parse import urlsplit

from .bundle import parse_bundle
from .manifest import RelayManifest


URL_PATTERN = re.compile(r"https?://[^\s<>)\]]+")
MARKDOWN_LINK_PATTERN = re.compile(r"\[[^\]]+\]\(([^)]+)\)")


@dataclass(frozen=True)
class EssayAudit:
    index: int
    title: str
    bundle: Path
    urls: tuple[str, ...]
    duplicate_urls: tuple[str, ...]
    homepage_urls: tuple[str, ...]
    broken_local_refs: tuple[str, ...]
    source_sha256: str

    @property
    def status(self) -> str:
        return "P0_MECHANICAL_INVENTORY_ONLY"


@dataclass(frozen=True)
class SeasonAudit:
    manifest: Path
    manifest_sha256: str
    essays: tuple[EssayAudit, ...]
    errors: tuple[str, ...]
    duplicate_urls: tuple[tuple[str, tuple[str, ...]], ...]
    essays_without_urls: tuple[str, ...]


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _clean_url(value: str) -> str:
    return value.rstrip(".,;:'\"")


def audit_manifest(manifest: RelayManifest) -> SeasonAudit:
    errors: list[str] = []
    essays: list[EssayAudit] = []
    title_locations: dict[str, list[Path]] = {}
    url_locations: dict[str, list[str]] = {}

    if len(manifest.posts) != 26:
        errors.append(f"manifest contains {len(manifest.posts)} posts; expected 26")
    for post in manifest.posts:
        title_locations.setdefault(post.title, []).append(post.source_bundle)
    for title, paths in title_locations.items():
        if len(paths) > 1:
            errors.append(f"manifest title appears in multiple bundles: {title!r}")

    for post in manifest.posts:
        try:
            articles = parse_bundle(post.source_bundle)
        except (OSError, ValueError) as exc:
            errors.append(f"post {post.index} {post.title!r}: bundle parse failed: {exc}")
            continue
        matches = [article for article in articles if article.title == post.source_title]
        if len(matches) != 1:
            errors.append(
                f"post {post.index} {post.title!r}: expected exactly one source-title match, found {len(matches)}"
            )
            continue
        article = matches[0]
        if article.title != post.title:
            errors.append(f"post {post.index}: manifest/source title mismatch")
        if article.schedule_iso_date != post.publish_date:
            errors.append(
                f"post {post.index} {post.title!r}: schedule mismatch manifest={post.publish_date} "
                f"source={article.schedule_iso_date}"
            )
        urls = tuple(dict.fromkeys(_clean_url(url) for url in URL_PATTERN.findall(article.body)))
        for url in urls:
            url_locations.setdefault(url, []).append(post.title)
        homepage_urls = tuple(
            url for url in urls if urlsplit(url).path in {"", "/"} and not urlsplit(url).query
        )
        local_refs: list[str] = []
        for reference in MARKDOWN_LINK_PATTERN.findall(article.body):
            target = reference.split("#", 1)[0].split("?", 1)[0]
            if not target or target.startswith(("http://", "https://", "mailto:")):
                continue
            candidate = (post.source_bundle.parent / target).resolve()
            if not candidate.is_file():
                local_refs.append(reference)
        essays.append(
            EssayAudit(
                index=post.index,
                title=post.title,
                bundle=post.source_bundle,
                urls=urls,
                duplicate_urls=(),
                homepage_urls=homepage_urls,
                broken_local_refs=tuple(local_refs),
                source_sha256=_sha256(post.source_bundle),
            )
        )

    duplicate_urls = tuple(
        (url, tuple(titles)) for url, titles in sorted(url_locations.items()) if len(titles) > 1
    )
    duplicate_by_url = {url for url, _titles in duplicate_urls}
    essays = [
        EssayAudit(
            index=essay.index,
            title=essay.title,
            bundle=essay.bundle,
            urls=essay.urls,
            duplicate_urls=tuple(url for url in essay.urls if url in duplicate_by_url),
            homepage_urls=essay.homepage_urls,
            broken_local_refs=essay.broken_local_refs,
            source_sha256=essay.source_sha256,
        )
        for essay in essays
    ]
    errors.extend(
        f"{essay.title}: broken local reference {reference!r}"
        for essay in essays
        for reference in essay.broken_local_refs
    )
    return SeasonAudit(
        manifest=manifest.path,
        manifest_sha256=_sha256(manifest.path),
        essays=tuple(essays),
        errors=tuple(errors),
        duplicate_urls=duplicate_urls,
        essays_without_urls=tuple(essay.title for essay in essays if not essay.urls),
    )


def render_report(audit: SeasonAudit) -> str:
    lines = [
        "CLOVE DETOX SEASON MECHANICAL AUDIT",
        "STATUS: P0_MECHANICAL_INVENTORY_ONLY",
        "HUMAN REVIEW: REQUIRED — this report does not establish P1/P2/P3/P4/FROZEN",
        "",
        f"MANIFEST: {audit.manifest}",
        f"MANIFEST_SHA256: {audit.manifest_sha256}",
        f"ESSAYS: {len(audit.essays)}",
        f"STRUCTURAL_ERRORS: {len(audit.errors)}",
        "",
        "STRUCTURAL ERRORS:",
    ]
    lines.extend(f"- {error}" for error in audit.errors) or lines.append("- none")
    lines.extend(["", "DUPLICATE URL INVENTORY:"])
    lines.extend(f"- {url} :: {', '.join(titles)}" for url, titles in audit.duplicate_urls) or lines.append("- none")
    lines.extend(["", "ESSAY INVENTORY:"])
    for essay in audit.essays:
        lines.extend(
            [
                f"[{essay.index:02d}] {essay.title}",
                f"  STATE: {essay.status}",
                f"  BUNDLE: {essay.bundle}",
                f"  SOURCE_SHA256: {essay.source_sha256}",
                f"  URLS: {len(essay.urls)}",
                f"  DUPLICATE_URLS: {len(essay.duplicate_urls)}",
                f"  HOMEPAGE_ONLY_URLS: {', '.join(essay.homepage_urls) if essay.homepage_urls else 'none'}",
                "  CLAIM INVENTORY: PENDING HUMAN REVIEW",
            ]
        )
    lines.extend(["", "ESSAYS_WITH_NO_URLS:"])
    lines.extend(f"- {title}" for title in audit.essays_without_urls) or lines.append("- none")
    lines.extend(
        [
            "",
            "INTERPRETATION:",
            "- Duplicate, homepage-only and missing-URL flags are research queues, not evidence verdicts.",
            "- URL presence never promotes a claim to source-checked status.",
            "- Counterevidence, claim classification, copy repair and freeze remain human/research work.",
        ]
    )
    return "\n".join(lines) + "\n"
