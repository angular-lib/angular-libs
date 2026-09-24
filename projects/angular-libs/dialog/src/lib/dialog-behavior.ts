import type { AutoFocusTarget } from './dialog.types';

export const DIALOG_FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export function queryFocusable(root: ParentNode): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(DIALOG_FOCUSABLE_SELECTOR)).filter(
    (node) => !node.hasAttribute('disabled') && node.tabIndex !== -1,
  );
}

export function applyAutoFocus(
  dialogEl: HTMLDialogElement,
  target: AutoFocusTarget | undefined,
): void {
  if (target === false) return;

  if (target === 'dialog' || target === undefined) {
    dialogEl.focus();
    return;
  }

  if (typeof target === 'string' && target !== 'first-tabbable') {
    const el = dialogEl.querySelector(target) as HTMLElement | null;
    el?.focus();
    return;
  }

  if (target instanceof HTMLElement) {
    target.focus();
    return;
  }

  const first = queryFocusable(dialogEl)[0];
  (first ?? dialogEl).focus();
}

export function isClickInsideDialog(el: HTMLElement, event: MouseEvent): boolean {
  const rect = el.getBoundingClientRect();
  return (
    rect.top <= event.clientY &&
    event.clientY <= rect.bottom &&
    rect.left <= event.clientX &&
    event.clientX <= rect.right
  );
}

let scrollLockCount = 0;
let previousBodyOverflow = '';
let previousBodyPaddingRight = '';

/**
 * Locks page scroll for modal dialogs. Pads `<body>` by the scrollbar width it hides
 * so the page does not shift sideways when the dialog opens.
 */
export function lockBodyScroll(): void {
  if (typeof document === 'undefined') return;
  if (scrollLockCount === 0) {
    const body = document.body;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    previousBodyOverflow = body.style.overflow;
    previousBodyPaddingRight = body.style.paddingRight;
    if (scrollbarWidth > 0) {
      const current = parseFloat(getComputedStyle(body).paddingRight) || 0;
      body.style.paddingRight = `${current + scrollbarWidth}px`;
    }
    body.style.overflow = 'hidden';
  }
  scrollLockCount += 1;
}

export function unlockBodyScroll(): void {
  if (typeof document === 'undefined') return;
  scrollLockCount = Math.max(0, scrollLockCount - 1);
  if (scrollLockCount === 0) {
    document.body.style.overflow = previousBodyOverflow;
    document.body.style.paddingRight = previousBodyPaddingRight;
  }
}
