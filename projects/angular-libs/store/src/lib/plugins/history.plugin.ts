import { computed, isDevMode, signal, Signal, untracked } from '@angular/core';
import { HistoryAdapter, HistoryAdapterOptions } from '../interfaces/history.plugin';
import { IALStore } from '../interfaces/ial-store';
import { ALStorePlugin } from '../interfaces/al-store-plugin';
import { isStoreHydrating } from '../store-hydration';

/**
 * Attempts a deep clone via `structuredClone`, falling back to the original reference if the
 * value can't be structurally cloned (e.g. it contains functions, `WeakMap`/`WeakSet`, or other
 * non-cloneable types). This trades perfect undo/redo snapshot isolation for never throwing on
 * unsupported values - the tracked value is still pushed onto the history stack, it just won't
 * be an independent copy in that edge case.
 */
function safeClone<T>(value: T): T {
  try {
    return structuredClone(value);
  } catch (e) {
    if (isDevMode()) {
      console.warn('[historyPlugin] Value could not be structurally cloned; falling back to the original reference.', e);
    }
    return value;
  }
}

/**
 * Creates a functional history plugin for tracking the undo/redo states of a specific key inside a state store.
 * Extends the store with time-travel/history debugging without adding any overhead of active change detection effects.
 *
 * @template StoreState The overall state interface of the store.
 * @template Key The specific key in the store being tracked.
 * @template T The type of the value at the specific key.
 *
 * @param key The key to track.
 * @param options Configuration options including limit.
 *
 * @example
 * ```ts
 * interface AppState { doc: string; }
 * const initialState: AppState = { doc: '' };
 *
 * @Injectable({ providedIn: 'root' })
 * export class DocumentStore extends ALStore<AppState> {
 *   // Register the history plugin directly as a class property
 *   docHistory = this.registerPlugin(historyPlugin('doc', { limit: 20 }));
 *
 *   constructor() {
 *     super(initialState);
 *   }
 *
 *   updateDoc(newContent: string) {
 *     this.set('doc', newContent); // History updates automatically!
 *   }
 * }
 * ```
 */
export function historyPlugin<
  StoreState extends Record<string, any>,
  Key extends keyof StoreState,
  T = StoreState[Key],
>(
  key: Key,
  options?: HistoryAdapterOptions,
): ALStorePlugin<StoreState> & HistoryAdapter<T> {
  const limit = options?.limit ?? 50;

  const undoStack = signal<T[]>([]);
  const redoStack = signal<T[]>([]);

  let storeRef: IALStore<StoreState>;
  let isRestoring = false;
  let previousValue: T;

  return {
    onInit(store) {
      storeRef = store;
      previousValue = safeClone(store.get(key));
    },

    onAfterUpdate(k, prevVal, newVal) {
      if (k !== key) return;

      const currentValue = newVal;

      if (isStoreHydrating(storeRef)) {
        previousValue = safeClone(currentValue);
        return;
      }

      // Determine if the store state is considered hydrated or ready
      let hydrated = true;
      if (options?.isReady) {
        hydrated = typeof options.isReady === 'function' 
          ? (options.isReady as () => boolean)() 
          : (options.isReady as Signal<boolean>)();
      }

      if (!hydrated) {
        // While hydrating, discard changes from entering history stack
        // and keep shifting the baseline value so it correctly aligns on completion
        previousValue = safeClone(currentValue);
        return;
      }

      if (!isRestoring) {
        if (JSON.stringify(previousValue) !== JSON.stringify(currentValue)) {
          const past = undoStack();
          const newPast = [...past, previousValue];

          if (newPast.length > limit) {
            newPast.shift(); // Enforce stack limit
          }

          undoStack.set(newPast);
          redoStack.set([]); // Standard behavior: any explicit new action invalidates future redo timeline
        }
      }

      isRestoring = false;
      previousValue = safeClone(currentValue);
    },

    canUndo: computed(() => undoStack().length > 0),
    canRedo: computed(() => redoStack().length > 0),

    undo() {
      if (!storeRef) return;
      untracked(() => {
        const past = undoStack();
        if (past.length === 0) return;

        const current = storeRef.get(key);
        const rStack = redoStack();

        // Push current value into the redo stack
        redoStack.set([...rStack, safeClone(current) as T]);

        // Pop the previous value from the undo stack
        const previous = past[past.length - 1];
        undoStack.set(past.slice(0, past.length - 1));

        isRestoring = true;
        storeRef.set(key, previous as any);
      });
    },

    redo() {
      if (!storeRef) return;
      untracked(() => {
        const rStack = redoStack();
        if (rStack.length === 0) return;

        const current = storeRef.get(key);
        const past = undoStack();

        // Push current value securely back into the undo stack
        undoStack.set([...past, safeClone(current) as T]);

        // Pop the next value from the redo stack
        const next = rStack[rStack.length - 1];
        redoStack.set(rStack.slice(0, rStack.length - 1));

        isRestoring = true;
        storeRef.set(key, next as any);
      });
    },

    clearHistory() {
      undoStack.set([]);
      redoStack.set([]);
    },
  };
}
