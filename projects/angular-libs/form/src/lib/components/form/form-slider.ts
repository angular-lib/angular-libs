import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormField } from '@angular/forms/signals';
import type { FormController } from '../../create-form';
import type { FormElement } from '../../types';
import type { FormUiFieldTree } from '../../types/form-ui-field-tree';
import { AlSlider } from '../controls/slider';
import { AlFieldShell } from '../field-shell/field-shell';

@Component({
  selector: 'al-form-slider',
  imports: [AlFieldShell, AlSlider, FormField],
  template: `
    <al-field-shell
      #af
      [field]="field()"
      [element]="element()"
      [form]="form()"
      [controller]="controller()"
      [clearableOverride]="false">
      @if (field(); as f) {
        <al-slider
          class="al-control__control"
          [formField]="$any(f)"
          [id]="af.controlId()"
          [step]="element().props?.step"
          [showValue]="element().props?.showValue !== false"
          [describedBy]="af.describedById()" />
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
export class AlFormSlider {
  readonly field = input.required<FormUiFieldTree | null>();
  readonly element = input.required<FormElement & { type: 'slider' }>();
  readonly form = input<FormUiFieldTree | null>(null);
  readonly controller = input<FormController | null>(null);
}
