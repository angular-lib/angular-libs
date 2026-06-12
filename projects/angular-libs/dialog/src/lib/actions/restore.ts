import { DialogRef } from '../dialog-ref';
import { getWindowState, triggerLayoutChangeHook } from './state';

/**
 * Restores a minimized or maximized dialog back to its normal floating state.
 *
 * Removes window state CSS classes, updates tracking states, and triggers layout/state change hooks.
 * Brings active user focus back to the restored dialog window.
 *
 * @param ref Reference to the dialog to restore.
 * @returns `true` if the dialog was successfully restored; `false` if the dialog is not open or was not minimized/maximized.
 */
export function restore(ref: DialogRef<any, any>): boolean {
  const dialogEl = ref.dialogEl;
  const state = getWindowState(ref);
  if (!dialogEl || (!state.isMinimized && !state.isMaximized)) {
    return false;
  }

  state.lastStateRect = dialogEl.getBoundingClientRect();

  if (state.isMinimized) {
    dialogEl.classList.toggle('al-dialog-minimized', false);
    dialogEl.querySelector('[data-al-dialog-content]')?.classList.toggle('al-dialog-minimized', false);
    dialogEl.style.removeProperty('--al-minimized-left');
    dialogEl.style.removeProperty('--al-minimized-index');
    state.isMinimized = false;
  } else if (state.isMaximized) {
    dialogEl.classList.toggle('al-dialog-maximized', false);
    dialogEl.querySelector('[data-al-dialog-content]')?.classList.toggle('al-dialog-maximized', false);
    state.isMaximized = false;
  }

  state._onStateChange?.('restored');

  dialogEl.focus();

  state.onRestore?.();
  triggerLayoutChangeHook(ref, 'normal');

  return true;
}
