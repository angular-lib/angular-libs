import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewEncapsulation,
  computed,
  input,
  model,
  output,
  viewChild,
} from '@angular/core';
import { AlPopoverPanel } from '../popover/al-popover-panel';

export type AlPickerInputType = 'date' | 'time' | 'datetime-local';

/**
 * Form-agnostic date/time control: native input + trail + popover panel.
 * Bind `value` with `model()`; emit `touch` on blur. Used by picker controls.
 */
@Component({
  selector: 'al-picker-shell',
  imports: [AlPopoverPanel],
  encapsulation: ViewEncapsulation.None,
  template: `
    <div class="al-picker-shell__control">
      <input
        #inputRef
        class="al-picker-input"
        [type]="inputType()"
        [id]="id() || null"
        [value]="value()"
        [attr.min]="min() ?? null"
        [attr.max]="max() ?? null"
        [attr.step]="step() ?? null"
        [attr.placeholder]="placeholder() ?? null"
        [attr.aria-invalid]="invalid() || null"
        [attr.aria-describedby]="describedBy() || null"
        [disabled]="disabled()"
        [readOnly]="readonly()"
        (input)="onNativeInput($event)"
        (blur)="onBlur()"
        (keydown)="onInputKeydown($event)" />
      <button
        type="button"
        class="al-picker-shell__trail al-trail-btn"
        [attr.aria-label]="trailLabel()"
        [disabled]="disabled() || readonly()"
        (click)="open($event)">
        <ng-content select="[alPickerTrail]" />
      </button>
    </div>

    <al-popover-panel
      #panelRef
      panelClass="al-picker-panel"
      [anchorName]="anchorName()"
      (opened)="onPanelOpened()"
      (closed)="onPanelClosed()"
      (keydown)="onPanelKeydown($event)">
      <ng-content />
    </al-popover-panel>
  `,
  styles: `
    al-picker-shell {
      display: block;
      width: 100%;
      position: relative;
    }
    al-picker-shell .al-picker-shell__control {
      display: flex;
      align-items: center;
      width: 100%;
      min-width: 0;
      gap: 0.15rem;
    }
    al-picker-shell .al-picker-shell__control > input.al-picker-input {
      flex: 1 1 auto;
      width: 100%;
      min-width: 0;
      box-sizing: border-box;
      border: 0;
      outline: none;
      background: transparent;
      font: inherit;
      padding: 0.25rem 0.2rem;
      color-scheme: inherit;
    }
    al-picker-shell input.al-picker-input::-webkit-calendar-picker-indicator {
      display: none;
    }
    al-picker-shell .al-picker-shell__trail {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 auto;
      border: 0;
      background: transparent;
      cursor: pointer;
      padding: 0.25rem 0.35rem;
      color: inherit;
      opacity: 0.75;
    }
    al-picker-shell .al-picker-shell__trail:disabled {
      cursor: not-allowed;
      opacity: 0.4;
    }
    .al-picker-actions {
      display: flex;
      gap: 0.35rem;
      justify-content: flex-end;
    }
    .al-picker-actions button {
      border: 1px solid var(--al-form-border, #c4c4c4);
      background: var(--al-picker-surface, #fff);
      border-radius: var(--al-picker-radius, 0.25rem);
      padding: 0.3rem 0.6rem;
      font: inherit;
      cursor: pointer;
      color: inherit;
    }
    .al-picker-actions button:hover {
      background: var(--al-picker-hover-bg, rgba(0, 0, 0, 0.06));
    }
    .al-picker-time {
      display: flex;
      gap: 0.25rem;
      height: 12rem;
    }
    .al-picker-time al-item-list {
      flex: 1 1 0;
      min-width: 3rem;
      min-height: 0;
      border: 1px solid var(--al-form-border, #c4c4c4);
      border-radius: var(--al-picker-radius, 0.25rem);
    }
    /* Calendar defines row height; time columns stretch + scroll inside it. */
    .al-picker-datetime {
      display: grid;
      grid-template-columns: max-content auto;
      align-items: stretch;
      gap: 0.75rem;
    }
    .al-picker-datetime .al-picker-time {
      /* height:0 so list content does not expand the grid row; min-height fills calendar. */
      height: 0;
      min-height: 100%;
      align-self: stretch;
      overflow: hidden;
    }
    .al-picker-datetime .al-picker-time al-item-list {
      height: 100%;
      min-height: 0;
      overflow-y: auto;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlPickerShell {
  /** String value (`yyyy-MM-dd` / `HH:mm` / `yyyy-MM-ddTHH:mm`). Empty `''`. */
  readonly value = model<string>('');
  readonly touch = output<void>();

  readonly inputType = input.required<AlPickerInputType>();
  readonly anchorName = input<string | undefined>(undefined);
  readonly min = input<string | undefined>(undefined);
  readonly max = input<string | undefined>(undefined);
  /** Native step (seconds for time/datetime-local). */
  readonly step = input<number | string | undefined>(undefined);
  readonly disabled = input(false);
  readonly readonly = input(false);
  readonly id = input<string>('');
  readonly placeholder = input<string | undefined>(undefined);
  readonly invalid = input(false);
  readonly describedBy = input<string>('');
  readonly trailLabel = input('Open picker');
  /** Close panel on Enter (time/datetime). Default false for date. */
  readonly closeOnEnter = input(false);

  readonly opened = output<void>();
  readonly closed = output<void>();

  private readonly panelRef = viewChild(AlPopoverPanel);
  private readonly inputRef = viewChild<ElementRef<HTMLInputElement>>('inputRef');

  readonly hasEverOpened = computed(() => this.panelRef()?.hasEverOpened() ?? false);

  open(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (this.disabled() || this.readonly()) {
      return;
    }
    this.panelRef()?.open();
  }

  close(): void {
    this.panelRef()?.close();
  }

  isOpen(): boolean {
    return this.panelRef()?.isOpen() ?? false;
  }

  focusInput(): void {
    this.inputRef()?.nativeElement.focus();
  }

  protected onNativeInput(event: Event): void {
    const el = event.target as HTMLInputElement;
    this.value.set(el.value || '');
  }

  protected onBlur(): void {
    this.touch.emit();
  }

  protected onInputKeydown(event: KeyboardEvent): void {
    if (event.key === ' ' || event.code === 'Space') {
      event.preventDefault();
      this.open();
    } else if (event.key === 'Escape') {
      this.close();
    } else if (event.key === 'Enter' && this.closeOnEnter()) {
      this.close();
    }
  }

  protected onPanelKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.close();
      this.focusInput();
    } else if (event.key === 'Enter' && this.closeOnEnter()) {
      this.close();
      this.focusInput();
    }
  }

  protected onPanelOpened(): void {
    this.opened.emit();
  }

  protected onPanelClosed(): void {
    this.closed.emit();
  }
}
