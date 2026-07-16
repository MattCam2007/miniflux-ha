#!/usr/bin/env python3
"""Enforce per-module coverage floors (plans/00-overview.md §5).

``coverage.py`` only supports a single global ``fail_under``; the plan calls
for three floors by ring (pure core 100%, adapter >=95%, HA-coupled >=90%).
This script reads ``coverage.json`` (produced by ``pytest --cov-report=json``)
and checks each file in ``custom_components/miniflux`` against its ring's
floor. Run after pytest in CI; exits non-zero (and prints every violation)
if any file is under its floor.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

PACKAGE = "custom_components/miniflux"

# Phase 1 pure-core modules: 100% line+branch, no exceptions.
PURE_CORE = {
    "models.py",
    "timeutil.py",
    "normalize.py",
    "filters.py",
    "signature.py",
    "webhook_payload.py",
    "rollup.py",
    "transitions.py",
    "errors.py",
}

# Phase 2 adapter: >=95%.
ADAPTER = {"api.py"}

PURE_CORE_FLOOR = 100.0
ADAPTER_FLOOR = 95.0
DEFAULT_FLOOR = 90.0  # HA-coupled ring: coordinator, flows, entities, services, webhook, repairs.

# Files exempt from floors entirely (declarative/no-logic).
EXEMPT = {"__init__.py", "const.py"}


def floor_for(filename: str) -> float | None:
    if filename in EXEMPT:
        return None
    if filename in PURE_CORE:
        return PURE_CORE_FLOOR
    if filename in ADAPTER:
        return ADAPTER_FLOOR
    return DEFAULT_FLOOR


def main() -> int:
    coverage_path = Path("coverage.json")
    if not coverage_path.exists():
        print(f"::error::{coverage_path} not found — run pytest with --cov-report=json first")
        return 1

    data = json.loads(coverage_path.read_text())
    failures: list[str] = []
    checked = 0

    for filepath, filedata in data.get("files", {}).items():
        posix_path = filepath.replace("\\", "/")
        if PACKAGE not in posix_path:
            continue
        filename = Path(posix_path).name
        floor = floor_for(filename)
        if floor is None:
            continue

        checked += 1
        summary = filedata["summary"]
        percent = summary["percent_covered"]
        if percent < floor:
            missing_lines = summary.get("missing_lines", 0)
            missing_branches = summary.get("missing_branches", 0)
            failures.append(
                f"  {posix_path}: {percent:.1f}% < floor {floor:.0f}% "
                f"(missing {missing_lines} lines, {missing_branches} branches)"
            )

    if failures:
        print(f"Coverage floor violations ({len(failures)}):")
        print("\n".join(failures))
        return 1

    print(f"All {checked} covered files meet their per-module floor.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
