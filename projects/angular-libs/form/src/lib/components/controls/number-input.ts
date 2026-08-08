import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';

/** Standalone number input. Value: `number | null` (empty → null). */
@Component({
  selector: 'al-number-input',
  template: `
    <input
      #inputRef
      class="al-number-input"
      type="number"
      [id]="id() || null"
      [value]="value() ?? ''"
      [attr.placeholder]="placeholder() ?? null"
      [attr.step]="step() ?? null"
      [attr.min]="min() ?? null"
      [attr.max]="max() ?? null"
      [attr.aria-invalid]="invalid() || null"
      [attr.aria-describedby]="describedBy() || null"
      [disabled]="disabled()"
      [readOnly]="readonly()"
      (input)="onInput($event)"
      (blur)="touch.emit()"
      (compositionstart)="composingChange.emit(true)"
      (compositionend)="composingChange.emit(false)" />
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
    }
    .al-number-input {
      width: 100%;
      box-sizing: border-box;
      font: inherit;
      padding: var(--al-form-control-padding-block, 0.25rem)
        var(--al-form-control-padding-inline, 0.35rem);
      border: 1px solid var(--al-form-border, #c4c4c4);
      border-radius: 0.25rem;
      outline: none;
      background: #fff;
    }
    .al-number-input:focus {
      border-color: var(--al-form-focus, #ea580c);
    }
    :host.al-control__control .al-number-input {
      border: 0;
      border-radius: 0;
      background: transparent;
      padding: var(--al-form-control-padding-block, 0.25rem)
        var(--al-form-control-padding-inline, 0.2rem);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlNumberInput implements FormValueControl<number | null> {
  readonly value = model<number | null>(null);
  readonly touch = output<void>();
  readonly id = input('');
  readonly placeholder = input<string | undefined>(undefined);
  readonly step = input<number | string | undefined>(undefined);
  readonly min = input<number | undefined>(undefined);
  readonly max = input<number | undefined>(undefined);
  readonly disabled = input(false);
  readonly readonly = input(false);
  readonly invalid = input(false);
  readonly describedBy = input('');
  readonly composingChange = output<boolean>();

  protected onInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    if (raw === '') {
      this.value.set(null);
      return;
    }
    const n = Number(raw);
    this.value.set(Number.isFinite(n) ? n : null);
  }
}
