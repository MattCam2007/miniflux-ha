import { html } from "lit";

import { MfCardEditorBase } from "./mf-card-editor-base";
import type { FeedManagerCardConfig } from "./feed-manager-card";

// Visual editor for miniflux-feed-manager-card. Only declares its own
// fields (F-U13's whole point) -- the entry picker is entirely handled by
// MfCardEditorBase.
export class MinifluxFeedManagerCardEditor extends MfCardEditorBase<FeedManagerCardConfig> {
  protected renderCardFields() {
    const config = this._config;
    return html`
      <label>
        Group by
        <select
          @change=${(e: Event) =>
            this._valueChanged({
              group_by: (e.target as HTMLSelectElement).value as "category" | "none",
            })}
        >
          <option value="category" ?selected=${(config.group_by ?? "category") === "category"}>
            Category
          </option>
          <option value="none" ?selected=${config.group_by === "none"}>None</option>
        </select>
      </label>
      <label>
        <input
          type="checkbox"
          .checked=${config.show_add ?? true}
          @change=${(e: Event) =>
            this._valueChanged({ show_add: (e.target as HTMLInputElement).checked })}
        />
        Show add-feed wizard
      </label>
      <label>
        <input
          type="checkbox"
          .checked=${config.show_delete ?? true}
          @change=${(e: Event) =>
            this._valueChanged({ show_delete: (e.target as HTMLInputElement).checked })}
        />
        Show delete
      </label>
      <label>
        <input
          type="checkbox"
          .checked=${config.require_hold ?? false}
          @change=${(e: Event) =>
            this._valueChanged({ require_hold: (e.target as HTMLInputElement).checked })}
        />
        Require hold-to-confirm on delete
      </label>
    `;
  }
}

customElements.define("miniflux-feed-manager-card-editor", MinifluxFeedManagerCardEditor);
