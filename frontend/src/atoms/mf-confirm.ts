import { LitElement, css, html } from "lit";

// F-U9 (DC5, S5): two-step destructive confirm. Step 1 is a plain trigger
// button; step 2 shows the real blast-radius text plus either a normal
// confirm button or, when require-hold is set (D-4: category delete, since
// it cascades), a press-and-hold button that only fires after a sustained
// press of `hold-ms`. Cancel -- or releasing an in-progress hold early --
// is always a no-op: nothing is dispatched, the caller's mutation never runs.

type Phase = "idle" | "confirming";

export class MfConfirm extends LitElement {
  static properties = {
    message: {},
    confirmLabel: { attribute: "confirm-label" },
    cancelLabel: { attribute: "cancel-label" },
    triggerLabel: { attribute: "trigger-label" },
    triggerAriaLabel: { attribute: "trigger-aria-label" },
    requireHold: { type: Boolean, attribute: "require-hold" },
    holdMs: { type: Number, attribute: "hold-ms" },
    disabled: { type: Boolean },
    _phase: { state: true },
    _holdProgress: { state: true },
  };

  message = "";
  confirmLabel = "Delete";
  cancelLabel = "Cancel";
  triggerLabel = "\u{1F5D1}";
  triggerAriaLabel = "Delete";
  requireHold = false;
  holdMs = 900;
  disabled = false;

  private _phase: Phase = "idle";
  private _holdProgress = 0;
  private _holdTimer?: ReturnType<typeof setTimeout>;
  private _holdRaf?: ReturnType<typeof setInterval>;

  static styles = css`
    :host {
      display: inline-block;
    }
    button {
      min-height: 44px;
      min-width: 44px;
      padding: 0 12px;
      border-radius: 6px;
      border: 1px solid var(--divider-color, #ccc);
      background: var(--card-background-color, #fff);
      color: var(--primary-text-color);
      cursor: pointer;
      font: inherit;
    }
    button.confirm {
      background: var(--error-color, #db4437);
      color: var(--text-primary-color, #fff);
      border-color: transparent;
      position: relative;
      overflow: hidden;
    }
    button.confirm .hold-progress {
      position: absolute;
      inset: 0;
      background: rgba(255, 255, 255, 0.35);
      transform-origin: left;
      pointer-events: none;
    }
    .panel {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 8px;
      border: 1px solid var(--divider-color, #ccc);
      border-radius: 8px;
      background: var(--card-background-color, #fff);
    }
    .message {
      margin: 0;
      color: var(--primary-text-color);
    }
    .actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }
  `;

  private _clearHold(): void {
    if (this._holdTimer) {
      clearTimeout(this._holdTimer);
      this._holdTimer = undefined;
    }
    if (this._holdRaf) {
      clearInterval(this._holdRaf);
      this._holdRaf = undefined;
    }
    this._holdProgress = 0;
  }

  private _reset(): void {
    this._clearHold();
    this._phase = "idle";
  }

  private _open = (): void => {
    // No `disabled` guard needed here: the trigger button carries the
    // native `disabled` attribute (see render()), which already suppresses
    // the click event entirely -- this handler is simply never invoked.
    this._phase = "confirming";
  };

  private _cancel = (): void => {
    this._reset();
    this.dispatchEvent(new CustomEvent("mf-cancel", { bubbles: true, composed: true }));
  };

  private _confirmNow(): void {
    this._reset();
    this.dispatchEvent(new CustomEvent("mf-confirm", { bubbles: true, composed: true }));
  }

  private _onConfirmClick = (): void => {
    // No requireHold guard needed: the template only wires @click to this
    // handler on the non-hold confirm button (see render()).
    this._confirmNow();
  };

  private _startHold = (): void => {
    // No requireHold guard needed: the template only wires @pointerdown to
    // this handler on the hold-variant button, which only renders at all
    // when requireHold is true.
    const startedAt = Date.now();
    this._holdRaf = setInterval(() => {
      this._holdProgress = Math.min(1, (Date.now() - startedAt) / this.holdMs);
    }, 16);
    this._holdTimer = setTimeout(() => {
      this._confirmNow();
    }, this.holdMs);
  };

  private _cancelHold = (): void => {
    this._clearHold();
  };

  protected render() {
    if (this._phase === "idle") {
      return html`<button
        class="trigger"
        aria-label=${this.triggerAriaLabel}
        ?disabled=${this.disabled}
        @click=${this._open}
      >
        ${this.triggerLabel}
      </button>`;
    }

    return html`
      <div class="panel" role="group" aria-label=${this.triggerAriaLabel}>
        <p class="message">${this.message}</p>
        <div class="actions">
          <button class="cancel" @click=${this._cancel}>${this.cancelLabel}</button>
          ${this.requireHold
            ? html`<button
                class="confirm"
                aria-label="${this.confirmLabel}, press and hold to confirm"
                @pointerdown=${this._startHold}
                @pointerup=${this._cancelHold}
                @pointerleave=${this._cancelHold}
              >
                <span class="hold-progress" style="width:${this._holdProgress * 100}%"></span>
                ${this.confirmLabel} (hold)
              </button>`
            : html`<button class="confirm" @click=${this._onConfirmClick}>
                ${this.confirmLabel}
              </button>`}
        </div>
      </div>
    `;
  }
}

customElements.define("mf-confirm", MfConfirm);
