#!/usr/bin/env python3
"""Verify Phase 1 pure-core modules never import homeassistant.

Phase 1 exit criteria (plans/02-pure-core.md): "no homeassistant import in
any Phase-1 module" -- this is the seam that makes those modules testable
with plain pytest and zero HA framework coupling (seam rule 5, overview §4).

Each module is imported in its own subprocess so sys.modules starts clean;
if homeassistant ends up loaded anyway, that proves a real (possibly
transitive) framework dependency a source-level grep could miss.
"""

from __future__ import annotations

import subprocess
import sys

PURE_CORE_MODULES = [
    "models",
    "timeutil",
    "normalize",
    "filters",
    "signature",
    "webhook_payload",
    "rollup",
    "transitions",
    "errors",
]

_CHECK_TEMPLATE = """
import sys
import custom_components.miniflux.{module}
leaked = sorted(m for m in sys.modules if m == "homeassistant" or m.startswith("homeassistant."))
if leaked:
    print("HA_IMPORTS_LEAKED:" + ",".join(leaked))
    sys.exit(1)
sys.exit(0)
"""


def main() -> int:
    failures: list[str] = []

    for module in PURE_CORE_MODULES:
        result = subprocess.run(
            [sys.executable, "-c", _CHECK_TEMPLATE.format(module=module)],
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            reason = result.stdout.strip() or result.stderr.strip().splitlines()[-1:]
            failures.append(f"custom_components.miniflux.{module}: {reason}")

    if failures:
        print(f"Framework-freedom violations ({len(failures)}):")
        for failure in failures:
            print(f"  {failure}")
        return 1

    print(f"All {len(PURE_CORE_MODULES)} pure-core modules import cleanly with zero homeassistant imports.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
