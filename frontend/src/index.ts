// Bundle entry point (F-U1). Side-effect imports register custom elements
// and push their card-picker metadata onto window.customCards; nothing is
// exported; no runtime network fetches. Real Phase 1 cards (C3/C4) get
// their own module imported here once built.
import "./spike-card";
