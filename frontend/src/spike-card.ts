import { LitElement, css, html } from "lit";

/**
 * F-U1 delivery spike (D-9). Proves the whole pipeline end-to-end: esbuild
 * bundle -> committed to custom_components/miniflux/frontend/ -> static path
 * registered -> Lovelace resource auto-added -> real card renders in a real
 * Home Assistant. It is not a Phase 1 feature card (C3/C4 are); delete this
 * file and its registration once the real-HA validation pass (00-START-HERE
 * §3) confirms the mechanism works and C3/C4 take over the picker.
 */
export class MinifluxSpikeCard extends LitElement {
  static styles = css`
    :host {
      display: block;
    }
    p {
      margin: 0 0 8px 0;
      color: var(--primary-text-color);
    }
    p:last-child {
      margin-bottom: 0;
    }
    .ok {
      color: var(--success-color, #4caf50);
      font-weight: 600;
    }
  `;

  setConfig(_config: Record<string, unknown>): void {
    // No options yet -- this is a throwaway spike card, not a real config surface.
  }

  getCardSize(): number {
    return 2;
  }

  getGridOptions(): { rows: number; columns: number } {
    return { rows: 2, columns: 12 };
  }

  protected render() {
    return html`
      <ha-card header="Miniflux — frontend delivery spike">
        <div class="card-content">
          <p class="ok">Bundle loaded and rendering inside Home Assistant.</p>
          <p>
            This confirms the F-U1 delivery pipeline: build → static path →
            Lovelace resource → real card render — with zero manual resource
            setup.
          </p>
          <p>
            Temporary spike card, not a Phase 1 feature card. Safe to remove
            once C3 (feed manager) and C4 (category manager) land.
          </p>
        </div>
      </ha-card>
    `;
  }
}

const ELEMENT_NAME = "miniflux-spike-card";

customElements.define(ELEMENT_NAME, MinifluxSpikeCard);

window.customCards = window.customCards ?? [];
window.customCards.push({
  type: ELEMENT_NAME,
  name: "Miniflux Spike (delivery test)",
  description:
    "Temporary card proving the F-U1 bundle delivery pipeline. Remove after real-HA validation.",
});
