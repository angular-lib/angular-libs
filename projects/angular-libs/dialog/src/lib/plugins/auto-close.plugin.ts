import type { DialogPlugin, DialogPluginContext } from '../dialog.types';
import type { DialogRef } from '../dialog-ref';

export interface AutoCloseOptions {
  /**
   * Duration in milliseconds before closing the dialog.
   * Defaults to 5000.
   */
  duration?: number;
  /**
   * Whether to pause/reset the countdown when hovering over the dialog.
   * Defaults to true.
   */
  pauseOnHover?: boolean;
}

/**
 * Plugin that automatically closes a dialog after a specified duration.
 *
 * Perfect for toast notifications, self-dismissing alerts, or temporary prompt banners.
 * Supports pausing and resetting the countdown when the user hovers over the dialog.
 *
 * @example
 * ```ts
 * import { autoClosePlugin } from '@angular-libs/dialog';
 *
 * dialogService.open(ToastComponent, {
 *   plugins: [autoClosePlugin({ duration: 3000, pauseOnHover: true })]
 * });
 * ```
 */
export function autoClosePlugin(options: AutoCloseOptions = {}): DialogPlugin {
  const { duration = 5000, pauseOnHover = true } = options;

  return {
    id: 'auto-close',
    setup(context: DialogPluginContext<any, any>): () => void {
      const { element, dialogRef } = context;
      let timeoutId: any = null;

      const startTimer = () => {
        if (timeoutId) return;
        timeoutId = setTimeout(() => {
          dialogRef.close(undefined, 'auto-close');
        }, duration);
      };

      const stopTimer = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
      };

      startTimer();

      let onMouseEnter: (() => void) | null = null;
      let onMouseLeave: (() => void) | null = null;

      if (pauseOnHover) {
        onMouseEnter = () => {
          stopTimer();
        };
        onMouseLeave = () => {
          startTimer();
        };
        element.addEventListener('mouseenter', onMouseEnter);
        element.addEventListener('mouseleave', onMouseLeave);
      }

      return () => {
        stopTimer();
        if (onMouseEnter) {
          element.removeEventListener('mouseenter', onMouseEnter);
        }
        if (onMouseLeave) {
          element.removeEventListener('mouseleave', onMouseLeave);
        }
      };
    },
  };
}
