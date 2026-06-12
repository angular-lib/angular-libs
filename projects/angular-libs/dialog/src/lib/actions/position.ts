import { DialogRef } from '../dialog-ref';
import { getWindowState, triggerLayoutChangeHook } from './state';

/**
 * Retrieves the current layout position coordinates (X and Y offsets) of a dialog.
 *
 * @param ref Reference to the dialog to inspect.
 * @returns An object containing the current `x` and `y` translation coordinates in pixels.
 */
export function getPosition(ref: DialogRef<any, any>): { x: number; y: number } {
  return getWindowState(ref).position;
}

/**
 * Retrieves the current width and height dimensions of a dialog.
 *
 * @param ref Reference to the dialog to inspect.
 * @returns An object containing the current `width` and `height` CSS style values.
 */
export function getSize(ref: DialogRef<any, any>): { width: string; height: string } {
  return getWindowState(ref).size;
}

/**
 * Repositions and optionally resizes a given dialog window using CSS translate3d transforms.
 *
 * This function preserves custom layout states, registers coordinates in the internally tracked window state,
 * and triggers plugin `onLayoutChange` hooks (with `'resized'` if sizing is adjusted, otherwise `'dragged'`).
 *
 * @param ref Reference to the dialog to update.
 * @param x The horizontal translation offset in pixels.
 * @param y The vertical translation offset in pixels.
 * @param width Optional new width to apply to the dialog (either as CSS string or numeric pixel value).
 * @param height Optional new height to apply to the dialog (either as CSS string or numeric pixel value).
 */
export function setPosition(
  ref: DialogRef<any, any>,
  x: number,
  y: number,
  width?: string | number,
  height?: string | number,
): void {
  const dialogEl = ref.dialogEl;
  if (!dialogEl) return;

  const state = getWindowState(ref);

  if (width !== undefined) {
    const val = typeof width === 'number' ? `${width}px` : width;
    dialogEl.style.width = val;
    state.size.width = val;
  }
  if (height !== undefined) {
    const val = typeof height === 'number' ? `${height}px` : height;
    dialogEl.style.height = val;
    state.size.height = val;
  }

  state.position.x = x;
  state.position.y = y;

  dialogEl.style.transform = `translate3d(${x}px, ${y}px, 0)`;

  // Trigger onLayoutChange plugin hook
  triggerLayoutChangeHook(ref, width !== undefined || height !== undefined ? 'resized' : 'dragged');
}
