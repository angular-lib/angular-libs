import { EventBusFeature, EventKey } from '../event-bus.models';

/**
 * Holds back the given events until none has been emitted for `ms` milliseconds, then delivers the
 * latest one. Each key is debounced separately. Pending events are dropped when the bus is destroyed.
 *
 * @example
 * ```ts
 * this.use(withDebounce(['search:typed', 'window:resized'], 300));
 * ```
 */
export function withDebounce<TEventMap extends object>(
  keys: EventKey<TEventMap> | readonly EventKey<TEventMap>[],
  ms: number,
): EventBusFeature<TEventMap, any> {
  const debounced = new Set<string>(Array.isArray(keys) ? keys : [keys as string]);
  return () => {
    const timers = new Map<string, ReturnType<typeof setTimeout>>();
    return {
      handle(event, next) {
        if (!debounced.has(event.key)) return next(event);
        clearTimeout(timers.get(event.key));
        timers.set(
          event.key,
          setTimeout(() => {
            timers.delete(event.key);
            next(event);
          }, ms),
        );
      },
      destroy() {
        timers.forEach(clearTimeout);
        timers.clear();
      },
    };
  };
}
