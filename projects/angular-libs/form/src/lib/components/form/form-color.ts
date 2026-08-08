import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormField } from '@angular/forms/signals';
import type { FormController } from '../../create-form';
import type { FormElement } from '../../types';
import type { FormUiFieldTree } from '../../types/form-ui-field-tree';
import { AlColorInput } from '../controls/color-input';
import { AlFieldShell } from '../field-shell/field-shell';

@Component({
  selector: 'al-form-color',
  imports: [AlFieldShell, AlColorInput, FormField],
  template: `
    <al-field-shell
      #af
      [field]="field()"
      [element]="element()"
      [form]="form()"
      [controller]="controller()"
      [clearValue]="'#000000'"
      [clearableOverride]="true">
      @if (field(); as f) {
        <al-color-input
          class="al-control__control"
          [formField]="$any(f)"
          [id]="af.controlId()"
          [showHex]="element().props?.showHex !== false"
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
export class AlFormColor {
  readonly field = input.required<FormUiFieldTree | null>();
  readonly element = input.required<FormElement & { type: 'color' }>();
  readonly form = input<FormUiFieldTree | null>(null);
  readonly controller = input<FormController | null>(null);
}
