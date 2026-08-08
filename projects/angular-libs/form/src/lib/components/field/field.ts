import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import type { FieldTree } from '@angular/forms/signals';
import { unwrapMaybeSignal } from '../../utils/resolve-field';
import type { MaybeSignal } from '../../types';

let nextFieldId = 0;

/**
 * Header + control + footer chrome around a projected control.
 */
@Component({
  selector: 'al-field',
  template: `
    <div
      class="al-field"
      [class.al-field--invalid]="invalid()"
      [class.al-field--required]="required()">
      @if (!hideHeader() && resolvedLabel()) {
        <div class="al-field__header">
          <label class="al-field__label" [attr.for]="controlId()">
            {{ resolvedLabel() }}
            @if (required()) {
              <span class="al-field__required" aria-hidden="true">*</span>
            }
          </label>
          @if (resolvedHelp()) {
            <span class="al-field__help" [attr.title]="resolvedHelp()" [attr.aria-label]="resolvedHelp()">?</span>
          }
        </div>
      }
      <div class="al-field__control">
        <ng-content />
      </div>
      @if (!hideFooter()) {
        <div class="al-field__footer">
          <div class="al-field__footer-left" [id]="describedById()">
            @if (showErrors()) {
              <ul class="al-field__errors">
                @for (err of errors(); track $index) {
                  <li>{{ err.message || err.kind }}</li>
                }
              </ul>
            } @else if (resolvedHint()) {
              <div class="al-field__hint">{{ resolvedHint() }}</div>
            }
          </div>
          @if (meta()) {
            <div class="al-field__footer-right">{{ meta() }}</div>
          }
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
    }
    .al-field {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
      margin-block: 0;
    }
    .al-field__header {
      display: flex;
      align-items: baseline;
      gap: 0.25rem;
    }
    .al-field__label {
      font-weight: 600;
      font-size: 0.875rem;
      line-height: 1.25;
    }
    .al-field__required {
      color: #b00020;
      margin-inline-start: 0.15rem;
    }
    .al-field__help {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1rem;
      height: 1rem;
      border-radius: 50%;
      border: 1px solid currentColor;
      font-size: 0.7rem;
      opacity: 0.7;
      cursor: help;
    }
    .al-field__footer {
      display: flex;
      justify-content: space-between;
      gap: 0.5rem;
      min-height: 0;
    }
    .al-field__footer:not(:has(.al-field__errors, .al-field__hint, .al-field__footer-right:not(:empty))) {
      display: none;
    }
    .al-field__footer-left {
      flex: 1;
      min-width: 0;
    }
    .al-field__footer-right {
      flex: 0 0 auto;
      font-size: 0.8rem;
      opacity: 0.75;
      font-variant-numeric: tabular-nums;
    }
    .al-field__errors {
      margin: 0;
      padding-inline-start: 1.1rem;
      color: #b00020;
      font-size: 0.875rem;
    }
    .al-field__hint {
      font-size: 0.875rem;
      opacity: 0.8;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlField {
  readonly field = input<FieldTree<unknown> | null>(null);
  readonly label = input<MaybeSignal<string> | undefined>(undefined);
  readonly hint = input<MaybeSignal<string> | undefined>(undefined);
  readonly labelHelp = input<MaybeSignal<string> | undefined>(undefined);
  readonly controlId = input<string>(`al-field-${++nextFieldId}`);
  readonly hideHeader = input(false);
  readonly hideFooter = input(false);
  /** Right-side footer meta (e.g. character count). */
  readonly meta = input<string | null>(null);
  /** Host flagged a submit attempt — reveal errors even if untouched. */
  readonly submitAttempted = input(false);

  protected readonly describedById = computed(() => `${this.controlId()}-desc`);

  protected readonly resolvedLabel = computed(() => {
    const v = this.label();
    return v == null ? '' : unwrapMaybeSignal(v);
  });

  protected readonly resolvedHint = computed(() => {
    const v = this.hint();
    return v == null ? '' : unwrapMaybeSignal(v);
  });

  protected readonly resolvedHelp = computed(() => {
    const v = this.labelHelp();
    return v == null ? '' : unwrapMaybeSignal(v);
  });

  protected readonly state = computed(() => {
    const f = this.field();
    return f ? f() : null;
  });

  protected readonly errors = computed(() => this.state()?.errors() ?? []);

  protected readonly invalid = computed(() => this.state()?.invalid() ?? false);

  protected readonly required = computed(() => this.state()?.required() ?? false);

  protected readonly showErrors = computed(() => {
    const s = this.state();
    if (!s || !s.invalid()) {
      return false;
    }
    return s.touched() || s.dirty() || this.submitAttempted();
  });
}
