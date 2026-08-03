import type { DialogPlugin, DialogPluginContext } from '../dialog.types';
import type { DialogRef } from '../dialog-ref';
import { isMinimized, isMaximized, getPosition, setPosition } from '../actions';

/** Hit area (px) along edges reserved for the native CSS resize handle. */
const RESIZE_EDGE_PX = 18;

export interface DraggablePluginOptions {
  /**
   * CSS selector for the drag handle.
   * When omitted, uses `.al-dialog-header` if present, otherwise the whole dialog.
   */
  handle?: string;
  /** Prevent the dialog from being dragged outside the viewport bounds. */
  containInViewport?: boolean;
}

/**
 * Plugin that makes a dialog draggable using pointer events.
 *
 * When the dialog has CSS `resize` enabled, pointer events near the bottom/right
 * edges are left alone so the native resize handle works.
 */
export function draggablePlugin(options: DraggablePluginOptions = {}): DialogPlugin {
  return {
    id: 'draggable',
    setup(context: DialogPluginContext): () => void {
      const { element, dialogRef } = context;
      const { containInViewport = false } = options;

      const handleSelector =
        options.handle?.trim() ||
        (element.querySelector('.al-dialog-header') ? '.al-dialog-header' : null);

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

      const isOnResizeEdge = (e: PointerEvent): boolean => {
        const resize = getComputedStyle(element).resize;
        if (!resize || resize === 'none') return false;

        const rect = element.getBoundingClientRect();
        const nearRight = e.clientX >= rect.right - RESIZE_EDGE_PX;
        const nearBottom = e.clientY >= rect.bottom - RESIZE_EDGE_PX;
        const nearLeft = e.clientX <= rect.left + RESIZE_EDGE_PX;
        const nearTop = e.clientY <= rect.top + RESIZE_EDGE_PX;

        // `both` / `horizontal` / `vertical` — browsers typically expose bottom-right;
        // also allow the matching edges so drag never steals the grip.
        if (resize === 'both') return (nearRight && nearBottom) || nearRight || nearBottom;
        if (resize === 'horizontal') return nearLeft || nearRight;
        if (resize === 'vertical') return nearTop || nearBottom;
        return nearRight && nearBottom;
      };

      const resolveHandle = (target: HTMLElement): Element | null => {
        if (!handleSelector) return element;
        try {
          const handle = target.closest(handleSelector);
          return handle && element.contains(handle) ? handle : null;
        } catch {
          return null;
        }
      };

      const setDraggingStateClass = (isDragging: boolean) => {
        element.classList.toggle('al-dialog-dragging', isDragging);
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
        if (e.button !== 0) return;
        if (isMinimized(dialogRef) || isMaximized(dialogRef)) {
          return;
        }

        const target = e.target as HTMLElement | null;
        if (!target) return;

        // Let the native CSS resize handle win over drag.
        if (isOnResizeEdge(e)) return;

        const handle = resolveHandle(target);
        if (!handle) return;

        if (isInteractiveTarget(target)) return;

        const pos = getPosition(dialogRef);
        const startTranslateX = pos.x;
        const startTranslateY = pos.y;

        const rect = element.getBoundingClientRect();
        const originX = rect.left - startTranslateX;
        const originY = rect.top - startTranslateY;

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
          nextX = Math.max(
            -dragging.originX,
            Math.min(nextX, window.innerWidth - dragging.originX - dragging.width),
          );
          nextY = Math.max(
            -dragging.originY,
            Math.min(nextY, window.innerHeight - dragging.originY - dragging.height),
          );
        }

        setPosition(dialogRef, nextX, nextY);
      };

      const onPointerUp = (e: PointerEvent) => stopDrag(e.pointerId);
      const onPointerCancel = (e: PointerEvent) => stopDrag(e.pointerId);

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
