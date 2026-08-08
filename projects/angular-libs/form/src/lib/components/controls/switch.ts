import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import type { FormCheckboxControl } from '@angular/forms/signals';

/** Standalone switch / toggle. Checked: boolean. */
@Component({
  selector: 'al-switch',
  template: `
    <label class="al-switch" [attr.for]="id() || null">
      <input
        #inputRef
        class="al-switch__input"
        type="checkbox"
        role="switch"
        [id]="id() || null"
        [checked]="checked()"
        [attr.aria-invalid]="invalid() || null"
        [attr.aria-describedby]="describedBy() || null"
        [disabled]="disabled()"
        (change)="onChange($event)"
        (blur)="touch.emit()" />
      <span class="al-switch__track" aria-hidden="true">
        <span class="al-switch__thumb"></span>
      </span>
      @if (label()) {
        <span class="al-switch__label">{{ label() }}</span>
      }
    </label>
  `,
  styles: `
    :host {
      display: inline-block;
    }
    .al-switch {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      cursor: pointer;
    }
    .al-switch__input {
      position: absolute;
      opacity: 0;
      width: 0;
      height: 0;
    }
    .al-switch__track {
      position: relative;
      width: 2.5rem;
      height: 1.35rem;
      border-radius: 999px;
      background: var(--al-form-border, #c4c4c4);
      transition: background 0.15s ease;
      flex-shrink: 0;
    }
    .al-switch__thumb {
      position: absolute;
      top: 0.15rem;
      left: 0.15rem;
      width: 1.05rem;
      height: 1.05rem;
      border-radius: 50%;
      background: #fff;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
      transition: transform 0.15s ease;
    }
    .al-switch__input:checked + .al-switch__track {
      background: var(--al-form-focus, #ea580c);
    }
    .al-switch__input:checked + .al-switch__track .al-switch__thumb {
      transform: translateX(1.15rem);
    }
    .al-switch__input:focus-visible + .al-switch__track {
      outline: 2px solid var(--al-form-focus, #ea580c);
      outline-offset: 2px;
    }
    .al-switch__input:disabled + .al-switch__track {
      opacity: 0.5;
    }
    .al-switch:has(.al-switch__input:disabled) {
      cursor: not-allowed;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlSwitch implements FormCheckboxControl {
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
