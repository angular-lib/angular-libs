import type { DataGridPlugin, DataGridPluginContext } from '@angular-libs/data-grid/plugin';

export interface AutosizePluginOptions {
  /** Toolbar sort order. Default 91. */
  order?: number;
  /** Button icon. Default `⟷`. */
  icon?: string;
  /** Accent color. */
  color?: string;
}

/**
 * Opt-in toolbar action that autosizes columns via {@link DataGridApi.autoSizeColumns}.
 *
 * @example
 * ```ts
 * plugins: [...defaultGridPlugins(), autosizePlugin()]
 * ```
 */
export function autosizePlugin<T = unknown>(
  options: AutosizePluginOptions = {},
): DataGridPlugin<T> {
  const order = options.order ?? 91;
  const icon = options.icon ?? '⟷';
  const color = options.color;

  return {
    id: 'autosize',
    setup(context: DataGridPluginContext<T>): () => void {
      return context.slots.registerToolbar({
        id: 'autosize-columns',
        order,
        icon,
        color,
        ariaLabel: context.api.getLocale().autosize,
        title: context.api.getLocale().autosize,
        actionClick: async ({ api }) => {
          api.autoSizeColumns();
        },
      });
    },
  };
}
