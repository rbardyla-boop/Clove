from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest

from clove_relay.adapters.substack_playwright import RelayStop
from clove_relay.bundle import find_article, parse_bundle
from clove_relay.calendar_rebase import (
    CalendarRebaseError,
    check_alignment,
    parse_post_time_overrides,
    proposed_changes,
    staged_files,
)
from clove_relay.cli import _parser
from clove_relay.manual_mode import HumanScheduleBatchStop, run_batch_human_schedule, run_one_human_schedule
from clove_relay.manifest import load_manifest
from clove_relay.receipts import PostReceipt, write_receipts
from clove_relay.season_audit import audit_manifest, render_report
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


def test_receipts_keep_final_action_ownership_explicit(tmp_path):
    human = PostReceipt(
        index=1,
        title="Example",
        requested_publish_at="2026-08-25T09:00",
        source_sha256="a" * 64,
        result="HUMAN_SCHEDULE_VERIFIED",
        final_action="human_schedule_click",
        verification="human-owned final Schedule click + visible confirmation",
    )
    experimental = PostReceipt(
        index=2,
        title="Experimental",
        requested_publish_at="2026-08-28T09:00",
        source_sha256="b" * 64,
        result="EXPERIMENTAL_RELAY_SCHEDULE_VERIFIED",
        final_action="relay_schedule_click",
        verification="title present in Scheduled",
    )

    json_path, text_path = write_receipts([human, experimental], verdict="TEST")
    payload = json_path.read_text(encoding="utf-8")
    text = text_path.read_text(encoding="utf-8")

    assert '"result": "HUMAN_SCHEDULE_VERIFIED"' in payload
    assert '"final_action": "human_schedule_click"' in payload
    assert '"result": "EXPERIMENTAL_RELAY_SCHEDULE_VERIFIED"' in payload
    assert '"final_action": "relay_schedule_click"' in payload
    assert "final_action=human_schedule_click" in text
    assert "final_action=relay_schedule_click" in text
    assert "Immediate publishes: 0" in text


class _FakeContext:
    def close(self):
        pass


class _FakePlaywright:
    def stop(self):
        pass


class _FakeHumanAdapter:
    def __init__(self, manifest, *, fail_on_verify: int | None = None):
        self.manifest = manifest
        self.fail_on_verify = fail_on_verify
        self.prepared: list[int] = []
        self.verified: list[int] = []

    def _launch(self):
        return _FakePlaywright(), _FakeContext(), object()

    def _ensure_logged_in(self, page):
        pass

    def _fill_editor(self, page, post):
        self.prepared.append(post.spec.index)

    def _continue_to_publish_settings(self, page, post):
        pass

    def _set_audience(self, page, post):
        pass

    def _set_email(self, page, post):
        pass

    def _enable_schedule(self, page, post):
        pass

    def _set_date_time(self, page, post, publish_time):
        return "fake"

    def _screenshot(self, page, label):
        return f"/tmp/{label}.png"

    def _verify_title_in_scheduled(self, page, post):
        self.verified.append(post.spec.index)
        if post.spec.index == self.fail_on_verify:
            raise RelayStop("fake scheduled-title verification failure")
        return "fake title verification + human visual confirmation"

    def _stop(self, page, message, label):
        return RelayStop(message)


def test_prepare_records_human_final_action(monkeypatch):
    manifest = load_manifest(MANIFEST)
    result = validate_manifest(
        manifest,
        now=datetime(2026, 8, 23, 9, 49, tzinfo=ZoneInfo("America/Halifax")),
    )
    monkeypatch.setattr("builtins.input", lambda _prompt: "SCHEDULED")
    adapter = _FakeHumanAdapter(manifest)

    receipt = run_one_human_schedule(adapter, result.posts[0], parse_hhmm("09:00"))

    assert receipt.result == "HUMAN_SCHEDULE_VERIFIED"
    assert receipt.final_action == "human_schedule_click"
    assert receipt.verification.startswith("human-owned final Schedule click +")


def test_prepare_batch_stops_before_touching_next_post_on_verification_failure(monkeypatch):
    manifest = load_manifest(MANIFEST)
    result = validate_manifest(
        manifest,
        now=datetime(2026, 8, 23, 9, 49, tzinfo=ZoneInfo("America/Halifax")),
    )
    monkeypatch.setattr("builtins.input", lambda _prompt: "SCHEDULED")
    adapter = _FakeHumanAdapter(manifest, fail_on_verify=1)

    with pytest.raises(HumanScheduleBatchStop, match="verification failure") as caught:
        run_batch_human_schedule(
            adapter,
            [(result.posts[0], parse_hhmm("09:00")), (result.posts[1], parse_hhmm("09:00"))],
        )

    assert adapter.prepared == [1]
    assert adapter.verified == [1]
    assert caught.value.receipts == ()
    assert caught.value.planned == 2


def test_prepare_batch_labels_each_successful_receipt_as_human_verified(monkeypatch):
    manifest = load_manifest(MANIFEST)
    result = validate_manifest(
        manifest,
        now=datetime(2026, 8, 23, 9, 49, tzinfo=ZoneInfo("America/Halifax")),
    )
    monkeypatch.setattr("builtins.input", lambda _prompt: "SCHEDULED")
    adapter = _FakeHumanAdapter(manifest)

    receipts = run_batch_human_schedule(
        adapter,
        [(result.posts[0], parse_hhmm("09:00")), (result.posts[1], parse_hhmm("09:00"))],
    )

    assert [receipt.result for receipt in receipts] == [
        "HUMAN_SCHEDULE_VERIFIED",
        "HUMAN_SCHEDULE_VERIFIED",
    ]
    assert all(receipt.final_action == "human_schedule_click" for receipt in receipts)


def test_calendar_rebase_preview_is_tuesday_friday_and_does_not_mutate_fixture():
    manifest = load_manifest(MANIFEST)
    manifest_text = MANIFEST.read_text(encoding="utf-8")
    changes = proposed_changes(
        manifest,
        manifest_text,
        "2026-09-01",
        default_time="09:00",
        overrides=parse_post_time_overrides(["2=10:30"]),
    )
    assert len(changes) == 26
    assert changes[0].new_date == "2026-09-01"
    assert changes[1].new_date == "2026-09-04"
    assert changes[1].publish_time == "10:30"
    assert changes[-1].new_date == "2026-11-27"
    assert all(datetime.fromisoformat(change.new_date).weekday() in {1, 4} for change in changes)

    staged = staged_files(manifest, manifest_text, changes)
    assert staged[MANIFEST] != manifest_text
    assert MANIFEST.read_text(encoding="utf-8") == manifest_text
    assert check_alignment(manifest, manifest_text)


def test_calendar_rebase_rejects_non_tuesday_and_duplicate_time_override():
    manifest = load_manifest(MANIFEST)
    manifest_text = MANIFEST.read_text(encoding="utf-8")
    with pytest.raises(CalendarRebaseError, match="not a Tuesday"):
        proposed_changes(manifest, manifest_text, "2026-09-02")
    with pytest.raises(CalendarRebaseError, match="duplicate --post-time"):
        parse_post_time_overrides(["1=09:00", "1=10:00"])


def test_season_audit_is_mechanical_and_does_not_promote_claim_status():
    manifest = load_manifest(MANIFEST)
    audit = audit_manifest(manifest)
    report = render_report(audit)

    assert len(audit.essays) == 26
    assert audit.errors == ()
    assert audit.duplicate_urls
    assert "P0_MECHANICAL_INVENTORY_ONLY" in report
    assert "does not establish P1/P2/P3/P4/FROZEN" in report
    assert "SOURCE_SHA256:" in report
