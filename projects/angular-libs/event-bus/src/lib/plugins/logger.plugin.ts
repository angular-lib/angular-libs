import { ALEventBusPlugin } from '../event-bus.models';

/**
 * Configuration options for the Logger Plugin.
 */
export interface LoggerPluginOptions {
  /** 
   * Enables logging purely in development environments. 
   * @default true
   */
  enabled?: boolean;
  /** Custom console styling configuration. */
  theme?: {
    /** 
     * CSS color string for console headers. 
     * @default '#0284c7' (blue)
     */
    headerColor?: string;
    /** 
     * CSS color string for console payload text representation. 
     * @default '#10b981' (green)
     */
    payloadColor?: string;
  };
}

/**
 * Creates a functional event bus logger plugin.
 * This is a passive interceptor plugin that works silently behind the scenes.
 * You can register it inside your constructor without assigning it to a class property.
 *
 * @param options Configurations including active status and custom header browser console colors.
 *
 * @example
 * ```ts
 * import { loggerPlugin } from '@angular-libs/event-bus';
 *
 * @Injectable({ providedIn: 'root' })
 * export class AppEventBus extends ALEventBus<AppEventMap> {
 *   constructor() {
 *     super();
 *     this.registerPlugin(loggerPlugin({ enabled: !environment.production }));
 *   }
 * }
 * ```
 */
export function loggerPlugin(options: LoggerPluginOptions = {}): ALEventBusPlugin {
  const enabled = options.enabled ?? true;
  const headerColor = options.theme?.headerColor ?? '#0284c7';
  const payloadColor = options.theme?.payloadColor ?? '#10b981';

  return {
    onAfterEmit(key, payload, emitOptions) {
      if (!enabled) return;
      const time = new Date().toLocaleTimeString();
      console.groupCollapsed(
        `%c[Event Bus :: ${time}] %c${String(key)}`,
        `color: ${headerColor}; font-weight: bold;`,
        'color: inherit; font-weight: bold;'
      );
      console.log('%cPayload:', `color: ${payloadColor}; font-weight: bold;`, payload);
      if (emitOptions?.headers) {
        console.log('%cHeaders:', 'color: #f59e0b; font-weight: bold;', emitOptions.headers);
      }
      console.groupEnd();
    }
  };
}
