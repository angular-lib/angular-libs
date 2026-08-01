import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  contentChild,
  ElementRef,
  input,
  output,
  signal,
} from '@angular/core';

/**
 * Shared input chrome: prefix / lead / projected control / clear / trail / suffix.
 * Focus ring lives on the host; actions are real buttons.
 *
 * `ViewEncapsulation.None` so projected controls (from field components) can be
 * sized — classes are all `al-control*` scoped.
 */
@Component({
  selector: 'al-control-chrome',
  encapsulation: ViewEncapsulation.None,
  template: `
    @if (prefix()) {
      <span class="al-control__affix al-control__prefix">{{ prefix() }}</span>
    }
    <span class="al-control__slot al-control__lead">
      <ng-content select="[alControlLead]" />
    </span>
    <div class="al-control__input">
      <ng-content />
    </div>
    @if (clearable() && hasValue() && !disabled() && !readonly()) {
      <button
        type="button"
        class="al-control__action al-control__clear"
        aria-label="Clear"
        (click)="onClearClick($event)">
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path
            fill="currentColor"
            d="M3.2 3.2a.75.75 0 0 1 1.06 0L8 6.94l3.74-3.74a.75.75 0 1 1 1.06 1.06L9.06 8l3.74 3.74a.75.75 0 1 1-1.06 1.06L8 9.06l-3.74 3.74a.75.75 0 0 1-1.06-1.06L6.94 8 3.2 4.26a.75.75 0 0 1 0-1.06z" />
        </svg>
      </button>
    }
    <span class="al-control__slot al-control__trail">
      <ng-content select="[alControlTrail]" />
    </span>
    @if (suffix()) {
      <span class="al-control__affix al-control__suffix">{{ suffix() }}</span>
    }
  `,
  styles: `
    al-control-chrome.al-control {
      display: flex;
      align-items: stretch;
      gap: 0.25rem;
      width: 100%;
      box-sizing: border-box;
      border: 1px solid var(--al-form-border, #c4c4c4);
      border-radius: 0.25rem;
      background: #fff;
      min-height: 2.25rem;
      padding-inline: 0.35rem;
    }
    /* Same focus language as .al-textarea: colored 1px border, wraps prefix/suffix/clear */
    al-control-chrome.al-control.al-control--focused {
      outline: none;
      border-color: var(--al-form-focus, #ea580c);
    }
    /* Open dropdown: keep focus cue, square bottom against panel */
    al-control-chrome.al-control.al-control--focused:has(.al-dropdown--open) {
      border-bottom-left-radius: 0;
      border-bottom-right-radius: 0;
      border-bottom-color: var(--al-form-border, #c4c4c4);
    }
    al-control-chrome.al-control.al-control--invalid {
      border-color: var(--al-form-invalid, #b00020);
    }
    al-control-chrome.al-control.al-control--disabled {
      opacity: 0.65;
      background: #f3f3f3;
    }
    al-control-chrome .al-control__input {
      flex: 1 1 auto;
      min-width: 0;
      display: flex;
      align-items: center;
      width: 100%;
    }
    al-control-chrome .al-control__input > input,
    al-control-chrome .al-control__input > textarea,
    al-control-chrome .al-control__input > button.al-control__control {
      flex: 1 1 auto;
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
      border: 0;
      outline: none;
      background: transparent;
      font: inherit;
      padding: 0.35rem 0.25rem;
      min-width: 0;
    }
    al-control-chrome .al-control__input > button.al-control__control {
      text-align: start;
      cursor: pointer;
    }
    al-control-chrome .al-control__affix {
      display: inline-flex;
      align-items: center;
      flex: 0 0 auto;
      padding-inline: 0.25rem;
      opacity: 0.7;
      font-size: 0.875rem;
      white-space: nowrap;
    }
    al-control-chrome .al-control__slot {
      display: inline-flex;
      align-items: center;
      flex: 0 0 auto;
    }
    al-control-chrome .al-control__slot:empty {
      display: none;
    }
    al-control-chrome .al-control__action {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 auto;
      border: 0;
      background: transparent;
      padding: 0.25rem;
      cursor: pointer;
      color: inherit;
      border-radius: 0.2rem;
    }
    al-control-chrome .al-control__action:hover {
      background: rgba(0, 0, 0, 0.06);
    }
    al-control-chrome .al-control__lead,
    al-control-chrome .al-control__trail,
    al-control-chrome .al-lead,
    al-control-chrome .al-trail {
      padding-inline: 0.2rem;
      opacity: 0.75;
      font-size: 0.875rem;
      display: inline-flex;
      align-items: center;
    }
    al-control-chrome .al-trail-btn {
      border: 0;
      background: transparent;
      cursor: pointer;
      padding: 0.25rem 0.35rem;
      font: inherit;
      display: inline-flex;
      align-items: center;
      color: inherit;
    }
    al-control-chrome input[type='search']::-webkit-search-cancel-button {
      display: none;
    }
  `,
  host: {
    class: 'al-control',
    '[class.al-control--focused]': 'focused()',
    '[class.al-control--invalid]': 'invalid()',
    '[class.al-control--disabled]': 'disabled()',
    '[style.anchor-name]': 'anchorName() || null',
    '(click)': 'onHostClick($event)',
    '(focusin)': 'focused.set(true)',
    '(focusout)': 'onFocusOut($event)',
    '(keydown)': 'onKeydown($event)',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlControlChrome {
  /** CSS anchor for popovers that should match this control box (incl. clear). */
  readonly anchorName = input<string | undefined>(undefined);
  readonly prefix = input<string | undefined>(undefined);
  readonly suffix = input<string | undefined>(undefined);
  readonly clearable = input(false);
  readonly clearOnEscape = input(false);
  readonly hasValue = input(false);
  readonly disabled = input(false);
  readonly readonly = input(false);
  readonly invalid = input(false);
  readonly composing = input(false);

  readonly clear = output<Event>();

  readonly inputRef = contentChild<ElementRef<HTMLElement>>('inputRef');

  protected readonly focused = signal(false);

  protected onHostClick(event: Event): void {
    const target = event.target as HTMLElement;
    if (target.closest('button.al-control__action, button.al-trail-btn')) {
      return;
    }
    const el = this.inputRef()?.nativeElement;
    if (el && 'focus' in el) {
      (el as HTMLElement).focus();
    }
  }

  protected onFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;
    if (next && (event.currentTarget as Node).contains(next)) {
      return;
    }
    this.focused.set(false);
  }

  protected onClearClick(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.composing()) {
      return;
    }
    this.clear.emit(event);
    queueMicrotask(() => {
      const el = this.inputRef()?.nativeElement;
      el?.focus?.();
    });
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape' || !this.clearOnEscape()) {
      return;
    }
    if (!this.clearable() || !this.hasValue() || this.disabled() || this.readonly() || this.composing()) {
      return;
    }
    event.preventDefault();
    this.clear.emit(event);
  }
}
