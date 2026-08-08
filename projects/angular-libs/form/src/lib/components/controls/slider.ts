import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';

/** Standalone range slider. Value: number. */
@Component({
  selector: 'al-slider',
  template: `
    <div class="al-slider">
      <input
        #inputRef
        class="al-slider__input"
        type="range"
        [id]="id() || null"
        [value]="value()"
        [attr.min]="min() ?? null"
        [attr.max]="max() ?? null"
        [attr.step]="step() ?? null"
        [attr.aria-invalid]="invalid() || null"
        [attr.aria-describedby]="describedBy() || null"
        [disabled]="disabled()"
        (input)="onInput($event)"
        (blur)="touch.emit()" />
      @if (showValue()) {
        <span class="al-slider__value">{{ value() }}</span>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
    }
    .al-slider {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      width: 100%;
    }
    .al-slider__input {
      flex: 1;
      min-width: 0;
      accent-color: var(--al-form-focus, #ea580c);
    }
    .al-slider__value {
      font-variant-numeric: tabular-nums;
      min-width: 2ch;
      text-align: end;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlSlider implements FormValueControl<number> {
  readonly value = model(0);
  readonly touch = output<void>();
  readonly id = input('');
  readonly min = input<number | undefined>(undefined);
  readonly max = input<number | undefined>(undefined);
  readonly step = input<number | undefined>(undefined);
  readonly showValue = input(true);
  readonly disabled = input(false);
  readonly invalid = input(false);
  readonly describedBy = input('');

  protected onInput(event: Event): void {
    const n = Number((event.target as HTMLInputElement).value);
    this.value.set(Number.isFinite(n) ? n : 0);
  }
}
