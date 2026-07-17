// Hand-written `hass` double (F-U2, per 00-method-and-conventions.md §2).
// Every service response is scripted per test; no network, no real HA.

export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_changed: string;
  last_updated: string;
}

export interface ServiceCallRecord {
  domain: string;
  service: string;
  data: Record<string, unknown>;
  target?: Record<string, unknown>;
  returnResponse: boolean;
}

export type ServiceHandler = (
  data: Record<string, unknown>,
) => unknown | Promise<unknown>;

/** Mirrors the real rejection shape of a failed WS call_service command
 * (homeassistant/components/websocket_api/commands.py::handle_call_service):
 * the rejected value has `.code`/`.message`, not a JS Error. `code` drives
 * MinifluxApi's error normalization (F-U5) -- see src/api/errors.ts for the
 * exact code -> retriable mapping, confirmed against HA core source. */
export class FakeServiceError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = "FakeServiceError";
  }
}

export interface EntityRegistryEntry {
  entity_id: string;
  platform: string;
  config_entry_id: string | null;
  device_id?: string | null;
}

interface HassEvent {
  event_type: string;
  data: Record<string, unknown>;
}

type EventCallback = (event: HassEvent) => void;

/** Mirrors the real `Connection.subscribeEvents` (home-assistant-js-
 * websocket) closely enough for card code to use unmodified against
 * either. There is deliberately no `subscribeEntities` here: real HA never
 * exposes that as a `connection` method (it's a heavier standalone helper
 * wrapping `conn.subscribeMessage` + a diff-collection cache) -- F-U7's
 * entity-tick signal instead comes from the card's own `hass` setter,
 * which HA already re-invokes on every entity change for every mounted
 * card, admin or not. See src/store/refresh-bus.ts. */
class FakeConnection {
  private eventSubscribers: Array<{ cb: EventCallback; eventType?: string }> = [];

  constructor(private readonly hass: FakeHass) {}

  async subscribeEvents(cb: EventCallback, eventType?: string): Promise<() => void> {
    if (!this.hass.user.is_admin) {
      // Real HA (websocket_api/commands.py::handle_subscribe_events):
      // subscribing to a custom event type not in SUBSCRIBE_ALLOWLIST
      // raises Unauthorized for a non-admin user (G4) -- the promise
      // rejects, it never silently subscribes to nothing.
      throw new FakeServiceError("Unauthorized", "unauthorized");
    }
    const entry = { cb, eventType };
    this.eventSubscribers.push(entry);
    return () => {
      this.eventSubscribers = this.eventSubscribers.filter((s) => s !== entry);
    };
  }

  /** Test-only trigger -- fires a bus event to every matching subscriber. */
  _fireEvent(eventType: string, data: Record<string, unknown>): void {
    for (const { cb, eventType: want } of this.eventSubscribers) {
      if (!want || want === eventType) cb({ event_type: eventType, data });
    }
  }
}

export class FakeHass {
  states: Record<string, HassEntity> = {};
  entities: Record<string, EntityRegistryEntry> = {};
  user: { is_admin: boolean } = { is_admin: false };
  connection: FakeConnection;
  calls: ServiceCallRecord[] = [];

  private handlers = new Map<string, ServiceHandler>();

  constructor() {
    this.connection = new FakeConnection(this);
  }

  /** Scripts a service's response (or throw, via a thrown FakeServiceError)
   * for every subsequent call matching `domain.service`. */
  respondTo(domain: string, service: string, handler: ServiceHandler): void {
    this.handlers.set(`${domain}.${service}`, handler);
  }

  async callService(
    domain: string,
    service: string,
    data: Record<string, unknown> = {},
    target?: Record<string, unknown>,
    _notifyOnError = true,
    returnResponse = false,
  ): Promise<{ context: { id: string }; response?: unknown }> {
    this.calls.push({ domain, service, data, target, returnResponse });

    const handler = this.handlers.get(`${domain}.${service}`);
    if (!handler) {
      throw new FakeServiceError(`No handler scripted for ${domain}.${service}`);
    }
    const result = await handler(data);
    return returnResponse
      ? { context: { id: "fake-context" }, response: result }
      : { context: { id: "fake-context" } };
  }

  async callWS<T>(msg: Record<string, unknown>): Promise<T> {
    const key = `ws:${msg.type}`;
    const handler = this.handlers.get(key);
    if (!handler) {
      throw new FakeServiceError(`No handler scripted for ${key}`);
    }
    return (await handler(msg)) as T;
  }

  respondToWS(type: string, handler: ServiceHandler): void {
    this.handlers.set(`ws:${type}`, handler);
  }

  /** Test helper: sets/replaces entity state. Does NOT itself notify
   * anything -- in production, HA re-invoking the card's `hass` setter
   * *is* the notification; tests that exercise the refresh bus call
   * `store.onHassUpdate(hass)` explicitly after this, exactly as a card's
   * setter would. */
  setState(entityId: string, state: string, attributes: Record<string, unknown> = {}): void {
    const now = new Date().toISOString();
    this.states[entityId] = {
      entity_id: entityId,
      state,
      attributes,
      last_changed: now,
      last_updated: now,
    };
  }

  fireEvent(eventType: string, data: Record<string, unknown>): void {
    this.connection._fireEvent(eventType, data);
  }
}
