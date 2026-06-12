import type { DialogPlugin, DialogPluginContext } from '../dialog.types';
import type { DialogRef } from '../dialog-ref';

export interface PopoverOptions {
  /**
   * The trigger element (or selector) that the dialog will be anchored to.
   */
  anchor: HTMLElement | string;
  /**
   * Desired placement of the popover relative to the anchor.
   * Supports standard intuitive names:
   * - 'bottom-left'
   * - 'bottom'
   * - 'bottom-right'
   * - 'top-left'
   * - 'top'
   * - 'top-right'
   * - 'left'
   * - 'right'
   * Defaults to 'bottom-left'.
   */
  placement?:
    | 'bottom-left' | 'bottom' | 'bottom-right'
    | 'top-left' | 'top' | 'top-right'
    | 'left' | 'right';
  /**
   * Offset in pixels between the anchor and the popover.
   * Defaults to 12.
   */
  offset?: number;
  /**
   * Whether to display an arrow pointing to the anchor.
   * Defaults to true.
   */
  showArrow?: boolean;
  /**
   * CSS color of the arrow. Defaults to '#ffffff'.
   */
  arrowColor?: string;
}

/**
 * Plugin that positions a floating non-modal dialog next to an anchor element as a popover.
 * Perfect for contextual menus, helper cards, dropdown overlays, or profile card reveals.
 *
 * @example
 * ```ts
 * import { popoverPlugin } from '@angular-libs/dialog';
 *
 * dialogService.open(HelpTipComponent, {
 *   modal: false,
 *   plugins: [popoverPlugin({ anchor: triggerButton, placement: 'bottom-start' })]
 * });
 * ```
 */
export function popoverPlugin(options: PopoverOptions): DialogPlugin {
  const placement = options.placement || 'bottom-left';
  const offset = options.offset !== undefined ? options.offset : 12;
  const showArrow = options.showArrow !== false;
  const arrowColor = options.arrowColor || '#ffffff';

  return {
    id: 'popover',
    setup(context: DialogPluginContext<any, any>): () => void {
      const { element } = context;
      // Find the anchor element
      let anchorEl: HTMLElement | null = null;
      if (options.anchor instanceof HTMLElement) {
        anchorEl = options.anchor;
      } else if (typeof options.anchor === 'string') {
        anchorEl = document.querySelector(options.anchor) as HTMLElement | null;
      }

      if (!anchorEl) {
        console.warn('popoverPlugin: Anchor element not found.');
        return () => {};
      }

      // Create arrow element if configured
      let arrowEl: HTMLDivElement | null = null;
      if (showArrow) {
        arrowEl = document.createElement('div');
        arrowEl.style.position = 'absolute';
        arrowEl.style.width = '0';
        arrowEl.style.height = '0';
        arrowEl.style.pointerEvents = 'none';
        arrowEl.style.zIndex = '10';
        element.appendChild(arrowEl);
      }

      // Override dialog base centering styles to allow absolute positioning on viewport
      element.style.position = 'fixed';
      element.style.inset = 'auto';
      element.style.margin = '0';
      element.style.transform = 'none';

      const updatePosition = () => {
        if (!anchorEl || !element) return;

        const anchorRect = anchorEl.getBoundingClientRect();
        const dialogWidth = element.offsetWidth || 0;
        const dialogHeight = element.offsetHeight || 0;

        let left = 0;
        let top = 0;

        switch (placement) {
          case 'bottom-left':
            left = anchorRect.left;
            top = anchorRect.bottom + offset;
            break;
          case 'bottom':
            left = anchorRect.left + (anchorRect.width - dialogWidth) / 2;
            top = anchorRect.bottom + offset;
            break;
          case 'bottom-right':
            left = anchorRect.right - dialogWidth;
            top = anchorRect.bottom + offset;
            break;
          case 'top-left':
            left = anchorRect.left;
            top = anchorRect.top - dialogHeight - offset;
            break;
          case 'top':
            left = anchorRect.left + (anchorRect.width - dialogWidth) / 2;
            top = anchorRect.top - dialogHeight - offset;
            break;
          case 'top-right':
            left = anchorRect.right - dialogWidth;
            top = anchorRect.top - dialogHeight - offset;
            break;
          case 'left':
            left = anchorRect.left - dialogWidth - offset;
            top = anchorRect.top + (anchorRect.height - dialogHeight) / 2;
            break;
          case 'right':
            left = anchorRect.right + offset;
            top = anchorRect.top + (anchorRect.height - dialogHeight) / 2;
            break;
        }

        // Viewport bounding collision prevention helper
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        if (left < 0) left = 4;
        if (left + dialogWidth > viewportWidth) left = viewportWidth - dialogWidth - 4;
        if (top < 0) top = 4;
        if (top + dialogHeight > viewportHeight) top = viewportHeight - dialogHeight - 4;

        element.style.left = `${left}px`;
        element.style.top = `${top}px`;

        // Coordinate arrow alignment
        if (arrowEl) {
          const arrowSize = 8;
          arrowEl.style.border = 'none';
          arrowEl.style.removeProperty('top');
          arrowEl.style.removeProperty('bottom');
          arrowEl.style.removeProperty('left');
          arrowEl.style.removeProperty('right');

          if (placement === 'bottom-left' || placement === 'bottom' || placement === 'bottom-right') {
            // Arrow on top pointing up
            arrowEl.style.borderLeft = `${arrowSize}px solid transparent`;
            arrowEl.style.borderRight = `${arrowSize}px solid transparent`;
            arrowEl.style.borderBottom = `${arrowSize}px solid ${arrowColor}`;
            arrowEl.style.top = `-${arrowSize - 2}px`; // Closer to the edge

            let anchorTargetX: number;
            if (placement === 'bottom-left') {
              const targetAnchorWidth = Math.min(anchorRect.width, 48);
              anchorTargetX = anchorRect.left + targetAnchorWidth / 2;
            } else if (placement === 'bottom-right') {
              const targetAnchorWidth = Math.min(anchorRect.width, 48);
              anchorTargetX = anchorRect.right - targetAnchorWidth / 2;
            } else {
              anchorTargetX = anchorRect.left + anchorRect.width / 2;
            }

            let arrowLeft = anchorTargetX - left - arrowSize;
            arrowLeft = Math.max(12, Math.min(arrowLeft, dialogWidth - arrowSize * 2 - 12));
            arrowEl.style.left = `${arrowLeft}px`;
          } else if (placement === 'top-left' || placement === 'top' || placement === 'top-right') {
            // Arrow on bottom pointing down
            arrowEl.style.borderLeft = `${arrowSize}px solid transparent`;
            arrowEl.style.borderRight = `${arrowSize}px solid transparent`;
            arrowEl.style.borderTop = `${arrowSize}px solid ${arrowColor}`;
            arrowEl.style.bottom = `-${arrowSize - 2}px`; // Closer to the edge

            let anchorTargetX: number;
            if (placement === 'top-left') {
              const targetAnchorWidth = Math.min(anchorRect.width, 48);
              anchorTargetX = anchorRect.left + targetAnchorWidth / 2;
            } else if (placement === 'top-right') {
              const targetAnchorWidth = Math.min(anchorRect.width, 48);
              anchorTargetX = anchorRect.right - targetAnchorWidth / 2;
            } else {
              anchorTargetX = anchorRect.left + anchorRect.width / 2;
            }

            let arrowLeft = anchorTargetX - left - arrowSize;
            arrowLeft = Math.max(12, Math.min(arrowLeft, dialogWidth - arrowSize * 2 - 12));
            arrowEl.style.left = `${arrowLeft}px`;
          } else if (placement === 'left') {
            // Arrow on right pointing right
            arrowEl.style.borderTop = `${arrowSize}px solid transparent`;
            arrowEl.style.borderBottom = `${arrowSize}px solid transparent`;
            arrowEl.style.borderLeft = `${arrowSize}px solid ${arrowColor}`;
            arrowEl.style.right = `-${arrowSize - 2}px`; // Closer to the edge

            const anchorTargetY = anchorRect.top + anchorRect.height / 2;
            let arrowTop = anchorTargetY - top - arrowSize;
            arrowTop = Math.max(12, Math.min(arrowTop, dialogHeight - arrowSize * 2 - 12));
            arrowEl.style.top = `${arrowTop}px`;
          } else if (placement === 'right') {
            // Arrow on left pointing left
            arrowEl.style.borderTop = `${arrowSize}px solid transparent`;
            arrowEl.style.borderBottom = `${arrowSize}px solid transparent`;
            arrowEl.style.borderRight = `${arrowSize}px solid ${arrowColor}`;
            arrowEl.style.left = `-${arrowSize - 2}px`; // Closer to the edge

            const anchorTargetY = anchorRect.top + anchorRect.height / 2;
            let arrowTop = anchorTargetY - top - arrowSize;
            arrowTop = Math.max(12, Math.min(arrowTop, dialogHeight - arrowSize * 2 - 12));
            arrowEl.style.top = `${arrowTop}px`;
          }
        }
      };

      // Set initial layout safely on frame tick
      const frameId = requestAnimationFrame(() => {
        updatePosition();
      });

      // Recalculate on screen updates to keep context anchored
      window.addEventListener('resize', updatePosition, { passive: true });
      window.addEventListener('scroll', updatePosition, { capture: true, passive: true });

      return () => {
        cancelAnimationFrame(frameId);
        window.removeEventListener('resize', updatePosition);
        window.removeEventListener('scroll', updatePosition, { capture: true });
      };
    },
  };
}
