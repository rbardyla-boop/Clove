from __future__ import annotations

from pathlib import Path
import shutil

from playwright.sync_api import sync_playwright

from .substack_playwright import SubstackPlaywrightAdapter
from ..manifest import RelayManifest


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

    def _launch(self):
        playwright = sync_playwright().start()
        try:
            context = playwright.chromium.launch_persistent_context(
                user_data_dir=str(self.brave_root),
                executable_path=self.brave_executable,
                headless=False,
                viewport={"width": 1440, "height": 1000},
                args=[
                    f"--profile-directory={self.brave_profile.name}",
                    "--no-first-run",
                    "--no-default-browser-check",
                ],
            )
        except Exception as exc:
            playwright.stop()
            raise BraveDirectError(
                "Could not open the real Brave profile. Close every Brave window and background process, then retry. "
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
