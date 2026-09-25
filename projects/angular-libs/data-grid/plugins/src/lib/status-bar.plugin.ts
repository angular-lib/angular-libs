import type { DataGridPlugin, DataGridPluginContext } from '@angular-libs/data-grid/plugin';

export interface StatusBarPluginOptions {
  /** Show selected row count. Default true. */
  showSelected?: boolean;
  /** Show filtered/sorted data-row count. Default true. */
  showRows?: boolean;
}

/**
 * Registers status-bar slot items (selected / data-row counts).
 * Labels come from `api.getLocale()`.
 *
 * Row count uses processed (filtered/sorted) data rows — not display rows —
 * so master-detail panels and group headers are not counted as extra rows.
 */
export function statusBarPlugin<T = any>(
  options: StatusBarPluginOptions = {},
): DataGridPlugin<T> {
  const showSelected = options.showSelected !== false;
  const showRows = options.showRows !== false;

  return {
    id: 'statusBar',
    setup(context: DataGridPluginContext<T>): () => void {
      const cleanups: Array<() => void> = [];
      if (showRows) {
        cleanups.push(
          context.slots.registerStatusBar({
            id: 'rows',
            order: 10,
            text: () => {
              const locale = context.api.getLocale();
              return `${context.api.getProcessedRows().length} ${locale.statusRows}`;
            },
          }),
        );
      }
      if (showSelected) {
        cleanups.push(
          context.slots.registerStatusBar({
            id: 'selected',
            order: 20,
            text: () => {
              const n = context.api.getSelectedIds().length;
              if (!n) {
                return '';
              }
              return `${n} ${context.api.getLocale().statusSelected}`;
            },
          }),
        );
      }
      return () => {
        for (const cleanup of [...cleanups].reverse()) {
          cleanup();
        }
      };
    },
  };
}
