import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import type { DataGridLocale } from '../../locale/default-locale';
import { defaultGridLocale } from '../../locale/default-locale';
import type { ResolvedColumn } from '../data-grid/data-grid.types';
import { DEFAULT_FILTER_DEBOUNCE_MS, InputDebouncer } from '../../utils/debounce';
import {
  DATE_FILTER_OPS,
  FILTER_OP_SYMBOLS,
  NUMBER_FILTER_OPS,
  TEXT_FILTER_OPS,
  formatNumberFilterInput,
  hasNumberShorthand,
  isDateKey,
  isValuelessOp,
  normalizeFilterModel,
  parseNumberFilterInput,
  resolveFilterKind,
  sameFilterModel,
  type ColumnFilterModel,
  type FilterJoin,
  type NumberFilterCondition,
  type NumberFilterOp,
} from '../../utils/filter-model';
import { EMPTY_SET_FILTER_OPTIONS, type SetFilterOptions } from '../../utils/filter-rows';

type ConditionKind = 'text' | 'number' | 'date';

interface ConditionDraft {
  op: string;
  text: string;
  textTo: string;
}

interface FilterDraft {
  conditions: [ConditionDraft, ConditionDraft];
  join: FilterJoin;
}

const OPS: Record<ConditionKind, readonly string[]> = {
  text: TEXT_FILTER_OPS,
  number: NUMBER_FILTER_OPS,
  date: DATE_FILTER_OPS,
};

const DEFAULT_OP: Record<ConditionKind, string> = {
  text: 'contains',
  number: 'equals',
  date: 'equals',
};

/** Locale key for each operator label. */
const OP_LABEL_KEY: Record<string, keyof DataGridLocale> = {
  contains: 'filterOpContains',
  notContains: 'filterOpNotContains',
  equals: 'filterOpEquals',
  notEqual: 'filterOpNotEqual',
  startsWith: 'filterOpStartsWith',
  endsWith: 'filterOpEndsWith',
  lessThan: 'filterOpLessThan',
  lessThanOrEqual: 'filterOpLessThanOrEqual',
  greaterThan: 'filterOpGreaterThan',
  greaterThanOrEqual: 'filterOpGreaterThanOrEqual',
  inRange: 'filterOpInRange',
  before: 'filterOpBefore',
  after: 'filterOpAfter',
  blank: 'filterOpBlank',
  notBlank: 'filterOpNotBlank',
};

function emptyCondition(kind: ConditionKind): ConditionDraft {
  return { op: DEFAULT_OP[kind], text: '', textTo: '' };
}

/**
 * Shared filter control used by the floating filter row and the filters tool panel.
 * Reads / emits a typed {@link ColumnFilterModel} (`null` = no filter).
 *
 * Typed text is debounced (`debounceMs`); operator / date / set / boolean
 * changes emit immediately. Enter and blur flush a pending edit.
 */
@Component({
  selector: 'al-data-grid-filter-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (summaryOnly()) {
      <div class="al-dg-filter-field__row">
        <input
          class="al-dg-filter-field__input al-dg-filter-field__primary"
          [class.al-data-grid__filter-input]="variant() === 'floating'"
          [attr.tabindex]="floatingTabIndex()"
          readonly
          [value]="summary()"
          [attr.title]="summary()"
          [attr.aria-label]="ariaLabel() || null"
          data-testid="al-dg-filter-field-summary"
        />
        <button
          type="button"
          class="al-dg-filter-field__clear"
          [attr.tabindex]="floatingTabIndex()"
          [attr.aria-label]="labels().filtersRemoveFilter + ' ' + ariaLabel()"
          [attr.title]="labels().filtersRemoveFilter"
          (click)="emit(null)"
        >
          ×
        </button>
      </div>
    } @else if (kind() === 'boolean') {
      <select
        class="al-dg-filter-field__input al-dg-filter-field__primary"
        [class.al-data-grid__filter-input]="variant() === 'floating'"
        [attr.tabindex]="floatingTabIndex()"
        [value]="booleanValue()"
        (change)="onBoolean($any($event.target).value)"
        [attr.aria-label]="ariaLabel() || null"
        data-testid="al-dg-filter-field-boolean"
      >
        <option value="">{{ labels().filterAny }}</option>
        <option value="true">{{ labels().filterTrue }}</option>
        <option value="false">{{ labels().filterFalse }}</option>
      </select>
    } @else if (kind() === 'set') {
      @if (variant() === 'panel') {
        <ng-container *ngTemplateOutlet="setList" />
      } @else {
        <div
          class="al-dg-filter-field__set al-data-grid__set-filter"
          data-testid="al-dg-set-filter"
          (focusout)="onSetFocusOut($event)"
        >
          <button
            type="button"
            class="al-dg-filter-field__set-trigger al-dg-filter-field__primary"
            [attr.tabindex]="floatingTabIndex()"
            aria-haspopup="dialog"
            [attr.aria-expanded]="setOpen()"
            [attr.aria-label]="ariaLabel() + ': ' + setSummary()"
            (click)="toggleSetPopup()"
            (keydown)="onSetKeydown($event)"
            data-testid="al-dg-set-filter-trigger"
          >
            <span class="al-dg-filter-field__set-summary">{{ setSummary() }}</span>
            <span aria-hidden="true">▾</span>
          </button>
          @if (setOpen()) {
            <div
              class="al-dg-filter-field__popup al-data-grid__set-filter-list"
              role="dialog"
              [attr.aria-label]="ariaLabel() || null"
              (keydown)="onSetKeydown($event)"
              data-testid="al-dg-set-filter-popup"
            >
              <ng-container *ngTemplateOutlet="setList" />
            </div>
          }
        </div>
      }
    } @else if (conditionKind(); as ck) {
      <div
        class="al-dg-filter-field__conditions"
        [class.al-dg-filter-field__conditions--panel]="variant() === 'panel'"
      >
        <ng-container *ngTemplateOutlet="condition; context: { $implicit: 0, ck: ck }" />
        @if (variant() === 'panel' && conditionActive(0)) {
          <div class="al-dg-filter-field__join" role="radiogroup" [attr.aria-label]="ariaLabel() || null">
            @for (j of joins; track j) {
              <label class="al-dg-filter-field__join-opt">
                <input
                  type="radio"
                  [name]="radioName"
                  [checked]="draft().join === j"
                  (change)="onJoin(j)"
                  [attr.data-testid]="'al-dg-filter-join-' + j"
                />
                {{ j === 'and' ? labels().filterJoinAnd : labels().filterJoinOr }}
              </label>
            }
          </div>
          <ng-container *ngTemplateOutlet="condition; context: { $implicit: 1, ck: ck }" />
        }
      </div>
    } @else if (kind() === 'custom' && variant() === 'panel') {
      <span class="al-dg-filter-field__hint">{{ labels().filterCustom }}</span>
    }

    <ng-template #condition let-i let-ck="ck">
      @let c = draft().conditions[i];
      <div class="al-dg-filter-field__row" [attr.data-testid]="'al-dg-filter-condition-' + i">
        @if (variant() === 'floating') {
          <span class="al-dg-filter-field__op" [attr.title]="opLabel(c.op)">
            <span class="al-dg-filter-field__op-symbol" aria-hidden="true">{{ opSymbol(c.op) }}</span>
            <select
              [attr.tabindex]="floatingTabIndex()"
              [value]="c.op"
              (change)="onOp(i, $any($event.target).value)"
              [attr.aria-label]="labels().filterOperatorAriaLabel + ' ' + ariaLabel()"
              data-testid="al-dg-filter-field-op"
            >
              @for (op of ops(); track op) {
                <option [value]="op" [selected]="op === c.op">{{ opLabel(op) }}</option>
              }
            </select>
          </span>
        } @else {
          <select
            class="al-dg-filter-field__input al-dg-filter-field__op-select"
            [value]="c.op"
            (change)="onOp(i, $any($event.target).value)"
            [attr.aria-label]="labels().filterOperatorAriaLabel + ' ' + ariaLabel()"
            data-testid="al-dg-filter-field-op"
          >
            @for (op of ops(); track op) {
              <option [value]="op" [selected]="op === c.op">{{ opLabel(op) }}</option>
            }
          </select>
        }
      </div>
      @if (!isValueless(c.op)) {
        <div class="al-dg-filter-field__row al-dg-filter-field__values">
          @if (ck === 'date') {
            <input
              class="al-dg-filter-field__input"
              [class.al-dg-filter-field__primary]="i === 0"
              [class.al-data-grid__filter-input]="variant() === 'floating'"
              [attr.tabindex]="floatingTabIndex()"
              type="date"
              [value]="c.text"
              (change)="onDate(i, 'text', $any($event.target).value)"
              [attr.aria-label]="(c.op === 'inRange' ? labels().filterFrom + ' ' : '') + ariaLabel()"
              data-testid="al-dg-filter-field-date"
            />
            @if (c.op === 'inRange') {
              <input
                class="al-dg-filter-field__input"
                [class.al-data-grid__filter-input]="variant() === 'floating'"
                [attr.tabindex]="floatingTabIndex()"
                type="date"
                [value]="c.textTo"
                (change)="onDate(i, 'textTo', $any($event.target).value)"
                [attr.aria-label]="labels().filterTo + ' ' + ariaLabel()"
                data-testid="al-dg-filter-field-date-to"
              />
            }
          } @else {
            <input
              class="al-dg-filter-field__input"
              [class.al-dg-filter-field__primary]="i === 0"
              [class.al-data-grid__filter-input]="variant() === 'floating'"
              [attr.tabindex]="floatingTabIndex()"
              [type]="ck === 'number' ? 'text' : 'search'"
              [attr.inputmode]="ck === 'number' ? 'decimal' : null"
              [value]="c.text"
              (input)="onText(i, 'text', $any($event.target).value)"
              (keydown.enter)="flush()"
              (blur)="flush()"
              [attr.aria-label]="(splitRange(c.op) ? labels().filterFrom + ' ' : '') + ariaLabel()"
              [attr.aria-invalid]="invalid()[i] || null"
              [attr.title]="invalid()[i] ? labels().filterInvalidNumber : null"
              [placeholder]="ck === 'number' && !splitRange(c.op) ? labels().filterNumberPlaceholder : labels().filterPlaceholder"
              [attr.data-testid]="i === 0 ? 'al-dg-filter-field-text' : 'al-dg-filter-field-text-' + i"
            />
            @if (splitRange(c.op)) {
              <input
                class="al-dg-filter-field__input"
                [attr.tabindex]="floatingTabIndex()"
                type="text"
                inputmode="decimal"
                [value]="c.textTo"
                (input)="onText(i, 'textTo', $any($event.target).value)"
                (keydown.enter)="flush()"
                (blur)="flush()"
                [attr.aria-label]="labels().filterTo + ' ' + ariaLabel()"
                [placeholder]="labels().filterTo"
                data-testid="al-dg-filter-field-text-to"
              />
            }
          }
        </div>
      }
    </ng-template>

    <ng-template #setList>
      <div class="al-dg-filter-field__set-body">
        <input
          #setSearch
          class="al-dg-filter-field__input"
          type="search"
          [value]="setSearchText()"
          (input)="setSearchText.set($any($event.target).value)"
          [placeholder]="labels().filterSetSearch"
          [attr.aria-label]="labels().filterSetSearch + ' ' + ariaLabel()"
          data-testid="al-dg-set-filter-search"
        />
        <div class="al-dg-filter-field__set-list" data-testid="al-dg-set-filter-list">
          @if (visibleSetOptions().length) {
            <label class="al-dg-filter-field__set-item al-dg-filter-field__set-item--all al-data-grid__set-filter-item">
              <input
                type="checkbox"
                [checked]="setAllState() === 'all'"
                [indeterminate]="setAllState() === 'some'"
                (change)="toggleSetAll()"
                data-testid="al-dg-set-filter-select-all"
              />
              <span>{{ labels().filterSetSelectAll }}</span>
            </label>
          }
          @for (opt of visibleSetOptions(); track opt.key) {
            <label class="al-dg-filter-field__set-item al-data-grid__set-filter-item">
              <input
                type="checkbox"
                [checked]="isSetSelected(opt.key)"
                (change)="toggleSet(opt.key, $any($event.target).checked)"
              />
              <span>{{ opt.key === null ? labels().filterSetBlanks : opt.label }}</span>
            </label>
          } @empty {
            <span class="al-dg-filter-field__hint">{{ labels().filterNoValues }}</span>
          }
        </div>
        @if (setOptionList().truncated) {
          <span class="al-dg-filter-field__hint" data-testid="al-dg-set-filter-truncated">
            {{ labels().filterSetTruncated.replace('{count}', '' + setOptionList().options.length) }}
          </span>
        }
      </div>
    </ng-template>
  `,
  imports: [NgTemplateOutlet],
  styles: `
    :host {
      display: block;
      width: 100%;
      min-width: 0;
      box-sizing: border-box;
      position: relative;
    }
    .al-dg-filter-field__row {
      display: flex;
      gap: 4px;
      align-items: center;
      min-width: 0;
    }
    .al-dg-filter-field__conditions {
      display: flex;
      gap: 4px;
      min-width: 0;
    }
    .al-dg-filter-field__conditions--panel {
      flex-direction: column;
      gap: 6px;
    }
    .al-dg-filter-field__values {
      flex: 1 1 auto;
    }
    .al-dg-filter-field__input {
      display: block;
      width: 100%;
      min-width: 0;
      box-sizing: border-box;
      border: 1px solid var(--al-dg-border, #babfc7);
      border-radius: 6px;
      padding: 6px 8px;
      font: inherit;
      font-size: 12px;
      color: var(--al-dg-fg, #181d1f);
      background: var(--al-dg-bg, #fff);
    }
    .al-dg-filter-field__input[aria-invalid='true'] {
      border-color: var(--al-dg-danger, #d93025);
    }
    .al-dg-filter-field__op {
      position: relative;
      flex: 0 0 auto;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 22px;
      height: 100%;
      font-size: 11px;
      color: var(--al-dg-muted, #5f6368);
      border: 1px solid var(--al-dg-border, #babfc7);
      border-radius: 4px;
      background: var(--al-dg-header-bg, #f8f8f8);
      box-sizing: border-box;
      padding: 0 3px;
    }
    .al-dg-filter-field__op select {
      position: absolute;
      inset: 0;
      width: 100%;
      opacity: 0;
      cursor: pointer;
    }
    .al-dg-filter-field__op:focus-within {
      outline: 2px solid var(--al-dg-accent, #2196f3);
    }
    .al-dg-filter-field__join {
      display: flex;
      gap: 12px;
      font-size: 12px;
    }
    .al-dg-filter-field__join-opt {
      display: inline-flex;
      gap: 4px;
      align-items: center;
    }
    .al-dg-filter-field__clear {
      flex: 0 0 auto;
      border: 0;
      background: transparent;
      cursor: pointer;
      color: var(--al-dg-muted, #5f6368);
      font: inherit;
      padding: 0 4px;
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
    .al-dg-filter-field__set-trigger {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 4px;
      width: 100%;
      box-sizing: border-box;
      cursor: pointer;
      padding: 2px 6px;
      font: inherit;
      font-size: 12px;
      color: var(--al-dg-fg, #181d1f);
      border: 1px solid var(--al-dg-border, #babfc7);
      border-radius: 4px;
      background: var(--al-dg-bg, #fff);
    }
    .al-dg-filter-field__set-summary {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .al-dg-filter-field__set-body {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .al-dg-filter-field__set-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
      max-height: 180px;
      overflow: auto;
    }
    .al-dg-filter-field__popup {
      position: absolute;
      z-index: 20;
      left: 0;
      top: 100%;
      min-width: max(100%, 180px);
      width: max-content;
      max-width: 320px;
      margin-top: 4px;
      padding: 6px;
      border: 1px solid var(--al-dg-border, #babfc7);
      border-radius: 6px;
      background: var(--al-dg-bg, #fff);
      box-shadow: 0 4px 12px color-mix(in srgb, #000 12%, transparent);
      box-sizing: border-box;
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
    .al-dg-filter-field__set-item--all {
      font-weight: 600;
    }
  `,
})
export class DataGridFilterField {
  private readonly hostEl = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);

  /** Accept any row type — filter UI only reads filter/type metadata. */
  readonly column = input.required<ResolvedColumn<any>>();
  /** Current model for this column (`null` = no filter). */
  readonly model = input<ColumnFilterModel | null | undefined>(null);
  /** Lazy set-filter options — only read while the list is shown. */
  readonly setOptions = input<() => SetFilterOptions>(() => EMPTY_SET_FILTER_OPTIONS);
  /** Accessible name, including the column header. */
  readonly ariaLabel = input('');
  /** `floating` = compact header control; `panel` = full editor (2 conditions, inline set list). */
  readonly variant = input<'floating' | 'panel'>('floating');
  readonly locale = input<DataGridLocale | null>(null);
  /** Debounce for typed text (ms, `0` = per keystroke). */
  readonly debounceMs = input(DEFAULT_FILTER_DEBOUNCE_MS);
  readonly modelChange = output<ColumnFilterModel | null>();

  readonly joins: readonly FilterJoin[] = ['and', 'or'];
  readonly radioName = `al-dg-filter-join-${nextFieldId++}`;

  readonly labels = computed(() => this.locale() ?? defaultGridLocale);
  readonly floatingTabIndex = computed(() => (this.variant() === 'floating' ? -1 : null));
  readonly kind = computed(() => resolveFilterKind(this.column()));
  readonly conditionKind = computed((): ConditionKind | null => {
    const kind = this.kind();
    return kind === 'text' || kind === 'number' || kind === 'date' ? kind : null;
  });
  readonly ops = computed(() => OPS[this.conditionKind() ?? 'text']);

  /** Model the built-in control can't edit (other kind, 2 conditions in a floating cell, custom). */
  readonly summaryOnly = computed(() => {
    const model = this.model();
    const kind = this.kind();
    if (!model) {
      return false;
    }
    if (model.kind !== kind || kind === 'custom') {
      return true;
    }
    return (
      this.variant() === 'floating' &&
      'conditions' in model &&
      model.conditions.length > 1
    );
  });

  readonly summary = computed(() => describeFilterModel(this.model() ?? null, this.labels()));

  /** Last model this field emitted — its echo must not reset the local draft. */
  private lastEmitted: ColumnFilterModel | null | undefined = undefined;
  private readonly debouncer = new InputDebouncer<void>(
    () => this.emitDraft(),
    () => this.debounceMs(),
  );

  readonly draft = linkedSignal<
    { model: ColumnFilterModel | null | undefined; kind: ConditionKind | null },
    FilterDraft
  >({
    source: () => ({ model: this.model(), kind: this.conditionKind() }),
    computation: (src, previous) => {
      if (previous && this.lastEmitted !== undefined && sameFilterModel(src.model ?? null, this.lastEmitted)) {
        return previous.value;
      }
      // External change (API / clear all / state restore) wins over a pending edit.
      this.lastEmitted = undefined;
      this.debouncer.cancel();
      return draftFromModel(src.model ?? null, src.kind ?? 'text', this.variant(), this.labels().numberLocale);
    },
  });

  /** Per-condition "text did not parse" flags (number shorthand). */
  readonly invalid = computed((): [boolean, boolean] => {
    const kind = this.conditionKind();
    const d = this.draft();
    return [0, 1].map(
      (i) => kind === 'number' && numberCondition(d.conditions[i]!, this.labels().numberLocale) === 'invalid',
    ) as [boolean, boolean];
  });

  // --- set filter ---------------------------------------------------------

  readonly setOpen = signal(false);
  readonly setSearchText = signal('');
  readonly setOptionList = computed((): SetFilterOptions =>
    this.kind() === 'set' && (this.variant() === 'panel' || this.setOpen())
      ? this.setOptions()()
      : EMPTY_SET_FILTER_OPTIONS,
  );
  private readonly selectedSet = computed((): ReadonlySet<string | null> | null => {
    const model = this.model();
    return model?.kind === 'set' ? new Set(model.values) : null;
  });
  readonly visibleSetOptions = computed(() => {
    const needle = this.setSearchText().trim().toLowerCase();
    const options = this.setOptionList().options;
    if (!needle) {
      return options;
    }
    const blanks = this.labels().filterSetBlanks.toLowerCase();
    return options.filter((o) => (o.key === null ? blanks : o.label.toLowerCase()).includes(needle));
  });
  readonly setAllState = computed((): 'all' | 'some' | 'none' => {
    const visible = this.visibleSetOptions();
    const checked = visible.filter((o) => this.isSetSelected(o.key)).length;
    return checked === 0 ? 'none' : checked === visible.length ? 'all' : 'some';
  });
  readonly setSummary = computed(() => {
    const labels = this.labels();
    const selected = this.selectedSet();
    if (!selected) {
      return labels.filterSetAll;
    }
    if (!selected.size) {
      return labels.filterSetNone;
    }
    return labels.filterSetSelected.replace('{count}', String(selected.size));
  });

  private readonly onDocPointerDown = (event: Event): void => {
    const target = event.target as Node | null;
    if (target && !this.hostEl.nativeElement.contains(target)) {
      this.closeSetPopup(false);
    }
  };

  readonly booleanValue = computed(() => {
    const model = this.model();
    return model?.kind === 'boolean' ? String(model.value) : '';
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      // Outputs are already torn down here — drop a pending keystroke.
      this.debouncer.cancel();
      this.document.removeEventListener('pointerdown', this.onDocPointerDown, true);
    });
  }

  opLabel(op: string): string {
    const key = OP_LABEL_KEY[op];
    return key ? String(this.labels()[key] ?? op) : op;
  }

  opSymbol(op: string): string {
    return FILTER_OP_SYMBOLS[op] ?? op;
  }

  isValueless(op: string): boolean {
    return isValuelessOp(op);
  }

  /** Number `inRange` in the panel uses separate from / to inputs. */
  splitRange(op: string): boolean {
    return op === 'inRange' && this.variant() === 'panel' && this.conditionKind() === 'number';
  }

  conditionActive(index: number): boolean {
    const c = this.draft().conditions[index]!;
    return isValuelessOp(c.op) || c.text.trim() !== '' || c.textTo.trim() !== '';
  }

  onText(index: number, field: 'text' | 'textTo', value: string): void {
    this.patch(index, (c) => {
      const next = { ...c, [field]: value };
      // Typed shorthand (`>100`, `10..20`) drives the operator dropdown.
      if (this.conditionKind() === 'number' && field === 'text' && hasNumberShorthand(value)) {
        const parsed = parseNumberFilterInput(value, c.op as NumberFilterOp, this.labels().numberLocale);
        if (parsed.ok && parsed.condition) {
          next.op = parsed.condition.op;
        }
      }
      return next;
    });
    this.debouncer.push();
  }

  onOp(index: number, op: string): void {
    this.patch(index, (c) => {
      let text = c.text;
      if (this.conditionKind() === 'number' && hasNumberShorthand(text)) {
        // Explicit operator wins: keep only the operand(s) of the typed shorthand.
        const parsed = parseNumberFilterInput(text, c.op as NumberFilterOp, this.labels().numberLocale);
        if (parsed.ok && parsed.condition) {
          const cond: NumberFilterCondition =
            op === 'inRange' ? parsed.condition : { op: op as NumberFilterOp, value: parsed.condition.value };
          text = formatNumberFilterInput(cond, this.labels().numberLocale);
        }
      }
      return { ...c, op, text };
    });
    this.flushNow();
  }

  onDate(index: number, field: 'text' | 'textTo', value: string): void {
    this.patch(index, (c) => ({ ...c, [field]: value }));
    this.flushNow();
  }

  onJoin(join: FilterJoin): void {
    this.draft.update((d) => ({ ...d, join }));
    this.flushNow();
  }

  onBoolean(value: string): void {
    this.emit(value === '' ? null : { kind: 'boolean', value: value === 'true' });
  }

  /** Emit a pending typed edit now (Enter / blur). */
  flush(): void {
    this.debouncer.flush();
  }

  emit(model: ColumnFilterModel | null): void {
    const next = normalizeFilterModel(model);
    this.lastEmitted = next;
    if (!sameFilterModel(next, this.model() ?? null)) {
      this.modelChange.emit(next);
    }
  }

  private flushNow(): void {
    this.debouncer.cancel();
    this.emitDraft();
  }

  private patch(index: number, fn: (c: ConditionDraft) => ConditionDraft): void {
    this.draft.update((d) => {
      const conditions = [...d.conditions] as [ConditionDraft, ConditionDraft];
      conditions[index] = fn(conditions[index]!);
      return { ...d, conditions };
    });
  }

  private emitDraft(): void {
    const kind = this.conditionKind();
    if (!kind) {
      return;
    }
    this.emit(modelFromDraft(this.draft(), kind, this.labels().numberLocale));
  }

  // --- set filter ---------------------------------------------------------

  isSetSelected(key: string | null): boolean {
    const selected = this.selectedSet();
    return !selected || selected.has(key);
  }

  toggleSet(key: string | null, checked: boolean): void {
    const next = this.currentSelection();
    if (checked) {
      next.add(key);
    } else {
      next.delete(key);
    }
    this.emitSet(next);
  }

  toggleSetAll(): void {
    const visible = this.visibleSetOptions().map((o) => o.key);
    const selectAll = this.setAllState() !== 'all';
    if (!this.setSearchText().trim()) {
      this.emit(selectAll ? null : { kind: 'set', values: [] });
      return;
    }
    const next = this.currentSelection();
    for (const key of visible) {
      if (selectAll) {
        next.add(key);
      } else {
        next.delete(key);
      }
    }
    this.emitSet(next);
  }

  toggleSetPopup(): void {
    if (this.setOpen()) {
      this.closeSetPopup(false);
      return;
    }
    this.setOpen.set(true);
    this.document.addEventListener('pointerdown', this.onDocPointerDown, true);
    afterNextRender(
      () => {
        this.hostEl.nativeElement
          .querySelector<HTMLInputElement>('[data-testid="al-dg-set-filter-search"]')
          ?.focus({ preventScroll: true });
      },
      { injector: this.injector },
    );
  }

  onSetKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.setOpen()) {
      event.preventDefault();
      event.stopPropagation();
      this.closeSetPopup(true);
    } else if (this.setOpen() && event.key !== 'Tab') {
      // Keep arrows / space / Enter inside the popup away from grid navigation.
      event.stopPropagation();
    }
  }

  onSetFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;
    if (next && !this.hostEl.nativeElement.contains(next)) {
      this.closeSetPopup(false);
    }
  }

  private closeSetPopup(restoreFocus: boolean): void {
    if (!this.setOpen()) {
      return;
    }
    this.setOpen.set(false);
    this.setSearchText.set('');
    this.document.removeEventListener('pointerdown', this.onDocPointerDown, true);
    if (restoreFocus) {
      this.hostEl.nativeElement
        .querySelector<HTMLElement>('[data-testid="al-dg-set-filter-trigger"]')
        ?.focus({ preventScroll: true });
    }
  }

  private currentSelection(): Set<string | null> {
    const selected = this.selectedSet();
    return new Set(selected ?? this.setOptionList().options.map((o) => o.key));
  }

  private emitSet(next: Set<string | null>): void {
    const { options, truncated } = this.setOptionList();
    const everything = !truncated && options.every((o) => next.has(o.key));
    this.emit(everything ? null : { kind: 'set', values: [...next] });
  }
}

let nextFieldId = 0;

function draftFromModel(
  model: ColumnFilterModel | null,
  kind: ConditionKind,
  variant: 'floating' | 'panel',
  numberLocale: string | undefined,
): FilterDraft {
  const conditions: [ConditionDraft, ConditionDraft] = [emptyCondition(kind), emptyCondition(kind)];
  if (!model || model.kind !== kind) {
    return { conditions, join: 'and' };
  }
  model.conditions.slice(0, 2).forEach((c, i) => {
    if (model.kind === 'number') {
      const nc = c as NumberFilterCondition;
      const split = nc.op === 'inRange' && variant === 'panel';
      conditions[i] = {
        op: nc.op,
        text: split
          ? formatNumberFilterInput({ op: 'equals', value: nc.value }, numberLocale)
          : formatNumberFilterInput(nc, numberLocale),
        textTo: split ? formatNumberFilterInput({ op: 'equals', value: nc.valueTo }, numberLocale) : '',
      };
    } else {
      const cc = c as { op: string; value?: string; valueTo?: string };
      conditions[i] = { op: cc.op, text: cc.value ?? '', textTo: cc.valueTo ?? '' };
    }
  });
  return { conditions, join: model.join ?? 'and' };
}

/** One number condition from draft text — `null` when empty, `'invalid'` when unparseable. */
function numberCondition(
  c: ConditionDraft,
  numberLocale: string | undefined,
): NumberFilterCondition | null | 'invalid' {
  if (isValuelessOp(c.op)) {
    return { op: c.op as NumberFilterOp };
  }
  const main = parseNumberFilterInput(c.text, c.op as NumberFilterOp, numberLocale);
  if (!main.ok) {
    return 'invalid';
  }
  if (c.op !== 'inRange' || main.condition?.op === 'inRange') {
    return main.condition;
  }
  // `inRange` with plain operands (panel from / to, or one floating number):
  // either bound alone is a half-open range.
  const to = parseNumberFilterInput(c.textTo, 'equals', numberLocale);
  if (!to.ok) {
    return 'invalid';
  }
  const from = main.condition?.value;
  const upper = to.condition?.value;
  if (from != null && upper != null) {
    return { op: 'inRange', value: Math.min(from, upper), valueTo: Math.max(from, upper) };
  }
  if (from != null) {
    return { op: 'greaterThanOrEqual', value: from };
  }
  return upper != null ? { op: 'lessThanOrEqual', value: upper } : null;
}

function modelFromDraft(
  draft: FilterDraft,
  kind: ConditionKind,
  numberLocale: string | undefined,
): ColumnFilterModel | null {
  const join = draft.join;
  if (kind === 'text') {
    return {
      kind,
      join,
      conditions: draft.conditions.map((c) => ({
        op: c.op as never,
        ...(isValuelessOp(c.op) ? {} : { value: c.text }),
      })),
    };
  }
  if (kind === 'number') {
    const conditions = draft.conditions
      .map((c) => numberCondition(c, numberLocale))
      .filter((c): c is NumberFilterCondition => !!c && c !== 'invalid');
    return { kind, join, conditions };
  }
  return {
    kind,
    join,
    conditions: draft.conditions
      .filter((c) => isValuelessOp(c.op) || (isDateKey(c.text) && (c.op !== 'inRange' || isDateKey(c.textTo))))
      .map((c) => ({
        op: c.op as never,
        ...(isValuelessOp(c.op) ? {} : { value: c.text }),
        ...(c.op === 'inRange' ? { valueTo: c.textTo } : {}),
      })),
  };
}

/** Short human-readable description of a model (read-only floating summary, tooltips). */
export function describeFilterModel(model: ColumnFilterModel | null, labels: DataGridLocale): string {
  if (!model) {
    return '';
  }
  switch (model.kind) {
    case 'set':
      return model.values.length
        ? labels.filterSetSelected.replace('{count}', String(model.values.length))
        : labels.filterSetNone;
    case 'boolean':
      return model.value ? labels.filterTrue : labels.filterFalse;
    case 'custom':
      return labels.filterCustom;
    default: {
      const join = model.join === 'or' ? labels.filterJoinOr : labels.filterJoinAnd;
      return (model.conditions as { op: string; value?: unknown; valueTo?: unknown }[])
        .map((c) => {
          const key = OP_LABEL_KEY[c.op];
          const op = key ? String(labels[key]) : c.op;
          if (isValuelessOp(c.op)) {
            return op;
          }
          return c.op === 'inRange' ? `${op} ${c.value}–${c.valueTo}` : `${op} ${c.value}`;
        })
        .join(` ${join} `);
    }
  }
}
