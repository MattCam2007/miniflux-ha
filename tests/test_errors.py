"""Chunk 1.9 — typed error hierarchy + HTTP->error mapping (architecture §3.1).

Pure; api.py (Phase 2) raises these, everyone else catches them. This is the
contract Phase 3 translates into ConfigEntryAuthFailed/HomeAssistantError/
UpdateFailed and Phase 5 translates into service-call failures.
"""

from __future__ import annotations

from custom_components.miniflux import errors


class TestErrorHierarchy:
    def test_all_specific_errors_are_miniflux_error_subclasses(self):
        for cls in (
            errors.MinifluxConnectionError,
            errors.MinifluxAuthError,
            errors.MinifluxBadRequestError,
            errors.MinifluxNotFoundError,
            errors.MinifluxServerError,
        ):
            assert issubclass(cls, errors.MinifluxError)

    def test_miniflux_error_is_an_exception(self):
        assert issubclass(errors.MinifluxError, Exception)


class TestMapHttpError:
    def test_401_maps_to_auth_error(self):
        err = errors.map_http_error(401, {"error_message": "invalid token"})
        assert isinstance(err, errors.MinifluxAuthError)
        assert err.detail == "invalid token"
        assert err.status == 401

    def test_400_maps_to_bad_request_with_message_verbatim(self):
        err = errors.map_http_error(400, {"error_message": "feed_url is required"})
        assert isinstance(err, errors.MinifluxBadRequestError)
        assert err.detail == "feed_url is required"
        assert err.status == 400

    def test_422_maps_to_bad_request(self):
        err = errors.map_http_error(422, {"error_message": "invalid category"})
        assert isinstance(err, errors.MinifluxBadRequestError)
        assert err.detail == "invalid category"

    def test_404_maps_to_not_found(self):
        err = errors.map_http_error(404, None)
        assert isinstance(err, errors.MinifluxNotFoundError)
        assert err.status == 404

    def test_500_maps_to_server_error_with_string_body(self):
        err = errors.map_http_error(500, "internal server error")
        assert isinstance(err, errors.MinifluxServerError)
        assert err.detail == "internal server error"
        assert err.status == 500

    def test_503_maps_to_server_error(self):
        err = errors.map_http_error(503, None)
        assert isinstance(err, errors.MinifluxServerError)
        assert err.status == 503

    def test_unknown_status_maps_to_base_error_with_status(self):
        err = errors.map_http_error(418, None)
        assert type(err) is errors.MinifluxError
        assert err.status == 418

    def test_missing_error_message_key_gets_nonempty_fallback_detail(self):
        err = errors.map_http_error(404, {})
        assert err.detail

    def test_none_body_gets_nonempty_fallback_detail(self):
        err = errors.map_http_error(500, None)
        assert err.detail


class TestUserMessage:
    def test_connection_error_mentions_unreachable_and_url(self):
        err = errors.MinifluxConnectionError("connection timed out")
        msg = errors.user_message(err, instance_url="https://reader.example.lan")
        assert "unreachable" in msg.lower()
        assert "https://reader.example.lan" in msg
        assert "connection timed out" in msg

    def test_auth_error_message_carries_detail(self):
        err = errors.MinifluxAuthError("invalid token")
        msg = errors.user_message(err)
        assert "invalid token" in msg

    def test_bad_request_message_carries_detail_verbatim(self):
        err = errors.map_http_error(400, {"error_message": "feed_url is required"})
        msg = errors.user_message(err)
        assert "feed_url is required" in msg

    def test_not_found_message(self):
        err = errors.map_http_error(404, {"error_message": "entry not found"})
        msg = errors.user_message(err)
        assert "entry not found" in msg

    def test_server_error_message(self):
        err = errors.map_http_error(500, {"error_message": "database unavailable"})
        msg = errors.user_message(err)
        assert "database unavailable" in msg

    def test_works_without_instance_url(self):
        err = errors.MinifluxServerError("internal error", status=500)
        msg = errors.user_message(err)
        assert "internal error" in msg

    def test_base_error_type_produces_a_message(self):
        err = errors.map_http_error(418, {"error_message": "I'm a teapot"})
        msg = errors.user_message(err)
        assert "I'm a teapot" in msg
