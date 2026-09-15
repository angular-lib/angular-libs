import type { DialogPlugin, DialogPluginContext, PopoverPlacement } from '../dialog.types';

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
  placement?: PopoverPlacement;
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
   * CSS color of the arrow. Defaults to `var(--al-dialog-bg)` so it matches the dialog surface / theme.
   */
  arrowColor?: string;
  /**
   * Flip to the opposite side when the preferred placement overflows the viewport.
   * Defaults to `true`. Viewport clamp / shift still runs afterward as a fallback.
   */
  flip?: boolean;
}

export interface PopoverPositionInput {
  placement: PopoverPlacement;
  anchor: Pick<DOMRect, 'left' | 'top' | 'right' | 'bottom' | 'width' | 'height'>;
  dialogWidth: number;
  dialogHeight: number;
  offset: number;
  viewportWidth: number;
  viewportHeight: number;
  /** When `false`, only clamp/shift (legacy). Defaults to `true`. */
  flip?: boolean;
  padding?: number;
}

export interface PopoverPositionResult {
  left: number;
  top: number;
  placement: PopoverPlacement;
}

const FLIP_MAP: Record<PopoverPlacement, PopoverPlacement> = {
  'bottom-left': 'top-left',
  bottom: 'top',
  'bottom-right': 'top-right',
  'top-left': 'bottom-left',
  top: 'bottom',
  'top-right': 'bottom-right',
  left: 'right',
  right: 'left',
};

function rawPosition(
  placement: PopoverPlacement,
  anchor: PopoverPositionInput['anchor'],
  dialogWidth: number,
  dialogHeight: number,
  offset: number,
): { left: number; top: number } {
  switch (placement) {
    case 'bottom-left':
      return { left: anchor.left, top: anchor.bottom + offset };
    case 'bottom':
      return {
        left: anchor.left + (anchor.width - dialogWidth) / 2,
        top: anchor.bottom + offset,
      };
    case 'bottom-right':
      return { left: anchor.right - dialogWidth, top: anchor.bottom + offset };
    case 'top-left':
      return { left: anchor.left, top: anchor.top - dialogHeight - offset };
    case 'top':
      return {
        left: anchor.left + (anchor.width - dialogWidth) / 2,
        top: anchor.top - dialogHeight - offset,
      };
    case 'top-right':
      return { left: anchor.right - dialogWidth, top: anchor.top - dialogHeight - offset };
    case 'left':
      return {
        left: anchor.left - dialogWidth - offset,
        top: anchor.top + (anchor.height - dialogHeight) / 2,
      };
    case 'right':
      return {
        left: anchor.right + offset,
        top: anchor.top + (anchor.height - dialogHeight) / 2,
      };
  }
}

function mainAxisOverflow(
  placement: PopoverPlacement,
  pos: { left: number; top: number },
  dialogWidth: number,
  dialogHeight: number,
  viewportWidth: number,
  viewportHeight: number,
): number {
  if (placement.startsWith('bottom')) {
    return Math.max(0, pos.top + dialogHeight - viewportHeight);
  }
  if (placement.startsWith('top')) {
    return Math.max(0, -pos.top);
  }
  if (placement === 'left') {
    return Math.max(0, -pos.left);
  }
  return Math.max(0, pos.left + dialogWidth - viewportWidth);
}

function shiftIntoViewport(
  pos: { left: number; top: number },
  dialogWidth: number,
  dialogHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  padding: number,
): { left: number; top: number } {
  let { left, top } = pos;
  const maxLeft = Math.max(padding, viewportWidth - dialogWidth - padding);
  const maxTop = Math.max(padding, viewportHeight - dialogHeight - padding);
  if (left < padding) left = padding;
  if (left > maxLeft) left = maxLeft;
  if (top < padding) top = padding;
  if (top > maxTop) top = maxTop;
  return { left, top };
}

/**
 * Preferred placement, optional flip on main-axis overflow, then clamp/shift
 * so the popover stays in the viewport.
 */
export function computePopoverPosition(input: PopoverPositionInput): PopoverPositionResult {
  const padding = input.padding ?? 4;
  const shouldFlip = input.flip !== false;

  const preferred = rawPosition(
    input.placement,
    input.anchor,
    input.dialogWidth,
    input.dialogHeight,
    input.offset,
  );
  const preferredOverflow = mainAxisOverflow(
    input.placement,
    preferred,
    input.dialogWidth,
    input.dialogHeight,
    input.viewportWidth,
    input.viewportHeight,
  );

  let placement = input.placement;
  let pos = preferred;

  if (shouldFlip && preferredOverflow > 0) {
    const flippedPlacement = FLIP_MAP[input.placement];
    const flipped = rawPosition(
      flippedPlacement,
      input.anchor,
      input.dialogWidth,
      input.dialogHeight,
      input.offset,
    );
    const flippedOverflow = mainAxisOverflow(
      flippedPlacement,
      flipped,
      input.dialogWidth,
      input.dialogHeight,
      input.viewportWidth,
      input.viewportHeight,
    );
    if (flippedOverflow < preferredOverflow) {
      placement = flippedPlacement;
      pos = flipped;
    }
  }

  const shifted = shiftIntoViewport(
    pos,
    input.dialogWidth,
    input.dialogHeight,
    input.viewportWidth,
    input.viewportHeight,
    padding,
  );

  return { ...shifted, placement };
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
 *   plugins: [popoverPlugin({ anchor: triggerButton, placement: 'bottom' })]
 * });
 * ```
 */
export function popoverPlugin(options: PopoverOptions): DialogPlugin {
  const placement = options.placement || 'bottom-left';
  const offset = options.offset !== undefined ? options.offset : 12;
  const showArrow = options.showArrow !== false;
  const arrowColor = options.arrowColor ?? 'var(--al-dialog-bg)';
  const flip = options.flip !== false;

  return {
    id: 'popover',
    setup(context: DialogPluginContext): () => void {
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
        arrowEl.className = 'al-dialog-popover-arrow';
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

        const result = computePopoverPosition({
          placement,
          anchor: anchorRect,
          dialogWidth,
          dialogHeight,
          offset,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          flip,
        });

        const left = result.left;
        const top = result.top;
        const effectivePlacement = result.placement;

        element.style.left = `${left}px`;
        element.style.top = `${top}px`;
        element.dataset['alPopoverPlacement'] = effectivePlacement;

        // Coordinate arrow alignment
        if (arrowEl) {
          const arrowSize = 8;
          arrowEl.style.border = 'none';
          arrowEl.style.removeProperty('top');
          arrowEl.style.removeProperty('bottom');
          arrowEl.style.removeProperty('left');
          arrowEl.style.removeProperty('right');

          if (
            effectivePlacement === 'bottom-left' ||
            effectivePlacement === 'bottom' ||
            effectivePlacement === 'bottom-right'
          ) {
            // Arrow on top pointing up
            arrowEl.style.borderLeft = `${arrowSize}px solid transparent`;
            arrowEl.style.borderRight = `${arrowSize}px solid transparent`;
            arrowEl.style.borderBottom = `${arrowSize}px solid ${arrowColor}`;
            arrowEl.style.top = `-${arrowSize - 2}px`; // Closer to the edge

            let anchorTargetX: number;
            if (effectivePlacement === 'bottom-left') {
              const targetAnchorWidth = Math.min(anchorRect.width, 48);
              anchorTargetX = anchorRect.left + targetAnchorWidth / 2;
            } else if (effectivePlacement === 'bottom-right') {
              const targetAnchorWidth = Math.min(anchorRect.width, 48);
              anchorTargetX = anchorRect.right - targetAnchorWidth / 2;
            } else {
              anchorTargetX = anchorRect.left + anchorRect.width / 2;
            }

            let arrowLeft = anchorTargetX - left - arrowSize;
            arrowLeft = Math.max(12, Math.min(arrowLeft, dialogWidth - arrowSize * 2 - 12));
            arrowEl.style.left = `${arrowLeft}px`;
          } else if (
            effectivePlacement === 'top-left' ||
            effectivePlacement === 'top' ||
            effectivePlacement === 'top-right'
          ) {
            // Arrow on bottom pointing down
            arrowEl.style.borderLeft = `${arrowSize}px solid transparent`;
            arrowEl.style.borderRight = `${arrowSize}px solid transparent`;
            arrowEl.style.borderTop = `${arrowSize}px solid ${arrowColor}`;
            arrowEl.style.bottom = `-${arrowSize - 2}px`; // Closer to the edge

            let anchorTargetX: number;
            if (effectivePlacement === 'top-left') {
              const targetAnchorWidth = Math.min(anchorRect.width, 48);
              anchorTargetX = anchorRect.left + targetAnchorWidth / 2;
            } else if (effectivePlacement === 'top-right') {
              const targetAnchorWidth = Math.min(anchorRect.width, 48);
              anchorTargetX = anchorRect.right - targetAnchorWidth / 2;
            } else {
              anchorTargetX = anchorRect.left + anchorRect.width / 2;
            }

            let arrowLeft = anchorTargetX - left - arrowSize;
            arrowLeft = Math.max(12, Math.min(arrowLeft, dialogWidth - arrowSize * 2 - 12));
            arrowEl.style.left = `${arrowLeft}px`;
          } else if (effectivePlacement === 'left') {
            // Arrow on right pointing right
            arrowEl.style.borderTop = `${arrowSize}px solid transparent`;
            arrowEl.style.borderBottom = `${arrowSize}px solid transparent`;
            arrowEl.style.borderLeft = `${arrowSize}px solid ${arrowColor}`;
            arrowEl.style.right = `-${arrowSize - 2}px`; // Closer to the edge

            const anchorTargetY = anchorRect.top + anchorRect.height / 2;
            let arrowTop = anchorTargetY - top - arrowSize;
            arrowTop = Math.max(12, Math.min(arrowTop, dialogHeight - arrowSize * 2 - 12));
            arrowEl.style.top = `${arrowTop}px`;
          } else if (effectivePlacement === 'right') {
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
