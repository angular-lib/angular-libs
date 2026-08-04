import { Directive, ElementRef, effect, inject, input, output } from '@angular/core';
import { ALShortcutService } from './shortcut.service';

/**
 * Declarative shortcut binding with signal inputs and automatic cleanup.
 */
@Directive({
  selector: '[alShortcut]',
  standalone: true,
})
export class ALShortcutDirective {
  private readonly elementRef = inject(ElementRef);
  private readonly shortcutService = inject(ALShortcutService);

  readonly alShortcut = input.required<string>();
  readonly alShortcutPriority = input<number>(0);
  readonly alShortcutDescription = input<string>('');
  readonly alShortcutPreventDefault = input<boolean>(true);
  readonly alShortcutAllowRepeat = input<boolean>(false);
  readonly alShortcutGlobal = input<boolean>(false);
  readonly alShortcutType = input<'keydown' | 'keyup'>('keydown');
  readonly alShortcutStopPropagation = input<boolean>(false);
  readonly alShortcutId = input<string | undefined>(undefined);
  readonly alShortcutGroup = input<string | undefined>(undefined);
  readonly alShortcutTriggered = output<KeyboardEvent>();

  constructor() {
    effect((onCleanup) => {
      const currentShortcut = this.alShortcut();
      if (currentShortcut) {
        const description = this.alShortcutDescription();
        const unsubscribe = this.shortcutService.register({
          shortcut: currentShortcut,
          action: (event) => {
            this.alShortcutTriggered.emit(event);
          },
          element: this.alShortcutGlobal() ? undefined : this.elementRef.nativeElement,
          priority: this.alShortcutPriority(),
          preventDefault: this.alShortcutPreventDefault(),
          stopPropagation: this.alShortcutStopPropagation(),
          description: description || undefined,
          allowRepeat: this.alShortcutAllowRepeat(),
          type: this.alShortcutType(),
          id: this.alShortcutId(),
          group: this.alShortcutGroup(),
        });
        onCleanup(() => unsubscribe());
      }
    });
  }
}
