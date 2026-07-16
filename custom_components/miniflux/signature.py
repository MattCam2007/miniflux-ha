"""Central HMAC verification for Miniflux's native webhook (architecture D1, §3.4).

This is the whole reason the webhook receiver lives inside the integration
rather than asking every automation author to hand-roll verification: one
audited implementation, used for every delivery. ``verify`` never raises —
any malformed input is a rejection (False), not an exception that could
destabilize the webhook handler into a fail-open state.
"""

from __future__ import annotations

import hashlib
import hmac
from collections.abc import Mapping

from .const import WEBHOOK_HEADER_EVENT_TYPE


def verify(secret: str, raw_body: bytes, provided_signature: str) -> bool:
    """Verify a hex HMAC-SHA256 signature over the raw body (ASSUMED R1).

    Returns False (never raises) for any unverifiable input: missing/empty
    secret, missing/empty/non-string/non-hex/wrong-length signature.
    """
    if not secret or not isinstance(provided_signature, str) or not provided_signature:
        return False
    expected = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    # Both sides are guaranteed `str` here (expected from hexdigest(), provided
    # via the isinstance check above), so compare_digest cannot raise TypeError.
    # Hex case carries no security meaning; compare case-insensitively so an
    # uppercase-hex sender isn't spuriously rejected.
    return hmac.compare_digest(expected, provided_signature.strip().lower())


def extract_event_type(headers: Mapping[str, str]) -> str | None:
    """Read Miniflux's event-type header (case-insensitive lookup)."""
    if WEBHOOK_HEADER_EVENT_TYPE in headers:
        return headers[WEBHOOK_HEADER_EVENT_TYPE]
    lowered = {key.lower(): value for key, value in headers.items()}
    return lowered.get(WEBHOOK_HEADER_EVENT_TYPE.lower())
