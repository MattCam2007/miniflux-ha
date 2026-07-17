// Bundle entry point (F-U1). Side-effect imports register custom elements
// and push their card-picker metadata onto window.customCards; nothing is
// exported; no runtime network fetches.
import "./spike-card";
import "./cards/feed-manager-card";
import "./cards/feed-manager-card-editor";
