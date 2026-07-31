import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { FormController } from '../../create-form';
import type { FormElement } from '../../types';
import type { FormUiFieldTree } from '../../types/form-ui-field-tree';
import { AlFormElements } from '../layout/form-elements';

/**
 * Group owns its own flex row/column — same flex host as the root list,
 * not a nested second `al-form-elements` inside `display: contents`.
 */
@Component({
  selector: 'al-group-field',
  imports: [AlFormElements],
  template: `
    @if (form(); as f) {
      <al-form-elements
        [form]="f"
        [elements]="childElements()"
        [controller]="controller()"
        [direction]="direction()"
        [gap]="gap()"
        [alignItems]="alignItems()"
        [justifyContent]="justifyContent()" />
    }
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
      min-width: 0;
      box-sizing: border-box;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlGroupField {
  readonly field = input<FormUiFieldTree | null>(null);
  readonly element = input.required<FormElement & { type: 'group' }>();
  readonly form = input<FormUiFieldTree | null>(null);
  readonly controller = input<FormController | null>(null);

  protected readonly childElements = computed(() => this.element().props.elements ?? []);

  protected readonly direction = computed(() => this.element().props.direction ?? 'row');

  protected readonly gap = computed(() => this.element().props.gap ?? null);

  protected readonly alignItems = computed(() => this.element().props.alignItems || null);

  protected readonly justifyContent = computed(() => this.element().props.justifyContent || null);
}
