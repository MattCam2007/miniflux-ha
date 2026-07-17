// Bundle entry point (F-U1). Side-effect imports register custom elements
// and push their card-picker metadata onto window.customCards; nothing is
// exported; no runtime network fetches. F-U14 (test/bundle.smoke.test.ts)
// asserts the built bundle exposes exactly the elements imported here.
import "./cards/feed-manager-card";
import "./cards/feed-manager-card-editor";
import "./cards/category-manager-card";
import "./cards/category-manager-card-editor";
