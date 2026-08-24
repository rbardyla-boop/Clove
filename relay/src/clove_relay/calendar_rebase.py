from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
import os
from pathlib import Path
import re
import tempfile

import yaml

from .bundle import SEPARATOR, parse_bundle
from .manifest import RelayManifest
from .validate import parse_hhmm


class CalendarRebaseError(ValueError):
    """Raised when a calendar proposal cannot be proven safe to stage."""


@dataclass(frozen=True)
class CalendarChange:
    index: int
    title: str
    old_date: str
    new_date: str
    publish_time: str | None


def _manifest_post_blocks(text: str) -> list[tuple[str, str, str]]:
    blocks = re.findall(r"(?ms)^  - title:.*?(?=^  - title:|\Z)", text)
    if not blocks:
        raise CalendarRebaseError("manifest has no indented post blocks")
    result: list[tuple[str, str, str]] = []
    for block in blocks:
        title_match = re.search(r"(?m)^  - title:\s*(.+?)\s*$", block)
        date_match = re.search(r"(?m)^    publish_date:\s*[\"']?(\d{4}-\d{2}-\d{2})[\"']?\s*$", block)
        if not title_match or not date_match:
            raise CalendarRebaseError("every manifest post must contain title and publish_date")
        title = str(yaml.safe_load(title_match.group(1)))
        result.append((block, title, date_match.group(1)))
    return result


def _format_source_date(value: str) -> str:
    parsed = date.fromisoformat(value)
    return parsed.strftime("%B %-d, %Y")


def _post_times(manifest: RelayManifest, default_time: str | None, overrides: dict[int, str]) -> dict[int, str | None]:
    if default_time is not None:
        parse_hhmm(default_time)
    for index, value in overrides.items():
        if index < 1 or index > len(manifest.posts):
            raise CalendarRebaseError(f"post-time index must be between 1 and {len(manifest.posts)}")
        parse_hhmm(value)
    result: dict[int, str | None] = {}
    for post in manifest.posts:
        result[post.index] = overrides.get(post.index, default_time or post.publish_time)
    return result


def parse_post_time_overrides(values: list[str]) -> dict[int, str]:
    result: dict[int, str] = {}
    for raw in values:
        if "=" not in raw:
            raise CalendarRebaseError(f"invalid --post-time {raw!r}; expected INDEX=HH:MM")
        raw_index, value = raw.split("=", 1)
        try:
            index = int(raw_index)
        except ValueError as exc:
            raise CalendarRebaseError(f"invalid --post-time index {raw_index!r}") from exc
        if index in result:
            raise CalendarRebaseError(f"duplicate --post-time override for post {index}")
        parse_hhmm(value)
        result[index] = value
    return result


def proposed_changes(
    manifest: RelayManifest,
    manifest_text: str,
    first_tuesday: str,
    *,
    default_time: str | None = None,
    overrides: dict[int, str] | None = None,
) -> tuple[CalendarChange, ...]:
    try:
        start = date.fromisoformat(first_tuesday)
    except ValueError as exc:
        raise CalendarRebaseError("first Tuesday must be YYYY-MM-DD") from exc
    if start.weekday() != 1:
        raise CalendarRebaseError(f"first date {first_tuesday} is not a Tuesday")
    blocks = _manifest_post_blocks(manifest_text)
    if len(manifest.posts) != 26 or len(blocks) != 26:
        raise CalendarRebaseError("calendar rebase requires exactly 26 manifest posts")
    overrides = overrides or {}
    times = _post_times(manifest, default_time, overrides)
    changes: list[CalendarChange] = []
    seen_slots: set[tuple[str, str | None]] = set()
    for position, post in enumerate(manifest.posts):
        expected_block, block_title, old_date = blocks[position]
        if block_title != post.title:
            raise CalendarRebaseError(
                f"manifest block {position + 1} title mismatch: parsed={block_title!r}, model={post.title!r}"
            )
        new_date = (start + timedelta(days=7 * (position // 2) + (3 if position % 2 else 0))).isoformat()
        slot = (new_date, times[post.index])
        if slot in seen_slots:
            raise CalendarRebaseError(f"duplicate proposed slot {slot}")
        seen_slots.add(slot)
        changes.append(
            CalendarChange(
                index=post.index,
                title=post.title,
                old_date=old_date,
                new_date=new_date,
                publish_time=times[post.index],
            )
        )
    return tuple(changes)


def _replace_manifest_dates(text: str, changes: tuple[CalendarChange, ...]) -> str:
    change_by_title = {change.title: change for change in changes}

    def replace_block(match: re.Match[str]) -> str:
        block = match.group(0)
        title_match = re.search(r"^  - title:\s*(.+?)\s*$", block, re.M)
        if not title_match:
            return block
        title = str(yaml.safe_load(title_match.group(1)))
        if title not in change_by_title:
            raise CalendarRebaseError(f"manifest contains unexpected title {title!r}")
        change = change_by_title[title]
        block = re.sub(
            r"(?m)^(    publish_date:\s*[\"']?)\d{4}-\d{2}-\d{2}([\"']?\s*)$",
            rf"\g<1>{change.new_date}\g<2>",
            block,
            count=1,
        )
        if change.publish_time is not None:
            time_line = re.search(r"(?m)^    publish_time:\s*.*$", block)
            if time_line:
                block = block[:time_line.start()] + f"    publish_time: {change.publish_time}\n" + block[time_line.end():]
            else:
                marker = re.search(r"(?m)^    publish_date:.*$", block)
                if not marker:
                    raise CalendarRebaseError(f"post {change.index} has no publish_date line")
                insertion = marker.end()
                block = block[:insertion] + f"\n    publish_time: {change.publish_time}" + block[insertion:]
        return block

    return re.sub(r"(?ms)^  - title:.*?(?=^  - title:|\Z)", replace_block, text)


def _replace_bundle_dates(text: str, changes: tuple[CalendarChange, ...]) -> str:
    by_title = {change.title: change for change in changes}
    seen: set[str] = set()
    chunks = text.split(SEPARATOR)
    updated_chunks: list[str] = []
    for chunk in chunks:
        title_match = re.search(r"(?m)^TITLE:\s*(.+?)\s*$", chunk)
        if not title_match:
            updated_chunks.append(chunk)
            continue
        title = title_match.group(1).strip()
        if title not in by_title:
            raise CalendarRebaseError(f"source packet contains unexpected title {title!r}")
        change = by_title[title]
        if title in seen:
            raise CalendarRebaseError(f"source packet repeats title {title!r}")
        seen.add(title)
        schedule_match = re.search(r"(?m)^SCHEDULE:\s*(.+?)\s*$", chunk)
        if not schedule_match:
            raise CalendarRebaseError(f"source packet title {title!r} has no SCHEDULE line")
        if schedule_match.group(1).strip() != _format_source_date(change.old_date):
            raise CalendarRebaseError(
                f"source packet date mismatch for {title!r}: "
                f"packet={schedule_match.group(1).strip()!r}, manifest={change.old_date!r}"
            )
        replacement, count = re.subn(
            r"(?m)^(SCHEDULE:\s*).+$",
            rf"\g<1>{_format_source_date(change.new_date)}",
            chunk,
            count=1,
        )
        if count != 1:
            raise CalendarRebaseError(f"source packet title {title!r} has no SCHEDULE line")
        updated_chunks.append(replacement)
    if seen != set(by_title):
        missing = sorted(set(by_title) - seen)
        raise CalendarRebaseError(f"source packet is missing titles: {missing}")
    return SEPARATOR.join(updated_chunks)


def staged_files(
    manifest: RelayManifest,
    manifest_text: str,
    changes: tuple[CalendarChange, ...],
) -> dict[Path, str]:
    files = {manifest.path: _replace_manifest_dates(manifest_text, changes)}
    for bundle in sorted({post.source_bundle for post in manifest.posts}):
        parsed = parse_bundle(bundle)
        expected_titles = {post.title for post in manifest.posts if post.source_bundle == bundle}
        actual_titles = {article.title for article in parsed}
        if actual_titles != expected_titles:
            raise CalendarRebaseError(
                f"source packet title set mismatch for {bundle}: "
                f"expected {len(expected_titles)}, found {len(actual_titles)}"
            )
        titles = {article.title for article in parsed}
        bundle_changes = tuple(change for change in changes if change.title in titles)
        files[bundle] = _replace_bundle_dates(bundle.read_text(encoding="utf-8"), bundle_changes)
    return files


def check_alignment(manifest: RelayManifest, manifest_text: str) -> tuple[CalendarChange, ...]:
    blocks = _manifest_post_blocks(manifest_text)
    if len(manifest.posts) != 26 or len(blocks) != 26:
        raise CalendarRebaseError("calendar check requires exactly 26 manifest posts")
    changes: list[CalendarChange] = []
    seen_slots: set[tuple[str, str | None]] = set()
    for position, post in enumerate(manifest.posts):
        _block, block_title, manifest_date = blocks[position]
        if block_title != post.title:
            raise CalendarRebaseError(f"manifest title mismatch at post {position + 1}")
        slot = (manifest_date, post.publish_time)
        if slot in seen_slots:
            raise CalendarRebaseError(f"duplicate manifest slot {slot}")
        seen_slots.add(slot)
        changes.append(CalendarChange(post.index, post.title, manifest_date, manifest_date, post.publish_time))
    files = staged_files(manifest, manifest_text, tuple(changes))
    if files[manifest.path] != manifest_text:
        raise CalendarRebaseError("manifest text could not be round-tripped without mutation")
    for bundle in sorted({post.source_bundle for post in manifest.posts}):
        if files[bundle] != bundle.read_text(encoding="utf-8"):
            raise CalendarRebaseError(f"source packet is out of sync with manifest: {bundle}")
    return tuple(changes)


def apply_staged_files(files: dict[Path, str]) -> None:
    originals = {path: path.read_text(encoding="utf-8") for path in files}
    temporary: list[tuple[Path, Path]] = []
    try:
        for path, content in files.items():
            handle = tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, prefix=f".{path.name}.", delete=False)
            with handle:
                handle.write(content)
                handle.flush()
                os.fsync(handle.fileno())
            temporary.append((path, Path(handle.name)))
        for path, staged in temporary:
            os.replace(staged, path)
    except Exception:
        for _path, staged in temporary:
            staged.unlink(missing_ok=True)
        for path, content in originals.items():
            handle = tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, prefix=f".{path.name}.rollback.", delete=False)
            with handle:
                handle.write(content)
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(handle.name, path)
        raise
