import { LitElement, css, html } from "lit";
import { repeat } from "lit/directives/repeat.js";

// F-U12 (S1): fixed-row-height windowed list for the 500+ row case (C3's
// feed list, C4's expanded feed sub-lists). Renders only the rows
// intersecting the viewport plus a small buffer, never the full set.
//
// Deliberately reads `height` (the same px string the card's own config
// already carries, e.g. C3's `height: 520px`) as the viewport size rather
// than measuring the real DOM box (ResizeObserver/clientHeight) -- Phase 1
// never resizes a mounted card, and this keeps the windowing math pure and
// directly testable without a real browser layout engine.

export interface VirtualListItem {
  id: string | number;
}

export class MfVirtualList<T extends VirtualListItem = VirtualListItem> extends LitElement {
  static properties = {
    items: { attribute: false },
    itemHeight: { type: Number, attribute: "item-height" },
    height: {},
    bufferRows: { type: Number, attribute: "buffer-rows" },
    renderItem: { attribute: false },
    _scrollTop: { state: true },
  };

  items: T[] = [];
  itemHeight = 48;
  height = "520px";
  bufferRows = 5;
  /** No default: an unset renderItem is a caller bug (every real user of
   * this atom sets it), better surfaced loudly than papered over with a
   * silent blank-row fallback. */
  renderItem!: (item: T, index: number) => unknown;

  private _scrollTop = 0;

  static styles = css`
    :host {
      display: block;
    }
    .viewport {
      overflow-y: auto;
      position: relative;
    }
    .spacer {
      position: relative;
    }
    .window {
      position: absolute;
      left: 0;
      right: 0;
      top: 0;
    }
  `;

  private get _viewportHeightPx(): number {
    const parsed = Number.parseInt(this.height, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private _onScroll = (event: Event): void => {
    this._scrollTop = (event.target as HTMLElement).scrollTop;
  };

  private get _range(): { start: number; end: number } {
    const total = this.items.length;
    const start = Math.max(
      0,
      Math.floor(this._scrollTop / this.itemHeight) - this.bufferRows,
    );
    const visibleCount = Math.ceil(this._viewportHeightPx / this.itemHeight) + this.bufferRows * 2;
    const end = Math.min(total, start + visibleCount);
    return { start, end };
  }

  protected render() {
    const { start, end } = this._range;
    const totalHeight = this.items.length * this.itemHeight;
    const offsetY = start * this.itemHeight;
    const visible = this.items.slice(start, end);

    return html`
      <div class="viewport" style="height:${this.height}" @scroll=${this._onScroll}>
        <div class="spacer" style="height:${totalHeight}px">
          <div class="window" style="transform:translateY(${offsetY}px)">
            ${repeat(
              visible,
              (item) => item.id,
              (item, i) => this.renderItem(item, start + i),
            )}
          </div>
        </div>
      </div>
    `;
  }
}

customElements.define("mf-virtual-list", MfVirtualList);
