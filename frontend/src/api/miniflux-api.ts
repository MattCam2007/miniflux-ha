// F-U4: one typed method per Phase-1 service, over hass.callService's WS
// call_service + return_response path (architecture: the only sanctioned
// way a card talks to the backend -- DoD "every service call goes through
// MinifluxApi, never a raw callService").
//
// Every call resolves config_entry_id via F-U3 and sends it explicitly
// (D-3: the seam stays live even though no Phase 1 UI ever shows a picker),
// and every rejection is normalized via F-U5's runCall/MinifluxApiError.
//
// returnResponse is only ever true for services registered with
// SupportsResponse.ONLY (get_feeds, get_categories, count_entries,
// create_feed, discover_feeds, create_category) -- passing true for any
// other service makes HA itself raise ServiceValidationError
// ("service_does_not_support_response"), confirmed against
// homeassistant/core.py's ServiceRegistry.async_call.

import { resolveConfigEntryId } from "./config-entry";
import { runCall } from "./errors";
import type { Hass } from "./hass-types";
import type { CategoryDto, DiscoverCandidateDto, EntryStatus, FeedDto } from "./types";

interface CallOptions {
  config_entry_id?: string;
}

function omitUndefined(data: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
}

export class MinifluxApi {
  private async callWithResponse<T>(
    hass: Hass,
    service: string,
    options: CallOptions,
    data: Record<string, unknown>,
  ): Promise<T> {
    const configEntryId = resolveConfigEntryId(hass, options.config_entry_id);
    const payload = omitUndefined({ ...data, config_entry_id: configEntryId });
    const { response } = await runCall(
      hass.callService("miniflux", service, payload, undefined, true, true),
    );
    return response as T;
  }

  private async callVoid(
    hass: Hass,
    service: string,
    options: CallOptions,
    data: Record<string, unknown>,
  ): Promise<void> {
    const configEntryId = resolveConfigEntryId(hass, options.config_entry_id);
    const payload = omitUndefined({ ...data, config_entry_id: configEntryId });
    await runCall(hass.callService("miniflux", service, payload, undefined, true, false));
  }

  // --- Query family ---------------------------------------------------

  async getFeeds(
    hass: Hass,
    params: { category?: number | string; only_with_errors?: boolean } & CallOptions = {},
  ): Promise<{ feeds: FeedDto[] }> {
    return this.callWithResponse(hass, "get_feeds", params, {
      category: params.category,
      only_with_errors: params.only_with_errors,
    });
  }

  async getCategories(
    hass: Hass,
    options: CallOptions = {},
  ): Promise<{ categories: CategoryDto[] }> {
    return this.callWithResponse(hass, "get_categories", options, {});
  }

  async countEntries(
    hass: Hass,
    params: {
      category?: number | string;
      feed?: number | string;
      status?: EntryStatus[];
      starred?: boolean;
    } & CallOptions = {},
  ): Promise<{ total: number }> {
    return this.callWithResponse(hass, "count_entries", params, {
      category: params.category,
      feed: params.feed,
      status: params.status,
      starred: params.starred,
    });
  }

  // --- Feed admin -------------------------------------------------------

  async createFeed(
    hass: Hass,
    params: {
      feed_url: string;
      category?: number | string;
      crawler?: boolean;
    } & CallOptions,
  ): Promise<{ feed_id: number }> {
    return this.callWithResponse(hass, "create_feed", params, {
      feed_url: params.feed_url,
      category: params.category,
      crawler: params.crawler,
    });
  }

  async updateFeed(
    hass: Hass,
    params: {
      feed: number | string;
      title?: string;
      category?: number | string;
      feed_url?: string;
      disabled?: boolean;
      crawler?: boolean;
    } & CallOptions,
  ): Promise<void> {
    const { feed, title, category, feed_url, disabled, crawler } = params;
    return this.callVoid(hass, "update_feed", params, {
      feed,
      title,
      category,
      feed_url,
      disabled,
      crawler,
    });
  }

  async deleteFeed(hass: Hass, params: { feed: number | string } & CallOptions): Promise<void> {
    return this.callVoid(hass, "delete_feed", params, { feed: params.feed });
  }

  async refreshFeed(hass: Hass, params: { feed: number | string } & CallOptions): Promise<void> {
    return this.callVoid(hass, "refresh_feed", params, { feed: params.feed });
  }

  async refreshAllFeeds(hass: Hass, options: CallOptions = {}): Promise<void> {
    return this.callVoid(hass, "refresh_all_feeds", options, {});
  }

  async discoverFeeds(
    hass: Hass,
    params: { url: string } & CallOptions,
  ): Promise<{ feeds: DiscoverCandidateDto[] }> {
    return this.callWithResponse(hass, "discover_feeds", params, { url: params.url });
  }

  // --- Mutation / mark-all-read -----------------------------------------

  async markAllRead(
    hass: Hass,
    params: (
      | { feed: number | string; category?: never; everything?: never }
      | { category: number | string; feed?: never; everything?: never }
      | { everything: true; feed?: never; category?: never }
    ) &
      CallOptions,
  ): Promise<void> {
    return this.callVoid(hass, "mark_all_read", params, {
      feed: params.feed,
      category: params.category,
      everything: params.everything,
    });
  }

  // --- Category admin -----------------------------------------------------

  async createCategory(
    hass: Hass,
    params: { title: string } & CallOptions,
  ): Promise<{ category_id: number }> {
    return this.callWithResponse(hass, "create_category", params, { title: params.title });
  }

  async updateCategory(
    hass: Hass,
    params: { category: number | string; title: string } & CallOptions,
  ): Promise<void> {
    return this.callVoid(hass, "update_category", params, {
      category: params.category,
      title: params.title,
    });
  }

  async deleteCategory(
    hass: Hass,
    params: { category: number | string } & CallOptions,
  ): Promise<void> {
    return this.callVoid(hass, "delete_category", params, { category: params.category });
  }
}
