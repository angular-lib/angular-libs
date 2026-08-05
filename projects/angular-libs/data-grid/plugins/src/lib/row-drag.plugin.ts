import { signal, type Signal } from '@angular/core';
import type { DataGridPlugin, DataGridPluginContext } from '@angular-libs/data-grid';

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
 * Pass `false` or `{ enabled: false }` to start disabled.
 */
export function rowDragPlugin<T = unknown>(
  options: RowDragPluginOptions = true,
): RowDragPlugin<T> {
  const initiallyOn = typeof options === 'boolean' ? options : (options.enabled ?? true);
  const enabled = signal(initiallyOn);

  let context: DataGridPluginContext<T> | null = null;
  let clearDrag: (() => void) | null = null;

  const apply = (): void => {
    clearDrag?.();
    clearDrag = null;
    const ctx = context;
    if (!ctx || !enabled()) {
      return;
    }
    clearDrag = ctx.slots.enableRowDrag();
  };

  return {
    id: 'rowDrag',
    enabled: enabled.asReadonly(),
    setEnabled(next: boolean): void {
      if (enabled() === next) {
        return;
      }
      enabled.set(next);
      apply();
    },
    setup(ctx: DataGridPluginContext<T>): () => void {
      context = ctx;
      apply();
      return () => {
        clearDrag?.();
        clearDrag = null;
        context = null;
      };
    },
  };
}
