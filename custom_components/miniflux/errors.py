"""Typed error hierarchy + HTTP -> error mapping (architecture §3.1 error table).

Pure: api.py raises these, nothing else in the codebase touches an HTTP
status code or response body directly. Phase 3 translates these into
ConfigEntryAuthFailed/UpdateFailed; Phase 5 translates them into HA service
call failures via user_message().
"""

from __future__ import annotations


class MinifluxError(Exception):
    """Base for all typed Miniflux client errors. Carries a human-readable
    ``detail`` and the originating HTTP ``status`` (None for connection
    failures, which never reached an HTTP response)."""

    def __init__(self, detail: str, *, status: int | None = None):
        super().__init__(detail)
        self.detail = detail
        self.status = status


class MinifluxConnectionError(MinifluxError):
    """Timeout, connect, DNS, or TLS failure -- Miniflux unreachable."""


class MinifluxAuthError(MinifluxError):
    """401 -- invalid or expired API key."""


class MinifluxBadRequestError(MinifluxError):
    """400/422 -- the caller sent something Miniflux rejected."""


class MinifluxNotFoundError(MinifluxError):
    """404."""


class MinifluxServerError(MinifluxError):
    """5xx."""


_LEAD_IN = {
    MinifluxConnectionError: "Miniflux unreachable",
    MinifluxAuthError: "Miniflux authentication failed",
    MinifluxBadRequestError: "Miniflux rejected the request",
    MinifluxNotFoundError: "Miniflux resource not found",
    MinifluxServerError: "Miniflux server error",
}


def map_http_error(status: int, body: dict | str | None) -> MinifluxError:
    detail = _extract_detail(status, body)
    if status == 401:
        return MinifluxAuthError(detail, status=status)
    if status in (400, 422):
        return MinifluxBadRequestError(detail, status=status)
    if status == 404:
        return MinifluxNotFoundError(detail, status=status)
    if status >= 500:
        return MinifluxServerError(detail, status=status)
    return MinifluxError(detail, status=status)


def _extract_detail(status: int, body: dict | str | None) -> str:
    if isinstance(body, dict):
        message = body.get("error_message")
        if isinstance(message, str) and message:
            return message
    elif isinstance(body, str) and body:
        return body
    return f"HTTP {status} with no error detail from Miniflux"


def user_message(err: MinifluxError, *, instance_url: str | None = None) -> str:
    """The human string surfaced in service errors and logs (architecture
    §3.1 "Surfaced as" column)."""
    lead_in = _LEAD_IN.get(type(err), "Miniflux error")
    where = f" at {instance_url}" if instance_url else ""
    return f"{lead_in}{where}: {err.detail}"
