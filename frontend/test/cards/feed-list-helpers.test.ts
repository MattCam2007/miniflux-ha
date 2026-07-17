import { describe, expect, it } from "vitest";

import {
  UNCATEGORIZED_TITLE,
  diffFeedFields,
  formatCheckedAge,
  groupFeedsByCategory,
  monogram,
} from "../../src/cards/feed-list-helpers";
import type { FeedDto } from "../../src/api/types";

function makeFeed(overrides: Partial<FeedDto> = {}): FeedDto {
  return {
    id: 1,
    title: "Example Feed",
    site_url: "https://example.com",
    feed_url: "https://example.com/feed.xml",
    category_id: 100,
    category_title: "News",
    checked_at: "2026-07-17T08:00:00Z",
    parsing_error_count: 0,
    parsing_error_message: "",
    disabled: false,
    unread: 0,
    ...overrides,
  };
}

describe("monogram", () => {
  it("uppercases the first letter", () => {
    expect(monogram("ars technica")).toBe("A");
  });
  it("falls back to ? for an empty title", () => {
    expect(monogram("   ")).toBe("?");
  });
});

describe("groupFeedsByCategory", () => {
  it("groups feeds under their category", () => {
    const feeds = [
      makeFeed({ id: 1, category_id: 100, category_title: "News" }),
      makeFeed({ id: 2, category_id: 100, category_title: "News" }),
      makeFeed({ id: 3, category_id: 200, category_title: "Tech" }),
    ];
    const groups = groupFeedsByCategory(feeds);
    expect(groups.map((g) => g.title)).toEqual(["News", "Tech"]);
    expect(groups[0].feeds.map((f) => f.id)).toEqual([1, 2]);
  });

  it("puts feeds without a category in an Uncategorized group, sorted last", () => {
    const feeds = [
      makeFeed({ id: 1, category_id: null, category_title: null }),
      makeFeed({ id: 2, category_id: 100, category_title: "Zebra" }),
    ];
    const groups = groupFeedsByCategory(feeds);
    expect(groups.map((g) => g.title)).toEqual(["Zebra", UNCATEGORIZED_TITLE]);
  });

  it("an all-uncategorized list still produces exactly one Uncategorized group", () => {
    const feeds = [makeFeed({ id: 1, category_id: null }), makeFeed({ id: 2, category_id: null })];
    const groups = groupFeedsByCategory(feeds);
    expect(groups).toHaveLength(1);
    expect(groups[0].feeds).toHaveLength(2);
  });

  it("an empty feed list produces no groups", () => {
    expect(groupFeedsByCategory([])).toEqual([]);
  });
});

describe("formatCheckedAge", () => {
  const now = new Date("2026-07-17T10:00:00Z");

  it("null checked_at reads Never checked", () => {
    expect(formatCheckedAge(null, now)).toBe("Never checked");
  });

  it("under a minute reads Just now", () => {
    expect(formatCheckedAge("2026-07-17T09:59:45Z", now)).toBe("Just now");
  });

  it("minutes-scale age", () => {
    expect(formatCheckedAge("2026-07-17T09:45:00Z", now)).toBe("15m ago");
  });

  it("hours-scale age", () => {
    expect(formatCheckedAge("2026-07-17T07:00:00Z", now)).toBe("3h ago");
  });

  it("days-scale age", () => {
    expect(formatCheckedAge("2026-07-14T10:00:00Z", now)).toBe("3d ago");
  });

  it("a future timestamp (clock skew) reads Just now rather than a negative age", () => {
    expect(formatCheckedAge("2026-07-17T10:05:00Z", now)).toBe("Just now");
  });
});

describe("diffFeedFields", () => {
  const original = makeFeed({ title: "Old Title", category_id: 100, feed_url: "https://a.com/feed" });

  it("only includes fields that actually changed", () => {
    const patch = diffFeedFields(original, {
      title: "Old Title",
      category: 100,
      feed_url: "https://a.com/feed",
      disabled: false,
      crawler: false,
    });
    expect(patch).toEqual({ crawler: false }); // crawler always sent (unobservable current value)
  });

  it("includes title when renamed", () => {
    const patch = diffFeedFields(original, {
      title: "New Title",
      category: 100,
      feed_url: "https://a.com/feed",
      disabled: false,
      crawler: false,
    });
    expect(patch.title).toBe("New Title");
    expect(patch.category).toBeUndefined();
  });

  it("includes category when moved", () => {
    const patch = diffFeedFields(original, {
      title: "Old Title",
      category: 200,
      feed_url: "https://a.com/feed",
      disabled: false,
      crawler: false,
    });
    expect(patch.category).toBe(200);
  });

  it("includes feed_url when changed", () => {
    const patch = diffFeedFields(original, {
      title: "Old Title",
      category: 100,
      feed_url: "https://b.com/feed",
      disabled: false,
      crawler: false,
    });
    expect(patch.feed_url).toBe("https://b.com/feed");
  });

  it("includes disabled when toggled", () => {
    const patch = diffFeedFields(original, {
      title: "Old Title",
      category: 100,
      feed_url: "https://a.com/feed",
      disabled: true,
      crawler: false,
    });
    expect(patch.disabled).toBe(true);
  });
});
