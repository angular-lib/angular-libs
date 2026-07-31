import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { FormElement } from '../../types';
import type { FormController } from '../../create-form';
import type { FieldTree } from '@angular/forms/signals';

@Component({
  selector: 'al-space-field',
  template: `<div class="al-space" [style.height]="height()"></div>`,
  styles: `
    .al-space {
      width: 100%;
      min-height: 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlSpaceField {
  readonly field = input<FieldTree<unknown> | null>(null);
  readonly element = input.required<FormElement & { type: 'space' }>();
  readonly form = input<FieldTree<unknown> | null>(null);
  readonly controller = input<FormController<unknown> | null>(null);

  protected readonly height = computed(() => this.element().props?.height ?? null);
}
