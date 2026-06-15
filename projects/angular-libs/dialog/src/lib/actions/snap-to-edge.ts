import { DialogRef } from '../dialog-ref';
import { getWindowState } from './state';
import { setPosition, getPosition } from './position';
import { restore } from './restore';

export type SnapEdge = 'left' | 'right' | 'top' | 'bottom';

/**
 * Snaps a modeless floating dialog to a specific edge of the viewport,
 * resizing it to occupy 50% of the screen dimension.
 */
export function snapToEdge(ref: DialogRef<any, any>, edge: SnapEdge): void {
  const dialogEl = ref.dialogEl;
  if (!dialogEl || !dialogEl.open) {
    return;
  }

  // Restore if minimized or maximized
  const state = getWindowState(ref);
  if (state.isMaximized || state.isMinimized) {
    restore(ref);
  }

  // Neutralize the center-alignment CSS (margin: auto; inset: 0) to prevent the centering 
  // basis from shifting when we resize the dialog. This aligns our translation coordinate space
  // 1:1 with the viewport boundary coordinates.
  dialogEl.style.margin = '0';
  dialogEl.style.inset = '0 auto auto 0';

  // Guarantee that max width & max height won't choke down the snapped layouts
  dialogEl.style.maxWidth = 'none';
  dialogEl.style.maxHeight = 'none';

  const containerWidth = window.innerWidth;
  const containerHeight = window.innerHeight;

  let x = 0;
  let y = 0;
  let width = 0;
  let height = 0;

  switch (edge) {
    case 'left':
      width = containerWidth / 2;
      height = containerHeight;
      x = 0;
      y = 0;
      break;
    case 'right':
      width = containerWidth / 2;
      height = containerHeight;
      x = containerWidth / 2;
      y = 0;
      break;
    case 'top':
      width = containerWidth;
      height = containerHeight / 2;
      x = 0;
      y = 0;
      break;
    case 'bottom':
      width = containerWidth;
      height = containerHeight / 2;
      x = 0;
      y = containerHeight / 2;
      break;
  }

  setPosition(ref, x, y, width, height);
}
