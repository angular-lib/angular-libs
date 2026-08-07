/**
 * Demo-only “third-party style” plugin — lives outside `@angular-libs/data-grid`.
 * Shows chrome + capability registration without editing the grid host.
 */

import type { DataGridPlugin, DataGridPluginContext } from '@angular-libs/data-grid/plugin';

/**
 * Adds a status-bar line and an Alt+S shortcut to focus the find input.
 */
export function sampleStatusPlugin<T = unknown>(): DataGridPlugin<T> {
  return {
    id: 'demo-sample-status',
    setup(context: DataGridPluginContext<T>): () => void {
      const cleanStatus = context.slots.registerStatusBar({
        id: 'demo-sample-status',
        order: 90,
        text: () => `Plugin sample · ${context.api.getDisplayedRowCount()} rows`,
      });

      const cleanInteraction = context.capabilities.registerInteraction({
        id: 'demo-sample-hint',
        setup: (element) => {
          const onKey = (event: KeyboardEvent): void => {
            if (event.altKey && event.key.toLowerCase() === 's') {
              event.preventDefault();
              context.api.focusFindInput();
            }
          };
          element.addEventListener('keydown', onKey);
          return () => element.removeEventListener('keydown', onKey);
        },
      });

      return () => {
        cleanInteraction();
        cleanStatus();
      };
    },
  };
}
