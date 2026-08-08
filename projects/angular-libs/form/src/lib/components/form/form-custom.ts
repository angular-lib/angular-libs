import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import type { FormController } from '../../create-form';
import type { FormElement } from '../../types';
import type { FormUiFieldTree } from '../../types/form-ui-field-tree';

/**
 * Renders a custom field component from `formCustom({ props: { component, inputs } })`.
 */
@Component({
  selector: 'al-form-custom',
  imports: [NgComponentOutlet],
  template: `
    @if (component()) {
      <ng-container
        [ngComponentOutlet]="component()"
        [ngComponentOutletInputs]="outletInputs()" />
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlFormCustom {
  readonly field = input.required<FormUiFieldTree | null>();
  readonly element = input.required<FormElement & { type: 'custom' }>();
  readonly form = input<FormUiFieldTree | null>(null);
  readonly controller = input<FormController | null>(null);

  protected readonly component = computed(() => this.element().props.component);

  protected readonly outletInputs = computed(() => ({
    field: this.field(),
    element: this.element(),
    form: this.form(),
    controller: this.controller(),
    ...(this.element().props.inputs ?? {}),
  }));
}
