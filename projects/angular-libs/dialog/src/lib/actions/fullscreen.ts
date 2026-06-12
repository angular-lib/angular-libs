import { DialogRef } from '../dialog-ref';
import { getWindowState, triggerLayoutChangeHook } from './state';
import { restore } from './restore';

/**
 * Checks if a given dialog is currently in fullscreen mode.
 *
 * @param ref Reference to the dialog to check.
 * @returns `true` if the dialog element or its content is the current fullscreen element.
 */
export function isFullscreen(ref: DialogRef<any, any>): boolean {
  const activeEl = document.fullscreenElement;
  return !!activeEl && (activeEl === ref.dialogEl || ref.dialogEl.contains(activeEl));
}

/**
 * Requests native HTML5 fullscreen mode for the dialog element.
 *
 * If the dialog is currently minimized, it is restored first.
 *
 * @param ref Reference to the dialog to display in fullscreen.
 * @returns A promise that resolves to `true` if fullscreen was requested and resolved successfully; `false` otherwise.
 */
export async function enterFullscreen(ref: DialogRef<any, any>): Promise<boolean> {
  const dialogEl = ref.dialogEl;
  if (!dialogEl?.open || isFullscreen(ref)) return false;

  const state = getWindowState(ref);
  if (state.isMinimized) restore(ref);

  // To bypass WebKit/Safari's strict restriction disallowing direct fullscreen on <dialog> elements,
  // we target the first child element (the component root node) if available, falling back to the dialog.
  const target = dialogEl.firstElementChild || dialogEl;
  if (!target.requestFullscreen) return false;

  try {
    await target.requestFullscreen();
    dialogEl.focus();
    triggerLayoutChangeHook(ref, 'resized');
    return true;
  } catch (error) {
    console.error('Failed to enter fullscreen mode:', error);
    return false;
  }
}

/**
 * Exits native fullscreen mode if the given dialog is currently fullscreen.
 *
 * @param ref Reference to the dialog to exit fullscreen.
 * @returns A promise that resolves to `true` if fullscreen was exited; `false` otherwise.
 */
export async function exitFullscreen(ref: DialogRef<any, any>): Promise<boolean> {
  if (!isFullscreen(ref) || !document.exitFullscreen) return false;

  try {
    await document.exitFullscreen();
    return true;
  } catch (error) {
    console.error('Failed to exit fullscreen mode:', error);
    return false;
  }
}

/**
 * Toggles fullscreen mode for the dialog element.
 *
 * If the dialog is currently fullscreen, this exits fullscreen; otherwise, this requests fullscreen.
 *
 * @param ref Reference to the dialog to toggle.
 * @returns A promise that resolves to `true` if toggle action succeeded; `false` otherwise.
 */
export async function toggleFullscreen(ref: DialogRef<any, any>): Promise<boolean> {
  return isFullscreen(ref) ? exitFullscreen(ref) : enterFullscreen(ref);
}
