import { Directive, ElementRef, effect, inject, input, output } from '@angular/core';
import { ALShortcutService } from './shortcut.service';

/**
 * A highly declarative shortcut directive matching inputs, outputs, and cleanup.
 */
@Directive({
  selector: '[alShortcut]',
  standalone: true,
})
export class ALShortcutDirective {
  private readonly elementRef = inject(ElementRef);
  private readonly shortcutService = inject(ALShortcutService);

  // Modern input/output signals matches selector exactly without needing aliases
  readonly alShortcut = input.required<string>();
  readonly alShortcutPriority = input<number>(0);
  readonly alShortcutDescription = input<string>('Template directive custom trigger action.');
  readonly alShortcutPreventDefault = input<boolean>(true);
  readonly alShortcutAllowRepeat = input<boolean>(false);
  readonly alShortcutGlobal = input<boolean>(false);
  readonly alShortcutTriggered = output<KeyboardEvent>();

  constructor() {
    // Automatically re-register whenever inputs reactively change, and auto-cleanup!
    effect((onCleanup) => {
      const currentShortcut = this.alShortcut();
      if (currentShortcut) {
        const unsubscribe = this.shortcutService.register({
          shortcut: currentShortcut,
          action: (event) => {
            this.alShortcutTriggered.emit(event);
          },
          element: this.alShortcutGlobal() ? undefined : this.elementRef.nativeElement, // Keep reference to focus element to support scoped element checks!
          priority: this.alShortcutPriority(),
          preventDefault: this.alShortcutPreventDefault(),
          description: this.alShortcutDescription(),
          allowRepeat: this.alShortcutAllowRepeat(),
        });
        onCleanup(() => unsubscribe());
      }
    });
  }
}
