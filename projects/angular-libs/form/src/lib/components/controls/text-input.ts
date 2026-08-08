import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';

/** Standalone text input. Value: string. */
@Component({
  selector: 'al-text-input',
  template: `
    <input
      #inputRef
      class="al-text-input"
      type="text"
      [id]="id() || null"
      [value]="value()"
      [attr.placeholder]="placeholder() ?? null"
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
    .al-text-input {
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
    .al-text-input:focus {
      border-color: var(--al-form-focus, #ea580c);
    }
    :host.al-control__control .al-text-input {
      border: 0;
      border-radius: 0;
      background: transparent;
      padding: var(--al-form-control-padding-block, 0.25rem)
        var(--al-form-control-padding-inline, 0.2rem);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlTextInput implements FormValueControl<string> {
  readonly value = model<string>('');
  readonly touch = output<void>();
  readonly id = input('');
  readonly placeholder = input<string | undefined>(undefined);
  readonly disabled = input(false);
  readonly readonly = input(false);
  readonly invalid = input(false);
  readonly describedBy = input('');
  readonly composingChange = output<boolean>();

  protected onInput(event: Event): void {
    this.value.set((event.target as HTMLInputElement).value);
  }
}
