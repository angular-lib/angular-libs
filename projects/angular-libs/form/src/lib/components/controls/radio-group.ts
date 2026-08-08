import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import type { FormRadioOption } from '../../types';

/** Standalone radio group. Value: option value or null. */
@Component({
  selector: 'al-radio-group',
  template: `
    <div
      class="al-radio-group"
      [class.al-radio-group--row]="direction() === 'row'"
      role="radiogroup"
      [attr.aria-invalid]="invalid() || null"
      [attr.aria-describedby]="describedBy() || null">
      @for (opt of options(); track opt.value) {
        <label class="al-radio-group__option">
          <input
            type="radio"
            [name]="groupName() || id() || 'al-radio'"
            [id]="optionId($index)"
            [checked]="value() === opt.value"
            [disabled]="disabled() || !!opt.disabled"
            (change)="onSelect(opt.value)"
            (blur)="touch.emit()" />
          <span>{{ opt.label }}</span>
        </label>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    .al-radio-group {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }
    .al-radio-group--row {
      flex-direction: row;
      flex-wrap: wrap;
      gap: 0.75rem 1rem;
    }
    .al-radio-group__option {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      cursor: pointer;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlRadioGroup
  implements FormValueControl<string | number | boolean | null>
{
  readonly value = model<string | number | boolean | null>(null);
  readonly touch = output<void>();
  readonly options = input<readonly FormRadioOption[]>([]);
  readonly direction = input<'row' | 'column'>('column');
  readonly id = input('');
  readonly groupName = input('');
  readonly disabled = input(false);
  readonly invalid = input(false);
  readonly describedBy = input('');

  protected optionId(index: number): string {
    const base = this.id() || 'al-radio';
    return `${base}-${index}`;
  }

  protected onSelect(v: string | number | boolean): void {
    this.value.set(v);
  }
}
