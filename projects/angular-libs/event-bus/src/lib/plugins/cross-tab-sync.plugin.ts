import { ALEventBusPlugin, IALEventBus } from '../event-bus.models';

/**
 * Configuration options for the Cross-Tab Synchronization Plugin.
 */
export interface CrossTabSyncPluginOptions {
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
 * import { crossTabSyncPlugin } from '@angular-libs/event-bus';
 *
 * @Injectable({ providedIn: 'root' })
 * export class AppEventBus extends ALEventBus<AppEventMap> {
 *   constructor() {
 *     super();
 *     this.registerPlugin(
 *       crossTabSyncPlugin({ keys: ['user:logged-out', 'cart:updated'] })
 *     );
 *   }
 * }
 * ```
 */
export function crossTabSyncPlugin(options: CrossTabSyncPluginOptions = {}): ALEventBusPlugin {
  const channelName = options.channelName ?? 'al-event-bus-sync';
  const keys = options.keys;
  let busInstance: IALEventBus<any> | null = null;
  let channel: BroadcastChannel | null = null;
  const SYNC_HEADER = '__TAB_SYNC_FLAG__';

  // Guards against re-broadcasting a reset that we ourselves just applied because it arrived
  // from another tab (which would otherwise cause an infinite ping-pong between tabs).
  let isApplyingRemoteReset = false;

  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    channel = new BroadcastChannel(channelName);
  }

  return {
    onInit(bus) {
      busInstance = bus;
      if (!channel) return;

      channel.onmessage = (event) => {
        if (!busInstance) return;
        const data = event.data;

        if (data?.type === 'reset') {
          isApplyingRemoteReset = true;
          try {
            if (data.key === undefined) {
              busInstance.resetAllEvents();
            } else {
              busInstance.resetEvent(data.key);
            }
          } finally {
            isApplyingRemoteReset = false;
          }
          return;
        }

        const { key, payload, headers } = data;
        // Re-emit on the local bus, with the SYNC_HEADER to avoid broadcast echoing loops
        const nextHeaders = { ...headers, [SYNC_HEADER]: true };
        busInstance.emit(key, payload, { headers: nextHeaders });
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
        type: 'emit',
        key: keyStr,
        payload,
        headers: emitOptions?.headers,
      });
    },
    onReset(key?: string) {
      if (!channel || isApplyingRemoteReset) return;
      if (keys && key !== undefined && !keys.includes(key)) return;
      channel.postMessage({ type: 'reset', key });
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
