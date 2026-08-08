import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormField } from '@angular/forms/signals';
import type { FormController } from '../../create-form';
import type { FormFieldActionContext } from '../../field-action';
import type { FormElement } from '../../types';
import type { FormUiFieldTree } from '../../types/form-ui-field-tree';
import { AlPasswordInput } from '../controls/password-input';
import { AlFieldShell } from '../field-shell/field-shell';

@Component({
  selector: 'al-form-password',
  imports: [AlFieldShell, AlPasswordInput, FormField],
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
        <al-password-input
          class="al-control__control"
          [formField]="$any(f)"
          [id]="af.controlId()"
          [placeholder]="element().props?.placeholder"
          [describedBy]="af.describedById()"
          (composingChange)="af.setComposing($event)"
          (toggle)="onToggle($event)" />
      }
    </al-field-shell>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlFormPassword {
  readonly field = input.required<FormUiFieldTree | null>();
  readonly element = input.required<FormElement & { type: 'password' }>();
  readonly form = input<FormUiFieldTree | null>(null);
  readonly controller = input<FormController | null>(null);

  protected onClear(event: Event): void {
    this.element().props?.onClear?.(this.ctx(event));
  }

  protected onToggle(event: Event): void {
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
