import { describe, expect, it } from "vitest";

import { sortCategories } from "../../src/cards/category-list-helpers";
import type { CategoryDto } from "../../src/api/types";

function cat(overrides: Partial<CategoryDto> = {}): CategoryDto {
  return { id: 1, title: "News", feed_count: 1, unread: 0, ...overrides };
}

describe("sortCategories", () => {
  it("sorts by unread descending", () => {
    const result = sortCategories(
      [cat({ id: 1, unread: 3 }), cat({ id: 2, unread: 10 }), cat({ id: 3, unread: 0 })],
      "unread",
    );
    expect(result.map((c) => c.id)).toEqual([2, 1, 3]);
  });

  it("sorts by title alphabetically", () => {
    const result = sortCategories(
      [cat({ id: 1, title: "Zebra" }), cat({ id: 2, title: "Apple" })],
      "title",
    );
    expect(result.map((c) => c.title)).toEqual(["Apple", "Zebra"]);
  });

  it("sorts by feed count descending", () => {
    const result = sortCategories(
      [cat({ id: 1, feed_count: 2 }), cat({ id: 2, feed_count: 8 })],
      "feeds",
    );
    expect(result.map((c) => c.id)).toEqual([2, 1]);
  });

  it("null counts (G1 unknown) always sort last, regardless of direction", () => {
    const result = sortCategories(
      [cat({ id: 1, unread: null }), cat({ id: 2, unread: 5 }), cat({ id: 3, unread: 0 })],
      "unread",
    );
    expect(result.map((c) => c.id)).toEqual([2, 3, 1]);
  });

  it("two categories both with a null count keep their original relative order", () => {
    const result = sortCategories(
      [
        cat({ id: 1, unread: null }),
        cat({ id: 2, unread: 5 }),
        cat({ id: 3, unread: null }),
      ],
      "unread",
    );
    expect(result.map((c) => c.id)).toEqual([2, 1, 3]);
  });

  it("null feed_count sorts last under the feeds sort too", () => {
    const result = sortCategories(
      [cat({ id: 1, feed_count: 4 }), cat({ id: 2, feed_count: null })],
      "feeds",
    );
    expect(result.map((c) => c.id)).toEqual([1, 2]);
  });

  it("ties keep their original relative order (stable sort)", () => {
    const result = sortCategories(
      [cat({ id: 1, unread: 5 }), cat({ id: 2, unread: 5 })],
      "unread",
    );
    expect(result.map((c) => c.id)).toEqual([1, 2]);
  });

  it("an empty list stays empty", () => {
    expect(sortCategories([], "unread")).toEqual([]);
  });
});
