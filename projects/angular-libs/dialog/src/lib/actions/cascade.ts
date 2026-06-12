import { DialogRef } from '../dialog-ref';
import { setPosition } from './position';
import { bringToFront } from './bring-to-front';

/**
 * Progressively offsets and cascades an array of active modeless dialog windows diagonally
 * across the user's viewport screen.
 */
export function cascade(refs: DialogRef<any, any>[], offsetPixels = 28): void {
  refs.forEach((ref, index) => {
    const shift = index * offsetPixels;
    setPosition(ref, shift, shift);
    bringToFront(ref);
  });
}
