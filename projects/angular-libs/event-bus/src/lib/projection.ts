import { computed, signal } from '@angular/core';
import { BusEvent, Projection, ProjectionOptions } from './event-bus.models';
import { StoredValue, storedValue } from './storage';

type Reducer<S> = (state: S, payload: any, event: any) => S;

/** @internal Backs `ALEventBus.projection()`. */
export function createProjection<S>(
  initial: S,
  reducers: object,
  options: ProjectionOptions | undefined,
  subscribe: (key: string, listener: (event: BusEvent<any, any, string>) => void) => () => void,
): Projection<S> {
  const limit = options?.undo === true ? 50 : options?.undo ? options.undo.limit : 0;
  const persist = options?.persist;
  const store: StoredValue<S> | null = persist
    ? typeof persist === 'string'
      ? storedValue<S>(persist)
      : storedValue<S>(persist.key, persist)
    : null;
  const saved = store?.read();
  const state = signal(saved === undefined ? initial : saved);
  const setState = (value: S) => {
    state.set(value);
    store?.write(value);
  };
  const past = signal<readonly S[]>([]);
  const future = signal<readonly S[]>([]);

  for (const [key, reduce] of Object.entries(reducers) as [string, Reducer<S> | undefined][]) {
    if (!reduce) continue;
    subscribe(key, (event) => {
      const before = state();
      const after = reduce(before, event.payload, event);
      if (Object.is(before, after)) return;
      if (limit > 0) {
        past.update((stack) => [...stack, before].slice(-limit));
        future.set([]);
      }
      setState(after);
    });
  }

  return {
    state: state.asReadonly(),
    canUndo: computed(() => past().length > 0),
    canRedo: computed(() => future().length > 0),
    undo() {
      const stack = past();
      if (stack.length === 0) return false;
      future.update((f) => [...f, state()]);
      setState(stack[stack.length - 1]);
      past.set(stack.slice(0, -1));
      return true;
    },
    redo() {
      const stack = future();
      if (stack.length === 0) return false;
      past.update((p) => [...p, state()].slice(-limit));
      setState(stack[stack.length - 1]);
      future.set(stack.slice(0, -1));
      return true;
    },
    clearHistory() {
      past.set([]);
      future.set([]);
    },
    reset() {
      state.set(initial);
      store?.remove();
      past.set([]);
      future.set([]);
    },
  };
}
