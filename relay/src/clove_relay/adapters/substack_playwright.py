from __future__ import annotations

from dataclasses import dataclass
from datetime import time
from pathlib import Path
import re

from playwright.sync_api import Locator, Page, sync_playwright

from ..manifest import RelayManifest
from ..receipts import PostReceipt, sha256_text
from ..validate import ValidatedPost


class RelayStop(RuntimeError):
    """Raised when Relay cannot prove the next UI action is safe."""


@dataclass(frozen=True)
class BrowserConfig:
    auth_dir: Path = Path(".relay-auth/substack")
    receipt_dir: Path = Path(".relay-receipts")


class SubstackPlaywrightAdapter:
    def __init__(self, manifest: RelayManifest, config: BrowserConfig | None = None):
        self.manifest = manifest
        self.config = config or BrowserConfig()
        self.config.auth_dir.mkdir(parents=True, exist_ok=True)
        self.config.receipt_dir.mkdir(parents=True, exist_ok=True)

    def _launch(self):
        playwright = sync_playwright().start()
        context = playwright.chromium.launch_persistent_context(
            user_data_dir=str(self.config.auth_dir),
            headless=False,
            viewport={"width": 1440, "height": 1000},
        )
        page = context.pages[0] if context.pages else context.new_page()
        return playwright, context, page

    def _screenshot(self, page: Page, label: str) -> str:
        safe = re.sub(r"[^A-Za-z0-9._-]+", "-", label).strip("-")[:80]
        path = self.config.receipt_dir / f"{safe}.png"
        page.screenshot(path=str(path), full_page=True)
        return str(path)

    def _stop(self, page: Page, message: str, label: str) -> RelayStop:
        shot = self._screenshot(page, label)
        return RelayStop(f"{message}\nScreenshot: {shot}")

    @staticmethod
    def _unique(candidates: list[Locator], description: str) -> Locator:
        matches: list[Locator] = []
        for candidate in candidates:
            try:
                count = candidate.count()
            except Exception:
                continue
            if count == 1:
                matches.append(candidate)
        if len(matches) != 1:
            raise RelayStop(
                f"could not identify exactly one {description}; "
                f"safe candidates={len(matches)}"
            )
        return matches[0]

    def _ensure_logged_in(self, page: Page) -> None:
        page.goto(self.manifest.dashboard_url, wait_until="domcontentloaded")
        if "sign-in" in page.url or "signin" in page.url:
            raise self._stop(page, "Substack session is not logged in", "logged-out")
        if page.get_by_text(re.compile(r"sign in", re.I)).count() and not page.get_by_text(
            re.compile(r"dashboard", re.I)
        ).count():
            raise self._stop(page, "Substack appears to require login", "logged-out")

    def login(self) -> None:
        playwright, context, page = self._launch()
        try:
            page.goto(self.manifest.dashboard_url, wait_until="domcontentloaded")
            print("\nA visible Chromium window is open.")
            print("Sign in to Substack normally if needed. Do not paste credentials into Relay.")
            input("When your publication dashboard is visible, press Enter here: ")
            self._ensure_logged_in(page)
            print("LOGIN_SESSION_READY")
        finally:
            context.close()
            playwright.stop()

    def _open_new_article(self, page: Page) -> None:
        self._ensure_logged_in(page)

        create = page.get_by_role("button", name=re.compile(r"^Create$", re.I))
        if create.count() != 1:
            create = page.get_by_text("Create", exact=True)
        if create.count() != 1:
            raise self._stop(page, "Could not identify the Create control", "create-control")
        create.click()

        article = page.get_by_text("Article", exact=True)
        if article.count() != 1:
            article = page.get_by_role("menuitem", name=re.compile(r"^Article$", re.I))
        if article.count() != 1:
            raise self._stop(page, "Could not identify the Article control", "article-control")
        article.click()
        page.wait_for_load_state("domcontentloaded")

    def _fill_editor(self, page: Page, post: ValidatedPost) -> None:
        self._open_new_article(page)

        try:
            title = self._unique(
                [
                    page.locator("input[placeholder='Title']"),
                    page.locator("textarea[placeholder='Title']"),
                    page.get_by_placeholder(re.compile(r"^Title$", re.I)),
                    page.get_by_placeholder(re.compile(r"post title", re.I)),
                ],
                "title field",
            )
            subtitle = self._unique(
                [
                    page.locator("input[placeholder='Subtitle']"),
                    page.locator("textarea[placeholder='Subtitle']"),
                    page.get_by_placeholder(re.compile(r"subtitle", re.I)),
                ],
                "subtitle field",
            )
            body = self._unique(
                [
                    page.locator(".ProseMirror[contenteditable='true']"),
                    page.locator("[contenteditable='true'][data-placeholder*='Write']"),
                ],
                "article body editor",
            )
        except RelayStop as exc:
            raise self._stop(page, str(exc), f"editor-fields-{post.spec.index:02d}")

        title.fill(post.spec.title)
        subtitle.fill(post.spec.subtitle)
        body.fill(post.body)

        # Read our own fields back before continuing. Relay does not inspect unrelated content.
        if title.input_value().strip() != post.spec.title:
            raise self._stop(page, "Title read-back mismatch", f"title-mismatch-{post.spec.index:02d}")
        if subtitle.input_value().strip() != post.spec.subtitle:
            raise self._stop(page, "Subtitle read-back mismatch", f"subtitle-mismatch-{post.spec.index:02d}")

    def _continue_to_publish_settings(self, page: Page, post: ValidatedPost) -> None:
        continue_button = page.get_by_role("button", name=re.compile(r"^Continue$", re.I))
        if continue_button.count() != 1:
            raise self._stop(page, "Could not identify Continue button", f"continue-{post.spec.index:02d}")
        continue_button.click()
        page.wait_for_timeout(800)

    def _set_audience(self, page: Page, post: ValidatedPost) -> None:
        if post.spec.audience != "everyone":
            raise self._stop(
                page,
                "v0.1 batch adapter is locked to audience=everyone until other audiences are qualified",
                f"audience-{post.spec.index:02d}",
            )

        radio = page.get_by_role("radio", name=re.compile(r"^Everyone$", re.I))
        if radio.count() == 1:
            if not radio.is_checked():
                radio.check()
            return

        everyone = page.get_by_text("Everyone", exact=True)
        if everyone.count() == 1:
            everyone.click()
            return

        raise self._stop(page, "Could not safely identify audience=Everyone", f"audience-{post.spec.index:02d}")

    def _set_email(self, page: Page, post: ValidatedPost) -> None:
        checkbox = page.get_by_role(
            "checkbox", name=re.compile(r"Send via email and Substack app inbox", re.I)
        )
        if checkbox.count() != 1:
            # The UI text is documented by Substack, but if the control shape changes we stop.
            raise self._stop(page, "Could not identify email/app delivery checkbox", f"email-{post.spec.index:02d}")
        if checkbox.is_checked() != post.spec.email:
            checkbox.click()
        if checkbox.is_checked() != post.spec.email:
            raise self._stop(page, "Email/app delivery state did not match manifest", f"email-state-{post.spec.index:02d}")

    def _enable_schedule(self, page: Page, post: ValidatedPost) -> None:
        schedule = page.get_by_role(
            "checkbox", name=re.compile(r"Schedule time to email and publish", re.I)
        )
        if schedule.count() != 1:
            schedule = page.get_by_label(re.compile(r"Schedule time to email and publish", re.I))
        if schedule.count() != 1:
            raise self._stop(page, "Could not identify schedule checkbox", f"schedule-toggle-{post.spec.index:02d}")
        if not schedule.is_checked():
            schedule.click()
        if not schedule.is_checked():
            raise self._stop(page, "Schedule checkbox did not stay enabled", f"schedule-toggle-state-{post.spec.index:02d}")

    def _set_date_time(self, page: Page, post: ValidatedPost, publish_time: time) -> str:
        date_value = post.spec.publish_date
        time_value = publish_time.strftime("%H:%M")

        date_input = page.locator("input[type='date']")
        time_input = page.locator("input[type='time']")
        if date_input.count() == 1 and time_input.count() == 1:
            date_input.fill(date_value)
            time_input.fill(time_value)
            if date_input.input_value() != date_value or time_input.input_value()[:5] != time_value:
                raise self._stop(page, "Date/time read-back mismatch", f"datetime-{post.spec.index:02d}")
            return "automated_date_time_fields"

        print("\nRelay could not prove the current Substack date/time widgets are safe to automate.")
        print(f"Set this post manually to: {date_value} at {time_value} (local device timezone).")
        input("After the correct future date/time is visibly selected in Substack, press Enter: ")
        return "human_set_date_time"

    def prepare_post(
        self,
        page: Page,
        post: ValidatedPost,
        publish_time: time,
        *,
        dry_run: bool,
    ) -> tuple[str, str | None]:
        self._fill_editor(page, post)
        self._continue_to_publish_settings(page, post)
        self._set_audience(page, post)
        self._set_email(page, post)
        self._enable_schedule(page, post)
        time_method = self._set_date_time(page, post, publish_time)
        screenshot = self._screenshot(page, f"prepared-{post.spec.index:02d}")

        requested = f"{post.spec.publish_date}T{publish_time.strftime('%H:%M')}"
        print("\nPREPARED FOR SCHEDULING")
        print(f"  [{post.spec.index:02d}] {post.spec.title}")
        print(f"  time: {requested} ({self.manifest.timezone}; Substack uses local device timezone)")
        print(f"  audience: {post.spec.audience}")
        print(f"  email/app: {post.spec.email}")
        print(f"  date/time method: {time_method}")
        print(f"  screenshot: {screenshot}")

        if dry_run:
            print("DRY_RUN_STOP: Relay will not click Schedule.")
            return time_method, screenshot

        answer = input("Type SCHEDULE to authorize the final Schedule click for this post: ").strip()
        if answer != "SCHEDULE":
            raise self._stop(page, "Human did not authorize final schedule action", f"not-authorized-{post.spec.index:02d}")

        button = page.get_by_role("button", name=re.compile(r"^Schedule$", re.I))
        if button.count() != 1:
            raise self._stop(page, "Could not identify exactly one final Schedule button", f"final-schedule-{post.spec.index:02d}")
        button.click()
        page.wait_for_timeout(1200)
        return time_method, screenshot

    def _verify_title_in_scheduled(self, page: Page, post: ValidatedPost) -> str:
        page.goto(self.manifest.posts_url, wait_until="domcontentloaded")
        scheduled = page.get_by_text("Scheduled", exact=True)
        if scheduled.count() >= 1:
            try:
                scheduled.first.click()
                page.wait_for_timeout(600)
            except Exception:
                pass

        title = page.get_by_text(post.spec.title, exact=True)
        if title.count() < 1:
            raise self._stop(page, "Scheduled list does not show the expected title", f"verify-{post.spec.index:02d}")

        print("\nThe expected title is visible in Substack's Scheduled area.")
        print("Use the visible browser to confirm the displayed schedule time and audience are correct.")
        answer = input("Type VERIFIED if the visible scheduled entry is correct: ").strip()
        if answer != "VERIFIED":
            raise self._stop(page, "Human visual verification was not granted", f"verify-human-{post.spec.index:02d}")
        return "title_present_in_scheduled + human_visual_date_audience_confirmation"

    def run_one(
        self,
        post: ValidatedPost,
        publish_time: time,
        *,
        dry_run: bool,
    ) -> PostReceipt:
        playwright, context, page = self._launch()
        try:
            self._ensure_logged_in(page)
            _method, screenshot = self.prepare_post(page, post, publish_time, dry_run=dry_run)
            requested = f"{post.spec.publish_date}T{publish_time.strftime('%H:%M')}"
            if dry_run:
                return PostReceipt(
                    index=post.spec.index,
                    title=post.spec.title,
                    requested_publish_at=requested,
                    source_sha256=sha256_text(post.body),
                    result="DRY_RUN",
                    verification="final Schedule action deliberately not executed",
                    screenshot=screenshot,
                )

            verification = self._verify_title_in_scheduled(page, post)
            return PostReceipt(
                index=post.spec.index,
                title=post.spec.title,
                requested_publish_at=requested,
                source_sha256=sha256_text(post.body),
                result="VERIFIED",
                verification=verification,
                screenshot=screenshot,
            )
        finally:
            context.close()
            playwright.stop()

    def run_batch(self, posts_with_times: list[tuple[ValidatedPost, time]]) -> list[PostReceipt]:
        receipts: list[PostReceipt] = []
        playwright, context, page = self._launch()
        try:
            self._ensure_logged_in(page)
            for post, publish_time in posts_with_times:
                try:
                    _method, screenshot = self.prepare_post(page, post, publish_time, dry_run=False)
                    verification = self._verify_title_in_scheduled(page, post)
                    receipts.append(
                        PostReceipt(
                            index=post.spec.index,
                            title=post.spec.title,
                            requested_publish_at=f"{post.spec.publish_date}T{publish_time.strftime('%H:%M')}",
                            source_sha256=sha256_text(post.body),
                            result="VERIFIED",
                            verification=verification,
                            screenshot=screenshot,
                        )
                    )
                except Exception:
                    # Fail closed: no blind continuation to the next post.
                    raise
            return receipts
        finally:
            context.close()
            playwright.stop()

    def verify_batch(self, posts: list[ValidatedPost]) -> list[tuple[int, str, bool]]:
        playwright, context, page = self._launch()
        try:
            self._ensure_logged_in(page)
            page.goto(self.manifest.posts_url, wait_until="domcontentloaded")
            scheduled = page.get_by_text("Scheduled", exact=True)
            if scheduled.count() >= 1:
                try:
                    scheduled.first.click()
                    page.wait_for_timeout(600)
                except Exception:
                    pass
            results: list[tuple[int, str, bool]] = []
            for post in posts:
                found = page.get_by_text(post.spec.title, exact=True).count() >= 1
                results.append((post.spec.index, post.spec.title, found))
            return results
        finally:
            context.close()
            playwright.stop()
