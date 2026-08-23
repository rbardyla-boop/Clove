from __future__ import annotations

import argparse
from pathlib import Path
import sys

from .adapters.brave_direct import BraveDirectError, BraveDirectSubstackAdapter
from .adapters.substack_playwright import RelayStop, SubstackPlaywrightAdapter
from .brave_session import BraveSessionImportError, import_brave_session
from .firefox_session import FirefoxSessionImportError, import_firefox_session
from .manifest import load_manifest
from .receipts import write_receipts
from .validate import resolved_time, validate_manifest


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="clove-relay",
        description="Local-first, human-confirmed scheduled publishing relay",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    def with_manifest(
        name: str,
        help_text: str,
        *,
        post: bool = False,
        time: bool = False,
        browser: bool = False,
    ):
        p = sub.add_parser(name, help=help_text)
        p.add_argument("manifest", type=Path)
        if post:
            p.add_argument("--post", type=int, required=True, help="1-based post index")
        if time:
            p.add_argument(
                "--default-time",
                help="HH:MM local publish time used when the manifest omits publish_time",
            )
        if browser:
            p.add_argument(
                "--browser",
                choices=("relay", "brave"),
                default="relay",
                help="relay = isolated Relay Chromium profile; brave = use the existing local Brave profile directly",
            )
            p.add_argument(
                "--brave-profile",
                type=Path,
                help="Explicit Brave profile directory when --browser brave is used",
            )
        return p

    with_manifest("validate", "Validate the manifest and source packets", time=True)
    with_manifest("login", "Open the persistent local Substack login session")

    brave_check = with_manifest(
        "brave-check",
        "Open the existing Brave profile and prove the authenticated publisher dashboard is reachable without editing a post",
    )
    brave_check.add_argument(
        "--profile",
        type=Path,
        help="Explicit Brave profile directory; omit to use Default/auto-discover",
    )

    import_brave = with_manifest(
        "import-brave-session",
        "Copy only the authenticated Substack session from a local Brave profile",
    )
    import_brave.add_argument(
        "--profile",
        type=Path,
        help="Explicit Brave profile directory; omit to auto-discover and choose",
    )

    import_firefox = with_manifest(
        "import-firefox-session",
        "Copy only Substack cookies from an already-authenticated local Firefox profile",
    )
    import_firefox.add_argument(
        "--profile",
        type=Path,
        help="Explicit Firefox profile directory; omit to auto-discover and choose",
    )

    with_manifest("dry-run", "Fill one post and stop before Schedule", post=True, time=True, browser=True)
    with_manifest("qualify", "Schedule and verify exactly one post", post=True, time=True, browser=True)
    with_manifest("schedule", "Schedule and verify the full batch sequentially", time=True, browser=True)
    with_manifest("verify", "Check expected titles in the Scheduled area", time=False, browser=True)
    return parser


def _select_post(posts, index: int):
    if index < 1 or index > len(posts):
        raise ValueError(f"--post must be between 1 and {len(posts)}")
    return posts[index - 1]


def _resolved_or_fail(post, default_time: str | None):
    value = resolved_time(post.spec, default_time)
    if value is None:
        raise ValueError(
            f"post {post.spec.index} {post.spec.title!r} has no publish time; "
            "supply --default-time HH:MM"
        )
    return value


def _adapter_for(args, manifest):
    if getattr(args, "browser", "relay") == "brave":
        return BraveDirectSubstackAdapter(
            manifest,
            profile=getattr(args, "brave_profile", None),
        )
    return SubstackPlaywrightAdapter(manifest)


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    try:
        manifest = load_manifest(args.manifest)

        if args.command == "validate":
            result = validate_manifest(
                manifest,
                default_time=args.default_time,
                require_time=False,
            )
            print(f"VALIDATION_PASS: {len(result.posts)} posts")
            for warning in result.warnings:
                print(f"WARNING: {warning}")
            if result.warnings:
                print("Dates are frozen. Supply --default-time HH:MM when scheduling.")
            return 0

        if args.command == "brave-check":
            adapter = BraveDirectSubstackAdapter(manifest, profile=args.profile)
            adapter.check_session()
            return 0

        if args.command == "import-brave-session":
            import_brave_session(manifest, profile=args.profile)
            return 0

        if args.command == "import-firefox-session":
            import_firefox_session(manifest, profile=args.profile)
            return 0

        if args.command == "login":
            SubstackPlaywrightAdapter(manifest).login()
            return 0

        adapter = _adapter_for(args, manifest)

        if args.command == "dry-run":
            result = validate_manifest(
                manifest,
                default_time=args.default_time,
                require_time=True,
            )
            post = _select_post(result.posts, args.post)
            publish_time = _resolved_or_fail(post, args.default_time)
            receipt = adapter.run_one(post, publish_time, dry_run=True)
            json_path, text_path = write_receipts([receipt], verdict="DRY_RUN_COMPLETE")
            print(f"Receipt: {text_path}")
            print(f"JSON: {json_path}")
            return 0

        if args.command == "qualify":
            result = validate_manifest(
                manifest,
                default_time=args.default_time,
                require_time=True,
            )
            post = _select_post(result.posts, args.post)
            publish_time = _resolved_or_fail(post, args.default_time)
            receipt = adapter.run_one(post, publish_time, dry_run=False)
            json_path, text_path = write_receipts([receipt], verdict="QUALIFICATION_PASS")
            print(f"QUALIFICATION_PASS: {post.spec.title}")
            print(f"Receipt: {text_path}")
            print(f"JSON: {json_path}")
            return 0

        if args.command == "schedule":
            result = validate_manifest(
                manifest,
                default_time=args.default_time,
                require_time=True,
            )
            posts_with_times = [
                (post, _resolved_or_fail(post, args.default_time)) for post in result.posts
            ]
            print(f"BATCH_READY: {len(posts_with_times)} posts")
            print("v0.1 requires a human SCHEDULE confirmation for every final Schedule click.")
            answer = input("Type BEGIN to start the batch: ").strip()
            if answer != "BEGIN":
                raise ValueError("batch was not authorized")
            receipts = adapter.run_batch(posts_with_times)
            verdict = "READY_FOR_DETOX" if len(receipts) == len(posts_with_times) else "INCOMPLETE"
            json_path, text_path = write_receipts(receipts, verdict=verdict)
            print(f"VERDICT: {verdict}")
            print(f"Receipt: {text_path}")
            print(f"JSON: {json_path}")
            return 0

        if args.command == "verify":
            result = validate_manifest(manifest, require_time=False)
            rows = adapter.verify_batch(list(result.posts))
            failed = [row for row in rows if not row[2]]
            for index, title, found in rows:
                print(f"[{index:02d}] {'FOUND' if found else 'MISSING'} | {title}")
            if failed:
                print(f"VERIFY_FAIL: {len(failed)} expected titles not found")
                return 2
            print(f"VERIFY_TITLE_PASS: {len(rows)} expected titles visible in Scheduled")
            print("Note: v0.1 title verification is not a substitute for the per-post visual date/audience check.")
            return 0

        raise AssertionError(f"unhandled command {args.command}")

    except (
        ValueError,
        OSError,
        RelayStop,
        BraveSessionImportError,
        FirefoxSessionImportError,
        BraveDirectError,
    ) as exc:
        print(f"RELAY_STOP: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
