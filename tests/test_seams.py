"""Architectural seam guards that aren't naturally exercised by behavioral
tests (plans/00-overview.md §4). A violation here means a module has grown
a responsibility it shouldn't have -- not a bug in that module's own logic.
"""

from __future__ import annotations

import re
from pathlib import Path

PACKAGE_DIR = Path(__file__).parent.parent / "custom_components" / "miniflux"
_IMPORT_AIOHTTP_RE = re.compile(r"^\s*(import aiohttp\b|from aiohttp\b)", re.MULTILINE)
_IMPORT_HA_RE = re.compile(r"^\s*(import homeassistant\b|from homeassistant\b)", re.MULTILINE)

# Phase 1 pure-core modules (plans/02-pure-core.md): must have zero
# homeassistant import in their own source. Framework-freedom is checked at
# the source level, not dynamically via "importable with HA absent" -- once
# __init__.py (Phase 3) legitimately imports homeassistant for entry setup,
# Python's import model means importing *any* submodule of this package
# transitively runs __init__.py first, so a dynamic sys.modules check would
# flag every module in the package, pure-core or not. That's an inherent
# property of all HA custom_components (the package's own __init__.py always
# needs HA), not a coupling problem in these specific modules -- the thing
# that's actually architecturally meaningful is that their own source never
# references an HA API, which is exactly what this checks.
PURE_CORE_MODULES = (
    "models.py",
    "timeutil.py",
    "normalize.py",
    "filters.py",
    "signature.py",
    "webhook_payload.py",
    "rollup.py",
    "transitions.py",
    "errors.py",
)


def test_only_api_module_imports_aiohttp():
    """All HTTP lives in api.py (seam corollary, plans/00-overview.md §4) --
    if another module starts importing aiohttp, it has taken on an HTTP
    responsibility that belongs in the client instead."""
    offenders = []
    for path in PACKAGE_DIR.glob("*.py"):
        if path.name in ("api.py", "__init__.py"):
            continue
        if _IMPORT_AIOHTTP_RE.search(path.read_text()):
            offenders.append(path.name)

    assert offenders == [], f"unexpected aiohttp import(s) outside api.py: {offenders}"


def test_api_module_does_import_aiohttp():
    """Sanity check that the guard above isn't vacuously true."""
    assert _IMPORT_AIOHTTP_RE.search((PACKAGE_DIR / "api.py").read_text())


def test_pure_core_modules_have_no_homeassistant_import():
    """Phase 1 exit criteria (plans/02-pure-core.md): these modules' own
    logic never references an HA API -- see PURE_CORE_MODULES docstring
    above for why this is a source check, not a dynamic import check."""
    offenders = []
    for name in PURE_CORE_MODULES:
        path = PACKAGE_DIR / name
        if _IMPORT_HA_RE.search(path.read_text()):
            offenders.append(name)

    assert offenders == [], f"unexpected homeassistant import(s) in: {offenders}"


def test_init_module_does_import_homeassistant():
    """Sanity check that the guard above isn't vacuously true -- __init__.py
    legitimately needs homeassistant for entry setup (Phase 3)."""
    assert _IMPORT_HA_RE.search((PACKAGE_DIR / "__init__.py").read_text())
