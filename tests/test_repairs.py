"""Chunk 6.4 — repair issues for webhook wiring problems (architecture C7,
D10). Thin wrappers around HA's issue registry: our only job is picking the
right issue id (namespaced per config entry -- multiple Miniflux instances
must not share/clobber each other's wiring-problem issues), severity, and
translation key. The *when to call these* decisions (setup-time secret
check, N-consecutive-failures threshold) live in webhook.py, not here.
"""

from __future__ import annotations

from homeassistant.helpers import issue_registry as ir
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.miniflux import repairs
from custom_components.miniflux.const import (
    CONF_API_KEY,
    CONF_URL,
    CONF_VERIFY_SSL,
    CONF_WEBHOOK_ID,
    DOMAIN,
    ISSUE_WEBHOOK_SECRET_MISSING,
    ISSUE_WEBHOOK_SIGNATURE_FAILING,
)


def _entry(hass, entry_id_suffix: str = "1") -> MockConfigEntry:
    entry = MockConfigEntry(
        domain=DOMAIN,
        unique_id=f"reader.example.lan:{entry_id_suffix}",
        data={
            CONF_URL: "https://reader.example.lan",
            CONF_API_KEY: "test-key",
            CONF_VERIFY_SSL: True,
            CONF_WEBHOOK_ID: "webhook-id",
        },
    )
    entry.add_to_hass(hass)
    return entry


def _issue_ids(hass) -> set[str]:
    return {issue_id for (domain, issue_id) in ir.async_get(hass).issues if domain == DOMAIN}


class TestSecretMissing:
    async def test_note_creates_issue(self, hass):
        entry = _entry(hass)

        repairs.async_note_secret_missing(hass, entry)

        issue_id = f"{ISSUE_WEBHOOK_SECRET_MISSING}_{entry.entry_id}"
        issue = ir.async_get(hass).async_get_issue(DOMAIN, issue_id)
        assert issue is not None
        assert issue.is_fixable is False
        assert issue.translation_key == ISSUE_WEBHOOK_SECRET_MISSING
        assert issue.translation_placeholders == {"instance_url": "https://reader.example.lan"}

    async def test_note_is_idempotent(self, hass):
        """Repeated deliveries with no secret configured must not pile up
        duplicate issues -- async_create_issue replaces-in-place by id."""
        entry = _entry(hass)

        repairs.async_note_secret_missing(hass, entry)
        repairs.async_note_secret_missing(hass, entry)

        issue_id = f"{ISSUE_WEBHOOK_SECRET_MISSING}_{entry.entry_id}"
        assert sum(1 for i in _issue_ids(hass) if i == issue_id) == 1

    async def test_clear_removes_issue(self, hass):
        entry = _entry(hass)
        repairs.async_note_secret_missing(hass, entry)

        repairs.async_clear_secret_missing(hass, entry)

        issue_id = f"{ISSUE_WEBHOOK_SECRET_MISSING}_{entry.entry_id}"
        assert ir.async_get(hass).async_get_issue(DOMAIN, issue_id) is None

    async def test_clear_when_absent_does_not_raise(self, hass):
        entry = _entry(hass)
        repairs.async_clear_secret_missing(hass, entry)  # no-op, must not raise

    async def test_two_entries_do_not_share_an_issue(self, hass):
        """Each Miniflux instance's wiring problem is independent -- fixing
        entry A's secret must not silently clear entry B's still-broken one."""
        entry_a = _entry(hass, "1")
        entry_b = _entry(hass, "2")

        repairs.async_note_secret_missing(hass, entry_a)
        repairs.async_note_secret_missing(hass, entry_b)
        repairs.async_clear_secret_missing(hass, entry_a)

        assert ir.async_get(hass).async_get_issue(
            DOMAIN, f"{ISSUE_WEBHOOK_SECRET_MISSING}_{entry_a.entry_id}"
        ) is None
        assert ir.async_get(hass).async_get_issue(
            DOMAIN, f"{ISSUE_WEBHOOK_SECRET_MISSING}_{entry_b.entry_id}"
        ) is not None


class TestSignatureFailing:
    async def test_note_creates_issue(self, hass):
        entry = _entry(hass)

        repairs.async_note_signature_failing(hass, entry)

        issue_id = f"{ISSUE_WEBHOOK_SIGNATURE_FAILING}_{entry.entry_id}"
        issue = ir.async_get(hass).async_get_issue(DOMAIN, issue_id)
        assert issue is not None
        assert issue.is_fixable is False
        assert issue.translation_key == ISSUE_WEBHOOK_SIGNATURE_FAILING

    async def test_clear_removes_issue(self, hass):
        entry = _entry(hass)
        repairs.async_note_signature_failing(hass, entry)

        repairs.async_clear_signature_failing(hass, entry)

        issue_id = f"{ISSUE_WEBHOOK_SIGNATURE_FAILING}_{entry.entry_id}"
        assert ir.async_get(hass).async_get_issue(DOMAIN, issue_id) is None

    async def test_clear_when_absent_does_not_raise(self, hass):
        entry = _entry(hass)
        repairs.async_clear_signature_failing(hass, entry)  # no-op, must not raise

    async def test_independent_of_secret_missing_issue(self, hass):
        """The two issue types are distinct failure modes (no secret at all
        vs a secret that's wrong) and must not clear each other."""
        entry = _entry(hass)
        repairs.async_note_secret_missing(hass, entry)
        repairs.async_note_signature_failing(hass, entry)

        repairs.async_clear_signature_failing(hass, entry)

        assert ir.async_get(hass).async_get_issue(
            DOMAIN, f"{ISSUE_WEBHOOK_SECRET_MISSING}_{entry.entry_id}"
        ) is not None
