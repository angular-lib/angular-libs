import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import type { DataGridLocale } from '../../locale/default-locale';
import { defaultGridLocale } from '../../locale/default-locale';
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
        [attr.tabindex]="floatingTabIndex()"
        [value]="value()"
        (change)="valueChange.emit($any($event.target).value)"
        [attr.aria-label]="ariaLabel() || null"
        data-testid="al-dg-filter-field-boolean"
      >
        <option value="">{{ labels().filterAny }}</option>
        <option value="true">{{ labels().filterTrue }}</option>
        <option value="false">{{ labels().filterFalse }}</option>
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
            <span class="al-dg-filter-field__hint">{{ labels().filterNoValues }}</span>
          }
        </div>
      } @else {
        <details class="al-dg-filter-field__set al-data-grid__set-filter" data-testid="al-dg-set-filter">
          <summary [attr.tabindex]="floatingTabIndex()">{{ labels().filterSet }}</summary>
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
        [attr.tabindex]="floatingTabIndex()"
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
        [attr.tabindex]="floatingTabIndex()"
        type="{{ isNumber() ? 'number' : 'search' }}"
        [value]="value()"
        (input)="valueChange.emit($any($event.target).value)"
        [attr.aria-label]="ariaLabel() || null"
        [placeholder]="labels().filterPlaceholder"
        data-testid="al-dg-filter-field-text"
      />
    }
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
      min-width: 0;
      box-sizing: border-box;
    }
    .al-dg-filter-field__input {
      display: block;
      width: 100%;
      box-sizing: border-box;
      border: 1px solid var(--al-dg-border, #babfc7);
      border-radius: 6px;
      padding: 6px 8px;
      font: inherit;
      font-size: 12px;
      color: var(--al-dg-fg, #181d1f);
      background: var(--al-dg-bg, #fff);
    }
    .al-dg-filter-field__hint {
      color: var(--al-dg-muted, #5f6368);
      font-size: 12px;
    }
    .al-dg-filter-field__set {
      display: block;
      width: 100%;
      font-size: 12px;
      position: relative;
      box-sizing: border-box;
    }
    .al-dg-filter-field__set > summary {
      display: block;
      width: 100%;
      box-sizing: border-box;
      cursor: pointer;
      list-style: none;
      padding: 2px 4px;
      border: 1px solid var(--al-dg-border, #babfc7);
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
      z-index: 20;
      left: 0;
      top: 100%;
      min-width: 100%;
      width: max-content;
      margin-top: 4px;
      padding: 6px;
      border: 1px solid var(--al-dg-border, #babfc7);
      border-radius: 6px;
      background: var(--al-dg-bg, #fff);
      box-shadow: 0 4px 12px color-mix(in srgb, #000 12%, transparent);
      outline: none;
    }
    .al-dg-filter-field__set-item {
      display: flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      white-space: nowrap;
      font-size: 12px;
      color: var(--al-dg-fg, #181d1f);
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
  readonly locale = input<DataGridLocale | null>(null);
  readonly valueChange = output<string>();

  readonly labels = computed(() => this.locale() ?? defaultGridLocale);
  readonly floatingTabIndex = computed(() => (this.variant() === 'floating' ? -1 : null));

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
