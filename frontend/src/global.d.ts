export {};

interface CustomCardEntry {
  type: string;
  name: string;
  description?: string;
}

declare global {
  interface Window {
    customCards?: CustomCardEntry[];
  }
}
