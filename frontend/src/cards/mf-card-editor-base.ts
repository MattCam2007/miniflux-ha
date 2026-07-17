import { LitElement, html } from "lit";

import { listConfigEntryIds } from "../api/config-entry";
import type { Hass } from "../api/hass-types";

// F-U13: shared visual-editor base every card's own editor extends.
// Owns the config_entry_id picker (D-3: hidden whenever exactly one --
// the common case -- or zero instances are configured; shown only if a
// user genuinely has more than one Miniflux integration entry) and the
// standard HA editor `config-changed` event contract, so a concrete
// editor only ever has to implement its own fields.

export interface BaseCardConfig {
  type: string;
  config_entry_id?: string;
}

export abstract class MfCardEditorBase<C extends BaseCardConfig> extends LitElement {
  static properties = {
    hass: {},
    _config: { state: true },
  };

  hass?: Hass;
  protected _config: C = {} as C;

  setConfig(config: C): void {
    this._config = config;
  }

  /** Subclasses render only their own fields; the entry picker above them
   * is handled entirely here. */
  protected abstract renderCardFields(): unknown;

  protected get availableConfigEntryIds(): string[] {
    return this.hass ? listConfigEntryIds(this.hass) : [];
  }

  private get _showEntryPicker(): boolean {
    return this.availableConfigEntryIds.length > 1;
  }

  /** Subclasses call this on every field change; it merges the patch into
   * `_config` and dispatches HA's standard config-changed event so the
   * dashboard editor picks up the new value. */
  protected _valueChanged(patch: Partial<C>): void {
    this._config = { ...this._config, ...patch };
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config: this._config },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _onEntryPickerChange = (event: Event): void => {
    // No empty-value fallback needed: the picker only ever renders
    // <option>s for real config entry ids, no blank placeholder, so
    // select.value is always one of those ids.
    const select = event.target as HTMLSelectElement;
    this._valueChanged({ config_entry_id: select.value } as Partial<C>);
  };

  protected render() {
    return html`
      ${this._showEntryPicker
        ? html`
            <div class="entry-picker">
              <label for="config-entry-id">Miniflux instance</label>
              <select id="config-entry-id" @change=${this._onEntryPickerChange}>
                ${this.availableConfigEntryIds.map(
                  (id) =>
                    html`<option value=${id} ?selected=${this._config.config_entry_id === id}>
                      ${id}
                    </option>`,
                )}
              </select>
            </div>
          `
        : ""}
      ${this.renderCardFields()}
    `;
  }
}
