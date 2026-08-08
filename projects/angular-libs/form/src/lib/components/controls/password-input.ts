import { ChangeDetectionStrategy, Component, input, model, output, signal } from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import { AlIconEye, AlIconEyeOff } from '../icons/icons';

/** Standalone password input with show/hide. Value: string. */
@Component({
  selector: 'al-password-input',
  imports: [AlIconEye, AlIconEyeOff],
  template: `
    <div class="al-password-input">
      <input
        #inputRef
        class="al-password-input__field"
        [type]="visible() ? 'text' : 'password'"
        [id]="id() || null"
        [value]="value()"
        [attr.placeholder]="placeholder() ?? null"
        [attr.aria-invalid]="invalid() || null"
        [attr.aria-describedby]="describedBy() || null"
        [disabled]="disabled()"
        [readOnly]="readonly()"
        autocomplete="current-password"
        (input)="onInput($event)"
        (blur)="touch.emit()"
        (compositionstart)="composingChange.emit(true)"
        (compositionend)="composingChange.emit(false)" />
      <button
        type="button"
        class="al-password-input__toggle"
        [attr.aria-label]="visible() ? 'Hide password' : 'Show password'"
        [attr.aria-pressed]="visible()"
        [disabled]="disabled() || readonly()"
        (click)="toggleVisible($event)">
        @if (visible()) {
          <al-icon-eye-off />
        } @else {
          <al-icon-eye />
        }
      </button>
    </div>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
    }
    .al-password-input {
      display: flex;
      align-items: stretch;
      width: 100%;
      border: 1px solid var(--al-form-border, #c4c4c4);
      border-radius: 0.25rem;
      background: #fff;
    }
    .al-password-input:focus-within {
      border-color: var(--al-form-focus, #ea580c);
    }
    .al-password-input__field {
      flex: 1;
      border: 0;
      outline: none;
      background: transparent;
      font: inherit;
      padding: var(--al-form-control-padding-block, 0.25rem)
        var(--al-form-control-padding-inline, 0.35rem);
      min-width: 0;
    }
    .al-password-input__toggle {
      border: 0;
      background: transparent;
      cursor: pointer;
      padding: 0.15rem 0.25rem;
      display: inline-flex;
      align-items: center;
      color: inherit;
    }
    :host.al-control__control .al-password-input {
      border: 0;
      border-radius: 0;
      background: transparent;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlPasswordInput implements FormValueControl<string> {
  readonly value = model<string>('');
  readonly touch = output<void>();
  readonly id = input('');
  readonly placeholder = input<string | undefined>(undefined);
  readonly disabled = input(false);
  readonly readonly = input(false);
  readonly invalid = input(false);
  readonly describedBy = input('');
  readonly composingChange = output<boolean>();
  readonly toggle = output<Event>();

  protected readonly visible = signal(false);

  protected onInput(event: Event): void {
    this.value.set((event.target as HTMLInputElement).value);
  }

  protected toggleVisible(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.visible.update((v) => !v);
    this.toggle.emit(event);
  }
}
