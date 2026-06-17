import { ALEventBusPlugin, IALEventBus } from '../event-bus.models';

/**
 * Configuration rule representing a target event mapping and its timing boundaries.
 */
export interface DebounceRule {
  /** The event key to apply debounce timing to. */
  key: string;
  /** The debounce delay in milliseconds. */
  delay: number;
}

/**
 * Creates a functional event debounce plugin.
 * This is a passive interceptor plugin that works silently behind the scenes.
 * You can register it inside your constructor without assigning it to a class property.
 *
 * @param rules Array of configurations establishing custom time delays on a per-event basis.
 *
 * @example
 * ```ts
 * import { debouncePlugin } from '@angular-libs/event-bus';
 *
 * @Injectable({ providedIn: 'root' })
 * export class AppEventBus extends ALEventBus<AppEventMap> {
 *   constructor() {
 *     super();
 *     this.registerPlugin(
 *       debouncePlugin([
 *         { key: 'input:search-typed', delay: 300 },
 *         { key: 'window:resized', delay: 150 }
 *       ])
 *     );
 *   }
 * }
 * ```
 */
export function debouncePlugin(rules: DebounceRule[]): ALEventBusPlugin {
  let busInstance: IALEventBus<any> | null = null;
  const timers = new Map<string, any>();
  const rulesMap = new Map(rules.map((r) => [r.key, r.delay]));

  // Internal header key to bypass our debounce check when rehashing emissions
  const DEBOUNCE_BYPASS = '__DEBUG_DEBOUNCE_BYPASS__';

  return {
    onInit(bus) {
      busInstance = bus;
    },
    onBeforeEmit(key, payload, options) {
      const keyStr = String(key);
      const delay = rulesMap.get(keyStr);

      if (!delay || !busInstance) return;

      // Checking bypass header
      if (options?.headers?.[DEBOUNCE_BYPASS]) {
        // Clean up our bypass header so it doesn't propagate to consumers
        delete options.headers[DEBOUNCE_BYPASS];
        return;
      }

      // Clear previous scheduled emit
      if (timers.has(keyStr)) {
        clearTimeout(timers.get(keyStr));
      }

      const timerId = setTimeout(() => {
        timers.delete(keyStr);
        const nextOptions = { ...options, headers: { ...options?.headers, [DEBOUNCE_BYPASS]: true } };
        busInstance!.emit(keyStr as any, payload as any, nextOptions);
      }, delay);

      timers.set(keyStr, timerId);

      // Cancel the current synchronous execution loop
      return false;
    },
    onDestroy() {
      timers.forEach(clearTimeout);
      timers.clear();
      busInstance = null;
    }
  };
}
