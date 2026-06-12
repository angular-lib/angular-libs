import type { DialogPlugin, DialogPluginContext } from '../dialog.types';
import type { DialogRef } from '../dialog-ref';
import { getWindowState } from '../actions';

export interface DockPluginOptions {
  /**
   * Optional custom target element or CSS selector where minimized dialogs should be attached.
   */
  minimizeTarget?: HTMLElement | string;
  /**
   * Whether the default dynamic taskbar should automatically hide when there is no cursor interaction.
   * If `true`, the dock collapses off-screen based on cursor motion. Defaults to `false`.
   */
  autoHide?: boolean;
}

function resolveMinimizeTarget(target?: HTMLElement | string): HTMLElement | null {
  if (!target) return null;
  if (target instanceof HTMLElement) {
    return target;
  }
  if (typeof target === 'string') {
    try {
      return document.querySelector(target) as HTMLElement | null;
    } catch {
      return null;
    }
  }
  return null;
}

function getOrCreateTaskbar(autoHide: boolean): HTMLElement {
  let taskbar = document.querySelector('.al-dialog-taskbar') as HTMLElement;
  if (!taskbar) {
    taskbar = document.createElement('div');
    taskbar.className = 'al-dialog-taskbar';
    taskbar.classList.toggle('al-autohide', autoHide);
    document.body.appendChild(taskbar);
  } else {
    // If the taskbar already exists, update its auto-hide mode
    taskbar.classList.toggle('al-autohide', autoHide);
  }
  return taskbar;
}

function cleanTaskbarIfEmpty(): void {
  const taskbar = document.querySelector('.al-dialog-taskbar');
  if (taskbar && taskbar.children.length === 0) {
    taskbar.remove();
  }
}

/**
 * Plugin that manages docking minimized dialogs inside a native-styled bottom taskbar
 * or a custom user-defined target element.
 *
 * Keeps the core DialogService clean, lightweight, and 100% safe for SSR environments.
 *
 * @example
 * ```ts
 * import { dockPlugin } from '@angular-libs/dialog';
 *
 * // Global configuration
 * dialogService.updateConfig({
 *   plugins: [dockPlugin({ autoHide: true })]
 * });
 * ```
 */
export function dockPlugin(options: DockPluginOptions = {}): DialogPlugin {
  return {
    id: 'dock',
    setup(context: DialogPluginContext<any, any>): () => void {
      const { element, dialogRef } = context;
      const windowState = getWindowState(dialogRef);
      const originalOnStateChange = windowState._onStateChange;

      windowState._onStateChange = (state: any) => {
        if (state === 'minimized') {
          const customTarget = resolveMinimizeTarget(options.minimizeTarget);
          if (customTarget) {
            customTarget.appendChild(element);
          } else {
            const defaultTaskbar = getOrCreateTaskbar(options.autoHide ?? false);
            defaultTaskbar.appendChild(element);
          }
        } else {
          // Only re-append to document.body if the dialog is NOT already in document.body
          if (element.parentElement !== document.body) {
            document.body.appendChild(element);
          }
          cleanTaskbarIfEmpty();
        }

        // Parent or subsequent chaining handlers called dynamically
        originalOnStateChange?.(state);
      };

      return () => {
        cleanTaskbarIfEmpty();
      };
    },
  };
}
