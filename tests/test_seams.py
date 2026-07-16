"""Architectural seam guards that aren't naturally exercised by behavioral
tests (plans/00-overview.md §4). A violation here means a module has grown
a responsibility it shouldn't have -- not a bug in that module's own logic.
"""

from __future__ import annotations

import re
from pathlib import Path

PACKAGE_DIR = Path(__file__).parent.parent / "custom_components" / "miniflux"
_IMPORT_AIOHTTP_RE = re.compile(r"^\s*(import aiohttp\b|from aiohttp\b)", re.MULTILINE)


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
