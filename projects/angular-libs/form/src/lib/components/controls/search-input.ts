import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  model,
  output,
  untracked,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import { AlIconSearch } from '../icons/icons';

/** Standalone search input. Value: string. Emits `search` (debounced). */
@Component({
  selector: 'al-search-input',
  imports: [AlIconSearch],
  template: `
    <div class="al-search-input">
      <span class="al-search-input__lead" aria-hidden="true">
        <al-icon-search />
      </span>
      <input
        #inputRef
        class="al-search-input__field"
        type="search"
        [id]="id() || null"
        [value]="value()"
        [attr.placeholder]="placeholder() ?? 'Search…'"
        [attr.aria-invalid]="invalid() || null"
        [attr.aria-describedby]="describedBy() || null"
        [disabled]="disabled()"
        [readOnly]="readonly()"
        (input)="onInput($event)"
        (blur)="touch.emit()"
        (compositionstart)="composingChange.emit(true)"
        (compositionend)="composingChange.emit(false)" />
    </div>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
    }
    .al-search-input {
      display: flex;
      align-items: center;
      width: 100%;
      border: 1px solid var(--al-form-border, #c4c4c4);
      border-radius: 0.25rem;
      background: #fff;
      gap: 0.2rem;
      padding-inline: 0.25rem;
    }
    .al-search-input:focus-within {
      border-color: var(--al-form-focus, #ea580c);
    }
    .al-search-input__lead {
      display: inline-flex;
      opacity: 0.75;
    }
    .al-search-input__field {
      flex: 1;
      border: 0;
      outline: none;
      background: transparent;
      font: inherit;
      padding: var(--al-form-control-padding-block, 0.25rem)
        var(--al-form-control-padding-inline, 0.2rem);
      min-width: 0;
    }
    .al-search-input__field::-webkit-search-cancel-button {
      display: none;
    }
    :host.al-control__control .al-search-input {
      border: 0;
      border-radius: 0;
      background: transparent;
      padding-inline: 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlSearchInput implements FormValueControl<string> {
  readonly value = model<string>('');
  readonly touch = output<void>();
  readonly id = input('');
  readonly placeholder = input<string | undefined>(undefined);
  readonly debounceMs = input(300);
  readonly disabled = input(false);
  readonly readonly = input(false);
  readonly invalid = input(false);
  readonly describedBy = input('');
  readonly composingChange = output<boolean>();
  readonly search = output<string>();

  private readonly destroyRef = inject(DestroyRef);
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => this.clearTimer());
    effect(() => {
      const term = this.value();
      untracked(() => this.scheduleSearch(term));
    });
  }

  protected onInput(event: Event): void {
    this.value.set((event.target as HTMLInputElement).value);
  }

  private scheduleSearch(term: string): void {
    this.clearTimer();
    if (!term) {
      this.search.emit(term);
      return;
    }
    this.debounceTimer = setTimeout(() => this.search.emit(term), this.debounceMs());
  }

  private clearTimer(): void {
    if (this.debounceTimer != null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }
}
