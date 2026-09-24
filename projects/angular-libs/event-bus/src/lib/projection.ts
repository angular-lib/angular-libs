import { computed, signal } from '@angular/core';
import { BusEvent, Projection, ProjectionOptions } from './event-bus.models';

type Reducer<S> = (state: S, payload: any, event: any) => S;

/** @internal Backs `ALEventBus.projection()`. */
export function createProjection<S>(
  initial: S,
  reducers: object,
  options: ProjectionOptions | undefined,
  subscribe: (key: string, listener: (event: BusEvent<any, any, string>) => void) => () => void,
): Projection<S> {
  const limit = options?.undo === true ? 50 : options?.undo ? options.undo.limit : 0;
  const state = signal(initial);
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
      state.set(after);
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
      state.set(stack[stack.length - 1]);
      past.set(stack.slice(0, -1));
      return true;
    },
    redo() {
      const stack = future();
      if (stack.length === 0) return false;
      past.update((p) => [...p, state()].slice(-limit));
      state.set(stack[stack.length - 1]);
      future.set(stack.slice(0, -1));
      return true;
    },
    clearHistory() {
      past.set([]);
      future.set([]);
    },
    reset() {
      state.set(initial);
      past.set([]);
      future.set([]);
    },
  };
}
