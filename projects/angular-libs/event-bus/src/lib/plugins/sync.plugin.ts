import { ALEventBusPlugin, IALEventBus } from '../event-bus.models';

/**
 * Configuration options for the Cross-Tab Synchronization Plugin.
 */
export interface SyncPluginOptions {
  /** 
   * The channel namespace to coordinate with. 
   * @default 'al-event-bus-sync'
   */
  channelName?: string;
  /** 
   * Specific event keys to sync. If omitted, synchronizes all events across tabs.
   * @default undefined (all keys synced)
   */
  keys?: string[];
}

/**
 * Creates a functional cross-tab synchronization plugin.
 * This is a passive interceptor plugin that works silently behind the scenes.
 * You can register it inside your constructor without assigning it to a class property.
 *
 * @param options Configurations including custom channel namespaces and target event restrictions.
 *
 * @example
 * ```ts
 * import { syncPlugin } from '@angular-libs/event-bus';
 *
 * @Injectable({ providedIn: 'root' })
 * export class AppEventBus extends ALEventBus<AppEventMap> {
 *   constructor() {
 *     super();
 *     this.registerPlugin(
 *       syncPlugin({ keys: ['user:logged-out', 'cart:updated'] })
 *     );
 *   }
 * }
 * ```
 */
export function syncPlugin(options: SyncPluginOptions = {}): ALEventBusPlugin {
  const channelName = options.channelName ?? 'al-event-bus-sync';
  const keys = options.keys;
  let busInstance: IALEventBus<any> | null = null;
  let channel: BroadcastChannel | null = null;
  const SYNC_HEADER = '__TAB_SYNC_FLAG__';

  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    channel = new BroadcastChannel(channelName);
  }

  return {
    onInit(bus) {
      busInstance = bus;
      if (!channel) return;

      channel.onmessage = (event) => {
        const { key, payload, headers } = event.data;
        if (busInstance) {
          // Re-emit on the local bus, with the SYNC_HEADER to avoid broadcast echoing loops
          const nextHeaders = { ...headers, [SYNC_HEADER]: true };
          busInstance.emit(key, payload, { headers: nextHeaders });
        }
      };
    },
    onAfterEmit(key, payload, emitOptions) {
      if (!channel) return;
      const keyStr = String(key);

      // Filter by keys if specified
      if (keys && !keys.includes(keyStr)) return;

      // Avoid echo infinite loops
      if (emitOptions?.headers?.[SYNC_HEADER]) {
        return;
      }

      channel.postMessage({
        key: keyStr,
        payload,
        headers: emitOptions?.headers,
      });
    },
    onDestroy() {
      if (channel) {
        channel.close();
        channel = null;
      }
      busInstance = null;
    }
  };
}
