import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewEncapsulation,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

/**
 * Native Popover API panel with CSS anchor positioning.
 * Shared by dropdown and date/time pickers (no CDK).
 */
@Component({
  selector: 'al-popover-panel',
  encapsulation: ViewEncapsulation.None,
  template: `<ng-content />`,
  styles: `
    al-popover-panel.al-popover-panel {
      margin: 0;
      padding: var(--al-popover-panel-padding, 0);
      border: 1px solid var(--al-form-border, #c4c4c4);
      border-radius: var(--al-picker-radius, 0.25rem);
      background: var(--al-picker-surface, #fff);
      color: inherit;
      box-shadow: var(--al-picker-panel-shadow, 0 4px 16px rgba(0, 0, 0, 0.12));
      box-sizing: border-box;
      inset: unset;
      left: anchor(left);
      top: anchor(bottom);
      right: auto;
      bottom: auto;
      position-try-fallbacks: flip-block, flip-inline;
    }
    al-popover-panel.al-popover-panel.al-picker-panel {
      --al-popover-panel-padding: 1rem;
      gap: 0.5rem;
    }
    al-popover-panel.al-popover-panel:popover-open {
      display: flex;
      flex-direction: column;
    }
    @supports not (anchor-name: --x) {
      al-popover-panel.al-popover-panel {
        left: 0;
        top: 100%;
      }
    }
  `,
  host: {
    '[class]': 'hostClassList()',
    '[attr.popover]': '"auto"',
    '[style.position-anchor]': 'anchorName() || null',
    '[style.max-height.px]': 'maxHeight() ?? null',
    '(toggle)': 'onToggle($event)',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlPopoverPanel {
  private readonly el = inject(ElementRef<HTMLElement>);

  readonly anchorName = input<string | undefined>(undefined);
  /** Extra CSS classes (e.g. `al-dropdown__panel`, `al-picker-panel`). */
  readonly panelClass = input<string>('');
  readonly maxHeight = input<number | null>(null);

  readonly opened = output<void>();
  readonly closed = output<void>();
  /** Mirrors native popover `toggle` with open boolean. */
  readonly openChange = output<boolean>();

  readonly hasEverOpened = signal(false);
  private readonly openState = signal(false);

  protected readonly hostClassList = computed(() => {
    const extra = this.panelClass().trim();
    return extra ? `al-popover-panel ${extra}` : 'al-popover-panel';
  });

  isOpen(): boolean {
    return this.openState();
  }

  open(): void {
    this.hasEverOpened.set(true);
    const panel = this.el.nativeElement;
    if (!panel.matches(':popover-open')) {
      panel.showPopover();
    }
  }

  close(): void {
    const panel = this.el.nativeElement;
    if (panel.matches(':popover-open')) {
      panel.hidePopover();
    }
  }

  protected onToggle(event: ToggleEvent): void {
    const next = event.newState === 'open';
    this.openState.set(next);
    this.openChange.emit(next);
    if (next) {
      this.hasEverOpened.set(true);
      this.opened.emit();
    } else {
      this.closed.emit();
    }
  }
}
