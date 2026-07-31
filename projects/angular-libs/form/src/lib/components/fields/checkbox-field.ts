import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormField } from '@angular/forms/signals';
import type { FormController } from '../../create-form';
import type { FormElement } from '../../types';
import type { FormUiFieldTree } from '../../types/form-ui-field-tree';
import { useFieldChrome } from '../../utils/field-state';
import { AlField } from '../field/field';

@Component({
  selector: 'al-checkbox-field',
  imports: [AlField, FormField],
  template: `
    @if (field(); as f) {
      <al-field
        [field]="f"
        [label]="element().label"
        [hint]="element().hint"
        [labelHelp]="element().labelHelp"
        [controlId]="controlId()"
        [hideHeader]="!!element().hideHeader"
        [hideFooter]="!!element().hideFooter"
        [submitAttempted]="submitAttempted()">
        <label class="al-checkbox" [attr.for]="controlId()">
          <input
            type="checkbox"
            [id]="controlId()"
            [formField]="$any(f)"
            [attr.aria-invalid]="invalid() || null"
            [attr.aria-describedby]="describedById()" />
          @if (element().props?.checkboxLabel) {
            <span>{{ element().props?.checkboxLabel }}</span>
          }
        </label>
      </al-field>
    } @else {
      <al-field [label]="element().label" [hint]="element().hint" />
    }
  `,
  styles: `
    .al-checkbox {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlCheckboxField {
  readonly field = input.required<FormUiFieldTree | null>();
  readonly element = input.required<FormElement & { type: 'checkbox' }>();
  readonly form = input<FormUiFieldTree | null>(null);
  readonly controller = input<FormController | null>(null);

  private readonly chrome = useFieldChrome(
    () => this.field(),
    () => this.element(),
    () => this.controller(),
  );

  protected readonly invalid = this.chrome.invalid;
  protected readonly submitAttempted = this.chrome.submitAttempted;
  protected readonly controlId = this.chrome.controlId;
  protected readonly describedById = this.chrome.describedById;
}
