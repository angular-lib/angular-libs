import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { FormField } from '@angular/forms/signals';
import type { FormController } from '../../create-form';
import type { FormElement } from '../../types';
import type { FormUiFieldTree } from '../../types/form-ui-field-tree';
import { AlFileInput } from '../controls/file-input';
import { AlFieldShell } from '../field-shell/field-shell';

@Component({
  selector: 'al-form-file',
  imports: [AlFieldShell, AlFileInput, FormField],
  template: `
    <al-field-shell
      #af
      [field]="field()"
      [element]="element()"
      [form]="form()"
      [controller]="controller()"
      [clearValue]="clearValue()"
      [clearableOverride]="true"
      [hasValue]="hasValue()">
      @if (field(); as f) {
        <al-file-input
          class="al-control__control"
          [formField]="$any(f)"
          [id]="af.controlId()"
          [multiple]="!!element().props?.multiple"
          [accept]="element().props?.accept"
          [maxFiles]="element().props?.maxFiles"
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
export class AlFormFile {
  readonly field = input.required<FormUiFieldTree | null>();
  readonly element = input.required<FormElement & { type: 'file' }>();
  readonly form = input<FormUiFieldTree | null>(null);
  readonly controller = input<FormController | null>(null);

  protected readonly clearValue = computed(() => (this.element().props?.multiple ? [] : null));

  protected readonly hasValue = computed(() => {
    const v = this.field()?.()?.value();
    if (Array.isArray(v)) {
      return v.length > 0;
    }
    return v != null;
  });
}
