import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import type { FormCheckboxControl } from '@angular/forms/signals';

/** Standalone checkbox. Checked: boolean. */
@Component({
  selector: 'al-checkbox',
  template: `
    <label class="al-checkbox" [attr.for]="id() || null">
      <input
        #inputRef
        type="checkbox"
        [id]="id() || null"
        [checked]="checked()"
        [attr.aria-invalid]="invalid() || null"
        [attr.aria-describedby]="describedBy() || null"
        [disabled]="disabled()"
        (change)="onChange($event)"
        (blur)="touch.emit()" />
      @if (label()) {
        <span>{{ label() }}</span>
      }
    </label>
  `,
  styles: `
    :host {
      display: inline-block;
    }
    .al-checkbox {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlCheckbox implements FormCheckboxControl {
  readonly checked = model(false);
  readonly touch = output<void>();
  readonly id = input('');
  readonly label = input<string | undefined>(undefined);
  readonly disabled = input(false);
  readonly invalid = input(false);
  readonly describedBy = input('');

  protected onChange(event: Event): void {
    this.checked.set((event.target as HTMLInputElement).checked);
  }
}
