import type { DataGridPlugin, DataGridPluginContext } from '@angular-libs/data-grid/plugin';

export interface CsvExportPluginOptions {
  /** Toolbar sort order. Default 90. */
  order?: number;
  /** Download filename. Default `data-grid.csv`. */
  filename?: string;
  /** Button icon. Default `CSV`. */
  icon?: string;
  /** Accent color. */
  color?: string;
}

/**
 * Opt-in toolbar action that exports visible rows as CSV via {@link DataGridApi.exportCsv}.
 *
 * @example
 * ```ts
 * plugins: [...defaultGridPlugins(), csvExportPlugin()]
 * ```
 */
export function csvExportPlugin<T = unknown>(
  options: CsvExportPluginOptions = {},
): DataGridPlugin<T> {
  const order = options.order ?? 90;
  const filename = options.filename ?? 'data-grid.csv';
  const icon = options.icon ?? 'CSV';
  const color = options.color;

  return {
    id: 'csvExport',
    setup(context: DataGridPluginContext<T>): () => void {
      return context.slots.registerToolbar({
        id: 'csv-export',
        order,
        icon,
        color,
        ariaLabel: context.api.getLocale().exportCsv,
        title: context.api.getLocale().exportCsv,
        actionClick: async ({ api }) => {
          api.exportCsv(filename);
        },
      });
    },
  };
}
