// The minimal slice of the real `hass` object every module in this subtree
// needs. Deliberately narrow (not the full home-assistant-frontend `HomeAssistant`
// type) so FakeHass (test/support/fake-hass.ts) can satisfy it exactly.

export interface HassEntityState {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_changed: string;
  last_updated: string;
}

export interface HassEntityRegistryEntry {
  entity_id: string;
  platform: string;
  config_entry_id: string | null;
  device_id?: string | null;
}

export interface HassConnection {
  subscribeEvents(
    callback: (event: { event_type: string; data: Record<string, unknown> }) => void,
    eventType?: string,
  ): Promise<() => void>;
  subscribeEntities(callback: (states: Record<string, HassEntityState>) => void): () => void;
}

export interface Hass {
  states: Record<string, HassEntityState>;
  entities: Record<string, HassEntityRegistryEntry>;
  user: { is_admin: boolean };
  connection: HassConnection;
  callService(
    domain: string,
    service: string,
    data?: Record<string, unknown>,
    target?: Record<string, unknown>,
    notifyOnError?: boolean,
    returnResponse?: boolean,
  ): Promise<{ context: { id: string }; response?: unknown }>;
}
