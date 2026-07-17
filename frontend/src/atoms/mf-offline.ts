import { LitElement, css, html } from "lit";

import type { Hass } from "../api/hass-types";

// F-U11: standard offline banner (DC7 offline baseline) bound to
// binary_sensor.miniflux_reachable. Every card includes this so a Miniflux
// outage degrades honestly (banner shown, actions disabled by the card
// itself) instead of silently showing stale data with no explanation.

export const REACHABLE_ENTITY_ID = "binary_sensor.miniflux_reachable";

export class MfOffline extends LitElement {
  static properties = { hass: {} };
  hass?: Hass;

  static styles = css`
    :host {
      display: block;
    }
    .banner {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: 6px;
      background: var(--warning-color, #ff9800);
      color: var(--text-primary-color, #fff);
    }
    .icon {
      font-weight: 700;
    }
  `;

  private get _reachable(): boolean {
    const state = this.hass?.states[REACHABLE_ENTITY_ID]?.state;
    return state === "on";
  }

  protected render() {
    if (this._reachable) return html``;
    return html`
      <div class="banner" role="status" aria-live="polite">
        <span class="icon" aria-hidden="true">&#9888;</span>
        <span>Miniflux is unreachable. Showing last-known data; actions are disabled.</span>
      </div>
    `;
  }
}

customElements.define("mf-offline", MfOffline);
