import type { DialogPlugin, DialogPluginContext } from '../dialog.types';
import type { DialogRef } from '../dialog-ref';
import { isMinimized, isMaximized, getPosition, setPosition } from '../actions';

export interface DraggablePluginOptions {
  /** CSS selector for the drag handle element. Defaults to the whole dialog. */
  handle?: string;
  /** Prevent the dialog from being dragged outside the viewport bounds. */
  containInViewport?: boolean;
}

/**
 * Plugin that makes a dialog draggable using pointer events.
 *
 * @example
 * ```ts
 * import { draggablePlugin } from '@angular-libs/dialog';
 *
 * // Drag by the whole dialog
 * dialogService.open(MyDialog, { plugins: [draggablePlugin()] });
 *
 * // Drag by a specific handle, constrained to viewport
 * dialogService.open(MyDialog, { plugins: [draggablePlugin({ handle: '.my-header', containInViewport: true })] });
 * ```
 */
export function draggablePlugin(options: DraggablePluginOptions = {}): DialogPlugin {
  return {
    id: 'draggable',
    setup(context: DialogPluginContext<any, any>): () => void {
      const { element, dialogRef } = context;
      const { handle, containInViewport = false } = options;
      const handleSelector = handle?.trim() || null;

      let dragging: {
        pointerId: number;
        startX: number;
        startY: number;
        startTranslateX: number;
        startTranslateY: number;
        originX: number;
        originY: number;
        width: number;
        height: number;
      } | null = null;

      const isInteractiveTarget = (target: HTMLElement) => {
        return !!target.closest(
          'button, input, textarea, select, option, a, label, [contenteditable="true"], [data-al-dialog-no-drag]',
        );
      };

      const resolveHandle = (target: HTMLElement): Element | null => {
        if (!handleSelector) return element;
        try {
          const handle = target.closest(handleSelector);
          return handle && element.contains(handle) ? handle : null;
        } catch {
          // Invalid selector: fail closed and skip dragging.
          return null;
        }
      };

      const setDraggingStateClass = (isDragging: boolean) => {
        element.classList.toggle('al-dialog-dragging', isDragging);

        // Mirror state on mounted dialog content component root for easier styling.
        const contentRoot = element.querySelector('[data-al-dialog-content]');
        if (contentRoot instanceof HTMLElement) {
          contentRoot.classList.toggle('al-dialog-dragging', isDragging);
        }
      };

      const stopDrag = (pointerId?: number) => {
        if (!dragging) return;
        if (pointerId !== undefined && dragging.pointerId !== pointerId) return;

        dragging = null;
        document.body.style.userSelect = '';
        setDraggingStateClass(false);
      };

      const onPointerDown = (e: PointerEvent) => {
        if (dragging) return;
        if (e.button !== 0) return; // Left click / primary pointer only
        if (isMinimized(dialogRef) || isMaximized(dialogRef)) {
          return;
        }

        const target = e.target as HTMLElement | null;
        if (!target) return;

        const handle = resolveHandle(target);
        if (!handle) return;

        // Keep controls clickable; allow opt-out via [data-al-dialog-no-drag].
        if (isInteractiveTarget(target)) return;

        // Capture coordinates FIRST, prior to focusing
        // This measures the reference points before any native DOM transitions/reparents can execute
        const pos = getPosition(dialogRef);
        const startTranslateX = pos.x;
        const startTranslateY = pos.y;

        const rect = element.getBoundingClientRect();
        const originX = rect.left - startTranslateX;
        const originY = rect.top - startTranslateY;

        // Focus the dialog to trigger focusin listeners, which brings it to the front
        element.focus();

        dragging = {
          pointerId: e.pointerId,
          startX: e.clientX,
          startY: e.clientY,
          startTranslateX,
          startTranslateY,
          originX,
          originY,
          width: rect.width,
          height: rect.height,
        };

        setDraggingStateClass(true);
        document.body.style.userSelect = 'none';
        e.preventDefault();
      };

      const onPointerMove = (e: PointerEvent) => {
        if (!dragging || dragging.pointerId !== e.pointerId) return;

        let nextX = dragging.startTranslateX + (e.clientX - dragging.startX);
        let nextY = dragging.startTranslateY + (e.clientY - dragging.startY);

        if (containInViewport) {
          nextX = Math.max(-dragging.originX, Math.min(nextX, window.innerWidth - dragging.originX - dragging.width));
          nextY = Math.max(-dragging.originY, Math.min(nextY, window.innerHeight - dragging.originY - dragging.height));
        }

        setPosition(dialogRef, nextX, nextY);
      };

      const onPointerUp = (e: PointerEvent) => stopDrag(e.pointerId);
      const onPointerCancel = (e: PointerEvent) => stopDrag(e.pointerId);

      // The drag starts on the dialog element, but move/end are tracked on `window` so the
      // gesture keeps working (and always cleans up) even if the element is moved in the DOM
      // mid-drag (e.g. when entering/leaving fullscreen). No pointer capture is needed.
      element.addEventListener('pointerdown', onPointerDown);
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerCancel);

      element.classList.add('al-dialog-draggable');
      if (handleSelector) {
        try {
          element.querySelectorAll(handleSelector).forEach((handleEl) => {
            handleEl.classList.add('al-dialog-drag-handle');
          });
        } catch {
          // Invalid selector: ignore styling for this selector.
        }
      } else {
        element.classList.add('al-dialog-drag-handle');
      }

      // Return teardown function
      return () => {
        stopDrag();
        element.removeEventListener('pointerdown', onPointerDown);
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerCancel);
      };
    },
  };
}
