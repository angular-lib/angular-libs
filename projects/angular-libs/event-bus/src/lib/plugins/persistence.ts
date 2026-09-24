import { EventBusPlugin, EventKey } from '../event-bus.models';
import { StorageOptions, storedValue } from '../storage';

export interface PersistenceOptions<TEventMap = any> extends StorageOptions {
  /** Storage key for this bus's saved events. */
  key: string;
  /** Event keys to save. Only list what is safe to keep in storage — never tokens or personal data. */
  keys: readonly EventKey<TEventMap>[];
}

interface SavedEvent {
  payload: unknown;
  headers?: object;
  timestamp: number;
}

/**
 * Saves the latest payload of the listed events and restores it on startup, so `onToSignal`,
 * `latest()`, `combineLatestToSignal` and `onToResource` have their value right after a reload.
 *
 * Restoring does not run handlers or other plugins (restored events have `origin: 'storage'`).
 * `resetEvent` / `resetAllEvents` remove saved values. Does nothing where storage is unavailable.
 *
 * @example
 * ```ts
 * this.use(withPersistence({ key: 'my-app-events', keys: ['theme:changed', 'user:preferences'] }));
 * ```
 */
export function withPersistence<TEventMap extends object>(options: PersistenceOptions<TEventMap>): EventBusPlugin<TEventMap, any> {
  return (_bus, context) => {
    const store = storedValue<Record<string, SavedEvent>>(options.key, options);
    const keys = new Set<string>(options.keys);
    // Only keep keys that are still configured, so removing one from `keys` drops its saved value.
    const saved: Record<string, SavedEvent> = {};
    for (const [key, event] of Object.entries(store.read() ?? {})) {
      if (keys.has(key)) saved[key] = event;
    }

    for (const [key, event] of Object.entries(saved)) {
      context.hydrate(key as EventKey<TEventMap>, event.payload as never, { headers: event.headers, timestamp: event.timestamp });
    }

    return {
      onAfterEmit(event) {
        if (!keys.has(event.key)) return;
        saved[event.key] = { payload: event.payload, headers: event.headers, timestamp: event.timestamp };
        store.write(saved);
      },
      onReset(key) {
        if (key === undefined) {
          for (const k of Object.keys(saved)) delete saved[k];
        } else if (keys.has(key)) {
          delete saved[key];
        } else {
          return;
        }
        if (Object.keys(saved).length === 0) store.remove();
        else store.write(saved);
      },
    };
  };
}
