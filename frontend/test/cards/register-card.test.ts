import { afterEach, describe, expect, it } from "vitest";

import { registerCard } from "../../src/cards/register-card";

afterEach(() => {
  window.customCards = [];
});

describe("registerCard", () => {
  it("pushes the exact registration metadata onto window.customCards", () => {
    registerCard({
      type: "miniflux-feed-manager-card",
      name: "Miniflux Feed Manager",
      description: "Manage Miniflux feeds",
    });

    expect(window.customCards).toEqual([
      {
        type: "miniflux-feed-manager-card",
        name: "Miniflux Feed Manager",
        description: "Manage Miniflux feeds",
      },
    ]);
  });

  it("creates window.customCards if it doesn't exist yet", () => {
    window.customCards = undefined;
    registerCard({ type: "a", name: "A", description: "d" });
    expect(window.customCards).toHaveLength(1);
  });

  it("multiple cards accumulate rather than overwrite each other", () => {
    registerCard({ type: "a", name: "A", description: "d" });
    registerCard({ type: "b", name: "B", description: "d" });
    expect(window.customCards?.map((c) => c.type)).toEqual(["a", "b"]);
  });
});
