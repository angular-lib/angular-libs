import type { CsvExportOptions } from '@angular-libs/data-grid';
import type { DataGridPlugin, DataGridPluginContext } from '@angular-libs/data-grid/plugin';

/**
 * Toolbar chrome + any {@link CsvExportOptions} (`filename`, `columnKeys`,
 * `onlySelected`, `columnSeparator`, `processCell`, …) passed to every export.
 */
export interface CsvExportPluginOptions<T = unknown> extends CsvExportOptions<T> {
  /** Toolbar sort order. Default 90. */
  order?: number;
  /** Button icon. Default `CSV`. */
  icon?: string;
  /** Accent color. */
  color?: string;
}

/**
 * Opt-in toolbar action that exports processed rows as CSV via {@link DataGridApi.exportCsv}.
 *
 * @example
 * ```ts
 * plugins: [...defaultGridPlugins(), csvExportPlugin({ filename: 'people.csv' })]
 * ```
 */
export function csvExportPlugin<T = any>(
  options: CsvExportPluginOptions<T> = {},
): DataGridPlugin<T> {
  const { order = 90, icon = 'CSV', color, ...exportOptions } = options;

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
        actionClick: async () => {
          context.api.exportCsv({ filename: 'data-grid.csv', ...exportOptions });
        },
      });
    },
  };
}
