import { LitElement, html } from "lit";

import { resolveConfigEntryId } from "../api/config-entry";
import type { Hass } from "../api/hass-types";
import { MinifluxApi } from "../api/miniflux-api";
import { MinifluxApiError } from "../api/errors";
import type { DiscoverCandidateDto, FeedDto } from "../api/types";
import "../atoms/mf-confirm";
import "../atoms/mf-offline";
import "../atoms/mf-toast-host";
import type { MfToastHost } from "../atoms/mf-toast-host";
import "../atoms/mf-virtual-list";
import "../atoms/mf-category-picker";
import { applyOptimisticPatch } from "../store/optimistic";
import { MinifluxStore, SERVICE_GET_FEEDS, TTL_LONG_MS } from "../store/miniflux-store";
import type { BaseCardConfig } from "./mf-card-editor-base";
import { diffFeedFields, formatCheckedAge, groupFeedsByCategory, monogram } from "./feed-list-helpers";
import { registerCard } from "./register-card";

// C3: the feed manager card. Every feed operation the integration supports
// (create via discover, read, update, delete, refresh, mark-read,
// enable/disable) reachable from one card with zero gaps (D-1's minimum
// bar). No favicons in Phase 1 (G6 deferred) -- a letter/monogram avatar
// instead; no entry content is ever rendered here (management surface only).

export interface FeedManagerCardConfig extends BaseCardConfig {
  group_by?: "category" | "none";
  category?: number | string;
  show_add?: boolean;
  show_delete?: boolean;
  require_hold?: boolean;
  height?: string;
}

const VIRTUALIZE_THRESHOLD = 100;
const ROW_HEIGHT_PX = 56;

type WizardStep = "closed" | "discover" | "configure";

interface WizardState {
  step: WizardStep;
  siteUrl: string;
  candidates: DiscoverCandidateDto[];
  selectedFeedUrl?: string;
  category?: number | string;
  crawler: boolean;
  error?: string;
}

interface EditState {
  feed: FeedDto;
  title: string;
  category?: number | string;
  feedUrl: string;
  disabled: boolean;
  crawler: boolean;
}

const DEFAULT_WIZARD: WizardState = {
  step: "closed",
  siteUrl: "",
  candidates: [],
  crawler: false,
};

export class MinifluxFeedManagerCard extends LitElement {
  static properties = {
    hass: {},
    _config: { state: true },
    _feeds: { state: true },
    _wizard: { state: true },
    _editing: { state: true },
    _pendingRefresh: { state: true },
    _deletePreviewCounts: { state: true },
  };

  hass?: Hass;
  store: MinifluxStore = new MinifluxStore();
  api: MinifluxApi = new MinifluxApi();

  private _config: FeedManagerCardConfig = { type: "custom:miniflux-feed-manager-card" };
  private _feeds: FeedDto[] = [];
  private _wizard: WizardState = DEFAULT_WIZARD;
  private _editing?: EditState;
  private _pendingRefresh = new Set<number>();
  private _deletePreviewCounts = new Map<number, number>();

  // Light DOM (no shadow root): renders straight into the card so HA's own
  // ha-card / theme CSS custom properties apply without a shim, matching
  // how first-party Lovelace cards behave.
  protected createRenderRoot(): this {
    return this;
  }

  setConfig(config: FeedManagerCardConfig): void {
    this._config = {
      type: config.type,
      config_entry_id: config.config_entry_id,
      group_by: config.group_by ?? "category",
      category: config.category,
      show_add: config.show_add ?? true,
      show_delete: config.show_delete ?? true,
      require_hold: config.require_hold ?? false,
      height: config.height ?? "520px",
    };
  }

  static getStubConfig(): FeedManagerCardConfig {
    return { type: "custom:miniflux-feed-manager-card" };
  }

  static getConfigElement(): HTMLElement {
    return document.createElement("miniflux-feed-manager-card-editor");
  }

  getCardSize(): number {
    return 6;
  }

  getGridOptions(): { rows: number; columns: number } {
    return { rows: 6, columns: 12 };
  }

  private get _configEntryId(): string {
    return resolveConfigEntryId(this.hass!, this._config.config_entry_id);
  }

  private get _toastHost(): MfToastHost | null {
    return this.querySelector<MfToastHost>("mf-toast-host");
  }

  protected willUpdate(changed: Map<string, unknown>): void {
    if (changed.has("hass") && this.hass) {
      this.store.onHassUpdate(this.hass);
      void this.store.attach(this.hass);
      void this._loadFeeds();
    }
  }

  private async _loadFeeds(): Promise<void> {
    const hass = this.hass!;
    const configEntryId = this._configEntryId;
    const params: Record<string, unknown> = {};
    if (this._config.category !== undefined) params.category = this._config.category;

    const beforeCheckedAt = new Map(this._feeds.map((f) => [f.id, f.checked_at]));
    const { feeds } = await this.store.query(configEntryId, SERVICE_GET_FEEDS, params, TTL_LONG_MS, () =>
      this.api.getFeeds(hass, { config_entry_id: configEntryId, category: this._config.category }),
    );
    this._feeds = feeds;

    // A refresh's checked_at moving is the pending-row's own clear signal.
    for (const feed of feeds) {
      if (this._pendingRefresh.has(feed.id) && beforeCheckedAt.get(feed.id) !== feed.checked_at) {
        this._pendingRefresh.delete(feed.id);
      }
    }
  }

  // --- Row actions (C3-U4) ------------------------------------------------

  private async _refreshFeed(feed: FeedDto): Promise<void> {
    const hass = this.hass!;
    this._pendingRefresh = new Set(this._pendingRefresh).add(feed.id);
    try {
      await this.api.refreshFeed(hass, { feed: feed.id, config_entry_id: this._configEntryId });
      this.store.invalidateFeeds(this._configEntryId);
      await this._loadFeeds();
    } catch (err) {
      this._pendingRefresh = new Set([...this._pendingRefresh].filter((id) => id !== feed.id));
      this._toastHost?.show(this._errorMessage(err));
    }
  }

  private async _refreshAll(): Promise<void> {
    const hass = this.hass!;
    try {
      await this.api.refreshAllFeeds(hass, { config_entry_id: this._configEntryId });
      this.store.invalidateFeeds(this._configEntryId);
      await this._loadFeeds();
    } catch (err) {
      this._toastHost?.show(this._errorMessage(err));
    }
  }

  private async _markFeedRead(feed: FeedDto): Promise<void> {
    const hass = this.hass!;
    try {
      await this.api.markAllRead(hass, { feed: feed.id, config_entry_id: this._configEntryId });
      this.store.notifyLocalMutation();
    } catch (err) {
      this._toastHost?.show(this._errorMessage(err));
    }
  }

  private async _toggleDisabled(feed: FeedDto): Promise<void> {
    const hass = this.hass!;
    const configEntryId = this._configEntryId;
    const keys = this.store.keysFor(configEntryId, SERVICE_GET_FEEDS);
    const nextDisabled = !feed.disabled;

    const outcome = await applyOptimisticPatch<{ feeds: FeedDto[] }>(
      this.store.cache,
      keys,
      (current) => ({
        feeds: current.feeds.map((f) => (f.id === feed.id ? { ...f, disabled: nextDisabled } : f)),
      }),
      TTL_LONG_MS,
      () => this.api.updateFeed(hass, { feed: feed.id, disabled: nextDisabled, config_entry_id: configEntryId }),
    );

    if (outcome.ok) {
      await this._loadFeeds();
    } else {
      this._toastHost?.show(this._errorMessage(outcome.error));
    }
  }

  private async _prepareDelete(feed: FeedDto): Promise<void> {
    const hass = this.hass!;
    try {
      const { total } = await this.api.countEntries(hass, {
        feed: feed.id,
        config_entry_id: this._configEntryId,
      });
      this._deletePreviewCounts = new Map(this._deletePreviewCounts).set(feed.id, total);
    } catch {
      this._deletePreviewCounts = new Map(this._deletePreviewCounts).set(feed.id, 0);
    }
  }

  private async _deleteFeed(feed: FeedDto): Promise<void> {
    const hass = this.hass!;
    const configEntryId = this._configEntryId;
    try {
      await this.api.deleteFeed(hass, { feed: feed.id, config_entry_id: configEntryId });
      this.store.invalidateFeedsAndCategories(configEntryId);
      this.store.notifyLocalMutation(); // S4: entry queries elsewhere also drop this feed's rows
      await this._loadFeeds();
    } catch (err) {
      this._toastHost?.show(this._errorMessage(err));
    }
  }

  private _errorMessage(err: unknown): string {
    return err instanceof MinifluxApiError ? err.message : String(err);
  }

  // --- Add-feed wizard (C3-U2) ---------------------------------------------

  private _openWizard(): void {
    this._wizard = { ...DEFAULT_WIZARD, step: "discover" };
  }

  private _closeWizard(): void {
    this._wizard = DEFAULT_WIZARD;
  }

  private _isDirectFeedUrl(url: string): boolean {
    return /\.(xml|rss|atom)(\?.*)?$/i.test(url.trim());
  }

  private async _discover(siteUrl: string): Promise<void> {
    const hass = this.hass!;
    if (this._isDirectFeedUrl(siteUrl)) {
      this._wizard = {
        ...this._wizard,
        siteUrl,
        step: "configure",
        selectedFeedUrl: siteUrl,
        error: undefined,
      };
      return;
    }
    try {
      const { feeds } = await this.api.discoverFeeds(hass, {
        url: siteUrl,
        config_entry_id: this._configEntryId,
      });
      this._wizard = { ...this._wizard, siteUrl, candidates: feeds, error: undefined };
    } catch (err) {
      this._wizard = { ...this._wizard, error: this._errorMessage(err) };
    }
  }

  private _pickCandidate(feedUrl: string): void {
    this._wizard = { ...this._wizard, step: "configure", selectedFeedUrl: feedUrl, error: undefined };
  }

  private async _createFeed(): Promise<void> {
    // No selectedFeedUrl guard needed: the Subscribe button that calls
    // this only ever renders on the "configure" wizard step, which is
    // only reached once selectedFeedUrl has already been set (direct URL
    // or a picked candidate).
    const hass = this.hass!;
    try {
      await this.api.createFeed(hass, {
        feed_url: this._wizard.selectedFeedUrl!,
        category: this._wizard.category,
        crawler: this._wizard.crawler,
        config_entry_id: this._configEntryId,
      });
      this.store.invalidateFeeds(this._configEntryId);
      this.store.notifyLocalMutation();
      await this._loadFeeds();
      this._closeWizard();
    } catch (err) {
      this._wizard = { ...this._wizard, error: this._errorMessage(err) };
    }
  }

  // --- Edit sheet (C3-U3) --------------------------------------------------

  private _openEdit(feed: FeedDto): void {
    this._editing = {
      feed,
      title: feed.title,
      category: feed.category_id ?? undefined,
      feedUrl: feed.feed_url,
      disabled: feed.disabled,
      crawler: false,
    };
  }

  private _closeEdit(): void {
    this._editing = undefined;
  }

  private async _saveEdit(): Promise<void> {
    if (!this._editing) return;
    const hass = this.hass!;
    const configEntryId = this._configEntryId;
    const { feed, title, category, feedUrl, disabled, crawler } = this._editing;
    const patch = diffFeedFields(feed, { title, category, feed_url: feedUrl, disabled, crawler });

    const categoryMoved = "category" in patch;
    const renamed = "title" in patch;

    if (renamed && !categoryMoved) {
      // Rename is the optimistic case (baked decision, F-U8): patch the
      // card's own rendered `_feeds` immediately (not just the shared
      // cache) so the new title is visible in this frame, before the
      // mutation resolves; roll both back together on failure.
      const keys = this.store.keysFor(configEntryId, SERVICE_GET_FEEDS);
      const previousFeeds = this._feeds;
      const rename = (feeds: FeedDto[]) =>
        feeds.map((f) => (f.id === feed.id ? { ...f, title } : f));
      this._feeds = rename(this._feeds);
      this._closeEdit();

      const outcome = await applyOptimisticPatch<{ feeds: FeedDto[] }>(
        this.store.cache,
        keys,
        (current) => ({ feeds: rename(current.feeds) }),
        TTL_LONG_MS,
        () => this.api.updateFeed(hass, { feed: feed.id, ...patch, config_entry_id: configEntryId }),
      );
      if (!outcome.ok) {
        this._feeds = previousFeeds;
        this._toastHost?.show(this._errorMessage(outcome.error));
      }
      return;
    }

    try {
      await this.api.updateFeed(hass, { feed: feed.id, ...patch, config_entry_id: configEntryId });
      // Category move: server recomputes category_title -- re-query rather
      // than guess it locally.
      this.store.invalidateFeedsAndCategories(configEntryId);
      this.store.notifyLocalMutation();
      await this._loadFeeds();
      this._closeEdit();
    } catch (err) {
      this._toastHost?.show(this._errorMessage(err));
    }
  }

  // --- Rendering ------------------------------------------------------------

  private _renderRow(feed: FeedDto) {
    const pending = this._pendingRefresh.has(feed.id);
    const showDelete = this._config.show_delete;
    const previewCount = this._deletePreviewCounts.get(feed.id);

    return html`
      <div class="feed-row ${feed.disabled ? "feed-row--disabled" : ""}" data-feed-id=${feed.id}>
        <span class="avatar" aria-hidden="true">${monogram(feed.title)}</span>
        <span class="title">${feed.title}</span>
        ${feed.disabled ? html`<span class="badge badge--paused" title="Disabled">⏸</span>` : ""}
        ${feed.parsing_error_count > 0
          ? html`<span class="badge badge--error" title=${feed.parsing_error_message}>⚠</span>`
          : ""}
        <span class="unread">${feed.unread}</span>
        <span class="age">${formatCheckedAge(feed.checked_at, new Date())}</span>

        ${feed.disabled
          ? html`<button
              class="enable-button"
              @click=${() => this._toggleDisabled(feed)}
            >
              Enable
            </button>`
          : html`<button
              class="disable-button"
              aria-label="Disable ${feed.title}"
              @click=${() => this._toggleDisabled(feed)}
            >
              Disable
            </button>`}

        <button
          class="refresh-button"
          aria-label="Refresh ${feed.title}"
          ?disabled=${pending}
          @click=${() => this._refreshFeed(feed)}
        >
          ${pending ? "…" : "⟳"}
        </button>
        <button class="mark-read-button" aria-label="Mark ${feed.title} read" @click=${() => this._markFeedRead(feed)}>
          ✓
        </button>
        <button class="edit-button" aria-label="Edit ${feed.title}" @click=${() => this._openEdit(feed)}>
          ✎
        </button>
        ${showDelete
          ? html`<mf-confirm
              trigger-label="🗑"
              trigger-aria-label="Delete ${feed.title}"
              confirm-label="Delete"
              .requireHold=${this._config.require_hold}
              message=${previewCount === undefined
                ? `Delete ${feed.title}?`
                : `Delete ${feed.title} and its ${previewCount} entries?`}
              @click=${() => this._prepareDelete(feed)}
              @mf-confirm=${() => this._deleteFeed(feed)}
            ></mf-confirm>`
          : ""}
      </div>
    `;
  }

  private _renderList() {
    const height = this._config.height ?? "520px";

    if (this._feeds.length > VIRTUALIZE_THRESHOLD) {
      const items = this._feeds.map((f) => ({ ...f }));
      return html`<mf-virtual-list
        .items=${items}
        item-height=${ROW_HEIGHT_PX}
        height=${height}
        .renderItem=${(feed: FeedDto) => this._renderRow(feed)}
      ></mf-virtual-list>`;
    }

    if (this._config.group_by === "none") {
      return html`<div class="feed-list" style="max-height:${height};overflow-y:auto">
        ${this._feeds.map((f) => this._renderRow(f))}
      </div>`;
    }

    const groups = groupFeedsByCategory(this._feeds);
    return html`<div class="feed-list" style="max-height:${height};overflow-y:auto">
      ${groups.map(
        (group) => html`
          <div class="feed-group">
            <h3 class="feed-group__title">${group.title}</h3>
            ${group.feeds.map((f) => this._renderRow(f))}
          </div>
        `,
      )}
    </div>`;
  }

  private _renderWizard() {
    if (this._wizard.step === "closed") return html``;

    if (this._wizard.step === "discover") {
      return html`
        <div class="wizard" role="dialog" aria-label="Add feed">
          ${this._wizard.error ? html`<p class="error" role="alert">${this._wizard.error}</p>` : ""}
          <input
            class="wizard-url"
            type="text"
            placeholder="Site or feed URL"
            .value=${this._wizard.siteUrl}
            @change=${(e: Event) => this._discover((e.target as HTMLInputElement).value)}
          />
          <ul class="candidates">
            ${this._wizard.candidates.map(
              (c) => html`<li>
                <button @click=${() => this._pickCandidate(c.url)}>${c.title} (${c.type})</button>
              </li>`,
            )}
          </ul>
          <button class="wizard-cancel" @click=${() => this._closeWizard()}>Cancel</button>
        </div>
      `;
    }

    return html`
      <div class="wizard" role="dialog" aria-label="Add feed">
        ${this._wizard.error ? html`<p class="error" role="alert">${this._wizard.error}</p>` : ""}
        <p class="wizard-feed-url">${this._wizard.selectedFeedUrl}</p>
        <mf-category-picker
          .hass=${this.hass}
          .store=${this.store}
          .api=${this.api}
          allow-create
          @mf-picked=${(e: CustomEvent) => (this._wizard = { ...this._wizard, category: e.detail.value })}
        ></mf-category-picker>
        <label>
          <input
            type="checkbox"
            .checked=${this._wizard.crawler}
            @change=${(e: Event) =>
              (this._wizard = { ...this._wizard, crawler: (e.target as HTMLInputElement).checked })}
          />
          Use crawler
        </label>
        <button class="wizard-subscribe" @click=${() => this._createFeed()}>Subscribe</button>
        <button class="wizard-cancel" @click=${() => this._closeWizard()}>Cancel</button>
      </div>
    `;
  }

  // Always reads `this._editing` fresh rather than closing over a
  // destructured snapshot from the render that created the handler --
  // otherwise two field edits landing before Lit's next render flushes
  // (each handler still holding the pre-edit snapshot) would clobber one
  // another instead of merging.
  private _updateEditing(patch: Partial<EditState>): void {
    if (!this._editing) return;
    this._editing = { ...this._editing, ...patch };
  }

  private _renderEditSheet() {
    if (!this._editing) return html``;
    const editing = this._editing;
    const feedUrlChanged = editing.feedUrl !== editing.feed.feed_url;

    return html`
      <div class="edit-sheet" role="dialog" aria-label="Edit ${editing.feed.title}">
        <label>
          Title
          <input
            type="text"
            .value=${editing.title}
            @change=${(e: Event) =>
              this._updateEditing({ title: (e.target as HTMLInputElement).value })}
          />
        </label>
        <mf-category-picker
          .hass=${this.hass}
          .store=${this.store}
          .api=${this.api}
          .value=${editing.category}
          allow-create
          @mf-picked=${(e: CustomEvent) => this._updateEditing({ category: e.detail.value })}
        ></mf-category-picker>
        <label>
          Feed URL
          <input
            type="text"
            .value=${editing.feedUrl}
            @change=${(e: Event) =>
              this._updateEditing({ feedUrl: (e.target as HTMLInputElement).value })}
          />
        </label>
        ${feedUrlChanged
          ? html`<p class="caution" role="alert">Changing the feed URL changes its source.</p>`
          : ""}
        <label>
          <input
            type="checkbox"
            .checked=${editing.disabled}
            @change=${(e: Event) =>
              this._updateEditing({ disabled: (e.target as HTMLInputElement).checked })}
          />
          Disabled
        </label>
        <label>
          <input
            type="checkbox"
            .checked=${editing.crawler}
            @change=${(e: Event) =>
              this._updateEditing({ crawler: (e.target as HTMLInputElement).checked })}
          />
          Use crawler
        </label>
        <button class="save-button" @click=${() => this._saveEdit()}>Save</button>
        <button class="cancel-button" @click=${() => this._closeEdit()}>Cancel</button>
      </div>
    `;
  }

  protected render() {
    return html`
      <ha-card header="Miniflux Feeds">
        <mf-offline .hass=${this.hass}></mf-offline>
        <div class="toolbar">
          ${this._config.show_add
            ? html`<button class="add-button" @click=${() => this._openWizard()}>＋ Add feed</button>`
            : ""}
          <button class="refresh-all-button" @click=${() => this._refreshAll()}>⟳ Refresh all</button>
        </div>
        ${this._renderList()}
        ${this._renderWizard()}
        ${this._renderEditSheet()}
        <mf-toast-host></mf-toast-host>
      </ha-card>
    `;
  }
}

customElements.define("miniflux-feed-manager-card", MinifluxFeedManagerCard);

registerCard({
  type: "miniflux-feed-manager-card",
  name: "Miniflux Feed Manager",
  description: "Create, edit, delete, refresh, and manage every Miniflux feed.",
});
