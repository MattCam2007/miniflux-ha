"""Chunk 1.5 — central HMAC verification (architecture D1, §3.4).

The security crux: unsigned/malformed payloads must never verify, and
verification must never raise (a raise here could crash the webhook handler
in a way that risks fail-open behavior upstream).
"""

from __future__ import annotations

import hashlib
import hmac
from unittest.mock import patch

from custom_components.miniflux import signature
from custom_components.miniflux.const import WEBHOOK_HEADER_EVENT_TYPE, WEBHOOK_HEADER_SIGNATURE

SECRET = "s3cr3t-webhook-key"
BODY = b'{"event_type":"new_entries","feed":{"id":1},"entries":[]}'


def _sign(secret: str, body: bytes) -> str:
    return hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()


class TestVerify:
    def test_correct_signature_returns_true(self):
        sig = _sign(SECRET, BODY)
        assert signature.verify(SECRET, BODY, sig) is True

    def test_wrong_secret_returns_false(self):
        sig = _sign(SECRET, BODY)
        assert signature.verify("wrong-secret", BODY, sig) is False

    def test_wrong_body_returns_false(self):
        sig = _sign(SECRET, BODY)
        assert signature.verify(SECRET, b"tampered body", sig) is False

    def test_wrong_signature_returns_false(self):
        sig = _sign(SECRET, BODY)
        wrong = sig[:-1] + ("0" if sig[-1] != "0" else "1")
        assert signature.verify(SECRET, BODY, wrong) is False

    def test_empty_secret_returns_false_not_exception(self):
        sig = _sign(SECRET, BODY)
        assert signature.verify("", BODY, sig) is False

    def test_none_secret_returns_false_not_exception(self):
        sig = _sign(SECRET, BODY)
        assert signature.verify(None, BODY, sig) is False  # type: ignore[arg-type]

    def test_empty_signature_returns_false(self):
        assert signature.verify(SECRET, BODY, "") is False

    def test_none_signature_returns_false_not_exception(self):
        assert signature.verify(SECRET, BODY, None) is False  # type: ignore[arg-type]

    def test_non_hex_signature_returns_false_not_exception(self):
        assert signature.verify(SECRET, BODY, "not-a-hex-signature-at-all!!") is False

    def test_truncated_signature_returns_false_not_exception(self):
        sig = _sign(SECRET, BODY)
        assert signature.verify(SECRET, BODY, sig[:10]) is False

    def test_non_string_signature_returns_false_not_exception(self):
        assert signature.verify(SECRET, BODY, 12345) is False  # type: ignore[arg-type]

    def test_uppercase_hex_signature_still_verifies(self):
        """Case carries no security meaning in hex; don't spuriously reject it."""
        sig = _sign(SECRET, BODY).upper()
        assert signature.verify(SECRET, BODY, sig) is True

    def test_uses_hmac_compare_digest(self):
        """Proves the comparison goes through the constant-time primitive,
        not a naive == that would leak timing information."""
        sig = _sign(SECRET, BODY)
        with patch(
            "custom_components.miniflux.signature.hmac.compare_digest",
            wraps=hmac.compare_digest,
        ) as spy:
            assert signature.verify(SECRET, BODY, sig) is True
        spy.assert_called_once()


class TestExtractEventType:
    def test_finds_exact_header_name(self):
        headers = {WEBHOOK_HEADER_EVENT_TYPE: "new_entries"}
        assert signature.extract_event_type(headers) == "new_entries"

    def test_case_insensitive_header_lookup(self):
        headers = {WEBHOOK_HEADER_EVENT_TYPE.lower(): "save_entry"}
        assert signature.extract_event_type(headers) == "save_entry"

    def test_missing_header_returns_none(self):
        assert signature.extract_event_type({}) is None

    def test_unrelated_headers_return_none(self):
        headers = {"Content-Type": "application/json"}
        assert signature.extract_event_type(headers) is None


class TestSignedWebhookRequestFixtureAgreesWithVerify:
    """Pins the conftest signing helper against this module's verifier so a
    drift between them can't silently pass Phase 6 tests later."""

    def test_fixture_produces_a_signature_verify_accepts(self, signed_webhook_request):
        raw_body, headers = signed_webhook_request(SECRET, {"event_type": "new_entries"})
        assert signature.verify(SECRET, raw_body, headers[WEBHOOK_HEADER_SIGNATURE]) is True

    def test_fixture_with_wrong_secret_is_rejected(self, signed_webhook_request):
        raw_body, headers = signed_webhook_request(SECRET, {"event_type": "new_entries"})
        sig = headers[WEBHOOK_HEADER_SIGNATURE]
        assert signature.verify("different-secret", raw_body, sig) is False

    def test_fixture_sets_event_type_header(self, signed_webhook_request):
        _, headers = signed_webhook_request(SECRET, {}, event_type="save_entry")
        assert signature.extract_event_type(headers) == "save_entry"
