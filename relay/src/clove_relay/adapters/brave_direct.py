from __future__ import annotations

import os
from pathlib import Path
import shutil

from playwright.sync_api import Page, TimeoutError as PlaywrightTimeoutError, sync_playwright

from .substack_playwright import SubstackPlaywrightAdapter
from ..manifest import RelayManifest
from ..validate import ValidatedPost


class BraveDirectError(RuntimeError):
    """Raised when Relay cannot safely use the user's existing Brave profile."""


def _brave_root() -> Path:
    candidates = [
        Path.home() / ".config" / "BraveSoftware" / "Brave-Browser",
        Path.home() / "snap" / "brave" / "common" / ".config" / "BraveSoftware" / "Brave-Browser",
        Path.home() / ".var" / "app" / "com.brave.Browser" / "config" / "BraveSoftware" / "Brave-Browser",
    ]
    for root in candidates:
        if root.exists():
            return root
    raise BraveDirectError("Could not find a Brave user-data directory on this Linux account")


def _brave_executable() -> str:
    for name in ("brave-browser", "brave-browser-stable", "brave"):
        path = shutil.which(name)
        if path:
            return path
    flatpak = Path("/var/lib/flatpak/exports/bin/com.brave.Browser")
    if flatpak.exists():
        return str(flatpak)
    raise BraveDirectError("Could not find the Brave executable")


def _choose_profile(root: Path, explicit: Path | None) -> Path:
    if explicit is not None:
        profile = explicit.expanduser().resolve()
        if not profile.is_dir():
            raise BraveDirectError(f"Brave profile directory does not exist: {profile}")
        try:
            profile.relative_to(root.resolve())
        except ValueError as exc:
            raise BraveDirectError(
                f"Brave profile must be inside the detected user-data directory: {root}"
            ) from exc
        return profile

    default = root / "Default"
    if default.is_dir():
        return default

    profiles = sorted(
        [p for p in root.iterdir() if p.is_dir() and p.name.startswith("Profile ")]
    )
    if len(profiles) == 1:
        return profiles[0]
    if not profiles:
        raise BraveDirectError("No Brave Default/Profile directory was found")

    print("Brave profiles found:")
    for index, profile in enumerate(profiles, start=1):
        print(f"  {index}. {profile}")
    raw = input(f"Choose the profile visibly signed into Substack [1-{len(profiles)}]: ").strip()
    try:
        choice = int(raw)
    except ValueError as exc:
        raise BraveDirectError("Profile choice must be a number") from exc
    if choice < 1 or choice > len(profiles):
        raise BraveDirectError("Profile choice is out of range")
    return profiles[choice - 1]


def _running_brave_processes() -> list[tuple[int, str]]:
    """Return real Brave browser processes without matching Relay's own CLI text.

    Some Linux packages launch `/usr/bin/brave-browser`, which then execs a binary such
    as `/opt/brave.com/brave/brave`. Shell regexes that only search for `brave-browser`
    can therefore report nothing even while Brave is visibly open. Inspecting the real
    process executable/argv avoids that false negative.
    """

    matches: list[tuple[int, str]] = []
    proc = Path("/proc")
    if not proc.is_dir():
        return matches

    own_pid = os.getpid()
    for entry in proc.iterdir():
        if not entry.name.isdigit():
            continue
        pid = int(entry.name)
        if pid == own_pid:
            continue

        executable = ""
        try:
            executable = str((entry / "exe").resolve())
        except OSError:
            pass

        argv0 = ""
        try:
            raw = (entry / "cmdline").read_bytes().split(b"\0")
            if raw and raw[0]:
                argv0 = raw[0].decode("utf-8", errors="replace")
        except OSError:
            pass

        identity = f"{Path(executable).name} {Path(argv0).name}".lower()
        full = f"{executable} {argv0}".lower()
        if "brave" not in identity and "/brave" not in full and "com.brave.browser" not in full:
            continue

        label = executable or argv0 or "brave"
        matches.append((pid, label))

    return sorted(matches)


def _require_brave_closed() -> None:
    processes = _running_brave_processes()
    if not processes:
        return

    preview = "\n".join(f"  PID {pid}: {label}" for pid, label in processes[:12])
    more = "" if len(processes) <= 12 else f"\n  ... and {len(processes) - 12} more Brave processes"
    raise BraveDirectError(
        "Brave is still running and owns the profile lock. Close Brave completely before Relay opens the real profile.\n"
        f"Detected {len(processes)} Brave process(es):\n{preview}{more}\n"
        "After closing Brave, rerun the same Relay command. Do not delete SingletonLock files while a Brave process exists."
    )


class BraveDirectSubstackAdapter(SubstackPlaywrightAdapter):
    """Run Relay inside the user's real local Brave profile.

    This is the fallback for Chromium-family sessions that cannot be cloned because
    authentication cookies/storage remain bound to the original browser profile or
    OS keyring. Brave must be fully closed before Relay starts. Relay never reads,
    prints, exports, or copies cookie values in this mode.
    """

    def __init__(self, manifest: RelayManifest, profile: Path | None = None):
        super().__init__(manifest)
        self.brave_root = _brave_root().resolve()
        self.brave_profile = _choose_profile(self.brave_root, profile)
        self.brave_executable = _brave_executable()

    @staticmethod
    def _visible_exact_text(page: Page, text: str) -> bool:
        matches = page.get_by_text(text, exact=True)
        for index in range(matches.count()):
            try:
                if matches.nth(index).is_visible():
                    return True
            except Exception:
                continue
        return False

    def _fill_editor(self, page: Page, post: ValidatedPost) -> None:
        """Use the base editor fill, but survive Substack removing body placeholder attributes.

        Substack currently rerenders/retags the ProseMirror body after filling it. The
        original locator can therefore stop matching even though the full body is visibly
        present. If that exact read-back timeout occurs, verify the visible title,
        subtitle, and both ends of the body instead of treating a selector rerender as a
        failed write.
        """

        try:
            super()._fill_editor(page, post)
            return
        except PlaywrightTimeoutError:
            lines = [line.strip() for line in post.body.splitlines() if line.strip()]
            if not lines:
                raise self._stop(
                    page,
                    "The source body is empty after editor fill",
                    f"body-empty-{post.spec.index:02d}",
                )

            first_line = lines[0]
            last_line = lines[-1]
            title_ok = self._visible_exact_text(page, post.spec.title)
            subtitle_ok = self._visible_exact_text(page, post.spec.subtitle)
            first_ok = self._visible_exact_text(page, first_line)
            last_ok = first_ok if last_line == first_line else self._visible_exact_text(page, last_line)

            if title_ok and subtitle_ok and first_ok and last_ok:
                print(
                    "EDITOR_READBACK_PASS: Substack rerendered the body locator, but the visible "
                    "title, subtitle, first body line, and final body line all match the source."
                )
                return

            raise self._stop(
                page,
                "Substack rerendered the body editor and Relay could not verify both ends of the filled article",
                f"body-rerender-{post.spec.index:02d}",
            )

    def _launch(self):
        _require_brave_closed()
        playwright = sync_playwright().start()
        try:
            # Playwright normally adds --password-store=basic and --use-mock-keychain.
            # Those flags are useful for isolated test profiles but can prevent an
            # existing Linux Brave profile from decrypting its real cookie/session
            # store through the desktop keyring. In direct mode the whole point is to
            # use the user's existing profile as Brave itself would, so suppress only
            # those two defaults and retain the rest of Playwright's safety defaults.
            context = playwright.chromium.launch_persistent_context(
                user_data_dir=str(self.brave_root),
                executable_path=self.brave_executable,
                headless=False,
                viewport={"width": 1440, "height": 1000},
                ignore_default_args=[
                    "--password-store=basic",
                    "--use-mock-keychain",
                ],
                args=[
                    f"--profile-directory={self.brave_profile.name}",
                    "--no-first-run",
                    "--no-default-browser-check",
                ],
            )
        except Exception as exc:
            playwright.stop()
            raise BraveDirectError(
                "Could not open the real Brave profile even though Relay did not detect a running Brave process. "
                "Do not delete lock files yet; report this exact error so the lock state can be diagnosed safely. "
                f"Underlying error: {exc}"
            ) from exc
        page = context.pages[0] if context.pages else context.new_page()
        return playwright, context, page

    def check_session(self) -> None:
        playwright, context, page = self._launch()
        try:
            self._ensure_logged_in(page)
            print("BRAVE_DIRECT_SESSION_PASS")
            print(f"Brave profile: {self.brave_profile}")
            print("Publisher dashboard reached using the existing Brave session.")
            print("No post was created or modified by this check.")
            input("Confirm the publisher dashboard is visible, then press Enter: ")
        finally:
            context.close()
            playwright.stop()
