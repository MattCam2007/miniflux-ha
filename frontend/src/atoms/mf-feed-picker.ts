import { LitElement, css, html } from "lit";

import { MinifluxApi } from "../api/miniflux-api";
import { resolveConfigEntryId } from "../api/config-entry";
import type { Hass } from "../api/hass-types";
import type { FeedDto } from "../api/types";
import { MinifluxStore, SERVICE_GET_FEEDS, TTL_LONG_MS } from "../store/miniflux-store";

// F-U10: backed by the shared cached get_feeds query -- pass the same
// `store` instance a card already owns so opening a picker never issues a
// second fetch for data the card already has.

export type PickerEmitMode = "id" | "title";

export class MfFeedPicker extends LitElement {
  static properties = {
    hass: {},
    store: {},
    api: {},
    configEntryId: { attribute: "config-entry-id" },
    emit: {},
    value: {},
    _feeds: { state: true },
  };

  hass?: Hass;
  store: MinifluxStore = new MinifluxStore();
  api: MinifluxApi = new MinifluxApi();
  configEntryId?: string;
  emit: PickerEmitMode = "id";
  value?: number | string;

  private _feeds: FeedDto[] = [];

  static styles = css`
    :host {
      display: inline-block;
    }
    select {
      min-height: 44px;
      font: inherit;
      color: var(--primary-text-color);
      background: var(--card-background-color, #fff);
      border: 1px solid var(--divider-color, #ccc);
      border-radius: 6px;
      padding: 0 8px;
    }
  `;

  protected willUpdate(changed: Map<string, unknown>): void {
    if (changed.has("hass") && this.hass) {
      void this._load(this.hass);
    }
  }

  private async _load(hass: Hass): Promise<void> {
    const configEntryId = resolveConfigEntryId(hass, this.configEntryId);
    const { feeds } = await this.store.query(configEntryId, SERVICE_GET_FEEDS, {}, TTL_LONG_MS, () =>
      this.api.getFeeds(hass, { config_entry_id: configEntryId }),
    );
    this._feeds = feeds;
  }

  private _refValue(feed: FeedDto): number | string {
    return this.emit === "title" ? feed.title : feed.id;
  }

  private _onChange = (event: Event): void => {
    const select = event.target as HTMLSelectElement;
    const feed = this._feeds.find((f) => String(this._refValue(f)) === select.value);
    if (!feed) return;
    this.value = this._refValue(feed);
    this.dispatchEvent(
      new CustomEvent("mf-picked", {
        detail: { value: this.value },
        bubbles: true,
        composed: true,
      }),
    );
  };

  protected render() {
    return html`
      <select aria-label="Feed" @change=${this._onChange}>
        <option value="" ?selected=${this.value === undefined}>Select a feed…</option>
        ${this._feeds.map((feed) => {
          const ref = this._refValue(feed);
          return html`<option value=${ref} ?selected=${this.value === ref}>
            ${feed.title}
          </option>`;
        })}
      </select>
    `;
  }
}

customElements.define("mf-feed-picker", MfFeedPicker);
