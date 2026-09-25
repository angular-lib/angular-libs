/**
 * Typed adapter registry — plugins publish held adapters per grid; hosts and
 * other plugins discover them by a typed key instead of core knowing each plugin.
 *
 * ```ts
 * export const ROW_GROUP_ADAPTER = adapterKey<RowGroupAdapter>('rowGroup');
 * // plugin setup
 * context.adapters.register(ROW_GROUP_ADAPTER, adapter);
 * // host
 * grid.getAdapter(ROW_GROUP_ADAPTER)?.setColumns(['role']);
 * ```
 */

import { signal, type WritableSignal } from '@angular/core';

/** Typed lookup key for {@link GridAdapterRegistry}. Create with {@link adapterKey}. */
export interface AdapterKey<A> {
  readonly id: string;
  /** Phantom — carries the adapter type; never set at runtime. */
  readonly __adapter?: A;
}

/** Create a typed adapter key (keys match by `id`). */
export function adapterKey<A>(id: string): AdapterKey<A> {
  return Object.freeze({ id }) as AdapterKey<A>;
}

/**
 * Adapters registered by the plugins of one grid. Reads are reactive (signal-backed).
 * Later registration under the same key wins; its cleanup only removes itself.
 */
export class GridAdapterRegistry {
  private readonly entries: WritableSignal<ReadonlyMap<string, unknown>> = signal(new Map());

  register<A>(key: AdapterKey<A>, adapter: A): () => void {
    this.entries.update((prev) => new Map(prev).set(key.id, adapter));
    return () =>
      this.entries.update((prev) => {
        if (prev.get(key.id) !== adapter) {
          return prev;
        }
        const next = new Map(prev);
        next.delete(key.id);
        return next;
      });
  }

  get<A>(key: AdapterKey<A>): A | null {
    return (this.entries().get(key.id) as A | undefined) ?? null;
  }

  clearAll(): void {
    this.entries.set(new Map());
  }
}
