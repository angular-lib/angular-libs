import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { FormElement } from '../../types';
import type { FormController } from '../../create-form';
import type { FieldTree } from '@angular/forms/signals';

@Component({
  selector: 'al-line-break-field',
  template: ``,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlLineBreakField {
  readonly field = input<FieldTree<unknown> | null>(null);
  readonly element = input.required<FormElement & { type: 'line-break' }>();
  readonly form = input<FieldTree<unknown> | null>(null);
  readonly controller = input<FormController<unknown> | null>(null);
}
