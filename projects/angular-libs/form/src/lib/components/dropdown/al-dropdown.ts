import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  input,
  linkedSignal,
  output,
  signal,
  viewChild,
} from '@angular/core';
import type {
  FormDropdownColumn,
  FormDropdownDatasource,
  FormSelectCreatableOptions,
  FormSelectTreeOptions,
} from '../../types';
import type { AlDropdownApi } from './dropdown-api';
import { createItemFromTerm, createRowLabel, getCreateEligibility } from './create';
import { createDatasourceController, type DatasourceController } from './datasource';
import {
  type DropdownItem,
  formatItemLabel,
  getChildrenOf,
  getItemKey,
  getPropByPath,
  highlightSearchParts,
  resolveCreatable,
  resolveTree,
} from './dropdown-utils';
import { firstFocusableIndex, moveFocusIndex } from './keyboard';
import {
  applyGrouping,
  filterItemsBySearch,
  groupHeaderLabel,
  isGroupHeader,
} from './search';
import {
  collectDescendantKeys,
  flattenVisibleTree,
  initialExpandedIds,
  type FlatTreeNode,
} from './tree';

let nextAnchorId = 0;

export interface AlDropdownValueChange {
  /** Selected display rows (always objects). */
  rows: DropdownItem[];
  /** Ids derived from valueKey. */
  ids: unknown[];
}

/**
 * Reusable Popover-API dropdown (no CDK).
 * Use standalone or via `AlSelectField` inside Signal Forms.
 */
@Component({
  selector: 'al-dropdown',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    // Standalone: panel anchors to this host. Inside forms, parent passes `panelAnchor` instead.
    '[style.anchor-name]': 'hostAnchorName()',
  },
  template: `
    <div
      class="al-dropdown"
      [class.al-dropdown--disabled]="disabled()"
      [class.al-dropdown--readonly]="readonly()"
      [class.al-dropdown--open]="open()">
      <div
        #inputRef
        class="al-dropdown__trigger"
        [attr.id]="id() || null"
        role="combobox"
        [attr.aria-expanded]="open()"
        [attr.aria-controls]="listboxId"
        [attr.aria-haspopup]="treeCfg().enabled ? 'tree' : 'listbox'"
        [attr.aria-activedescendant]="activeDescendantId()"
        [attr.aria-disabled]="disabled() || null"
        [attr.tabindex]="disabled() ? -1 : 0"
        (click)="onTriggerClick($event)"
        (keydown)="onTriggerKeydown($event)">
        <div class="al-dropdown__value">
          @if (multiple() && selectedRows().length) {
            <div class="al-dropdown__chips">
              @for (chip of visibleChips(); track trackRow($index, chip)) {
                <span class="al-dropdown__chip">
                  {{ formatLabel(chip) }}
                  @if (!disabled() && !readonly()) {
                    <button
                      type="button"
                      class="al-dropdown__chip-remove"
                      aria-label="Remove"
                      (click)="removeChip($event, chip)">
                      ×
                    </button>
                  }
                </span>
              }
              @if (overflowChipCount() > 0) {
                <span class="al-dropdown__chip al-dropdown__chip--overflow"
                  >+{{ overflowChipCount() }}</span
                >
              }
            </div>
          } @else if (!multiple() && selectedRows().length && !searchTerm()) {
            <span class="al-dropdown__single-label">{{ formatLabel(selectedRows()[0]) }}</span>
          } @else if (!searchTerm() && !selectedRows().length) {
            <span class="al-dropdown__placeholder">{{ placeholder() }}</span>
          }
          @if (searchable() && !disabled() && !readonly()) {
            <input
              #searchRef
              class="al-dropdown__search"
              type="text"
              autocomplete="off"
              [attr.aria-autocomplete]="'list'"
              [attr.aria-controls]="listboxId"
              [placeholder]="selectedRows().length && !multiple() ? '' : ''"
              [value]="searchTerm()"
              (input)="onSearchInput($event)"
              (keydown)="onSearchKeydown($event)"
              (click)="$event.stopPropagation(); ensureOpen()" />
          }
        </div>
        @if (loading()) {
          <span class="al-dropdown__spinner" aria-hidden="true"></span>
        }
        <span class="al-dropdown__chevron" aria-hidden="true">
          <svg viewBox="0 0 16 16" width="16" height="16" focusable="false">
            <path
              fill="currentColor"
              d="M4.2 6.2a.75.75 0 0 1 1.06 0L8 8.94l2.74-2.74a.75.75 0 1 1 1.06 1.06l-3.27 3.27a.75.75 0 0 1-1.06 0L4.2 7.26a.75.75 0 0 1 0-1.06z" />
          </svg>
        </span>
        <ng-content select="[alDropdownAction]" />
      </div>

      <div
        #panelRef
        class="al-dropdown__panel"
        popover="auto"
        [style.position-anchor]="effectiveAnchor()"
        [style.max-height.px]="panelMaxHeight()"
        (toggle)="onPopoverToggle($event)">
        @if (showHeaders() && columns()?.length && !treeCfg().enabled) {
          <div class="al-dropdown__header-row" role="row">
            @if (enableCheckboxes() && multiple()) {
              <div class="al-dropdown__cell al-dropdown__cell--check">
                <input
                  type="checkbox"
                  [checked]="allFilteredSelected()"
                  [indeterminate]="someFilteredSelected() && !allFilteredSelected()"
                  (change)="toggleSelectAll($event)"
                  [attr.aria-label]="selectAllText()" />
              </div>
            }
            @for (col of visibleColumns(); track col.field ?? col.header ?? $index) {
              <div class="al-dropdown__cell al-dropdown__header" [style.width]="colWidth(col)">
                {{ col.header || col.field }}
              </div>
            }
          </div>
        } @else if (enableCheckboxes() && multiple() && !treeCfg().enabled) {
          <div class="al-dropdown__select-all">
            <label>
              <input
                type="checkbox"
                [checked]="allFilteredSelected()"
                [indeterminate]="someFilteredSelected() && !allFilteredSelected()"
                (change)="toggleSelectAll($event)" />
              {{ selectAllText() }}
            </label>
          </div>
        }

        <div
          [attr.id]="listboxId"
          [attr.role]="treeCfg().enabled ? 'tree' : 'listbox'"
          [attr.aria-multiselectable]="multiple() || null"
          class="al-dropdown__list"
          (scroll)="onPanelScroll($event)">
          @if (loading() && !panelRows().length) {
            <div class="al-dropdown__status">{{ loadingText() }}</div>
          } @else if (error()) {
            <div class="al-dropdown__status al-dropdown__status--error">{{ error() }}</div>
          } @else if (!panelRows().length && !createEligibility().show) {
            <div class="al-dropdown__status">{{ noItemsText() }}</div>
          } @else {
            @if (createEligibility().show) {
              <div
                [attr.id]="optionId(-1)"
                class="al-dropdown__option al-dropdown__option--create"
                [class.al-dropdown__option--focused]="focusedIndex() === -1"
                role="option"
                (click)="commitCreate()"
                (mouseenter)="focusedIndex.set(-1)">
                {{ createRowLabel(createEligibility().term) }}
              </div>
            }
            @for (row of panelRows(); track trackPanelRow($index, row); let i = $index) {
              @if (row.kind === 'group') {
                <div class="al-dropdown__group-header" role="presentation">
                  {{ row.label }}
                </div>
              } @else {
                <div
                  [attr.id]="optionId(i)"
                  class="al-dropdown__option"
                  [class.al-dropdown__option--selected]="row.selected"
                  [class.al-dropdown__option--focused]="focusedIndex() === i"
                  [class.al-dropdown__option--disabled]="row.disabled"
                  [style.padding-inline-start.px]="12 + row.depth * 16"
                  [attr.role]="treeCfg().enabled ? 'treeitem' : 'option'"
                  [attr.aria-selected]="row.selected"
                  [attr.aria-expanded]="row.hasChildren ? row.expanded : null"
                  [attr.aria-disabled]="row.disabled || null"
                  [attr.aria-level]="treeCfg().enabled ? row.depth + 1 : null"
                  (click)="onOptionClick($event, row, i)"
                  (mouseenter)="focusedIndex.set(i)">
                  @if (treeCfg().enabled && row.hasChildren) {
                    <button
                      type="button"
                      class="al-dropdown__expand"
                      [attr.aria-label]="row.expanded ? 'Collapse' : 'Expand'"
                      (click)="toggleExpand($event, row.key)">
                      {{ row.expanded ? '▾' : '▸' }}
                    </button>
                  }
                  @if (enableCheckboxes() && multiple() && !row.disabled) {
                    <input
                      type="checkbox"
                      class="al-dropdown__check"
                      [checked]="row.selected"
                      tabindex="-1"
                      (click)="$event.stopPropagation()"
                      (change)="pickItem(row.item)" />
                  }
                  @if (treeCfg().enabled || !visibleColumns().length) {
                    <span class="al-dropdown__option-label">
                      @for (part of row.labelParts; track $index) {
                        @if (part.hit) {
                          <mark>{{ part.text }}</mark>
                        } @else {
                          {{ part.text }}
                        }
                      }
                    </span>
                  } @else {
                    @for (col of visibleColumns(); track col.field ?? col.header ?? $index) {
                      <span class="al-dropdown__cell" [style.width]="colWidth(col)">
                        @for (part of cellParts(row.item, col); track $index) {
                          @if (part.hit) {
                            <mark>{{ part.text }}</mark>
                          } @else {
                            {{ part.text }}
                          }
                        }
                      </span>
                    }
                  }
                </div>
              }
            }
          }
        </div>

        @if (footerText()) {
          <button type="button" class="al-dropdown__footer" (click)="footerClick.emit()">
            {{ footerText() }}
          </button>
        }
        <ng-content select="[alDropdownFooter]" />
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
      position: relative;
    }
    /* Embedded in al-control-chrome — chrome owns border + focus ring */
    :host.al-control__control .al-dropdown__trigger,
    :host.al-select-dropdown .al-dropdown__trigger {
      border: 0;
      border-radius: 0;
      padding: 0;
      min-height: 1.5rem;
      background: transparent;
      box-shadow: none;
    }
    :host.al-control__control .al-dropdown__trigger:focus,
    :host.al-control__control .al-dropdown__trigger:focus-visible,
    :host.al-select-dropdown .al-dropdown__trigger:focus,
    :host.al-select-dropdown .al-dropdown__trigger:focus-visible {
      outline: none;
    }
    .al-dropdown {
      width: 100%;
    }
    .al-dropdown__trigger {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      width: 100%;
      box-sizing: border-box;
      min-height: 2rem;
      padding: 0.25rem 0.5rem;
      cursor: pointer;
      border: 1px solid var(--al-form-border, #c4c4c4);
      border-radius: 0.25rem;
      background: #fff;
    }
    .al-dropdown__trigger:focus,
    .al-dropdown__trigger:focus-visible {
      outline: none;
      border-color: var(--al-form-focus, #ea580c);
    }
    .al-dropdown--disabled .al-dropdown__trigger {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .al-dropdown--readonly .al-dropdown__trigger {
      cursor: default;
    }
    .al-dropdown__value {
      flex: 1;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.25rem;
      min-width: 0;
    }
    .al-dropdown__placeholder {
      opacity: 0.55;
    }
    .al-dropdown__search {
      flex: 1;
      min-width: 4rem;
      border: 0;
      outline: none;
      background: transparent;
      font: inherit;
      padding: 0;
    }
    .al-dropdown__chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem;
    }
    .al-dropdown__chip {
      display: inline-flex;
      align-items: center;
      gap: 0.15rem;
      padding: 0.1rem 0.35rem;
      border-radius: 0.25rem;
      background: #e8e8e8;
      font-size: 0.85em;
    }
    .al-dropdown__chip-remove {
      border: 0;
      background: transparent;
      cursor: pointer;
      padding: 0;
      line-height: 1;
      font-size: 1em;
    }
    .al-dropdown__chevron {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      width: 1.25rem;
      height: 1.25rem;
      opacity: 0.7;
      transition: transform 0.15s ease;
    }
    .al-dropdown--open .al-dropdown__chevron {
      transform: rotate(180deg);
    }
    .al-dropdown__spinner {
      width: 0.85rem;
      height: 0.85rem;
      border: 2px solid #ccc;
      border-top-color: #333;
      border-radius: 50%;
      animation: al-dd-spin 0.7s linear infinite;
    }
    @keyframes al-dd-spin {
      to {
        transform: rotate(360deg);
      }
    }
    .al-dropdown--open .al-dropdown__trigger {
      border-bottom-left-radius: 0;
      border-bottom-right-radius: 0;
      border-color: var(--al-form-focus, #ea580c);
      border-bottom-color: var(--al-form-border, #c4c4c4);
    }
    .al-dropdown__panel {
      margin: 0;
      padding: 0;
      border: 1px solid var(--al-form-border, #c4c4c4);
      border-radius: 0.25rem;
      background: #fff;
      box-sizing: border-box;
      overflow: auto;
      left: anchor(left);
      top: anchor(bottom);
      right: auto;
      bottom: auto;
      width: anchor-size(width);
      min-width: anchor-size(width);
    }
    .al-dropdown--open .al-dropdown__panel {
      border-top-left-radius: 0;
      border-top-right-radius: 0;
    }
    .al-dropdown__panel:popover-open {
      display: flex;
      flex-direction: column;
    }
    .al-dropdown__list {
      flex: 1;
      overflow: auto;
    }
    .al-dropdown__option,
    .al-dropdown__status,
    .al-dropdown__group-header,
    .al-dropdown__select-all {
      padding: 0.35rem 0.5rem;
    }
    .al-dropdown__option {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      cursor: pointer;
    }
    .al-dropdown__option--focused,
    .al-dropdown__option:hover {
      background: #f3f3f3;
    }
    .al-dropdown__option--selected {
      font-weight: 600;
    }
    .al-dropdown__option--disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
    .al-dropdown__option--create {
      font-style: italic;
    }
    .al-dropdown__group-header {
      font-size: 0.75em;
      text-transform: uppercase;
      opacity: 0.65;
      cursor: default;
    }
    .al-dropdown__status {
      opacity: 0.7;
    }
    .al-dropdown__status--error {
      opacity: 1;
      color: #b00020;
    }
    .al-dropdown__expand {
      border: 0;
      background: transparent;
      cursor: pointer;
      padding: 0 0.15rem;
      width: 1.25rem;
    }
    .al-dropdown__header-row {
      display: flex;
      border-bottom: 1px solid #ddd;
      font-weight: 600;
      font-size: 0.85em;
      position: sticky;
      top: 0;
      background: #fff;
      z-index: 1;
    }
    .al-dropdown__cell {
      padding: 0.25rem 0.35rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex: 1;
    }
    .al-dropdown__cell--check {
      flex: 0 0 1.5rem;
    }
    .al-dropdown__footer {
      border: 0;
      border-top: 1px solid #ddd;
      background: #fafafa;
      padding: 0.4rem 0.5rem;
      text-align: left;
      cursor: pointer;
      width: 100%;
    }
    .al-dropdown__footer:hover {
      background: #f0f0f0;
    }
    mark {
      background: #ffe58a;
      color: inherit;
      padding: 0;
    }
  `,
})
export class AlDropdown {
  readonly id = input<string | undefined>(undefined);
  /**
   * CSS anchor name for the panel (e.g. field host that includes chrome/clear).
   * When omitted, the panel anchors to this component's host.
   */
  readonly panelAnchor = input<string | undefined>(undefined);
  readonly valueKey = input.required<string>();
  readonly labelKeys = input.required<string[]>();
  readonly multiple = input(false);
  readonly items = input<readonly DropdownItem[]>([]);
  readonly loadItems = input<(() => Promise<readonly DropdownItem[]>) | undefined>(undefined);
  readonly datasource = input<FormDropdownDatasource | undefined>(undefined);
  readonly placeholder = input('Select…');
  readonly disabled = input(false);
  readonly readonly = input(false);
  readonly searchable = input(true);
  readonly disableSearchFiltering = input(false);
  readonly groupBy = input<string | ((item: DropdownItem) => string) | undefined>(undefined);
  readonly isRowDisabled = input<((item: DropdownItem) => boolean) | undefined>(undefined);
  readonly columns = input<FormDropdownColumn[] | undefined>(undefined);
  readonly panelMaxHeight = input(240);
  readonly enableCheckboxes = input(false);
  readonly footerText = input<string | undefined>(undefined);
  readonly noItemsText = input('No items');
  readonly loadingText = input('Loading…');
  readonly selectAllText = input('Select all');
  readonly createText = input<string | undefined>(undefined);
  readonly creatable = input<boolean | FormSelectCreatableOptions | undefined>(undefined);
  readonly tree = input<boolean | FormSelectTreeOptions | undefined>(undefined);
  readonly showHeaders = input(false);
  readonly maxVisibleChips = input(3);
  /**
   * Used for creatable S2 safety checks.
   * Prefer `onCreate` when mode is `'id'`.
   */
  readonly valueMode = input<'id' | 'object'>('object');
  /** Controlled selected rows (display objects). */
  readonly value = input<readonly DropdownItem[]>([]);

  readonly valueChange = output<AlDropdownValueChange>();
  readonly footerClick = output<void>();
  readonly openChange = output<boolean>();

  private readonly panelRef = viewChild<ElementRef<HTMLElement>>('panelRef');
  private readonly searchRef = viewChild<ElementRef<HTMLInputElement>>('searchRef');

  private readonly ownAnchor = `--al-dd-${nextAnchorId++}`;
  protected readonly listboxId = `al-dd-list-${nextAnchorId}`;

  /** Anchor the panel uses (external field host or this host). */
  protected readonly effectiveAnchor = computed(() => this.panelAnchor() ?? this.ownAnchor);
  /** Only set host anchor-name when we are the anchor. */
  protected readonly hostAnchorName = computed(() =>
    this.panelAnchor() ? null : this.ownAnchor,
  );

  protected readonly open = signal(false);
  protected readonly searchTerm = signal('');
  protected readonly focusedIndex = signal(-2);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly internalItems = signal<DropdownItem[]>([]);
  protected readonly expandedIds = signal<Set<string>>(new Set());
  protected readonly selectedRows = linkedSignal(() => [...this.value()]);

  private ds: DatasourceController | null = null;
  private staticLoaded = false;

  protected readonly treeCfg = computed(() => resolveTree(this.tree()));
  protected readonly createCfg = computed(() => resolveCreatable(this.creatable()));

  protected readonly effectiveItems = computed(() => {
    const internal = this.internalItems();
    if (internal.length || this.datasource() || this.loadItems()) {
      return internal;
    }
    return [...this.items()];
  });

  protected readonly filteredFlat = computed(() => {
    const tree = this.treeCfg();
    const items = this.effectiveItems();
    const term = this.searchTerm();
    const labelKeys = this.labelKeys();
    if (tree.enabled) {
      return flattenVisibleTree(
        items,
        this.valueKey(),
        this.expandedIds(),
        tree,
        this.disableSearchFiltering() ? '' : term,
        labelKeys,
      );
    }
    const filtered = filterItemsBySearch(
      items,
      term,
      labelKeys,
      this.columns(),
      this.disableSearchFiltering(),
    );
    return filtered.map(
      (item): FlatTreeNode => ({
        item,
        depth: 0,
        hasChildren: false,
        expanded: false,
        key: String(getItemKey(item, this.valueKey())),
      }),
    );
  });

  protected readonly panelRows = computed(() => {
    const tree = this.treeCfg();
    const nodes = this.filteredFlat();
    const selected = new Set(this.selectedRows().map((r) => getItemKey(r, this.valueKey())));
    const isDisabled = this.isRowDisabled();
    const labelKeys = this.labelKeys();
    const term = this.searchTerm();

    if (tree.enabled || !this.groupBy()) {
      return nodes.map((n) => ({
        kind: 'item' as const,
        item: n.item,
        depth: n.depth,
        hasChildren: n.hasChildren,
        expanded: n.expanded,
        key: n.key,
        selected: selected.has(getItemKey(n.item, this.valueKey())),
        disabled: !!isDisabled?.(n.item),
        labelParts: highlightSearchParts(formatItemLabel(n.item, labelKeys), term),
      }));
    }

    const grouped = applyGrouping(
      nodes.map((n) => n.item),
      this.groupBy(),
    );
    const rows: Array<
      | { kind: 'group'; label: string }
      | {
          kind: 'item';
          item: DropdownItem;
          depth: number;
          hasChildren: boolean;
          expanded: boolean;
          key: string;
          selected: boolean;
          disabled: boolean;
          labelParts: Array<{ text: string; hit: boolean }>;
        }
    > = [];
    for (const g of grouped) {
      if (isGroupHeader(g)) {
        rows.push({ kind: 'group', label: groupHeaderLabel(g) });
      } else {
        rows.push({
          kind: 'item',
          item: g,
          depth: 0,
          hasChildren: false,
          expanded: false,
          key: String(getItemKey(g, this.valueKey())),
          selected: selected.has(getItemKey(g, this.valueKey())),
          disabled: !!isDisabled?.(g),
          labelParts: highlightSearchParts(formatItemLabel(g, labelKeys), term),
        });
      }
    }
    return rows;
  });

  protected readonly createEligibility = computed(() =>
    getCreateEligibility(
      this.creatable(),
      this.searchTerm(),
      this.effectiveItems(),
      this.labelKeys(),
      this.valueMode(),
    ),
  );

  protected readonly visibleColumns = computed(() =>
    (this.columns() ?? []).filter((c) => !c.hide),
  );

  protected readonly visibleChips = computed(() =>
    this.selectedRows().slice(0, this.maxVisibleChips()),
  );

  protected readonly overflowChipCount = computed(() =>
    Math.max(0, this.selectedRows().length - this.maxVisibleChips()),
  );

  protected readonly activeDescendantId = computed(() => {
    const i = this.focusedIndex();
    if (i === -1 && this.createEligibility().show) {
      return this.optionId(-1);
    }
    if (i >= 0) {
      return this.optionId(i);
    }
    return null;
  });

  protected readonly navRows = computed(() => {
    const create = this.createEligibility().show
      ? [{ disabled: false, isGroupHeader: false, isCreateRow: true }]
      : [];
    const items = this.panelRows().map((r) =>
      r.kind === 'group'
        ? { disabled: true, isGroupHeader: true, isCreateRow: false }
        : { disabled: r.disabled, isGroupHeader: false, isCreateRow: false },
    );
    return [...create, ...items];
  });

  constructor() {
    effect((onCleanup) => {
      const dsConfig = this.datasource();
      this.ds?.destroy();
      this.ds = null;
      if (dsConfig) {
        this.ds = createDatasourceController(
          dsConfig,
          (items) => this.internalItems.set([...items]),
          (l) => this.loading.set(l),
          (e) => this.error.set(e),
        );
      }
      onCleanup(() => this.ds?.destroy());
    });

    effect(() => {
      if (!this.datasource() && !this.loadItems()) {
        this.internalItems.set([...this.items()]);
      }
    });
  }

  /** Imperative API for hosts. */
  api(): AlDropdownApi {
    return {
      open: () => void this.ensureOpen(),
      close: () => this.closePanel(),
      toggle: () => void this.toggle(),
      isOpen: () => this.open(),
      isLoading: () => this.loading(),
      getItems: () => this.effectiveItems(),
      setItems: (items) => {
        this.internalItems.set([...items]);
        this.staticLoaded = true;
      },
      getValue: () => this.selectedRows(),
      setValue: (rows) => this.emitValue([...rows]),
      selectById: (id) => this.selectByIds([id]),
      selectByIds: (ids) => this.selectByIds(ids),
      reload: () => void this.reload(),
      create: (term) => this.commitCreateWithTerm(term),
      expand: (id) => this.setExpanded(String(id), true),
      collapse: (id) => this.setExpanded(String(id), false),
    };
  }

  protected trackRow = (_: number, row: DropdownItem) => getItemKey(row, this.valueKey());

  protected trackPanelRow = (index: number, row: { kind: string; key?: string; label?: string }) =>
    row.kind === 'group' ? `g-${row.label}` : row.key ?? index;

  protected optionId(index: number): string {
    return `${this.listboxId}-opt-${index}`;
  }

  protected formatLabel(item: DropdownItem): string {
    return formatItemLabel(item, this.labelKeys());
  }

  protected createRowLabel(term: string): string {
    return createRowLabel(term, this.createText());
  }

  protected colWidth(col: FormDropdownColumn): string | null {
    if (col.width == null) {
      return null;
    }
    return typeof col.width === 'number' ? `${col.width}px` : col.width;
  }

  protected cellParts(
    item: DropdownItem,
    col: FormDropdownColumn,
  ): Array<{ text: string; hit: boolean }> {
    let raw: unknown;
    if (col.valueGetter) {
      raw = col.valueGetter(item);
    } else if (col.field) {
      raw = getPropByPath(item, col.field);
    } else {
      raw = '';
    }
    return highlightSearchParts(String(raw ?? ''), this.searchTerm());
  }

  protected async onTriggerClick(event: MouseEvent): Promise<void> {
    if (this.disabled() || this.readonly()) {
      return;
    }
    event.preventDefault();
    await this.toggle();
  }

  protected async toggle(): Promise<void> {
    if (this.open()) {
      this.closePanel();
    } else {
      await this.ensureOpen();
    }
  }

  protected async ensureOpen(): Promise<void> {
    if (this.disabled() || this.readonly()) {
      return;
    }
    await this.ensureItemsLoaded(true);
    const panel = this.panelRef()?.nativeElement;
    if (panel && !panel.matches(':popover-open')) {
      panel.showPopover();
    }
    this.open.set(true);
    this.openChange.emit(true);
    this.initExpanded();
    this.focusedIndex.set(
      this.createEligibility().show ? -1 : firstFocusableIndex(this.navRowsMapped()),
    );
    queueMicrotask(() => this.searchRef()?.nativeElement?.focus());
  }

  protected closePanel(): void {
    this.panelRef()?.nativeElement?.hidePopover();
    this.open.set(false);
    this.openChange.emit(false);
    this.searchTerm.set('');
    this.focusedIndex.set(-2);
  }

  protected onPopoverToggle(event: ToggleEvent): void {
    const next = event.newState === 'open';
    this.open.set(next);
    this.openChange.emit(next);
    if (!next) {
      this.searchTerm.set('');
      if (this.createCfg().createOnBlur && this.createEligibility().show) {
        void this.commitCreate();
      }
    }
  }

  private async ensureItemsLoaded(fromOpen: boolean): Promise<void> {
    if (this.datasource()) {
      if (fromOpen || !this.internalItems().length) {
        this.ds?.reset(this.searchTerm());
      }
      return;
    }
    if (this.items().length) {
      this.internalItems.set([...this.items()]);
      return;
    }
    if (this.staticLoaded && this.internalItems().length) {
      return;
    }
    const loader = this.loadItems();
    if (!loader) {
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    try {
      const list = await loader();
      this.internalItems.set([...list]);
      this.staticLoaded = true;
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to load items');
      this.internalItems.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  private async reload(): Promise<void> {
    this.staticLoaded = false;
    if (this.datasource()) {
      this.ds?.reset(this.searchTerm());
      return;
    }
    await this.ensureItemsLoaded(true);
  }

  private initExpanded(): void {
    const tree = this.treeCfg();
    if (!tree.enabled) {
      return;
    }
    const selected = new Set(this.selectedRows().map((r) => getItemKey(r, this.valueKey())));
    this.expandedIds.set(
      initialExpandedIds(this.effectiveItems(), this.valueKey(), selected, tree),
    );
  }

  protected onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchTerm.set(value);
    const ds = this.datasource();
    if (ds && !ds.searchLocally) {
      this.ds?.reset(value);
    }
    this.focusedIndex.set(
      this.createEligibility().show ? -1 : firstFocusableIndex(this.navRowsMapped()),
    );
  }

  protected onTriggerKeydown(event: KeyboardEvent): void {
    void this.handleKey(event);
  }

  protected onSearchKeydown(event: KeyboardEvent): void {
    void this.handleKey(event);
  }

  private navRowsMapped() {
    return this.panelRows().map((r) =>
      r.kind === 'group'
        ? { disabled: true, isGroupHeader: true }
        : { disabled: r.disabled, isGroupHeader: false },
    );
  }

  private async handleKey(event: KeyboardEvent): Promise<void> {
    if (this.disabled() || this.readonly()) {
      return;
    }
    const key = event.key;
    if (key === 'ArrowDown' || key === 'ArrowUp') {
      event.preventDefault();
      if (!this.open()) {
        await this.ensureOpen();
        return;
      }
      const dir = key === 'ArrowDown' ? 1 : -1;
      const createOffset = this.createEligibility().show ? 1 : 0;
      // Map focusedIndex: -1 = create, 0.. = panel rows
      const nav = this.navRows();
      let logical =
        this.focusedIndex() === -1 ? 0 : this.focusedIndex() + createOffset;
      if (this.focusedIndex() < -1) {
        logical = -1;
      }
      const next = moveFocusIndex(nav, logical, dir);
      if (next < 0) {
        return;
      }
      if (createOffset && next === 0 && nav[0]?.isCreateRow) {
        this.focusedIndex.set(-1);
      } else {
        this.focusedIndex.set(next - createOffset);
      }
      this.scrollFocusedIntoView();
      return;
    }
    if (key === 'Enter') {
      event.preventDefault();
      if (!this.open()) {
        await this.ensureOpen();
        return;
      }
      if (this.focusedIndex() === -1 && this.createEligibility().show) {
        await this.commitCreate();
        return;
      }
      const row = this.panelRows()[this.focusedIndex()];
      if (row && row.kind === 'item' && !row.disabled) {
        this.pickItem(row.item);
      }
      return;
    }
    if (key === 'Escape') {
      if (this.open()) {
        event.preventDefault();
        this.closePanel();
      }
      return;
    }
    if (key === 'Backspace' && this.multiple() && !this.searchTerm() && this.selectedRows().length) {
      event.preventDefault();
      const rows = [...this.selectedRows()];
      rows.pop();
      this.emitValue(rows);
      return;
    }
    if (
      key === ',' &&
      this.multiple() &&
      this.createCfg().enabled &&
      this.createCfg().createOnComma &&
      this.searchTerm().trim()
    ) {
      event.preventDefault();
      await this.commitCreate();
      return;
    }
    if (key === 'ArrowRight' && this.treeCfg().enabled) {
      const row = this.panelRows()[this.focusedIndex()];
      if (row && row.kind === 'item' && row.hasChildren && !row.expanded) {
        event.preventDefault();
        this.setExpanded(row.key, true);
      }
      return;
    }
    if (key === 'ArrowLeft' && this.treeCfg().enabled) {
      const row = this.panelRows()[this.focusedIndex()];
      if (row && row.kind === 'item' && row.hasChildren && row.expanded) {
        event.preventDefault();
        this.setExpanded(row.key, false);
      }
      return;
    }
    if (key.length === 1 && !this.open() && this.searchable()) {
      await this.ensureOpen();
    }
  }

  private scrollFocusedIntoView(): void {
    const id = this.activeDescendantId();
    if (!id) {
      return;
    }
    document.getElementById(id)?.scrollIntoView({ block: 'nearest' });
  }

  protected onOptionClick(event: MouseEvent, row: { item: DropdownItem; disabled: boolean; hasChildren: boolean; key: string }, _index: number): void {
    event.preventDefault();
    if (row.disabled) {
      return;
    }
    this.pickItem(row.item);
  }

  protected toggleExpand(event: Event, key: string): void {
    event.stopPropagation();
    const set = new Set(this.expandedIds());
    if (set.has(key)) {
      set.delete(key);
    } else {
      set.add(key);
    }
    this.expandedIds.set(set);
  }

  private setExpanded(key: string, expanded: boolean): void {
    const set = new Set(this.expandedIds());
    if (expanded) {
      set.add(key);
    } else {
      set.delete(key);
    }
    this.expandedIds.set(set);
  }

  protected pickItem(item: DropdownItem): void {
    const valueKey = this.valueKey();
    const id = getItemKey(item, valueKey);
    const tree = this.treeCfg();

    if (this.multiple()) {
      const current = [...this.selectedRows()];
      const ids = new Set(current.map((r) => getItemKey(r, valueKey)));
      if (ids.has(id)) {
        ids.delete(id);
        if (tree.enabled && tree.selectDescendants) {
          for (const d of collectDescendantKeys(item, valueKey, tree)) {
            ids.delete(d);
          }
        }
      } else {
        ids.add(id);
        if (tree.enabled && tree.selectDescendants) {
          for (const d of collectDescendantKeys(item, valueKey, tree)) {
            ids.add(d);
          }
        }
      }
      // rebuild rows: keep existing that remain, add toggled/descendants from items
      const byId = new Map<unknown, DropdownItem>();
      for (const r of current) {
        byId.set(getItemKey(r, valueKey), r);
      }
      byId.set(id, item);
      this.indexItems(this.effectiveItems(), byId, valueKey);
      const next = [...ids].map((k) => byId.get(k)).filter(Boolean) as DropdownItem[];
      this.emitValue(next);
    } else {
      this.emitValue([item]);
      this.closePanel();
    }
  }

  private indexItems(
    items: readonly DropdownItem[],
    map: Map<unknown, DropdownItem>,
    valueKey: string,
  ): void {
    const tree = this.treeCfg();
    for (const item of items) {
      map.set(getItemKey(item, valueKey), item);
      if (tree.enabled) {
        this.indexItems(getChildrenOf(item, tree), map, valueKey);
      }
    }
  }

  protected removeChip(event: Event, chip: DropdownItem): void {
    event.stopPropagation();
    const id = getItemKey(chip, this.valueKey());
    this.emitValue(this.selectedRows().filter((r) => getItemKey(r, this.valueKey()) !== id));
  }

  protected async commitCreate(): Promise<void> {
    await this.commitCreateWithTerm(this.searchTerm());
  }

  private async commitCreateWithTerm(term: string): Promise<void> {
    const eligibility = getCreateEligibility(
      this.creatable(),
      term,
      this.effectiveItems(),
      this.labelKeys(),
      this.valueMode(),
    );
    if (!eligibility.show) {
      return;
    }
    const item = await createItemFromTerm(
      this.creatable(),
      eligibility.term,
      this.valueKey(),
      this.labelKeys(),
    );
    if (!item) {
      return;
    }
    this.internalItems.update((list) => [...list, item]);
    if (this.multiple()) {
      this.emitValue([...this.selectedRows(), item]);
      this.searchTerm.set('');
    } else {
      this.emitValue([item]);
      this.closePanel();
    }
  }

  private selectByIds(ids: readonly unknown[]): void {
    const map = new Map<unknown, DropdownItem>();
    this.indexItems(this.effectiveItems(), map, this.valueKey());
    for (const r of this.selectedRows()) {
      map.set(getItemKey(r, this.valueKey()), r);
    }
    const rows = ids.map((id) => map.get(id)).filter(Boolean) as DropdownItem[];
    this.emitValue(rows);
  }

  private emitValue(rows: DropdownItem[]): void {
    this.selectedRows.set(rows);
    const valueKey = this.valueKey();
    this.valueChange.emit({
      rows,
      ids: rows.map((r) => getItemKey(r, valueKey)),
    });
  }

  protected allFilteredSelected(): boolean {
    const items = this.filteredItemRows();
    if (!items.length) {
      return false;
    }
    const selected = new Set(this.selectedRows().map((r) => getItemKey(r, this.valueKey())));
    return items.every((i) => selected.has(getItemKey(i, this.valueKey())));
  }

  protected someFilteredSelected(): boolean {
    const selected = new Set(this.selectedRows().map((r) => getItemKey(r, this.valueKey())));
    return this.filteredItemRows().some((i) => selected.has(getItemKey(i, this.valueKey())));
  }

  private filteredItemRows(): DropdownItem[] {
    return this.panelRows()
      .filter((r): r is Extract<typeof r, { kind: 'item' }> => r.kind === 'item')
      .map((r) => r.item);
  }

  protected toggleSelectAll(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const filtered = this.filteredItemRows();
    const valueKey = this.valueKey();
    if (checked) {
      const map = new Map<unknown, DropdownItem>();
      for (const r of this.selectedRows()) {
        map.set(getItemKey(r, valueKey), r);
      }
      for (const i of filtered) {
        map.set(getItemKey(i, valueKey), i);
      }
      this.emitValue([...map.values()]);
    } else {
      const remove = new Set(filtered.map((i) => getItemKey(i, valueKey)));
      this.emitValue(this.selectedRows().filter((r) => !remove.has(getItemKey(r, valueKey))));
    }
  }

  protected onPanelScroll(event: Event): void {
    const el = event.target as HTMLElement;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) {
      void this.ds?.loadNext();
    }
  }
}
