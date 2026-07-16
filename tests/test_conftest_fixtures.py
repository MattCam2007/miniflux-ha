"""Smoke tests for the model-dependent conftest builders (chunk 1.1).

Not testing production code — proving the shared test fixtures build valid
models, so a mistake here fails loudly instead of silently poisoning every
later test file that relies on them.
"""

from __future__ import annotations

from custom_components.miniflux.models import Feed, Snapshot


def test_make_feed_defaults(make_feed):
    feed = make_feed()
    assert isinstance(feed, Feed)
    assert feed.parsing_error_count == 0


def test_make_feed_override(make_feed):
    feed = make_feed(id=99, parsing_error_count=3)
    assert feed.id == 99
    assert feed.parsing_error_count == 3


def test_make_entry_defaults(make_entry):
    entry = make_entry()
    assert entry.id == 1
    assert entry.status == "unread"


def test_snapshot_factory_defaults(snapshot_factory):
    snap = snapshot_factory()
    assert isinstance(snap, Snapshot)
    assert snap.unread_total == 0
    assert snap.error_feed_ids == ()


def test_snapshot_factory_tunable(snapshot_factory, make_feed):
    error_feed = make_feed(id=5, parsing_error_count=2)
    snap = snapshot_factory(unread_total=42, starred_total=7, error_feeds=(error_feed,))
    assert snap.unread_total == 42
    assert snap.starred_total == 7
    assert snap.error_feed_ids == (5,)
