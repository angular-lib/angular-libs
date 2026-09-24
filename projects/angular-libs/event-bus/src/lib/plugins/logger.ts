import { isDevMode } from '@angular/core';
import { EventBusPlugin, EventOf } from '../event-bus.models';

export interface LoggerOptions<TEventMap = any> {
  /** Defaults to `isDevMode()`. */
  enabled?: boolean;
  /** Log only events for which this returns `true`. */
  filter?: (event: EventOf<TEventMap, any>) => boolean;
}

/**
 * Logs each event as a collapsed console group. Add it last to log what handlers receive, or first
 * to log everything emitted (including events later dropped or debounced).
 */
export function withLogger<TEventMap extends object = any>(options: LoggerOptions<TEventMap> = {}): EventBusPlugin<TEventMap, any> {
  return () => {
    if (!(options.enabled ?? isDevMode())) return;
    return {
      handle(event, next) {
        if (!options.filter || options.filter(event)) {
          const time = new Date(event.timestamp).toLocaleTimeString();
          console.groupCollapsed(`%c[Event Bus ${time}] %c${event.key}`, 'color:#0284c7;font-weight:bold', 'font-weight:bold');
          console.log('payload', event.payload);
          if (event.headers) console.log('headers', event.headers);
          if (event.origin !== 'local') console.log('origin', event.origin);
          console.groupEnd();
        }
        next(event);
      },
    };
  };
}
