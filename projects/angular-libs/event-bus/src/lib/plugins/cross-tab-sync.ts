import { EventBusPlugin, EventKey } from '../event-bus.models';

export interface CrossTabSyncOptions<TEventMap = any> {
  /** `BroadcastChannel` name. Use one per app and bus class. */
  channel: string;
  /** Keys to sync. Defaults to every key. Payloads must be structured-cloneable. */
  keys?: readonly EventKey<TEventMap>[];
}

const MESSAGE_KIND = '@angular-libs/event-bus';

/** @internal Identifies this JS realm (tab), so copies of a bus in the same tab never sync with each other. */
export const ɵTAB_ID = Math.random().toString(36).slice(2);

/**
 * Mirrors events — and `resetEvent` / `resetAllEvents` — to other tabs of the same origin with
 * `BroadcastChannel`.
 *
 * Received events enter the pipeline from the start with `origin: 'remote'` and are never sent back,
 * whatever other plugins (such as debounce) do with them. Messages from the same tab (e.g. a
 * component-scoped copy of the bus) are ignored. Does nothing where `BroadcastChannel` is unavailable
 * (SSR, old browsers).
 */
export function withCrossTabSync<TEventMap extends object>(options: CrossTabSyncOptions<TEventMap>): EventBusPlugin<TEventMap, any> {
  return (bus) => {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel(options.channel);
    const keys = options.keys ? new Set<string>(options.keys) : null;
    const synced = (key: string) => !keys || keys.has(key);
    const post = (message: object) => {
      try {
        channel.postMessage({ kind: MESSAGE_KIND, sender: ɵTAB_ID, ...message });
      } catch (error) {
        console.error('[ALEventBus] Could not sync across tabs (payload not cloneable?).', error);
      }
    };
    const anyBus = bus as unknown as {
      emit(key: string, payload: unknown, options: object): void;
      resetEvent(key: string, options: object): void;
      resetAllEvents(options: object): void;
    };

    channel.onmessage = ({ data }) => {
      if (data?.kind !== MESSAGE_KIND || data.sender === ɵTAB_ID) return;
      const remote = { origin: 'remote' };
      if (data.type === 'reset') {
        if (typeof data.key === 'string') {
          if (synced(data.key)) anyBus.resetEvent(data.key, remote);
        } else if (keys) {
          keys.forEach((key) => anyBus.resetEvent(key, remote));
        } else {
          anyBus.resetAllEvents(remote);
        }
        return;
      }
      if (data.type === 'emit' && typeof data.key === 'string' && synced(data.key)) {
        anyBus.emit(data.key, data.payload, { headers: data.headers, origin: 'remote' });
      }
    };

    return {
      handle(event, next) {
        next(event);
        if (event.origin === 'remote' || !synced(event.key)) return;
        post({ type: 'emit', key: event.key, payload: event.payload, headers: event.headers });
      },
      onReset(key, origin) {
        if (origin === 'remote' || (key !== undefined && !synced(key))) return;
        post({ type: 'reset', key });
      },
      destroy: () => channel.close(),
    };
  };
}
