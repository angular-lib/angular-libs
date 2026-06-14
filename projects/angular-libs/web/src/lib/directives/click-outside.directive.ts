import { Directive, ElementRef, inject, output } from '@angular/core';

/**
 * A directive that detects and emits click events occurring outside its host element.
 * 
 * This is particularly useful for UI components like dropdowns, modals, pop-overs, 
 * or tooltips that need to be dismissed when a user clicks anywhere else on the page.
 * 
 * @example
 * ```html
 * <div class="dropdown-menu" (alClickOutside)="closeDropdown()">
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
    if (!clickedInside) {
      this.clickOutside.emit(event);
    }
  }
}
