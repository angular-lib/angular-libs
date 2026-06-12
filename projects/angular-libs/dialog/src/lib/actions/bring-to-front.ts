import { DialogRef } from '../dialog-ref';

/**
 * Promotes a non-modal dialog instance to the top-most visual layer.
 *
 * Stacking is driven purely by CSS `z-index` rather than by moving the element in the DOM.
 * Non-modal `<dialog>` elements participate in normal flow, so `z-index` reliably controls their
 * order across browsers. Avoiding DOM reparenting is important: re-appending an element mid
 * interaction invalidates active pointer capture (breaking an in-progress drag) and would also
 * pull a dialog out of an ancestor fullscreen element's top layer.
 *
 * The target is simply given a `z-index` one above the highest of the other open dialogs,
 * leaving the others untouched. If it is already on top, nothing changes.
 */
export function bringToFront(ref: DialogRef<any, any>): void {
  const el = ref.dialogEl;
  if (!el || el.classList.contains('al-dialog-minimized')) return;

  const openNonModalSelector = '.al-dialog:not(.al-dialog-minimized)';
  const dialogs = Array.from(document.querySelectorAll(openNonModalSelector)) as HTMLElement[];
  if (dialogs.length <= 1) return;

  // Bump above the highest of the *other* dialogs. Excluding the target means re-raising the
  // dialog that is already on top is a no-op, so repeated clicks don't inflate z-index values.
  const maxOtherZ = Math.max(
    ...dialogs.filter((d) => d !== el).map((d) => parseInt(d.style.zIndex, 10) || 0),
  );
  if ((parseInt(el.style.zIndex, 10) || 0) <= maxOtherZ) {
    el.style.zIndex = String(maxOtherZ + 1);
  }
}

