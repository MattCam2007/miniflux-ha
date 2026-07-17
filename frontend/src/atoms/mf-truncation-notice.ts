import { LitElement, css, html } from "lit";

// F-U11 (S1): "showing first N of Total -- refine" notice for capped
// results. Renders nothing when the result wasn't actually capped
// (capped >= total) -- an uncapped list needs no disclaimer.

export class MfTruncationNotice extends LitElement {
  static properties = {
    capped: { type: Number },
    total: { type: Number },
  };

  capped = 0;
  total = 0;

  static styles = css`
    :host {
      display: block;
    }
    .notice {
      padding: 4px 8px;
      color: var(--secondary-text-color);
      font-size: 0.9em;
    }
  `;

  protected render() {
    if (this.capped >= this.total) return html``;
    return html`<p class="notice">
      Showing first ${this.capped} of ${this.total} — refine your filter to see more.
    </p>`;
  }
}

customElements.define("mf-truncation-notice", MfTruncationNotice);
