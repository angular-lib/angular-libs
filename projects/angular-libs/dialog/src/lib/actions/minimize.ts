import { DialogRef } from '../dialog-ref';
import { restore } from './restore';
import { getWindowState, triggerLayoutChangeHook } from './state';

/**
 * Checks if a given dialog is currently minimized.
 *
 * @param ref Reference to the dialog to check.
 * @returns `true` if the dialog is in minimized state, `false` otherwise.
 */
export function isMinimized(ref: DialogRef<any, any>): boolean {
  return getWindowState(ref).isMinimized;
}

/**
 * Minimizes a non-modal dialog to a taskbar/dock or a micro-preview state.
 *
 * For non-modal/modeless dialogs, this transforms the dialog into a docked taskbar item,
 * hiding the main body content and applying the `.al-dialog-minimized` class.
 * Native modal dialogs cannot be minimized using this method.
 *
 * @param ref Reference to the dialog to minimize.
 * @returns `true` if the minimization was applied successfully; `false` if the dialog was already minimized,
 * is modal, or was not open.
 */
export function minimize(ref: DialogRef<any, any>): boolean {
  const dialogEl = ref.dialogEl;
  if (!dialogEl || !dialogEl.open) {
    return false;
  }

  const state = getWindowState(ref);
  if (state.isMinimized) {
    return false;
  }

  // Native modal dialogs lock page interaction; minimization is only meaningful for non-modal dialogs.
  if (ref.options?.modal !== false) {
    return false;
  }

  state.lastStateRect = dialogEl.getBoundingClientRect();
  
  // Set window state CSS classes
  dialogEl.classList.toggle('al-dialog-minimized', true);
  dialogEl.querySelector('[data-al-dialog-content]')?.classList.toggle('al-dialog-minimized', true);

  state.isMinimized = true;
  state._onStateChange?.('minimized');

  // Focus the taskbar window or blur active selection so focus outline doesn't block window state changes
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }

  state.onMinimize?.();
  triggerLayoutChangeHook(ref, 'minimized');

  return true;
}

/**
 * Toggles the minimized state of a non-modal dialog.
 * If the dialog is currently minimized, this restores it; otherwise, this minimizes it.
 *
 * @param ref Reference to the dialog.
 * @returns `true` if the state was successfully toggled, `false` otherwise.
 */
export function toggleMinimize(ref: DialogRef<any, any>): boolean {
  const state = getWindowState(ref);
  return state.isMinimized ? restore(ref) : minimize(ref);
}
