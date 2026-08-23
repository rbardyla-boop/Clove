from __future__ import annotations

import configparser
from pathlib import Path
import sqlite3

from playwright.sync_api import sync_playwright

from .manifest import RelayManifest


class FirefoxSessionImportError(RuntimeError):
    """Raised when Relay cannot safely import an existing Firefox Substack session."""


def _firefox_roots() -> list[Path]:
    home = Path.home()
    return [
        home / ".mozilla" / "firefox",
        home / "snap" / "firefox" / "common" / ".mozilla" / "firefox",
    ]


def discover_firefox_profiles() -> list[Path]:
    """Return Firefox profiles that contain a cookies.sqlite database.

    Profiles are ordered by most recently modified cookie database first, which is
    usually the profile currently used by the human. Relay still shows the choices
    before importing when more than one profile is available.
    """

    found: dict[Path, float] = {}
    for root in _firefox_roots():
        if not root.exists():
            continue

        ini = root / "profiles.ini"
        if ini.exists():
            config = configparser.ConfigParser()
            try:
                config.read(ini)
            except configparser.Error:
                config = configparser.ConfigParser()

            for section in config.sections():
                if not section.startswith("Profile"):
                    continue
                raw = config.get(section, "Path", fallback="").strip()
                if not raw:
                    continue
                relative = config.get(section, "IsRelative", fallback="1") == "1"
                profile = (root / raw) if relative else Path(raw).expanduser()
                cookies = profile / "cookies.sqlite"
                if cookies.is_file():
                    try:
                        found[profile.resolve()] = cookies.stat().st_mtime
                    except OSError:
                        found[profile.resolve()] = 0.0

        # Fallback for unusual Firefox installations whose profiles.ini is stale.
        for cookies in root.glob("*/cookies.sqlite"):
            profile = cookies.parent
            try:
                found[profile.resolve()] = max(found.get(profile.resolve(), 0.0), cookies.stat().st_mtime)
            except OSError:
                found.setdefault(profile.resolve(), 0.0)

    return [path for path, _mtime in sorted(found.items(), key=lambda item: item[1], reverse=True)]


def _select_profile(explicit: Path | None) -> Path:
    if explicit is not None:
        profile = explicit.expanduser().resolve()
        if not (profile / "cookies.sqlite").is_file():
            raise FirefoxSessionImportError(f"Firefox profile has no cookies.sqlite: {profile}")
        return profile

    profiles = discover_firefox_profiles()
    if not profiles:
        raise FirefoxSessionImportError(
            "No Firefox profile with cookies.sqlite was found under ~/.mozilla/firefox "
            "or ~/snap/firefox/common/.mozilla/firefox"
        )
    if len(profiles) == 1:
        return profiles[0]

    print("Firefox profiles found:")
    for index, profile in enumerate(profiles, start=1):
        print(f"  {index}. {profile}")
    raw = input(f"Choose the profile that is already signed into Substack [1-{len(profiles)}]: ").strip()
    try:
        choice = int(raw)
    except ValueError as exc:
        raise FirefoxSessionImportError("Profile choice must be a number") from exc
    if choice < 1 or choice > len(profiles):
        raise FirefoxSessionImportError("Profile choice is out of range")
    return profiles[choice - 1]


def _read_substack_cookies(profile: Path) -> list[dict]:
    database = profile / "cookies.sqlite"
    try:
        connection = sqlite3.connect(f"file:{database}?mode=ro", uri=True, timeout=5)
    except sqlite3.Error as exc:
        raise FirefoxSessionImportError(
            f"Could not open Firefox cookie database: {exc}. If Firefox is busy, close it and retry."
        ) from exc

    try:
        columns = {row[1] for row in connection.execute("PRAGMA table_info(moz_cookies)")}
        required = {"host", "name", "value", "path", "expiry", "isSecure", "isHttpOnly"}
        missing = required - columns
        if missing:
            raise FirefoxSessionImportError(
                f"Firefox cookie schema is missing expected fields: {', '.join(sorted(missing))}"
            )

        rows = connection.execute(
            """
            SELECT host, name, value, path, expiry, isSecure, isHttpOnly
            FROM moz_cookies
            WHERE host = 'substack.com'
               OR host = '.substack.com'
               OR host LIKE '%.substack.com'
            """
        ).fetchall()
    except sqlite3.Error as exc:
        raise FirefoxSessionImportError(f"Could not read Firefox Substack cookies: {exc}") from exc
    finally:
        connection.close()

    cookies: list[dict] = []
    for host, name, value, path, expiry, secure, http_only in rows:
        if not name or value is None:
            continue
        item: dict = {
            "name": str(name),
            "value": str(value),
            "domain": str(host),
            "path": str(path or "/"),
            "secure": bool(secure),
            "httpOnly": bool(http_only),
        }
        try:
            expiry_value = int(expiry or 0)
        except (TypeError, ValueError):
            expiry_value = 0
        if expiry_value > 0:
            item["expires"] = float(expiry_value)
        cookies.append(item)

    if not cookies:
        raise FirefoxSessionImportError(
            "The selected Firefox profile contains no Substack cookies. Choose the profile that is visibly signed into Substack."
        )
    return cookies


def import_firefox_session(manifest: RelayManifest, profile: Path | None = None) -> None:
    """Copy only Substack cookies from an existing local Firefox profile into Relay.

    Cookie values never leave the machine, are never printed, and are persisted only
    inside Relay's git-ignored .relay-auth/substack browser profile.
    """

    selected = _select_profile(profile)
    cookies = _read_substack_cookies(selected)

    auth_dir = Path(".relay-auth/substack")
    auth_dir.mkdir(parents=True, exist_ok=True)

    playwright = sync_playwright().start()
    context = playwright.chromium.launch_persistent_context(
        user_data_dir=str(auth_dir),
        headless=False,
        viewport={"width": 1440, "height": 1000},
    )
    page = context.pages[0] if context.pages else context.new_page()
    try:
        context.add_cookies(cookies)
        page.goto(manifest.dashboard_url, wait_until="domcontentloaded")
        if "sign-in" in page.url or "signin" in page.url:
            raise FirefoxSessionImportError(
                "Substack rejected the imported Firefox session. Relay did not alter or print the cookies."
            )

        print("FIREFOX_SESSION_IMPORT_PASS")
        print(f"Source profile: {selected}")
        print(f"Imported Substack cookies: {len(cookies)}")
        print("Relay Chromium is now using the copied local Substack session.")
        input("Confirm the publisher dashboard is visible, then press Enter: ")
    finally:
        context.close()
        playwright.stop()
