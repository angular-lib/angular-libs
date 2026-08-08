import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormField } from '@angular/forms/signals';
import type { FormController } from '../../create-form';
import type { FormFieldActionContext } from '../../field-action';
import type { FormElement } from '../../types';
import type { FormUiFieldTree } from '../../types/form-ui-field-tree';
import { AlSearchInput } from '../controls/search-input';
import { AlFieldShell } from '../field-shell/field-shell';

@Component({
  selector: 'al-form-search',
  imports: [AlFieldShell, AlSearchInput, FormField],
  template: `
    <al-field-shell
      #af
      [field]="field()"
      [element]="element()"
      [form]="form()"
      [controller]="controller()"
      [clearValue]="''"
      [clearableOverride]="element().props?.clearable !== false"
      (clear)="onClear($event)">
      @if (field(); as f) {
        <al-search-input
          class="al-control__control"
          [formField]="$any(f)"
          [id]="af.controlId()"
          [placeholder]="element().props?.placeholder"
          [debounceMs]="element().props?.debounceMs ?? 300"
          [describedBy]="af.describedById()"
          (composingChange)="af.setComposing($event)"
          (search)="onSearch($event)" />
      }
      @if (element().props?.trail) {
        @if (element().props?.trailAction) {
          <button
            type="button"
            alControlTrail
            class="al-trail-btn"
            [disabled]="af.disabled() || af.readonly()"
            (click)="onTrail($event)">
            {{ element().props?.trail }}
          </button>
        } @else {
          <span alControlTrail class="al-trail">{{ element().props?.trail }}</span>
        }
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
export class AlFormSearch {
  readonly field = input.required<FormUiFieldTree | null>();
  readonly element = input.required<FormElement & { type: 'search' }>();
  readonly form = input<FormUiFieldTree | null>(null);
  readonly controller = input<FormController | null>(null);

  protected onClear(event: Event): void {
    this.element().props?.onClear?.(this.ctx(event));
    this.emitSearch('', event);
  }

  protected onTrail(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.element().props?.onTrail?.(this.ctx(event));
  }

  protected onSearch(term: string): void {
    this.emitSearch(term);
  }

  private emitSearch(term: string, event?: Event): void {
    const onSearch = this.element().props?.onSearch;
    if (!onSearch) {
      return;
    }
    onSearch({
      ...this.ctx(event ?? new Event('search')),
      term,
    });
  }

  private ctx(event: Event): FormFieldActionContext {
    return {
      event,
      field: this.field(),
      element: this.element(),
      form: this.form(),
      controller: this.controller(),
    };
  }
}
