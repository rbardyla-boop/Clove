from __future__ import annotations

from datetime import time

from .adapters.substack_playwright import SubstackPlaywrightAdapter
from .receipts import PostReceipt, sha256_text
from .validate import ValidatedPost


def _prepare_for_human_schedule(
    adapter: SubstackPlaywrightAdapter,
    page,
    post: ValidatedPost,
    publish_time: time,
) -> tuple[str, str]:
    """Prepare one post and stop at the human-owned final Schedule action.

    This intentionally reuses the already-qualified editor and publishing-settings
    helpers. Relay may automate a control only when the adapter can identify it safely;
    otherwise the existing helper pauses for the human to set that control visibly.
    The final Schedule click is never executed by this mode.
    """

    adapter._fill_editor(page, post)
    adapter._continue_to_publish_settings(page, post)
    adapter._set_audience(page, post)
    adapter._set_email(page, post)
    adapter._enable_schedule(page, post)
    time_method = adapter._set_date_time(page, post, publish_time)
    screenshot = adapter._screenshot(page, f"human-prepared-{post.spec.index:02d}")

    requested = f"{post.spec.publish_date}T{publish_time.strftime('%H:%M')}"
    print("\nHUMAN PREPARATION READY")
    print(f"  [{post.spec.index:02d}] {post.spec.title}")
    print(f"  time: {requested} ({adapter.manifest.timezone}; Substack uses local device timezone)")
    print(f"  audience: {post.spec.audience}")
    print(f"  email/app: {post.spec.email}")
    print(f"  date/time method: {time_method}")
    print(f"  screenshot: {screenshot}")
    print("  final Schedule action: HUMAN ONLY")
    return time_method, screenshot


def _human_schedule_checkpoint(adapter: SubstackPlaywrightAdapter, page, post: ValidatedPost) -> None:
    print("\nHUMAN SCHEDULE CHECKPOINT")
    print("Inspect the visible Substack page. If title, subtitle, body, audience, delivery, date and time are correct,")
    print("click Substack's final Schedule button yourself. Relay will not click it in preparation-assistant mode.")
    answer = input("After YOU click Schedule and Substack accepts it, type SCHEDULED here: ").strip()
    if answer != "SCHEDULED":
        raise adapter._stop(
            page,
            "Human did not confirm the manual final Schedule action",
            f"human-schedule-not-confirmed-{post.spec.index:02d}",
        )


def run_one_human_schedule(
    adapter: SubstackPlaywrightAdapter,
    post: ValidatedPost,
    publish_time: time,
) -> PostReceipt:
    playwright, context, page = adapter._launch()
    try:
        adapter._ensure_logged_in(page)
        _method, screenshot = _prepare_for_human_schedule(adapter, page, post, publish_time)
        _human_schedule_checkpoint(adapter, page, post)
        verification = adapter._verify_title_in_scheduled(page, post)
        return PostReceipt(
            index=post.spec.index,
            title=post.spec.title,
            requested_publish_at=f"{post.spec.publish_date}T{publish_time.strftime('%H:%M')}",
            source_sha256=sha256_text(post.body),
            result="VERIFIED",
            verification="human-owned final Schedule click + " + verification,
            screenshot=screenshot,
        )
    finally:
        context.close()
        playwright.stop()


def run_batch_human_schedule(
    adapter: SubstackPlaywrightAdapter,
    posts_with_times: list[tuple[ValidatedPost, time]],
) -> list[PostReceipt]:
    """Sequential preparation-assistant batch.

    Relay prepares and verifies one post at a time. The human performs every final
    Schedule click. Any failure stops the batch before Relay touches the next post.
    """

    receipts: list[PostReceipt] = []
    playwright, context, page = adapter._launch()
    try:
        adapter._ensure_logged_in(page)
        for post, publish_time in posts_with_times:
            _method, screenshot = _prepare_for_human_schedule(adapter, page, post, publish_time)
            _human_schedule_checkpoint(adapter, page, post)
            verification = adapter._verify_title_in_scheduled(page, post)
            receipts.append(
                PostReceipt(
                    index=post.spec.index,
                    title=post.spec.title,
                    requested_publish_at=f"{post.spec.publish_date}T{publish_time.strftime('%H:%M')}",
                    source_sha256=sha256_text(post.body),
                    result="VERIFIED",
                    verification="human-owned final Schedule click + " + verification,
                    screenshot=screenshot,
                )
            )
        return receipts
    finally:
        context.close()
        playwright.stop()
