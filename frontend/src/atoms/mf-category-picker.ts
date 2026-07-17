import { LitElement, css, html } from "lit";

import { resolveConfigEntryId } from "../api/config-entry";
import type { Hass } from "../api/hass-types";
import { MinifluxApi } from "../api/miniflux-api";
import type { CategoryDto } from "../api/types";
import { MinifluxStore, SERVICE_GET_CATEGORIES, TTL_LONG_MS } from "../store/miniflux-store";

// F-U10: backed by the shared cached get_categories query (G1 -- includes
// empty categories, which must be just as selectable as any other). The
// inline "new category…" option surfaces create_category directly from
// the picker so C3's add-feed wizard never has to leave the picker to
// create a target category.

export type PickerEmitMode = "id" | "title";

const CREATE_NEW_SENTINEL = "__mf_create_new__";

export class MfCategoryPicker extends LitElement {
  static properties = {
    hass: {},
    store: {},
    api: {},
    configEntryId: { attribute: "config-entry-id" },
    emit: {},
    value: {},
    allowCreate: { type: Boolean, attribute: "allow-create" },
    _categories: { state: true },
    _creating: { state: true },
  };

  hass?: Hass;
  store: MinifluxStore = new MinifluxStore();
  api: MinifluxApi = new MinifluxApi();
  configEntryId?: string;
  emit: PickerEmitMode = "id";
  value?: number | string;
  allowCreate = false;

  private _categories: CategoryDto[] = [];
  private _creating = false;

  static styles = css`
    :host {
      display: inline-block;
    }
    select,
    input,
    button {
      min-height: 44px;
      font: inherit;
      color: var(--primary-text-color);
      background: var(--card-background-color, #fff);
      border: 1px solid var(--divider-color, #ccc);
      border-radius: 6px;
      padding: 0 8px;
    }
    .create-row {
      display: flex;
      gap: 8px;
    }
  `;

  protected willUpdate(changed: Map<string, unknown>): void {
    if (changed.has("hass") && this.hass) {
      void this._load(this.hass);
    }
  }

  private async _load(hass: Hass): Promise<void> {
    const configEntryId = resolveConfigEntryId(hass, this.configEntryId);
    const { categories } = await this.store.query(
      configEntryId,
      SERVICE_GET_CATEGORIES,
      {},
      TTL_LONG_MS,
      () => this.api.getCategories(hass, { config_entry_id: configEntryId }),
    );
    this._categories = categories;
  }

  private _refValue(category: CategoryDto): number | string {
    return this.emit === "title" ? category.title : category.id;
  }

  private _emitPicked(value: number | string): void {
    this.value = value;
    this.dispatchEvent(
      new CustomEvent("mf-picked", { detail: { value }, bubbles: true, composed: true }),
    );
  }

  private _onChange = (event: Event): void => {
    const select = event.target as HTMLSelectElement;
    if (select.value === CREATE_NEW_SENTINEL) {
      this._creating = true;
      return;
    }
    const category = this._categories.find((c) => String(this._refValue(c)) === select.value);
    if (!category) return;
    this._emitPicked(this._refValue(category));
  };

  private _onCreateSubmit = async (event: SubmitEvent): Promise<void> => {
    event.preventDefault();
    // No `hass` guard needed: the create form only ever renders once
    // `_load(hass)` has run at least once (see render()), which requires
    // `hass` to already be set.
    const hass = this.hass!;
    const form = event.target as HTMLFormElement;
    const input = form.elements.namedItem("title") as HTMLInputElement;
    const title = input.value.trim();
    if (!title) return;

    const configEntryId = resolveConfigEntryId(hass, this.configEntryId);
    const { category_id } = await this.api.createCategory(hass, {
      title,
      config_entry_id: configEntryId,
    });
    this.store.invalidateCategories(configEntryId);
    this.store.notifyLocalMutation();
    await this._load(hass);

    this._creating = false;
    this._emitPicked(this.emit === "title" ? title : category_id);
  };

  private _cancelCreate = (): void => {
    this._creating = false;
  };

  protected render() {
    if (this._creating) {
      return html`
        <form class="create-row" @submit=${this._onCreateSubmit}>
          <input
            name="title"
            type="text"
            placeholder="New category name"
            aria-label="New category name"
            autofocus
          />
          <button type="submit">Create</button>
          <button type="button" @click=${this._cancelCreate}>Cancel</button>
        </form>
      `;
    }

    return html`
      <select aria-label="Category" @change=${this._onChange}>
        <option value="" ?selected=${this.value === undefined}>Select a category…</option>
        ${this._categories.map((category) => {
          const ref = this._refValue(category);
          const emptyBadge = category.feed_count === 0 ? " (empty)" : "";
          return html`<option value=${ref} ?selected=${this.value === ref}>
            ${category.title}${emptyBadge}
          </option>`;
        })}
        ${this.allowCreate
          ? html`<option value=${CREATE_NEW_SENTINEL}>+ New category…</option>`
          : ""}
      </select>
    `;
  }
}

customElements.define("mf-category-picker", MfCategoryPicker);
