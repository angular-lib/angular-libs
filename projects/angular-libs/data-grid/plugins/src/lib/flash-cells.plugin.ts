import { signal } from '@angular/core';
import type {
  DataGridPlugin,
  DataGridPluginContext,
} from '@angular-libs/data-grid/plugin';
import {
  flashKey,
  type FlashCellRef,
  type FlashCellsParams,
  type FlashCellsPluginOptions,
} from './flash-cells.types';

export type {
  FlashCellRef,
  FlashCellsParams,
  FlashCellsPluginOptions,
} from './flash-cells.types';
export { flashKey } from './flash-cells.types';

const DEFAULT_COLOR = '#ffeb3b';
const DEFAULT_DURATION = 1000;

interface FlashEntry {
  color: string;
  duration: number;
  token: number;
}

/** Held adapter — flash cells without remounting plugins. */
export interface FlashCellsAdapter {
  flashCells(params: FlashCellsParams): void;
  /** Cancel all active flashes. */
  clearFlash(): void;
}

export type FlashCellsPlugin<T = unknown> = DataGridPlugin<T> & FlashCellsAdapter;

/**
 * Opt-in cell flash highlight. Hold the return value and call `flashCells`.
 *
 * Requires a stable `rowId`. Not included in `defaultGridPlugins()`.
 *
 * @example
 * ```ts
 * const flash = flashCellsPlugin();
 * plugins = [...defaultGridPlugins(), flash];
 *
 * flash.flashCells({
 *   cells: [{ rowId: 1, columnId: 'price' }],
 *   color: '#ffe082',
 * });
 *
 * flash.flashCells({
 *   rowIds: [1, 2],
 *   columnIds: ['price', 'qty'],
 *   color: '#81c784',
 * });
 * ```
 */
export function flashCellsPlugin<T = unknown>(
  options: FlashCellsPluginOptions = {},
): FlashCellsPlugin<T> {
  const defaultColor = options.color ?? DEFAULT_COLOR;
  const defaultDuration = options.duration ?? DEFAULT_DURATION;

  const flashes = signal<ReadonlyMap<string, FlashEntry>>(new Map());
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  let tokenCounter = 0;
  let liveContext: DataGridPluginContext<T> | null = null;

  const clearTimers = (): void => {
    for (const timer of timers.values()) {
      clearTimeout(timer);
    }
    timers.clear();
  };

  const clearFlash = (): void => {
    clearTimers();
    flashes.set(new Map());
  };

  const scheduleClear = (key: string, token: number, duration: number): void => {
    const existing = timers.get(key);
    if (existing) {
      clearTimeout(existing);
    }
    timers.set(
      key,
      setTimeout(() => {
        timers.delete(key);
        const map = new Map(flashes());
        const entry = map.get(key);
        if (entry?.token === token) {
          map.delete(key);
          flashes.set(map);
        }
      }, duration),
    );
  };

  const applyFlash = (
    targets: FlashCellRef[],
    color: string,
    duration: number,
  ): void => {
    const next = new Map(flashes());
    const token = ++tokenCounter;
    for (const cell of targets) {
      const key = flashKey(cell.rowId, cell.columnId);
      next.set(key, { color, duration, token });
      scheduleClear(key, token, duration);
    }
    flashes.set(next);
  };

  const resolveTargets = (params: FlashCellsParams): FlashCellRef[] => {
    if (params.cells?.length) {
      return params.cells;
    }
    const rowIds = params.rowIds;
    if (!rowIds?.length) {
      return [];
    }
    const columnIds =
      params.columnIds?.length
        ? params.columnIds
        : (liveContext?.api.getVisibleColumnIds() ?? []);
    if (!columnIds.length) {
      return [];
    }
    const out: FlashCellRef[] = [];
    for (const rowId of rowIds) {
      for (const columnId of columnIds) {
        out.push({ rowId, columnId });
      }
    }
    return out;
  };

  const flashCells = (params: FlashCellsParams): void => {
    const targets = resolveTargets(params);
    if (!targets.length) {
      return;
    }
    const color = params.color ?? defaultColor;
    const duration = params.duration ?? defaultDuration;

    // Toggle class off first so CSS animation restarts on re-flash.
    const current = new Map(flashes());
    let needRestart = false;
    for (const cell of targets) {
      const key = flashKey(cell.rowId, cell.columnId);
      if (current.has(key)) {
        const timer = timers.get(key);
        if (timer) {
          clearTimeout(timer);
          timers.delete(key);
        }
        current.delete(key);
        needRestart = true;
      }
    }
    if (needRestart) {
      flashes.set(current);
      queueMicrotask(() => applyFlash(targets, color, duration));
      return;
    }
    applyFlash(targets, color, duration);
  };

  const adapter: FlashCellsAdapter = {
    flashCells,
    clearFlash,
  };

  const plugin: FlashCellsPlugin<T> = {
    id: 'flashCells',
    flashCells: (params) => adapter.flashCells(params),
    clearFlash: () => adapter.clearFlash(),

    setup(context: DataGridPluginContext<T>): () => void {
      liveContext = context;

      const cleanDecorator = context.capabilities.registerCellDecorator({
        id: 'flash-cells',
        className: ({ rowId, columnId }) => {
          flashes();
          return flashes().has(flashKey(rowId, columnId)) ? 'al-dg-cell--flash' : null;
        },
        style: ({ rowId, columnId }) => {
          flashes();
          const entry = flashes().get(flashKey(rowId, columnId));
          if (!entry) {
            return null;
          }
          return {
            '--al-dg-flash-color': entry.color,
            '--al-dg-flash-duration': `${entry.duration}ms`,
          };
        },
      });

      return () => {
        cleanDecorator();
        clearFlash();
        liveContext = null;
      };
    },
  };

  return plugin;
}
