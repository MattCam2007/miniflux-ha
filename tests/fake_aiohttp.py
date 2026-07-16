"""A minimal aiohttp.ClientSession stand-in for api.py's adapter-ring tests
(architecture §8.2). Gives tests precise, deterministic control over
responses, sequential retry behavior, and in-flight concurrency timing —
control a third-party HTTP mock library doesn't expose as directly.

Not a pytest fixture module; import the classes directly and construct a
FakeSession per test.
"""

from __future__ import annotations

import asyncio
import json as json_module
from types import SimpleNamespace
from typing import Any


class FakeResponse:
    def __init__(
        self,
        status: int = 200,
        *,
        json_body: Any = None,
        text_body: str | None = None,
        text_raises: Exception | None = None,
    ):
        self.status = status
        self._text_raises = text_raises
        if text_body is not None:
            self._text_body = text_body
        elif json_body is not None:
            self._text_body = json_module.dumps(json_body)
        else:
            self._text_body = ""

    async def text(self) -> str:
        if self._text_raises is not None:
            raise self._text_raises
        return self._text_body


class _FakeRequestCtx:
    def __init__(self, session: FakeSession, method: str, url: str, kwargs: dict):
        self._session = session
        self.method = method
        self.url = url
        self.kwargs = kwargs

    async def __aenter__(self):
        self._session.calls.append(
            SimpleNamespace(method=self.method, url=self.url, kwargs=self.kwargs)
        )
        async with self._session._concurrency_lock:
            self._session.current_concurrent += 1
            self._session.max_concurrent = max(
                self._session.max_concurrent, self._session.current_concurrent
            )
        if self._session.artificial_delay:
            await asyncio.sleep(self._session.artificial_delay)

        outcome = self._session._next_outcome(self.url)
        if isinstance(outcome, Exception):
            async with self._session._concurrency_lock:
                self._session.current_concurrent -= 1
            raise outcome
        return outcome

    async def __aexit__(self, *exc_info):
        async with self._session._concurrency_lock:
            self._session.current_concurrent -= 1
        return False


class FakeSession:
    """Stands in for aiohttp.ClientSession.

    Two modes, exactly one of which is provided:

    - ``outcomes``: a list of FakeResponse/Exception consumed in order across
      successive calls (one entry per retry attempt); the last entry repeats
      once exhausted. Fits sequential scenarios (retries, pagination pages).
    - ``by_url``: a dict mapping the exact request URL to a FakeResponse/
      Exception. Fits concurrent per-target scenarios (e.g. hydrating several
      entry ids at once, where one specific id 404s) where asyncio.gather
      doesn't guarantee call order.
    """

    def __init__(
        self,
        outcomes: list | None = None,
        *,
        by_url: dict[str, Any] | None = None,
        artificial_delay: float = 0,
    ):
        assert outcomes is None or by_url is None, "pass outcomes or by_url, not both"
        self._outcomes = list(outcomes) if outcomes is not None else None
        self._by_url = by_url
        if self._outcomes is None and self._by_url is None:
            self._outcomes = [FakeResponse()]
        self.calls: list[SimpleNamespace] = []
        self.artificial_delay = artificial_delay
        self.current_concurrent = 0
        self.max_concurrent = 0
        self._concurrency_lock = asyncio.Lock()

    def _next_outcome(self, url: str):
        if self._by_url is not None:
            return self._by_url[url]
        if len(self._outcomes) > 1:
            return self._outcomes.pop(0)
        return self._outcomes[0]

    def request(self, method: str, url: str, **kwargs) -> _FakeRequestCtx:
        return _FakeRequestCtx(self, method, url, kwargs)
