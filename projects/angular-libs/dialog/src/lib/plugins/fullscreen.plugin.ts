import type { DialogPlugin, DialogPluginContext } from '../dialog.types';
import { isFullscreen, exitFullscreen, toggleFullscreen } from '../actions/fullscreen';
import { triggerLayoutChangeHook } from '../actions/state';

export interface FullscreenPluginOptions {
  /**
   * Keyboard shortcut to trigger/toggle fullscreen mode.
   * - If a string is provided:
   *   - If it matches 'Alt+Enter', it triggers on Alt + Enter (default).
   *   - Otherwise, triggers if `event.key` matches (e.g. 'F11' or 'f').
   * - If a function is provided, it receives the KeyboardEvent and should return `true` to toggle.
   * - If `false` or `null`, keyboard shortcuts are disabled.
   * Defaults to `'Alt+Enter'`.
   */
  keyboardShortcut?: string | ((event: KeyboardEvent) => boolean) | null;
}

/**
 * Plugin that enables native fullscreen controls for a dialog using the HTML5 Fullscreen API.
 *
 * Keeps fullscreen states synchronized natively and coordinates with native `fullscreenchange` events
 * (such as when the user exits fullscreen using the 'Escape' key).
 * Supports toggle shortcuts (default: Alt+Enter).
 *
 * @example
 * ```ts
 * import { fullscreenPlugin } from '@angular-libs/dialog';
 *
 * dialogService.open(MyDialog, {
 *   plugins: [fullscreenPlugin({ keyboardShortcut: 'Alt+Enter' })]
 * });
 * ```
 */
export function fullscreenPlugin(options: FullscreenPluginOptions = {}): DialogPlugin {
  const { keyboardShortcut = 'Alt+Enter' } = options;

  return {
    id: 'fullscreen',
    setup({ element, dialogRef }: DialogPluginContext<any, any>): () => void {
      const handleFullscreenChange = () => {
        if (!isFullscreen(dialogRef)) {
          triggerLayoutChangeHook(dialogRef, 'normal');
        }
      };

      const handleKeyDown = (event: KeyboardEvent) => {
        if (!keyboardShortcut) return;

        const shouldToggle = typeof keyboardShortcut === 'function'
          ? keyboardShortcut(event)
          : keyboardShortcut === 'Alt+Enter'
            ? event.altKey && event.key === 'Enter'
            : event.key === keyboardShortcut;

        if (shouldToggle) {
          event.preventDefault();
          event.stopPropagation();
          toggleFullscreen(dialogRef);
        }
      };

      // Add event listeners
      document.addEventListener('fullscreenchange', handleFullscreenChange);
      element.addEventListener('keydown', handleKeyDown);

      // Cleanup
      return () => {
        document.removeEventListener('fullscreenchange', handleFullscreenChange);
        element.removeEventListener('keydown', handleKeyDown);

        if (isFullscreen(dialogRef)) {
          exitFullscreen(dialogRef);
        }
      };
    },
  };
}
