// F-U13: the one place every card pushes its picker metadata from --
// keeps the window.customCards shape consistent across C3/C4 (and every
// later card) instead of each card hand-rolling the push. The
// window.customCards type itself is declared once in src/global.d.ts.

export interface CardRegistration {
  type: string;
  name: string;
  description: string;
  /** Shows a live rendered preview in the card picker (HA convention). */
  preview?: boolean;
}

export function registerCard(registration: CardRegistration): void {
  window.customCards = window.customCards ?? [];
  window.customCards.push(registration);
}
