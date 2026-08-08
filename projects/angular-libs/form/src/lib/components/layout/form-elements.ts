import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { FormController } from '../../create-form';
import type { FormElementConfig, FormFlexAlign, FormFlexJustify } from '../../types';
import type { FormUiFieldTree } from '../../types/form-ui-field-tree';
import { AlFormElementList } from './form-element-list';

/**
 * Flex layout owner for a list of form elements (root form or a group).
 */
@Component({
  selector: 'al-form-elements',
  imports: [AlFormElementList],
  template: `
    <al-form-element-list
      [form]="form()"
      [elements]="elements()"
      [controller]="controller()" />
  `,
  styles: `
    :host {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      gap: var(--al-form-row-gap) var(--al-form-column-gap);
      width: 100%;
      box-sizing: border-box;
      min-width: 0;
      --al-form-row-gap: 0.25rem;
      --al-form-column-gap: 0.75rem;
      container-type: inline-size;
      container-name: al-form;
    }
  `,
  host: {
    '[style.flex-direction]': 'direction()',
    '[style.gap]': 'gap() || null',
    '[style.align-items]': 'alignItems() || null',
    '[style.justify-content]': 'justifyContent() || null',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlFormElements {
  readonly form = input.required<FormUiFieldTree>();
  readonly elements = input.required<readonly FormElementConfig[]>();
  readonly controller = input<FormController | null>(null);

  readonly direction = input<'row' | 'column'>('row');
  readonly gap = input<string | null>(null);
  readonly alignItems = input<FormFlexAlign | null>(null);
  readonly justifyContent = input<FormFlexJustify | null>(null);
}
