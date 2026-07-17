import { LitElement, html } from "lit";

import { resolveConfigEntryId } from "../api/config-entry";
import { MinifluxApiError } from "../api/errors";
import type { Hass } from "../api/hass-types";
import { MinifluxApi } from "../api/miniflux-api";
import type { CategoryDto, FeedDto } from "../api/types";
import "../atoms/mf-confirm";
import "../atoms/mf-offline";
import "../atoms/mf-toast-host";
import type { MfToastHost } from "../atoms/mf-toast-host";
import { applyOptimisticPatch } from "../store/optimistic";
import { MinifluxStore, SERVICE_GET_CATEGORIES, TTL_LONG_MS } from "../store/miniflux-store";
import type { CategorySort } from "./category-list-helpers";
import { sortCategories } from "./category-list-helpers";
import type { BaseCardConfig } from "./mf-card-editor-base";
import { registerCard } from "./register-card";

// C4: the category manager card, including empty categories -- the whole
// reason G1 exists. Complete category administration: create, read
// (empty included), rename, delete (cascade-aware, hold-to-confirm by
// default per D-4), mark-read, and drill into a category's feeds.

export interface CategoryManagerCardConfig extends BaseCardConfig {
  show_empty?: boolean;
  show_delete?: boolean;
  require_hold?: boolean;
  sort?: CategorySort;
}

interface RenameState {
  categoryId: number;
  title: string;
}

export class MinifluxCategoryManagerCard extends LitElement {
  static properties = {
    hass: {},
    _config: { state: true },
    _categories: { state: true },
    _expanded: { state: true },
    _expandedFeeds: { state: true },
    _renaming: { state: true },
    _creating: { state: true },
    _newTitle: { state: true },
    _createError: { state: true },
    _markReadPreview: { state: true },
    _deletePreview: { state: true },
  };

  hass?: Hass;
  store: MinifluxStore = new MinifluxStore();
  api: MinifluxApi = new MinifluxApi();

  private _config: CategoryManagerCardConfig = { type: "custom:miniflux-category-manager-card" };
  private _categories: CategoryDto[] = [];
  private _expanded = new Set<number>();
  private _expandedFeeds = new Map<number, FeedDto[]>();
  private _renaming?: RenameState;
  private _creating = false;
  private _newTitle = "";
  private _createError?: string;
  private _markReadPreview = new Map<number, number>();
  private _deletePreview = new Map<number, number>();

  protected createRenderRoot(): this {
    return this;
  }

  setConfig(config: CategoryManagerCardConfig): void {
    this._config = {
      type: config.type,
      config_entry_id: config.config_entry_id,
      show_empty: config.show_empty ?? true,
      show_delete: config.show_delete ?? true,
      require_hold: config.require_hold ?? true,
      sort: config.sort ?? "unread",
    };
  }

  static getStubConfig(): CategoryManagerCardConfig {
    return { type: "custom:miniflux-category-manager-card" };
  }

  static getConfigElement(): HTMLElement {
    return document.createElement("miniflux-category-manager-card-editor");
  }

  getCardSize(): number {
    return 5;
  }

  getGridOptions(): { rows: number; columns: number } {
    return { rows: 5, columns: 12 };
  }

  private get _configEntryId(): string {
    return resolveConfigEntryId(this.hass!, this._config.config_entry_id);
  }

  private get _toastHost(): MfToastHost | null {
    return this.querySelector<MfToastHost>("mf-toast-host");
  }

  private _errorMessage(err: unknown): string {
    // No instanceof fallback needed: every caller here catches a rejection
    // from an api.* call, and MinifluxApi always wraps failures as
    // MinifluxApiError (F-U5's runCall) before they ever reach a catch.
    return (err as MinifluxApiError).message;
  }

  protected willUpdate(changed: Map<string, unknown>): void {
    if (changed.has("hass") && this.hass) {
      this.store.onHassUpdate(this.hass);
      void this.store.attach(this.hass);
      void this._loadCategories();
    }
  }

  private async _loadCategories(): Promise<void> {
    const hass = this.hass!;
    const configEntryId = this._configEntryId;
    const { categories } = await this.store.query(
      configEntryId,
      SERVICE_GET_CATEGORIES,
      {},
      TTL_LONG_MS,
      () => this.api.getCategories(hass, { config_entry_id: configEntryId }),
    );
    this._categories = categories;
  }

  // --- Create / rename (C4-U2) ---------------------------------------------

  private _openCreate(): void {
    this._creating = true;
    this._newTitle = "";
    this._createError = undefined;
  }

  private async _submitCreate(): Promise<void> {
    const hass = this.hass!;
    const title = this._newTitle.trim();
    if (!title) return;
    try {
      await this.api.createCategory(hass, { title, config_entry_id: this._configEntryId });
      this.store.invalidateCategories(this._configEntryId);
      this.store.notifyLocalMutation();
      await this._loadCategories();
      this._creating = false;
    } catch (err) {
      this._createError = this._errorMessage(err);
    }
  }

  private _cancelCreate(): void {
    this._creating = false;
    this._createError = undefined;
  }

  private _startRename(category: CategoryDto): void {
    this._renaming = { categoryId: category.id, title: category.title };
  }

  private _cancelRename(): void {
    this._renaming = undefined;
  }

  private async _submitRename(): Promise<void> {
    // No `_renaming` guard needed: the Save button that calls this only
    // ever renders while a rename is in progress (see render()).
    const hass = this.hass!;
    const configEntryId = this._configEntryId;
    const { categoryId, title } = this._renaming!;

    const keys = this.store.keysFor(configEntryId, SERVICE_GET_CATEGORIES);
    const previousCategories = this._categories;
    this._categories = this._categories.map((c) => (c.id === categoryId ? { ...c, title } : c));
    this._renaming = undefined;

    const outcome = await applyOptimisticPatch<{ categories: CategoryDto[] }>(
      this.store.cache,
      keys,
      (current) => ({
        categories: current.categories.map((c) => (c.id === categoryId ? { ...c, title } : c)),
      }),
      TTL_LONG_MS,
      () => this.api.updateCategory(hass, { category: categoryId, title, config_entry_id: configEntryId }),
    );

    if (!outcome.ok) {
      this._categories = previousCategories;
      this._toastHost?.show(this._errorMessage(outcome.error));
    }
  }

  // --- Mark-read + delete (C4-U3) ------------------------------------------

  private async _prepareMarkRead(category: CategoryDto): Promise<void> {
    const hass = this.hass!;
    try {
      const { total } = await this.api.countEntries(hass, {
        category: category.id,
        status: ["unread"],
        config_entry_id: this._configEntryId,
      });
      this._markReadPreview = new Map(this._markReadPreview).set(category.id, total);
    } catch {
      this._markReadPreview = new Map(this._markReadPreview).set(category.id, 0);
    }
  }

  private async _markCategoryRead(category: CategoryDto): Promise<void> {
    const hass = this.hass!;
    try {
      await this.api.markAllRead(hass, {
        category: category.id,
        config_entry_id: this._configEntryId,
      });
      this.store.notifyLocalMutation();
    } catch (err) {
      this._toastHost?.show(this._errorMessage(err));
    }
  }

  private async _prepareDelete(category: CategoryDto): Promise<void> {
    const hass = this.hass!;
    try {
      const { feeds } = await this.api.getFeeds(hass, {
        category: category.id,
        config_entry_id: this._configEntryId,
      });
      this._deletePreview = new Map(this._deletePreview).set(category.id, feeds.length);
    } catch {
      this._deletePreview = new Map(this._deletePreview).set(category.id, 0);
    }
  }

  private async _deleteCategory(category: CategoryDto): Promise<void> {
    const hass = this.hass!;
    const configEntryId = this._configEntryId;
    try {
      await this.api.deleteCategory(hass, { category: category.id, config_entry_id: configEntryId });
      // Cascade (D-4): Miniflux deletes the contained feeds and their
      // entries too -- invalidate feeds + categories together in one bus
      // event so any co-mounted card drops the dead rows on re-query (S4).
      this.store.invalidateFeedsAndCategories(configEntryId);
      this.store.notifyLocalMutation();
      await this._loadCategories();
    } catch (err) {
      this._toastHost?.show(this._errorMessage(err));
    }
  }

  // --- Expand (C4-U4) -------------------------------------------------------

  private async _toggleExpand(category: CategoryDto): Promise<void> {
    const hass = this.hass!;
    if (this._expanded.has(category.id)) {
      this._expanded = new Set([...this._expanded].filter((id) => id !== category.id));
      return;
    }
    this._expanded = new Set(this._expanded).add(category.id);
    const { feeds } = await this.api.getFeeds(hass, {
      category: category.id,
      config_entry_id: this._configEntryId,
    });
    this._expandedFeeds = new Map(this._expandedFeeds).set(category.id, feeds);
  }

  // --- Rendering --------------------------------------------------------------

  private _renderRow(category: CategoryDto) {
    const isRenaming = this._renaming?.categoryId === category.id;
    const isExpanded = this._expanded.has(category.id);
    const markReadPreview = this._markReadPreview.get(category.id);
    const deletePreview = this._deletePreview.get(category.id);

    return html`
      <div class="category-row" data-category-id=${category.id}>
        <button class="expand-toggle" aria-label="Expand ${category.title}" @click=${() => this._toggleExpand(category)}>
          ${isExpanded ? "▾" : "▸"}
        </button>

        ${isRenaming
          ? html`
              <input
                class="rename-input"
                type="text"
                .value=${this._renaming!.title}
                @change=${(e: Event) =>
                  (this._renaming = { ...this._renaming!, title: (e.target as HTMLInputElement).value })}
              />
              <button class="rename-save" @click=${() => this._submitRename()}>Save</button>
              <button class="rename-cancel" @click=${() => this._cancelRename()}>Cancel</button>
            `
          : html`
              <span class="title">${category.title}</span>
              <span class="feed-count">${category.feed_count === null ? "—" : category.feed_count}</span>
              <span class="unread">${category.unread === null ? "—" : category.unread}</span>
              <button class="rename-button" aria-label="Rename ${category.title}" @click=${() => this._startRename(category)}>
                ✎
              </button>
              <mf-confirm
                trigger-label="✓"
                trigger-aria-label="Mark ${category.title} read"
                confirm-label="Mark read"
                message=${markReadPreview === undefined
                  ? `Mark ${category.title} read?`
                  : `Mark ${markReadPreview} unread entries in ${category.title} as read?`}
                @click=${() => this._prepareMarkRead(category)}
                @mf-confirm=${() => this._markCategoryRead(category)}
              ></mf-confirm>
              ${this._config.show_delete
                ? html`<mf-confirm
                    trigger-label="🗑"
                    trigger-aria-label="Delete ${category.title}"
                    confirm-label="Delete"
                    .requireHold=${this._config.require_hold}
                    message=${deletePreview === undefined
                      ? `Delete ${category.title}?`
                      : `Delete ${category.title} — its ${deletePreview} feeds and their entries go with it?`}
                    @click=${() => this._prepareDelete(category)}
                    @mf-confirm=${() => this._deleteCategory(category)}
                  ></mf-confirm>`
                : ""}
            `}
      </div>
      ${isExpanded ? this._renderExpandedFeeds(category) : ""}
    `;
  }

  private _renderExpandedFeeds(category: CategoryDto) {
    const feeds = this._expandedFeeds.get(category.id);
    if (!feeds) return html`<div class="expanded-feeds loading">Loading…</div>`;
    if (feeds.length === 0) return html`<div class="expanded-feeds empty">No feeds.</div>`;
    return html`
      <ul class="expanded-feeds">
        ${feeds.map((feed) => html`<li data-feed-id=${feed.id}>${feed.title}</li>`)}
      </ul>
    `;
  }

  private _renderCreateForm() {
    return html`
      <div class="create-row">
        ${this._createError ? html`<p class="error" role="alert">${this._createError}</p>` : ""}
        <input
          class="create-title"
          type="text"
          placeholder="Category name"
          .value=${this._newTitle}
          @change=${(e: Event) => (this._newTitle = (e.target as HTMLInputElement).value)}
        />
        <button class="create-submit" @click=${() => this._submitCreate()}>Create</button>
        <button class="create-cancel" @click=${() => this._cancelCreate()}>Cancel</button>
      </div>
    `;
  }

  protected render() {
    const visible = this._config.show_empty
      ? this._categories
      : this._categories.filter((c) => (c.feed_count ?? 0) > 0);
    const sorted = sortCategories(visible, this._config.sort ?? "unread");

    return html`
      <ha-card header="Miniflux Categories">
        <mf-offline .hass=${this.hass}></mf-offline>
        <div class="toolbar">
          <button class="add-button" @click=${() => this._openCreate()}>＋ New category</button>
        </div>
        ${this._creating ? this._renderCreateForm() : ""}
        <div class="category-list">${sorted.map((c) => this._renderRow(c))}</div>
        <mf-toast-host></mf-toast-host>
      </ha-card>
    `;
  }
}

customElements.define("miniflux-category-manager-card", MinifluxCategoryManagerCard);

registerCard({
  type: "miniflux-category-manager-card",
  name: "Miniflux Category Manager",
  description: "Create, rename, delete, and mark categories read — including empty ones.",
});
