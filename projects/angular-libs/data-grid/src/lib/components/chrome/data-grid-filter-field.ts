import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import type { ResolvedColumn } from '../data-grid/data-grid.types';
import { isDateColumn } from '../../utils/cell-value';
import { parseSetFilter, serializeSetFilter } from '../../utils/filter-rows';

/**
 * Shared filter control used by the floating filter row and the filters tool panel.
 * Emits the same string filter model as `DataGrid.setFilter`.
 */
@Component({
  selector: 'al-data-grid-filter-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isBoolean()) {
      <select
        class="al-dg-filter-field__input"
        [class.al-data-grid__filter-input]="variant() === 'floating'"
        [value]="value()"
        (change)="valueChange.emit($any($event.target).value)"
        [attr.aria-label]="ariaLabel() || null"
        data-testid="al-dg-filter-field-boolean"
      >
        <option value="">Any</option>
        <option value="true">True</option>
        <option value="false">False</option>
      </select>
    } @else if (isSet()) {
      @if (variant() === 'panel') {
        <div class="al-dg-filter-field__set-list" data-testid="al-dg-set-filter">
          @for (opt of setOptions(); track opt) {
            <label class="al-dg-filter-field__set-item">
              <input
                type="checkbox"
                [checked]="isSetSelected(opt)"
                (change)="toggleSet(opt, $any($event.target).checked)"
              />
              <span>{{ opt || '(empty)' }}</span>
            </label>
          } @empty {
            <span class="al-dg-filter-field__hint">No values</span>
          }
        </div>
      } @else {
        <details class="al-dg-filter-field__set al-data-grid__set-filter" data-testid="al-dg-set-filter">
          <summary>Set</summary>
          <div class="al-dg-filter-field__set-list al-data-grid__set-filter-list">
            @for (opt of setOptions(); track opt) {
              <label class="al-dg-filter-field__set-item al-data-grid__set-filter-item">
                <input
                  type="checkbox"
                  [checked]="isSetSelected(opt)"
                  (change)="toggleSet(opt, $any($event.target).checked)"
                />
                <span>{{ opt || '(empty)' }}</span>
              </label>
            }
          </div>
        </details>
      }
    } @else if (isDate()) {
      <input
        class="al-dg-filter-field__input"
        [class.al-data-grid__filter-input]="variant() === 'floating'"
        type="date"
        [value]="value()"
        (change)="valueChange.emit($any($event.target).value)"
        [attr.aria-label]="ariaLabel() || null"
        data-testid="al-dg-filter-field-date"
      />
    } @else {
      <input
        class="al-dg-filter-field__input"
        [class.al-data-grid__filter-input]="variant() === 'floating'"
        type="{{ isNumber() ? 'number' : 'search' }}"
        [value]="value()"
        (input)="valueChange.emit($any($event.target).value)"
        [attr.aria-label]="ariaLabel() || null"
        placeholder="Filter…"
        data-testid="al-dg-filter-field-text"
      />
    }
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    .al-dg-filter-field__input {
      width: 100%;
      box-sizing: border-box;
      border: 1px solid var(--al-dg-border, #e5e7eb);
      border-radius: 6px;
      padding: 6px 8px;
      font: inherit;
      font-size: 12px;
      color: var(--al-dg-fg, #111827);
      background: var(--al-dg-bg, #fff);
    }
    .al-dg-filter-field__hint {
      color: var(--al-dg-muted, #6b7280);
      font-size: 12px;
    }
    .al-dg-filter-field__set {
      font-size: 12px;
      position: relative;
    }
    .al-dg-filter-field__set > summary {
      cursor: pointer;
      list-style: none;
      padding: 2px 4px;
      border: 1px solid var(--al-dg-border, #e5e7eb);
      border-radius: 4px;
      background: var(--al-dg-bg, #fff);
    }
    .al-dg-filter-field__set-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
      max-height: 180px;
      overflow: auto;
    }
    .al-dg-filter-field__set .al-dg-filter-field__set-list {
      position: absolute;
      z-index: 5;
      left: 0;
      top: 100%;
      min-width: 140px;
      margin-top: 4px;
      padding: 6px;
      border: 1px solid var(--al-dg-border, #e5e7eb);
      border-radius: 6px;
      background: var(--al-dg-bg, #fff);
      box-shadow: none;
      outline: 1px solid var(--al-dg-border, #e5e7eb);
    }
    .al-dg-filter-field__set-item {
      display: flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      white-space: nowrap;
      font-size: 12px;
      color: var(--al-dg-fg, #111827);
    }
  `,
})
export class DataGridFilterField {
  /** Accept any row type — filter UI only reads filter/type metadata. */
  readonly column = input.required<ResolvedColumn<any>>();
  readonly value = input('');
  readonly setOptions = input<readonly string[]>([]);
  readonly ariaLabel = input('');
  /** `floating` = compact header dropdown; `panel` = inline checklist for set filters. */
  readonly variant = input<'floating' | 'panel'>('floating');
  readonly valueChange = output<string>();

  readonly isBoolean = computed(() => {
    const col = this.column();
    return col.filter === 'boolean' || col.type === 'boolean';
  });
  readonly isSet = computed(() => this.column().filter === 'set');
  readonly isDate = computed(() => isDateColumn(this.column()));
  readonly isNumber = computed(() => {
    const col = this.column();
    return col.filter === 'number' || col.type === 'number';
  });

  private readonly selectedSet = computed(
    () => new Set(parseSetFilter(this.value())),
  );

  isSetSelected(opt: string): boolean {
    return this.selectedSet().has(opt);
  }

  toggleSet(opt: string, checked: boolean): void {
    const current = new Set(this.selectedSet());
    if (checked) {
      current.add(opt);
    } else {
      current.delete(opt);
    }
    this.valueChange.emit(current.size ? serializeSetFilter([...current]) : '');
  }
}
