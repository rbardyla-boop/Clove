from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime
import hashlib
import json
from pathlib import Path
from typing import Iterable


@dataclass(frozen=True)
class PostReceipt:
    index: int
    title: str
    requested_publish_at: str
    source_sha256: str
    result: str
    final_action: str = "not_executed"
    verification: str | None = None
    screenshot: str | None = None


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def write_receipts(
    receipts: Iterable[PostReceipt],
    *,
    verdict: str,
    out_dir: str | Path = ".relay-receipts",
    planned: int | None = None,
) -> tuple[Path, Path]:
    target = Path(out_dir)
    target.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().astimezone().strftime("%Y%m%d-%H%M%S")
    json_path = target / f"relay-run-{stamp}.json"
    text_path = target / f"relay-run-{stamp}.txt"
    rows = list(receipts)

    payload = {
        "generated_at": datetime.now().astimezone().isoformat(),
        "verdict": verdict,
        "planned": len(rows) if planned is None else planned,
        "verified": sum(1 for row in rows if row.result.endswith("_VERIFIED")),
        "failed": sum(1 for row in rows if row.result == "FAILED"),
        "posts": [asdict(row) for row in rows],
    }
    json_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    lines = [
        "CLOVE RELAY RUN",
        f"Planned: {payload['planned']}",
        f"Verified: {payload['verified']}",
        f"Failed: {payload['failed']}",
        "Immediate publishes: 0 (Relay never chooses immediate publish as fallback)",
        "",
        f"VERDICT: {verdict}",
        "",
    ]
    for row in rows:
        lines.append(
            f"[{row.index:02d}] {row.result} | {row.requested_publish_at} | {row.title} | "
            f"final_action={row.final_action} | sha256={row.source_sha256}"
        )
        if row.verification:
            lines.append(f"     verification: {row.verification}")
        if row.screenshot:
            lines.append(f"     screenshot: {row.screenshot}")
    text_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return json_path, text_path
