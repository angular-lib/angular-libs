import { signal, type Signal } from '@angular/core';
import type { DataGridPlugin, DataGridPluginContext } from '@angular-libs/data-grid/plugin';

export type RowDragPluginOptions = boolean | { enabled?: boolean };

/** Held adapter — toggle the drag handle without rebuilding the plugin list. */
export interface RowDragAdapter {
  readonly enabled: Signal<boolean>;
  setEnabled(enabled: boolean): void;
}

export type RowDragPlugin<T = unknown> = DataGridPlugin<T> & RowDragAdapter;

/**
 * Adds a row-drag handle column and emits `rowReorder` when rows are dropped.
 *
 * {@link RowDragAdapter.setEnabled} toggles `enableRowDrag` — no remount / plugin list rebuild.
 * Pass `false` or `{ enabled: false }` to start disabled. One instance may serve
 * several grids: state is per grid and `setEnabled` applies to all of them.
 */
export function rowDragPlugin<T = unknown>(
  options: RowDragPluginOptions = true,
): RowDragPlugin<T> {
  const initiallyOn = typeof options === 'boolean' ? options : (options.enabled ?? true);
  const enabled = signal(initiallyOn);

  /** Per attached grid: its context + the `enableRowDrag` cleanup while on. */
  const grids = new Map<DataGridPluginContext<T>, { clearDrag: (() => void) | null }>();

  const apply = (
    ctx: DataGridPluginContext<T>,
    state: { clearDrag: (() => void) | null },
  ): void => {
    state.clearDrag?.();
    state.clearDrag = enabled() ? ctx.slots.enableRowDrag() : null;
  };

  return {
    id: 'rowDrag',
    enabled: enabled.asReadonly(),
    setEnabled(next: boolean): void {
      if (enabled() === next) {
        return;
      }
      enabled.set(next);
      for (const [ctx, state] of grids) {
        apply(ctx, state);
      }
    },
    setup(ctx: DataGridPluginContext<T>): () => void {
      const state = { clearDrag: null as (() => void) | null };
      grids.set(ctx, state);
      apply(ctx, state);
      return () => {
        state.clearDrag?.();
        state.clearDrag = null;
        grids.delete(ctx);
      };
    },
  };
}
