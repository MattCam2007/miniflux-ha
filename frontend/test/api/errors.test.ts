import { describe, expect, it } from "vitest";

import { MinifluxApiError, normalizeError, runCall } from "../../src/api/errors";
import { FakeServiceError } from "../support/fake-hass";

describe("normalizeError", () => {
  it("preserves the message verbatim (DC7)", () => {
    const normalized = normalizeError(new FakeServiceError("Unknown feed reference: 999"));
    expect(normalized.message).toBe("Unknown feed reference: 999");
  });

  it.each(["service_validation_error", "invalid_format", "not_found"])(
    "code %s is never retriable",
    (code) => {
      const normalized = normalizeError(new FakeServiceError("bad input", code));
      expect(normalized.retriable).toBe(false);
    },
  );

  it.each(["home_assistant_error", "unknown_error"])("code %s is retriable", (code) => {
    const normalized = normalizeError(new FakeServiceError("server unreachable", code));
    expect(normalized.retriable).toBe(true);
  });

  it("no code at all defaults to retriable (e.g. a raw network rejection)", () => {
    const normalized = normalizeError(new Error("network down"));
    expect(normalized.retriable).toBe(true);
  });

  it("a non-Error rejection still produces a usable message", () => {
    const normalized = normalizeError("just a string");
    expect(normalized.message).toBe("just a string");
    expect(normalized.retriable).toBe(true);
  });
});

describe("runCall", () => {
  it("passes through a successful result unchanged", async () => {
    const result = await runCall(Promise.resolve({ total: 5 }));
    expect(result).toEqual({ total: 5 });
  });

  it("wraps a rejection as MinifluxApiError with the normalized shape", async () => {
    const err = new FakeServiceError(
      "Multiple Miniflux instances are configured",
      "service_validation_error",
    );
    await expect(runCall(Promise.reject(err))).rejects.toMatchObject({
      message: "Multiple Miniflux instances are configured",
      retriable: false,
    });
  });

  it("the rejection is a real MinifluxApiError instance", async () => {
    const rejected = Promise.reject(new FakeServiceError("boom", "home_assistant_error"));
    try {
      await runCall(rejected);
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(MinifluxApiError);
      expect((err as MinifluxApiError).retriable).toBe(true);
    }
  });
});
