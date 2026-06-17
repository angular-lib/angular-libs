import { ALEventBusPlugin, IALEventBus } from '../event-bus.models';

/**
 * Configuration options for the History / Undo-Redo Plugin.
 */
export interface HistoryPluginOptions {
  /** 
   * Specific event keys to track history for. If omitted, captures all events. 
   * @default undefined (track all)
   */
  keys?: string[];
  /** 
   * Maximum history limit stack size. 
   * @default 50
   */
  limit?: number;
}

/**
 * Historical event dispatch item representation.
 */
export interface HistoryItem {
  key: string;
  payload: any;
  headers?: Record<string, any>;
}

/**
 * Extended plugin interface exposing Undo/Redo historical controls.
 */
export interface ALEventBusHistoryPlugin extends ALEventBusPlugin {
  /** 
   * Restores the previous event state from the stack and shifts current value to the redo stack. 
   * @returns `true` if undo succeeded, `false` if stack was empty.
   */
  undo(): boolean;
  /** 
   * Restores the next event state from the redo stack onto our active stack. 
   * @returns `true` if redo succeeded, `false` if stack was empty.
   */
  redo(): boolean;
  /**
   * Returns whether there are items in the undo stack.
   */
  canUndo(): boolean;
  /**
   * Returns whether there are items in the redo stack.
   */
  canRedo(): boolean;
  /** Resets state values on both history queues. */
  clearHistory(): void;
  /** Read-only undo stack. */
  getUndoStack(): readonly HistoryItem[];
  /** Read-only redo stack. */
  getRedoStack(): readonly HistoryItem[];
}

/**
 * Creates an event history management plugin that implements the Command Pattern.
 * It automatically tracks sequential dispatches, maintaining an undo and redo stack of event payloads.
 * This allows simple integration of undo/redo actions for canvas tools, editors, or wizard steps.
 *
 * @param options Configurations including history depth limits and targeted event key arrays.
 *
 * @example
 * ```ts
 * import { historyPlugin } from '@angular-libs/event-bus';
 *
 * @Injectable({ providedIn: 'root' })
 * export class AppEventBus extends ALEventBus<AppEventMap> {
 *   history = this.registerPlugin(
 *     historyPlugin({ keys: ['canvas:item-moved', 'canvas:item-deleted'] })
 *   );
 * }
 * 
 * // Trigger rollback in component / action handlers:
 * // appBus.history.undo();
 * ```
 */
export function historyPlugin(options: HistoryPluginOptions = {}): ALEventBusHistoryPlugin {
  const keys = options.keys;
  const limit = options.limit ?? 50;
  let busInstance: IALEventBus<any> | null = null;

  const undoStack: HistoryItem[] = [];
  const redoStack: HistoryItem[] = [];

  // A bypass mechanism to ignore logging actions when undoing/redoing
  let isNavigatingHistory = false;
  const HISTORY_BYPASS = '__HISTORY_ROLLBACK_BYPASS__';

  return {
    onInit(bus: IALEventBus<any>) {
      busInstance = bus;
    },
    onAfterEmit(key, payload, emitOptions) {
      const keyStr = String(key);
      if (keys && !keys.includes(keyStr)) return;
      if (emitOptions?.headers?.[HISTORY_BYPASS]) return;

      // Guard history stack from capturing undo/redo events directly
      if (isNavigatingHistory) return;

      undoStack.push({ key: keyStr, payload, headers: emitOptions?.headers });
      if (undoStack.length > limit) {
        undoStack.shift();
      }
      redoStack.length = 0; // Clear redo on any new emission
    },
    undo(): boolean {
      if (undoStack.length <= 1 || !busInstance) return false;

      isNavigatingHistory = true;
      try {
        // Move current state to redo stack
        const current = undoStack.pop()!;
        redoStack.push(current);

        // Retrieve prior state and restore it
        const prior = undoStack[undoStack.length - 1];
        const nextOptions = { ...prior.headers, [HISTORY_BYPASS]: true };
        busInstance.emit(prior.key as any, prior.payload, { headers: nextOptions });
        return true;
      } finally {
        isNavigatingHistory = false;
      }
    },
    redo(): boolean {
      if (redoStack.length === 0 || !busInstance) return false;

      isNavigatingHistory = true;
      try {
        const next = redoStack.pop()!;
        undoStack.push(next);

        const nextOptions = { ...next.headers, [HISTORY_BYPASS]: true };
        busInstance.emit(next.key as any, next.payload, { headers: nextOptions });
        return true;
      } finally {
        isNavigatingHistory = false;
      }
    },
    clearHistory() {
      undoStack.length = 0;
      redoStack.length = 0;
    },
    canUndo(): boolean {
      return undoStack.length > 1;
    },
    canRedo(): boolean {
      return redoStack.length > 0;
    },
    getUndoStack(): readonly HistoryItem[] {
      return undoStack;
    },
    getRedoStack(): readonly HistoryItem[] {
      return redoStack;
    }
  };
}
