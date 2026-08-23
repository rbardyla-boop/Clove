from __future__ import annotations

from pathlib import Path
import shutil
import sqlite3

from playwright.sync_api import sync_playwright

from .manifest import RelayManifest


class BraveSessionImportError(RuntimeError):
    """Raised when Relay cannot safely import an existing Brave Substack session."""


def _brave_root() -> Path:
    candidates = [
        Path.home() / ".config" / "BraveSoftware" / "Brave-Browser",
        Path.home() / "snap" / "brave" / "common" / ".config" / "BraveSoftware" / "Brave-Browser",
        Path.home() / ".var" / "app" / "com.brave.Browser" / "config" / "BraveSoftware" / "Brave-Browser",
    ]
    for root in candidates:
        if root.exists():
            return root
    raise BraveSessionImportError("Could not find a Brave user-data directory on this Linux account")


def _brave_executable() -> str:
    for name in ("brave-browser", "brave-browser-stable", "brave"):
        path = shutil.which(name)
        if path:
            return path
    flatpak = "/var/lib/flatpak/exports/bin/com.brave.Browser"
    if Path(flatpak).exists():
        return flatpak
    raise BraveSessionImportError("Could not find the Brave executable")


def _cookie_db(profile: Path) -> Path | None:
    for candidate in (profile / "Network" / "Cookies", profile / "Cookies"):
        if candidate.is_file():
            return candidate
    return None


def _substack_cookie_count(profile: Path) -> int:
    database = _cookie_db(profile)
    if database is None:
        return 0
    try:
        connection = sqlite3.connect(f"file:{database}?mode=ro", uri=True, timeout=3)
        try:
            row = connection.execute(
                "SELECT COUNT(*) FROM cookies WHERE host_key LIKE '%substack.com'"
            ).fetchone()
            return int(row[0] if row else 0)
        finally:
            connection.close()
    except sqlite3.Error:
        return 0


def discover_brave_profiles(root: Path) -> list[tuple[Path, int]]:
    profiles: list[tuple[Path, int]] = []
    for child in root.iterdir():
        if not child.is_dir():
            continue
        if child.name != "Default" and not child.name.startswith("Profile "):
            continue
        count = _substack_cookie_count(child)
        profiles.append((child, count))
    profiles.sort(key=lambda item: item[1], reverse=True)
    return profiles


def _choose_profile(root: Path, explicit: Path | None) -> Path:
    if explicit is not None:
        profile = explicit.expanduser().resolve()
        if not profile.is_dir():
            raise BraveSessionImportError(f"Brave profile directory does not exist: {profile}")
        return profile

    profiles = discover_brave_profiles(root)
    if not profiles:
        raise BraveSessionImportError("No Brave profile directories were found")

    with_substack = [item for item in profiles if item[1] > 0]
    if len(with_substack) == 1:
        profile, count = with_substack[0]
        print(f"Relay found one Brave profile with Substack cookies: {profile} [{count} cookies]")
        return profile

    print("Brave profiles found:")
    for index, (profile, count) in enumerate(profiles, start=1):
        print(f"  {index}. {profile} [{count} Substack cookies]")
    raw = input(f"Choose the Brave profile visibly signed into Substack [1-{len(profiles)}]: ").strip()
    try:
        choice = int(raw)
    except ValueError as exc:
        raise BraveSessionImportError("Profile choice must be a number") from exc
    if choice < 1 or choice > len(profiles):
        raise BraveSessionImportError("Profile choice is out of range")
    return profiles[choice - 1][0]


def _clone_profile(root: Path, profile: Path) -> tuple[Path, str]:
    clone_root = Path(".relay-auth/brave-clone")
    if clone_root.exists():
        shutil.rmtree(clone_root)
    clone_root.mkdir(parents=True, exist_ok=True)

    local_state = root / "Local State"
    if local_state.is_file():
        shutil.copy2(local_state, clone_root / "Local State")

    target = clone_root / profile.name
    ignored = shutil.ignore_patterns(
        "Cache", "Code Cache", "GPUCache", "DawnCache", "ShaderCache", "GrShaderCache",
        "Crashpad", "BrowserMetrics", "blob_storage", "optimization_guide_model_store"
    )
    try:
        shutil.copytree(profile, target, ignore=ignored)
    except OSError as exc:
        raise BraveSessionImportError(
            f"Could not clone the Brave profile: {exc}. Close Brave completely and retry."
        ) from exc
    return clone_root, profile.name


def _safe_cookie_payload(cookies: list[dict]) -> list[dict]:
    allowed = {"name", "value", "domain", "path", "expires", "httpOnly", "secure", "sameSite"}
    result: list[dict] = []
    for cookie in cookies:
        if "substack.com" not in str(cookie.get("domain", "")):
            continue
        result.append({key: value for key, value in cookie.items() if key in allowed})
    return result


def import_brave_session(manifest: RelayManifest, profile: Path | None = None) -> None:
    """Copy the authenticated Substack session from the user's local Brave profile.

    Relay clones the selected Brave profile into its git-ignored auth directory, opens the
    clone with Brave, verifies that the publisher dashboard is reachable, then copies only
    Substack cookies into Relay's Chromium profile. Cookie values are never printed.
    """

    root = _brave_root()
    executable = _brave_executable()
    selected = _choose_profile(root, profile)
    count = _substack_cookie_count(selected)
    if count == 0:
        raise BraveSessionImportError(
            "The selected Brave profile contains no Substack cookies. Choose the profile that is visibly signed into Substack."
        )

    clone_root, profile_name = _clone_profile(root, selected)

    playwright = sync_playwright().start()
    brave_context = None
    relay_context = None
    try:
        brave_context = playwright.chromium.launch_persistent_context(
            user_data_dir=str(clone_root),
            executable_path=executable,
            headless=False,
            viewport={"width": 1440, "height": 1000},
            args=[f"--profile-directory={profile_name}", "--no-first-run", "--no-default-browser-check"],
        )
        brave_page = brave_context.pages[0] if brave_context.pages else brave_context.new_page()
        brave_page.goto(manifest.dashboard_url, wait_until="domcontentloaded")
        if "sign-in" in brave_page.url or "signin" in brave_page.url:
            raise BraveSessionImportError(
                "The cloned Brave profile did not retain the signed-in Substack session. Close Brave completely and retry the import."
            )

        cookies = _safe_cookie_payload(brave_context.cookies())
        if not cookies:
            raise BraveSessionImportError("Brave opened the dashboard but Relay could not obtain Substack session cookies")

        auth_dir = Path(".relay-auth/substack")
        auth_dir.mkdir(parents=True, exist_ok=True)
        relay_context = playwright.chromium.launch_persistent_context(
            user_data_dir=str(auth_dir),
            headless=False,
            viewport={"width": 1440, "height": 1000},
        )
        relay_context.add_cookies(cookies)
        relay_page = relay_context.pages[0] if relay_context.pages else relay_context.new_page()
        relay_page.goto(manifest.dashboard_url, wait_until="domcontentloaded")
        if "sign-in" in relay_page.url or "signin" in relay_page.url:
            raise BraveSessionImportError(
                "Substack rejected the copied Brave session in Relay Chromium. No cookie values were printed or uploaded."
            )

        print("BRAVE_SESSION_IMPORT_PASS")
        print(f"Source profile: {selected}")
        print(f"Imported Substack cookies: {len(cookies)}")
        print("Relay Chromium is now using a local copy of the Brave Substack session.")
        input("Confirm the publisher dashboard is visible in Relay Chromium, then press Enter: ")
    finally:
        if relay_context is not None:
            relay_context.close()
        if brave_context is not None:
            brave_context.close()
        playwright.stop()
