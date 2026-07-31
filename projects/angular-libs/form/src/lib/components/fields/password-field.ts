import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { FormField } from '@angular/forms/signals';
import type { FormController } from '../../create-form';
import type { FormFieldActionContext } from '../../field-action';
import type { FormElement } from '../../types';
import type { FormUiFieldTree } from '../../types/form-ui-field-tree';
import { AlFieldShell } from '../field-shell/field-shell';
import { AlIconEye, AlIconEyeOff } from '../icons/icons';

@Component({
  selector: 'al-password-field',
  imports: [AlFieldShell, FormField, AlIconEye, AlIconEyeOff],
  template: `
    <al-field-shell
      #af
      [field]="field()"
      [element]="element()"
      [form]="form()"
      [controller]="controller()"
      [clearValue]="''"
      (clear)="onClear($event)">
      @if (element().props?.lead) {
        <span alControlLead class="al-lead">{{ element().props?.lead }}</span>
      }
      @if (field(); as f) {
        <input
          #inputRef
          [type]="visible() ? 'text' : 'password'"
          [id]="af.controlId()"
          [formField]="$any(f)"
          [attr.placeholder]="element().props?.placeholder ?? null"
          [attr.aria-invalid]="af.invalid() || null"
          [attr.aria-describedby]="af.describedById()"
          autocomplete="current-password"
          (compositionstart)="af.setComposing(true)"
          (compositionend)="af.setComposing(false)" />
      }
      <button
        type="button"
        alControlTrail
        class="al-trail-btn"
        [attr.aria-label]="visible() ? 'Hide password' : 'Show password'"
        [attr.aria-pressed]="visible()"
        [disabled]="af.disabled() || af.readonly()"
        (click)="toggleVisible($event)">
        @if (visible()) {
          <al-icon-eye-off />
        } @else {
          <al-icon-eye />
        }
      </button>
    </al-field-shell>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlPasswordField {
  readonly field = input.required<FormUiFieldTree | null>();
  readonly element = input.required<FormElement & { type: 'password' }>();
  readonly form = input<FormUiFieldTree | null>(null);
  readonly controller = input<FormController | null>(null);

  protected readonly visible = signal(false);

  protected onClear(event: Event): void {
    this.element().props?.onClear?.(this.ctx(event));
  }

  protected toggleVisible(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.visible.update((v) => !v);
    this.element().props?.onTrail?.(this.ctx(event));
  }

  private ctx(event: Event): FormFieldActionContext {
    return {
      event,
      field: this.field(),
      element: this.element(),
      form: this.form(),
      controller: this.controller(),
    };
  }
}
