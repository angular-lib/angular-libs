import type { DialogPlugin, DialogPluginContext } from '../dialog.types';
import { snapToEdge, type SnapEdge } from '../actions/snap-to-edge';

/**
 * Plugin that allows snapping a dialog to the viewport boundaries.
 * Pressing Alt + Arrow key while the dialog is focused will snap
 * the dialog to the corresponding edge.
 */
export function snapToEdgePlugin(): DialogPlugin {
  return {
    id: 'snap-to-edge',
    setup(context: DialogPluginContext<any, any>): () => void {
      const { element, dialogRef } = context;

      const onKeyDown = (e: KeyboardEvent) => {
        if (!e.altKey) return;

        let edge: SnapEdge | null = null;
        if (e.key === 'ArrowLeft') {
          edge = 'left';
        } else if (e.key === 'ArrowRight') {
          edge = 'right';
        } else if (e.key === 'ArrowUp') {
          edge = 'top';
        } else if (e.key === 'ArrowDown') {
          edge = 'bottom';
        }

        if (edge) {
          e.preventDefault();
          snapToEdge(dialogRef, edge);
        }
      };

      element.addEventListener('keydown', onKeyDown);

      return () => {
        element.removeEventListener('keydown', onKeyDown);
      };
    },
  };
}
