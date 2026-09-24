import {
  ApplicationRef,
  DOCUMENT,
  EnvironmentInjector,
  ErrorHandler,
  Injectable,
  inject,
  type Injector,
  type Type,
} from '@angular/core';
import { DialogRef, ɵanimationsDone } from './dialog-ref';
import { ɵclassNames, ɵcreateContent } from './dialog.service';
import type { DialogInputs, InferDialogResult } from './types';

export type PopoverPlacement =
  | 'top'
  | 'top-start'
  | 'top-end'
  | 'bottom'
  | 'bottom-start'
  | 'bottom-end'
  | 'left'
  | 'right';

export interface PopoverOptions {
  /** Default `bottom`. Flips to the other side when there is no room. */
  placement?: PopoverPlacement;
  /** Gap to the anchor in px. Default `8`. */
  offset?: number;
  panelClass?: string;
  ariaLabel?: string;
  /** Default `dialog`. Use e.g. `menu` / `listbox` when the content implements that pattern. */
  role?: string;
  injector?: Injector;
}

let nextAnchor = 0;

/**
 * Anchored, light-dismiss surfaces on the native Popover API, positioned with CSS anchor
 * positioning. Outside click and Escape close natively (guards do not apply to that);
 * nested popovers stay open.
 *
 * @example
 * ```ts
 * const ref = popover.open(event.currentTarget, MenuComponent, { items });
 * const { ok, value } = await ref.closed;
 * ```
 */
@Injectable({ providedIn: 'root' })
export class PopoverService {
  private readonly appRef = inject(ApplicationRef);
  private readonly environment = inject(EnvironmentInjector);
  private readonly document = inject(DOCUMENT);
  private readonly errorHandler = inject(ErrorHandler);

  open<C>(
    anchor: Element,
    component: Type<C>,
    inputs?: DialogInputs<C>,
    options: PopoverOptions = {},
  ): DialogRef<InferDialogResult<C>, C> {
    const doc = this.document;
    const element = doc.createElement('div');
    element.popover = 'auto';
    element.className = ɵclassNames('al-popover', options.panelClass);
    element.dataset['placement'] = options.placement ?? 'bottom';
    element.style.setProperty('--al-popover-offset', `${options.offset ?? 8}px`);
    element.setAttribute('role', options.role ?? 'dialog');
    if (options.ariaLabel) element.setAttribute('aria-label', options.ariaLabel);
    const releaseAnchor = linkAnchor(anchor as HTMLElement, element);

    const ref = new DialogRef<InferDialogResult<C>, C>({
      element,
      hide: () => element.hidePopover(),
      reportError: (error) => this.errorHandler.handleError(error),
    });
    const content = ɵcreateContent(this.environment, component, inputs, ref, options.injector);
    element.append(content.location.nativeElement);
    // Inside the anchor's popover or dialog: keeps popover nesting, and a modal would make it inert.
    (anchor.closest('[popover], dialog[open]') ?? doc.body).append(element);
    this.appRef.attachView(content.hostView);
    content.changeDetectorRef.detectChanges();

    // Native light dismiss does not say why; remember whether Escape or a pointer came last.
    let lastInput = '';
    let focusWasInside = false;
    const onInput = (e: Event) => (lastInput = e instanceof KeyboardEvent ? e.key : e.type);
    doc.addEventListener('keydown', onInput, true);
    doc.addEventListener('pointerdown', onInput, true);
    element.addEventListener('beforetoggle', (e) => {
      if (e.newState === 'closed') focusWasInside = element.contains(doc.activeElement);
    });
    element.addEventListener('toggle', async (e) => {
      if (e.newState !== 'closed') return;
      doc.removeEventListener('keydown', onInput, true);
      doc.removeEventListener('pointerdown', onInput, true);
      if (focusWasInside && (anchor as HTMLElement).isConnected) (anchor as HTMLElement).focus();
      await ɵanimationsDone(element);
      releaseAnchor();
      content.destroy();
      element.remove();
      ref.ɵfinish(lastInput === 'Escape' ? 'escape' : 'outside');
    });

    element.showPopover();
    if (!globalThis.CSS?.supports('position-anchor: --a')) placeFallback(anchor, element, options.offset ?? 8);
    return ref;
  }
}

/** Makes `anchor` the popover's CSS anchor, reusing an existing `anchor-name`. */
function linkAnchor(anchor: HTMLElement, popover: HTMLElement): () => void {
  const existing = getComputedStyle(anchor).getPropertyValue('anchor-name').trim();
  const own = !existing || existing === 'none';
  const name = own ? `--al-anchor-${++nextAnchor}` : existing.split(',')[0].trim();
  if (own) anchor.style.setProperty('anchor-name', name);
  popover.style.setProperty('position-anchor', name);
  return () => {
    if (own) anchor.style.removeProperty('anchor-name');
  };
}

/** Browsers without anchor positioning: below the anchor, kept inside the viewport. */
function placeFallback(anchor: Element, popover: HTMLElement, offset: number): void {
  const a = anchor.getBoundingClientRect();
  const p = popover.getBoundingClientRect();
  const left = Math.min(Math.max(8, a.left), innerWidth - p.width - 8);
  const below = a.bottom + offset;
  const top = below + p.height > innerHeight ? a.top - offset - p.height : below;
  Object.assign(popover.style, { position: 'fixed', margin: '0', inset: `${top}px auto auto ${left}px` });
}
