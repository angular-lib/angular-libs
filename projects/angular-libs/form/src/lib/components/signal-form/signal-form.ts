import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
} from '@angular/core';
import { FormRoot, type FieldTree } from '@angular/forms/signals';
import { FormController } from '../../create-form';
import type { FormElementConfig } from '../../types';
import type { FormUiFieldTree } from '../../types/form-ui-field-tree';
import { FORM_FIELD_REGISTRY } from '../../registry/provide-form-fields';
import { registerBuiltInFormFields } from '../../registry/register-built-ins';
import { warnInvalidFormSetup } from '../../utils/validate-elements';
import { AlFormElements } from '../layout/form-elements';

@Component({
  selector: 'al-signal-form',
  imports: [FormRoot, AlFormElements],
  template: `
    <form class="al-signal-form" [formRoot]="form()">
      <al-form-elements
        [form]="uiForm()"
        [elements]="resolvedElements()"
        [controller]="resolvedController()" />
      <ng-content />
    </form>
  `,
  styles: `
    :host {
      display: block;
    }
    .al-signal-form {
      display: block;
      width: 100%;
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      border: 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlSignalForm<TData = unknown> {
  readonly form = input.required<FieldTree<TData>>();
  readonly controller = input<FormController<TData> | null>(null);
  readonly elements = input<readonly FormElementConfig<TData>[] | null>(null);

  private readonly registry = inject(FORM_FIELD_REGISTRY);

  constructor() {
    registerBuiltInFormFields();

    effect(() => {
      warnInvalidFormSetup(this.uiForm(), this.resolvedElements(), this.registry);
    });
  }

  protected readonly uiForm = computed(() => this.form() as FormUiFieldTree);

  protected readonly resolvedController = computed(() => this.controller() as FormController | null);

  protected readonly resolvedElements = computed(() => {
    const fromInput = this.elements();
    if (fromInput?.length) {
      return fromInput as readonly FormElementConfig[];
    }
    return (this.controller()?.elements() ?? []) as readonly FormElementConfig[];
  });
}
