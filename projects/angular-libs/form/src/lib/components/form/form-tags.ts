import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { FormField } from '@angular/forms/signals';
import type { FormController } from '../../create-form';
import type { FormElement } from '../../types';
import type { FormUiFieldTree } from '../../types/form-ui-field-tree';
import { AlTagInput } from '../controls/tag-input';
import { AlFieldShell } from '../field-shell/field-shell';

@Component({
  selector: 'al-form-tags',
  imports: [AlFieldShell, AlTagInput, FormField],
  template: `
    <al-field-shell
      #af
      [field]="field()"
      [element]="element()"
      [form]="form()"
      [controller]="controller()"
      [clearValue]="emptyTags"
      [clearableOverride]="true"
      [hasValue]="hasValue()">
      @if (field(); as f) {
        <al-tag-input
          class="al-control__control"
          [formField]="$any(f)"
          [id]="af.controlId()"
          [placeholder]="element().props?.placeholder"
          [maxTags]="element().props?.maxTags"
          [addOnBlur]="!!element().props?.addOnBlur"
          [separatorKeys]="element().props?.separatorKeys ?? ['Enter', ',']"
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
export class AlFormTags {
  protected readonly emptyTags: string[] = [];

  readonly field = input.required<FormUiFieldTree | null>();
  readonly element = input.required<FormElement & { type: 'tags' }>();
  readonly form = input<FormUiFieldTree | null>(null);
  readonly controller = input<FormController | null>(null);

  protected readonly hasValue = computed(() => {
    const v = this.field()?.()?.value();
    return Array.isArray(v) && v.length > 0;
  });
}
