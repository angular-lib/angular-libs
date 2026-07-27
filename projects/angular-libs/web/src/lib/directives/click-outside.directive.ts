import { Directive, ElementRef, inject, input, output } from '@angular/core';

export type ClickOutsideIgnoreTarget = HTMLElement | ElementRef | string;

/**
 * A directive that detects and emits click events occurring outside its host element.
 * 
 * This is particularly useful for UI components like dropdowns, modals, pop-overs, 
 * or tooltips that need to be dismissed when a user clicks anywhere else on the page.
 * Supports ignoring specific toggle buttons/elements via `[alClickOutsideIgnore]`.
 * 
 * @example
 * ```html
 * <button #toggleBtn (click)="isOpen = !isOpen">Toggle</button>
 * <div 
 *   class="dropdown-menu" 
 *   (alClickOutside)="isOpen = false"
 *   [alClickOutsideIgnore]="[toggleBtn, '.ignore-me']"
 * >
 *   <!-- dropdown contents -->
 * </div>
 * ```
 */
@Directive({
  selector: '[alClickOutside]',
  standalone: true,
  host: {
    '(document:click)': 'onClick($event)',
  },
})
export class AlClickOutsideDirective {
  private readonly elementRef = inject(ElementRef);

  /**
   * Optional element(s), ElementRef(s), or CSS selector string(s) to ignore when checking outside clicks.
   */
  readonly alClickOutsideIgnore = input<ClickOutsideIgnoreTarget[] | ClickOutsideIgnoreTarget>();

  /**
   * Emits when a click event occurs outside the host element.
   */
  readonly clickOutside = output<MouseEvent>({ alias: 'alClickOutside' });

  /**
   * Global document click handler. Determines if the click target is outside the host element
   * and emits the event accordingly.
   * 
   * @param event The mouse click event.
   */
  protected onClick(event: MouseEvent): void {
    const targetElement = event.target as HTMLElement;
    if (!targetElement) {
      return;
    }

    const clickedInside = this.elementRef.nativeElement.contains(targetElement);
    if (!clickedInside && !this.isIgnored(targetElement)) {
      this.clickOutside.emit(event);
    }
  }

  private isIgnored(targetElement: HTMLElement): boolean {
    const ignore = this.alClickOutsideIgnore();
    if (!ignore) return false;
    const ignoreList = Array.isArray(ignore) ? ignore : [ignore];

    for (const item of ignoreList) {
      if (!item) continue;
      if (typeof item === 'string') {
        if (targetElement.closest(item)) {
          return true;
        }
      } else if (item instanceof ElementRef) {
        if (item.nativeElement && item.nativeElement.contains(targetElement)) {
          return true;
        }
      } else if (typeof item === 'object' && 'contains' in item && typeof (item as any).contains === 'function') {
        if ((item as Element).contains(targetElement)) {
          return true;
        }
      }
    }
    return false;
  }
}
