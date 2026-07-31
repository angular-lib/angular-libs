import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  untracked,
} from '@angular/core';
import { FormField } from '@angular/forms/signals';
import type { FormController } from '../../create-form';
import type { FormFieldActionContext } from '../../field-action';
import type { FormElement } from '../../types';
import type { FormUiFieldTree } from '../../types/form-ui-field-tree';
import { AlFieldShell } from '../field-shell/field-shell';
import { AlIconSearch } from '../icons/icons';

@Component({
  selector: 'al-search-field',
  imports: [AlFieldShell, FormField, AlIconSearch],
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
      <span alControlLead class="al-lead">
        <al-icon-search />
      </span>
      @if (field(); as f) {
        <input
          #inputRef
          type="search"
          class="al-search-input"
          [id]="af.controlId()"
          [formField]="$any(f)"
          [attr.placeholder]="element().props?.placeholder ?? 'Search…'"
          [attr.aria-invalid]="af.invalid() || null"
          [attr.aria-describedby]="af.describedById()"
          (compositionstart)="af.setComposing(true)"
          (compositionend)="af.setComposing(false)" />
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
  styles: ``,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlSearchField {
  readonly field = input.required<FormUiFieldTree | null>();
  readonly element = input.required<FormElement & { type: 'search' }>();
  readonly form = input<FormUiFieldTree | null>(null);
  readonly controller = input<FormController | null>(null);

  private readonly destroyRef = inject(DestroyRef);
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => this.clearTimer());

    effect(() => {
      const term = String(this.field()?.()?.value() ?? '');
      const onSearch = this.element().props?.onSearch;
      if (!onSearch) {
        return;
      }
      untracked(() => this.scheduleSearch(term));
    });
  }

  protected onClear(event: Event): void {
    this.element().props?.onClear?.(this.ctx(event));
    this.emitSearch('', event);
  }

  protected onTrail(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.element().props?.onTrail?.(this.ctx(event));
  }

  private scheduleSearch(term: string): void {
    this.clearTimer();
    const ms = this.element().props?.debounceMs ?? 300;
    if (!term) {
      this.emitSearch(term);
      return;
    }
    this.debounceTimer = setTimeout(() => this.emitSearch(term), ms);
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

  private clearTimer(): void {
    if (this.debounceTimer != null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
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
