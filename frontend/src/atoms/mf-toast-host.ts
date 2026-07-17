import { LitElement, css, html } from "lit";

// F-U11 (DC5): toast/undo host. A card mounts exactly one of these and
// calls `.show()` imperatively (e.g. after an optimistic mutation fails --
// F-U8 -- or a destructive action that offers a brief undo window). Each
// toast auto-dismisses after its own timeout; clicking Undo fires the
// caller's callback and dismisses immediately, cancelling the timer so it
// can't also fire.

export interface ToastOptions {
  undo?: () => void;
  timeoutMs?: number;
}

interface Toast {
  id: number;
  message: string;
  undo?: () => void;
}

const DEFAULT_TIMEOUT_MS = 6000;

export class MfToastHost extends LitElement {
  static properties = { _toasts: { state: true } };

  private _toasts: Toast[] = [];
  private _nextId = 1;
  private readonly _timers = new Map<number, ReturnType<typeof setTimeout>>();

  static styles = css`
    :host {
      display: block;
    }
    .toasts {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .toast {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 12px;
      border-radius: 6px;
      background: var(--primary-text-color, #212121);
      color: var(--text-primary-color, #fff);
    }
    button {
      min-height: 44px;
      min-width: 44px;
      background: transparent;
      color: inherit;
      border: none;
      font: inherit;
      text-decoration: underline;
      cursor: pointer;
    }
  `;

  show(message: string, options: ToastOptions = {}): void {
    const id = this._nextId++;
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this._toasts = [...this._toasts, { id, message, undo: options.undo }];
    this._timers.set(
      id,
      setTimeout(() => this._dismiss(id), timeoutMs),
    );
  }

  private _dismiss(id: number): void {
    // No `timers.has(id)` guard needed: every call site (the timeout
    // firing, or an Undo click) only ever runs for a toast whose timer is
    // still registered -- clearTimeout on an already-fired timer is a safe
    // no-op regardless.
    clearTimeout(this._timers.get(id));
    this._timers.delete(id);
    this._toasts = this._toasts.filter((toast) => toast.id !== id);
  }

  private _onUndoClick(toast: Toast): void {
    toast.undo?.();
    this._dismiss(toast.id);
  }

  protected render() {
    return html`
      <div class="toasts" aria-live="assertive">
        ${this._toasts.map(
          (toast) => html`
            <div class="toast">
              <span>${toast.message}</span>
              ${toast.undo
                ? html`<button @click=${() => this._onUndoClick(toast)}>Undo</button>`
                : ""}
            </div>
          `,
        )}
      </div>
    `;
  }
}

customElements.define("mf-toast-host", MfToastHost);
