import { Type, inject } from '@angular/core';
import type { ALEventBus } from '../event-bus';
import { EventBusPlugin, PluginHooks } from '../event-bus.models';

/**
 * Defines your own plugin. The factory runs in the bus's injection context, so it can `inject()`.
 * Every hook is optional; whatever you put in `api` is returned by `use()`.
 *
 * @example
 * ```ts
 * export function analyticsPlugin() {
 *   return definePlugin<AppEventMap>(() => {
 *     const analytics = inject(Analytics);
 *     const queue: string[] = [];
 *     return {
 *       onAfterEmit: (event) => queue.push(event.key),
 *       api: { flush: () => analytics.send(queue.splice(0)) },
 *     };
 *   });
 * }
 *
 * export class AppEventBus extends ALEventBus<AppEventMap> {
 *   analytics = this.use(analyticsPlugin()); // this.analytics.flush()
 * }
 * ```
 */
export function definePlugin<TEventMap extends object, THeaders extends object = Record<string, unknown>, TApi = void>(
  factory: (bus: ALEventBus<TEventMap, THeaders>) => PluginHooks<TEventMap, THeaders, TApi> | void,
): EventBusPlugin<TEventMap, THeaders, TApi> {
  return factory;
}

/**
 * For a bus provided in a component or route: also delivers its events to the parent instance of
 * the same bus class (e.g. the root one). Events never flow from parent to child.
 */
export function withBubbling(): EventBusPlugin<any, any> {
  return (bus) => {
    const parent = inject(bus.constructor as Type<ALEventBus<any, any>>, { skipSelf: true, optional: true });
    if (!parent) return;
    return {
      handle(event, next) {
        next(event);
        parent.emit(event.key, event.payload, { headers: event.headers, origin: event.origin });
      },
    };
  };
}
