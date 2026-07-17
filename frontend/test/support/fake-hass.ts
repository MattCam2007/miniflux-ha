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
type EntitiesCallback = (states: Record<string, HassEntity>) => void;

/** Mirrors the shape of home-assistant-js-websocket's real `Connection`
 * closely enough for card code to use unmodified against either. */
class FakeConnection {
  private eventSubscribers: Array<{ cb: EventCallback; eventType?: string }> = [];
  private entitySubscribers: EntitiesCallback[] = [];

  constructor(private readonly hass: FakeHass) {}

  async subscribeEvents(cb: EventCallback, eventType?: string): Promise<() => void> {
    if (!this.hass.user.is_admin) {
      // Real HA: subscribing to arbitrary custom event types over the
      // websocket is admin-only (G4) -- non-admin subscribers never
      // receive anything, which is exactly the constraint F-U7's
      // entity-tick fallback exists to work around.
      return () => {};
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

  subscribeEntities(cb: EntitiesCallback): () => void {
    this.entitySubscribers.push(cb);
    return () => {
      this.entitySubscribers = this.entitySubscribers.filter((s) => s !== cb);
    };
  }

  /** Test-only trigger -- simulates an entity-state poll tick. */
  _tickEntities(states: Record<string, HassEntity>): void {
    for (const cb of this.entitySubscribers) cb(states);
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

  /** Test helper: sets/replaces entity state and fires the entity-tick
   * subscribers, mirroring a coordinator poll landing. */
  setState(entityId: string, state: string, attributes: Record<string, unknown> = {}): void {
    const now = new Date().toISOString();
    this.states[entityId] = {
      entity_id: entityId,
      state,
      attributes,
      last_changed: now,
      last_updated: now,
    };
    this.connection._tickEntities(this.states);
  }

  fireEvent(eventType: string, data: Record<string, unknown>): void {
    this.connection._fireEvent(eventType, data);
  }
}
