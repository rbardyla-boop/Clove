from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time
from pathlib import Path
import re
from zoneinfo import ZoneInfo

from .bundle import find_article
from .manifest import PostSpec, RelayManifest


UNRESOLVED_PATTERNS = (
    re.compile(r"\{\{.+?\}\}"),
    re.compile(r"\bTBD\b", re.I),
    re.compile(r"\bREVIEW_ME\b", re.I),
    re.compile(r"\[INSERT[^\]]*\]", re.I),
)

ALLOWED_AUDIENCES = {"everyone", "free", "paid", "founding"}


@dataclass(frozen=True)
class ValidatedPost:
    spec: PostSpec
    body: str


@dataclass(frozen=True)
class ValidationResult:
    posts: tuple[ValidatedPost, ...]
    warnings: tuple[str, ...]


def parse_hhmm(value: str) -> time:
    try:
        return datetime.strptime(value, "%H:%M").time()
    except ValueError as exc:
        raise ValueError(f"invalid time {value!r}; expected HH:MM in 24-hour time") from exc


def resolved_time(spec: PostSpec, default_time: str | None) -> time | None:
    value = spec.publish_time or default_time
    return parse_hhmm(value) if value else None


def validate_manifest(
    manifest: RelayManifest,
    *,
    default_time: str | None = None,
    now: datetime | None = None,
    require_time: bool = False,
) -> ValidationResult:
    tz = ZoneInfo(manifest.timezone)
    current = now.astimezone(tz) if now else datetime.now(tz)
    warnings: list[str] = []
    validated: list[ValidatedPost] = []
    seen_slots: set[tuple[str, str | None]] = set()

    for spec in manifest.posts:
        if spec.audience not in ALLOWED_AUDIENCES:
            raise ValueError(
                f"post {spec.index} {spec.title!r}: unsupported audience {spec.audience!r}"
            )
        if not spec.source_bundle.exists():
            raise ValueError(
                f"post {spec.index} {spec.title!r}: bundle not found: {spec.source_bundle}"
            )

        try:
            scheduled_date = date.fromisoformat(spec.publish_date)
        except ValueError as exc:
            raise ValueError(
                f"post {spec.index} {spec.title!r}: publish_date must be YYYY-MM-DD"
            ) from exc

        article = find_article(spec.source_bundle, spec.source_title)
        if article.title != spec.title:
            raise ValueError(
                f"post {spec.index}: manifest title {spec.title!r} does not match bundle title {article.title!r}"
            )
        if article.subtitle != spec.subtitle:
            raise ValueError(
                f"post {spec.index} {spec.title!r}: subtitle mismatch between manifest and bundle"
            )
        if article.schedule_iso_date != spec.publish_date:
            raise ValueError(
                f"post {spec.index} {spec.title!r}: schedule date mismatch: "
                f"manifest={spec.publish_date}, bundle={article.schedule_iso_date}"
            )
        if scheduled_date < current.date():
            raise ValueError(
                f"post {spec.index} {spec.title!r}: publish date {spec.publish_date} is in the past"
            )

        chosen_time = resolved_time(spec, default_time)
        if require_time and chosen_time is None:
            raise ValueError(
                f"post {spec.index} {spec.title!r}: no publish time supplied; use --default-time HH:MM"
            )

        if scheduled_date == current.date() and chosen_time is not None:
            scheduled_dt = datetime.combine(scheduled_date, chosen_time, tzinfo=tz)
            if scheduled_dt <= current:
                raise ValueError(
                    f"post {spec.index} {spec.title!r}: resolved publish time is not in the future"
                )

        slot = (spec.publish_date, chosen_time.strftime("%H:%M") if chosen_time else None)
        if slot in seen_slots:
            raise ValueError(
                f"post {spec.index} {spec.title!r}: duplicate schedule slot {slot}"
            )
        seen_slots.add(slot)

        for pattern in UNRESOLVED_PATTERNS:
            match = pattern.search(article.body)
            if match:
                raise ValueError(
                    f"post {spec.index} {spec.title!r}: unresolved token {match.group(0)!r}"
                )

        if chosen_time is None:
            warnings.append(
                f"post {spec.index} {spec.title}: date is frozen but publish clock time is unset"
            )

        validated.append(ValidatedPost(spec=spec, body=article.body))

    return ValidationResult(posts=tuple(validated), warnings=tuple(warnings))
