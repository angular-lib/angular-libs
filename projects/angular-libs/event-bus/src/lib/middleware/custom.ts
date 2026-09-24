import { Type, inject } from '@angular/core';
import type { ALEventBus } from '../event-bus';
import { EventBusFeature, Middleware } from '../event-bus.models';

/**
 * Adds your own middleware. The factory runs in the bus's injection context, so it can `inject()`.
 *
 * @example
 * ```ts
 * this.use(withMiddleware(() => {
 *   const analytics = inject(Analytics);
 *   return {
 *     handle(event, next) {
 *       next(event);
 *       analytics.track(event.key);
 *     },
 *   };
 * }));
 * ```
 */
export function withMiddleware<TEventMap extends object, THeaders extends object = Record<string, unknown>>(
  factory: (bus: ALEventBus<TEventMap, THeaders>) => Middleware<TEventMap, THeaders>,
): EventBusFeature<TEventMap, THeaders> {
  return factory as EventBusFeature<TEventMap, THeaders>;
}

/**
 * For a bus provided in a component or route: also delivers its events to the parent instance of
 * the same bus class (e.g. the root one). Events never flow from parent to child.
 */
export function withBubbling(): EventBusFeature<any, any> {
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
