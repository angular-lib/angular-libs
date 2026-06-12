import type { DialogPlugin, DialogPluginContext } from '../dialog.types';
import type { DialogRef } from '../dialog-ref';
import { isMinimized, isMaximized, getPosition, getSize, setPosition, minimize, maximize } from '../actions';

export interface LayoutPersistenceOptions {
  /**
   * Unique key used to namespace this dialog's state in storage.
   * Optional if a custom 'save' hook is specified, or if dialog has a unique `id` option.
   */
  key?: string;
  /**
   * Prefix for storage keys. Defaults to 'al_'.
   */
  prefix?: string;
  /**
   * Storage mechanism to use. Defaults to window.localStorage.
   * Ignored if custom 'save' and 'restore' hooks are specified instead.
   */
  storage?: Storage;
  /**
   * Custom hook to restore a previously saved state.
   * Can return a state synchronously, or a Promise that resolves to a state.
   */
  restore?: (dialogRef: DialogRef<any, any>) => SavedDialogState | Promise<SavedDialogState | null> | null;
  /**
   * Custom hook triggered dynamically whenever position, dimensions,
   * minimized, or maximized window states are mutated.
   */
  save?: (state: SavedDialogState, dialogRef: DialogRef<any, any>) => void | Promise<void>;
}

export interface SavedDialogState {
  position: { x: number; y: number };
  size: { width: string; height: string };
  minimized: boolean;
  maximized: boolean;
}

/**
 * Plugin that remembers and restores a dialog's size, position, minimized,
 * and maximized states across sessions.
 * 
 * Supports local/session storage out-of-the-box, or plug-and-play event
 * bridges to adapt to any state solution (NGRX, Signals, dynamic API database).
 *
 * Designed elegantly on top of native layout change plugin hooks:
 * - onPositionChange
 * - onSizeChange
 * - onMinimize / onMaximize / onRestore
 *
 * @example
 * ```ts
 * import { layoutPersistencePlugin } from '@angular-libs/dialog';
 * 
 * // Using standard localStorage
 * dialogService.open(MyDialog, {
 *   plugins: [layoutPersistencePlugin({ key: 'user-profile-dialog' })]
 * });
 * 
 * // Using custom asynchronous storage/database backend
 * dialogService.open(MyDialog, {
 *   plugins: [layoutPersistencePlugin({
 *     restore: (ref) => api.fetchSavedDialogLayout(ref.options.id),
 *     save: (state, ref) => api.saveDialogLayout(ref.options.id, state)
 *   })]
 * });
 * ```
 */
export function layoutPersistencePlugin(options: LayoutPersistenceOptions): DialogPlugin {
  const {
    storage = typeof window !== 'undefined' ? window.localStorage : undefined,
    prefix = 'al_',
  } = options;

  let loadedState: SavedDialogState | null = null;

  const getStorageKey = (dialogRef: DialogRef<any, any>): string | null => {
    const key = options.key || dialogRef.options.id;
    return key ? `${prefix}${key}` : null;
  };

  const saveState = (dialogRef: DialogRef<any, any>) => {
    const state: SavedDialogState = {
      position: getPosition(dialogRef),
      size: getSize(dialogRef),
      minimized: isMinimized(dialogRef),
      maximized: isMaximized(dialogRef),
    };

    if (options.save) {
      try {
        const res = options.save(state, dialogRef);
        if (res instanceof Promise) {
          res.catch((err) => console.warn('Failed to persist state asynchronously:', err));
        }
      } catch (error) {
        console.warn('Failed to persist state via custom callback:', error);
      }
      return;
    }

    const storageKey = getStorageKey(dialogRef);
    if (!storage || !storageKey) return;
    try {
      storage.setItem(storageKey, JSON.stringify(state));
    } catch (error) {
      console.warn('Failed to persist dialog state to storage:', error);
    }
  };

  return {
    id: 'layout-persistence',
    setup(context: DialogPluginContext<any, any>): void {
      const { element, dialogRef } = context;
      const applyState = (state: SavedDialogState) => {
        setPosition(
          dialogRef,
          state.position.x,
          state.position.y,
          state.size.width || undefined,
          state.size.height || undefined,
        );
      };

      if (options.restore) {
        try {
          const res = options.restore(dialogRef);
          if (res) {
            if (res instanceof Promise) {
              res.then((state) => {
                if (state) {
                  loadedState = state;
                  applyState(state);
                  if (element.open) {
                    if (state.minimized) minimize(dialogRef);
                    else if (state.maximized) maximize(dialogRef);
                  }
                }
              }).catch((err) => console.warn('Failed to restore state asynchronously:', err));
            } else {
              loadedState = res;
              applyState(res);
              if (element.open) {
                if (res.minimized) minimize(dialogRef);
                else if (res.maximized) maximize(dialogRef);
              }
            }
          }
        } catch (error) {
          console.warn('Failed to load state via custom restore callback:', error);
        }
        return;
      }

      const storageKey = getStorageKey(dialogRef);
      if (!storage || !storageKey) return;

      // 1. Attempt to load previous state
      try {
        const raw = storage.getItem(storageKey);
        if (raw) {
          loadedState = JSON.parse(raw);
          if (loadedState) {
            // Restore position and dimensions immediately (before open/render to avoid flickering)
            applyState(loadedState);
          }
        }
      } catch (error) {
        console.warn('Failed to load dialog state from storage:', error);
      }
    },

    onOpen(context: DialogPluginContext<any, any>): void {
      if (!loadedState) return;

      // Restore minimized or maximized state after dialog is natively open
      try {
        if (loadedState.minimized) {
          minimize(context.dialogRef);
        } else if (loadedState.maximized) {
          maximize(context.dialogRef);
        }
      } catch (error) {
        console.warn('Failed to restore window state:', error);
      }
    },

    onLayoutChange(context): void {
      saveState(context.dialogRef);
    },
  };
}
