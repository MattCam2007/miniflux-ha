import { html } from "lit";

import { MfCardEditorBase } from "./mf-card-editor-base";
import type { CategoryManagerCardConfig } from "./category-manager-card";

export class MinifluxCategoryManagerCardEditor extends MfCardEditorBase<CategoryManagerCardConfig> {
  protected renderCardFields() {
    const config = this._config;
    return html`
      <label>
        Sort
        <select
          @change=${(e: Event) =>
            this._valueChanged({
              sort: (e.target as HTMLSelectElement).value as CategoryManagerCardConfig["sort"],
            })}
        >
          <option value="unread" ?selected=${(config.sort ?? "unread") === "unread"}>Unread</option>
          <option value="title" ?selected=${config.sort === "title"}>Title</option>
          <option value="feeds" ?selected=${config.sort === "feeds"}>Feeds</option>
        </select>
      </label>
      <label>
        <input
          type="checkbox"
          .checked=${config.show_empty ?? true}
          @change=${(e: Event) =>
            this._valueChanged({ show_empty: (e.target as HTMLInputElement).checked })}
        />
        Show empty categories
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
          .checked=${config.require_hold ?? true}
          @change=${(e: Event) =>
            this._valueChanged({ require_hold: (e.target as HTMLInputElement).checked })}
        />
        Require hold-to-confirm on delete
      </label>
    `;
  }
}

customElements.define("miniflux-category-manager-card-editor", MinifluxCategoryManagerCardEditor);
