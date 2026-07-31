import type { FieldTree } from '@angular/forms/signals';
import type { FormController } from './create-form';
import type { FormElement } from './types';

/** Context passed to field action callbacks (clear / trail / search). */
export interface FormFieldActionContext<TData = unknown> {
  event: Event;
  field: FieldTree<unknown> | null;
  element: FormElement<TData>;
  form: FieldTree<TData> | null;
  controller: FormController<TData> | null;
}
