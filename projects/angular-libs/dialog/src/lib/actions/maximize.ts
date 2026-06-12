import { DialogRef } from '../dialog-ref';
import { getWindowState, triggerLayoutChangeHook } from './state';
import { restore } from './restore';

/**
 * Checks if a given dialog is currently maximized.
 *
 * @param ref Reference to the dialog to check.
 * @returns `true` if the dialog is in maximized state, `false` otherwise.
 */
export function isMaximized(ref: DialogRef<any, any>): boolean {
  return getWindowState(ref).isMaximized;
}

/**
 * Maximizes a dialog to take up the full screen/viewport.
 *
 * This applies the `.al-dialog-maximized` class to the dialog element, setting its width and height to 100vw and 100vh.
 * If the dialog was previously minimized, it is restored first.
 *
 * @param ref Reference to the dialog to maximize.
 * @returns `true` if maximization was applied successfully; `false` if the dialog was already maximized or was not open.
 */
export function maximize(ref: DialogRef<any, any>): boolean {
  const dialogEl = ref.dialogEl;
  if (!dialogEl || !dialogEl.open) {
    return false;
  }

  const state = getWindowState(ref);
  if (state.isMaximized) {
    return false;
  }

  if (state.isMinimized) {
    restore(ref);
  }

  state.lastStateRect = dialogEl.getBoundingClientRect();

  // Set window state CSS classes
  dialogEl.classList.toggle('al-dialog-maximized', true);
  dialogEl.querySelector('[data-al-dialog-content]')?.classList.toggle('al-dialog-maximized', true);

  state.isMaximized = true;
  state._onStateChange?.('maximized');

  dialogEl.focus();

  state.onMaximize?.();
  triggerLayoutChangeHook(ref, 'maximized');

  return true;
}

/**
 * Toggles the maximized state of a dialog.
 * If the dialog is currently maximized, this restores it; otherwise, this maximizes it.
 *
 * @param ref Reference to the dialog to toggle.
 * @returns `true` if the state was successfully toggled, `false` otherwise.
 */
export function toggleMaximize(ref: DialogRef<any, any>): boolean {
  const state = getWindowState(ref);
  return state.isMaximized ? restore(ref) : maximize(ref);
}
