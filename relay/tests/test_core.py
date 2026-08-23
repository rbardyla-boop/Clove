from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest

from clove_relay.bundle import find_article, parse_bundle
from clove_relay.cli import _parser
from clove_relay.manifest import load_manifest
from clove_relay.validate import parse_hhmm, validate_manifest


ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT / "relay" / "examples" / "detox-season.yml"


def test_real_detox_manifest_validates_against_frozen_source_packets():
    manifest = load_manifest(MANIFEST)
    now = datetime(2026, 8, 23, 9, 49, tzinfo=ZoneInfo("America/Halifax"))
    result = validate_manifest(manifest, now=now)

    assert len(result.posts) == 26
    assert result.posts[0].spec.title == "WHERE DID THE BOYS GO?"
    assert result.posts[-1].spec.title == "THE NEW TEMPERANCE"
    assert len(result.warnings) == 26  # dates frozen, clock time intentionally unset


def test_bundle_extracts_exact_article_body():
    manifest = load_manifest(MANIFEST)
    first = manifest.posts[0]
    article = find_article(first.source_bundle, first.source_title)

    assert article.title == first.title
    assert article.subtitle == first.subtitle
    assert article.schedule_iso_date == first.publish_date
    assert article.body.startswith("Everybody already has an answer.")
    assert "AI disclosure:" in article.body


def test_all_source_titles_are_unique_inside_their_bundles():
    manifest = load_manifest(MANIFEST)
    by_bundle = {}
    for post in manifest.posts:
        by_bundle.setdefault(post.source_bundle, []).append(post)

    for bundle, expected in by_bundle.items():
        articles = parse_bundle(bundle)
        titles = [article.title for article in articles]
        assert len(titles) == len(set(titles))
        assert set(titles) == {post.title for post in expected}


def test_time_parser_is_strict():
    assert parse_hhmm("09:00").strftime("%H:%M") == "09:00"
    assert parse_hhmm("21:45").strftime("%H:%M") == "21:45"
    with pytest.raises(ValueError):
        parse_hhmm("9am")


def test_preparation_assistant_commands_are_registered():
    parser = _parser()

    one = parser.parse_args(
        [
            "prepare",
            str(MANIFEST),
            "--post",
            "1",
            "--default-time",
            "09:00",
            "--browser",
            "brave",
        ]
    )
    assert one.command == "prepare"
    assert one.post == 1
    assert one.browser == "brave"

    batch = parser.parse_args(
        [
            "prepare-batch",
            str(MANIFEST),
            "--default-time",
            "09:00",
            "--browser",
            "brave",
        ]
    )
    assert batch.command == "prepare-batch"
    assert batch.browser == "brave"
