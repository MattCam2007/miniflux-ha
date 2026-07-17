// F-U5: one error shape every MinifluxApi call normalizes to. `message` is
// rendered verbatim by cards (DC7) -- never re-parsed or reworded.
//
// `retriable` is derived from the WS call_service rejection's `.code`,
// confirmed against HA core source
// (homeassistant/components/websocket_api/commands.py::handle_call_service
// + .../websocket_api/const.py): a raised ServiceValidationError (caller
// mistake -- bad filter, unknown feed/category ref) always arrives as
// "service_validation_error"; a schema-level vol.Invalid arrives as
// "invalid_format"; a service name typo arrives as "not_found". None of
// those are worth retrying. Everything else (`home_assistant_error` --
// this integration's own _run() wraps transport/server failures into
// exactly this; `unknown_error`; no code at all, e.g. a network-level
// rejection) is treated as potentially transient.

const NON_RETRIABLE_CODES = new Set(["service_validation_error", "invalid_format", "not_found"]);

export interface NormalizedError {
  message: string;
  retriable: boolean;
}

export class MinifluxApiError extends Error {
  readonly retriable: boolean;

  constructor(normalized: NormalizedError) {
    super(normalized.message);
    this.name = "MinifluxApiError";
    this.retriable = normalized.retriable;
  }
}

function hasStringProp<K extends string>(
  value: unknown,
  key: K,
): value is Record<K, string> {
  return (
    typeof value === "object" &&
    value !== null &&
    key in value &&
    typeof (value as Record<string, unknown>)[key] === "string"
  );
}

export function normalizeError(err: unknown): NormalizedError {
  if (hasStringProp(err, "message")) {
    const code = hasStringProp(err, "code") ? err.code : undefined;
    return { message: err.message, retriable: code === undefined || !NON_RETRIABLE_CODES.has(code) };
  }
  return { message: String(err), retriable: true };
}

/** Every MinifluxApi method funnels its callService rejection through this,
 * so callers only ever see MinifluxApiError, never a raw WS error shape. */
export async function runCall<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise;
  } catch (err) {
    throw new MinifluxApiError(normalizeError(err));
  }
}
