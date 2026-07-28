import type {
  DataGridPlugin,
  DataGridPluginContext,
  FindFeatureConfig,
} from '@angular-libs/data-grid';

export type FindPluginOptions = FindFeatureConfig;

/**
 * Enables Find chrome + owns keyboard shortcuts via interaction capability.
 */
export function findPlugin<T = unknown>(options: FindPluginOptions = {}): DataGridPlugin<T> {
  return {
    id: 'find',
    setup(context: DataGridPluginContext<T>): () => void {
      const cleanFlag = context.slots.enableFind(options);
      const cleanInteraction = context.capabilities.registerInteraction({
        id: 'find-keys',
        setup: (element) => {
          const onKeydown = (event: KeyboardEvent): void => {
            const meta = event.ctrlKey || event.metaKey;
            if (meta && event.key.toLowerCase() === 'f') {
              event.preventDefault();
              context.api.focusFindInput();
              return;
            }
            if (event.key === 'F3' || (meta && event.key.toLowerCase() === 'g')) {
              event.preventDefault();
              if (event.shiftKey) {
                context.api.findPrev();
              } else {
                context.api.findNext();
              }
            }
          };
          element.addEventListener('keydown', onKeydown);
          return () => element.removeEventListener('keydown', onKeydown);
        },
      });
      return () => {
        cleanInteraction();
        cleanFlag();
      };
    },
  };
}
