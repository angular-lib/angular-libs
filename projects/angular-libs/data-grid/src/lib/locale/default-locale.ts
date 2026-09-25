/**
 * Default chrome strings for `@angular-libs/data-grid`.
 * Pass a partial `[locale]` to override; merge with `defaultGridLocale`.
 */

export interface DataGridLocale {
  quickFilterPlaceholder: string;
  findPlaceholder: string;
  findAriaLabel: string;
  findPrevAriaLabel: string;
  findNextAriaLabel: string;
  exportCsv: string;
  autosize: string;
  emptyMessage: string;
  loading: string;
  selectAllAriaLabel: string;
  selectRowAriaLabel: string;
  filterColumnAriaLabel: string;
  gridAriaLabel: string;
  paginationLabel: string;
  paginationPrev: string;
  paginationNext: string;
  editColumnHeader: string;
  save: string;
  cancel: string;
  columnsPanelTitle: string;
  columnsPanelHint: string;
  columnsShowAll: string;
  columnsAutosize: string;
  filtersPanelTitle: string;
  filtersClearAll: string;
  filtersQuickFilterLabel: string;
  filtersAddFilter: string;
  filtersAddFilterPlaceholder: string;
  filtersNoFilters: string;
  filtersRemoveFilter: string;
  sidebarAriaLabel: string;
  statusSelected: string;
  statusRows: string;
  statusFiltered: string;
  expandAll: string;
  collapseAll: string;
  ungroup: string;
  expandAllAriaLabel: string;
  collapseAllAriaLabel: string;
  expandDetailAriaLabel: string;
  collapseDetailAriaLabel: string;
  detailEmptyMessage: string;
  detailLoadingMessage: string;
  detailNotConfiguredMessage: string;
  detailGridAriaLabel: string;
  ungroupAriaLabel: string;
  columnsPanelShortLabel: string;
  filtersPanelShortLabel: string;
  groupsPanelLabel: string;
  groupsPanelShortLabel: string;
  pinLeft: string;
  pinRight: string;
  unpinColumn: string;
  sortAscending: string;
  sortDescending: string;
  sortClear: string;
  autosizeColumn: string;
  hideColumn: string;
  filterAny: string;
  filterTrue: string;
  filterFalse: string;
  filterPlaceholder: string;
  filterSet: string;
  filterNoValues: string;
  copyCell: string;
  copyRow: string;
  exportCsvAction: string;
  autosizeColumns: string;
  clearFilters: string;
  copyShortcut: string;
  groupsPanelHint: string;
  moveGroupUp: string;
  moveGroupDown: string;
  noteTitle: string;
  noteAdd: string;
  noteEdit: string;
  noteRemove: string;
  notePlaceholder: string;
  /**
   * BCP 47 tag for parsing / editing numbers and numeric dates
   * (`'nb-NO'` → `1 234,5`, `25.09.2026`). Default: runtime locale.
   */
  numberLocale?: string;
  invalidNumber: string;
  invalidDate: string;
  invalidBoolean: string;
  invalidOption: string;
}

export const defaultGridLocale: DataGridLocale = {
  quickFilterPlaceholder: 'Quick filter…',
  findPlaceholder: 'Find...',
  findAriaLabel: 'Find in grid',
  findPrevAriaLabel: 'Previous find match',
  findNextAriaLabel: 'Next find match',
  exportCsv: 'CSV',
  autosize: 'Autosize',
  emptyMessage: 'No rows',
  loading: 'Loading…',
  selectAllAriaLabel: 'Select all rows',
  selectRowAriaLabel: 'Select row',
  filterColumnAriaLabel: 'Filter',
  gridAriaLabel: 'Data grid',
  paginationLabel: 'Page',
  paginationPrev: 'Prev',
  paginationNext: 'Next',
  editColumnHeader: 'Edit',
  save: 'Save',
  cancel: 'Cancel',
  columnsPanelTitle: 'Columns',
  columnsPanelHint: 'Toggle visibility. Drag to reorder.',
  columnsShowAll: 'Show all',
  columnsAutosize: 'Autosize',
  filtersPanelTitle: 'Filters',
  filtersClearAll: 'Clear all',
  filtersQuickFilterLabel: 'Quick filter',
  filtersAddFilter: 'Add filter',
  filtersAddFilterPlaceholder: 'Select column…',
  filtersNoFilters: 'No filters yet.',
  filtersRemoveFilter: 'Remove filter',
  sidebarAriaLabel: 'Grid tool panels',
  statusSelected: 'selected',
  statusRows: 'rows',
  statusFiltered: 'filtered',
  expandAll: 'Expand',
  collapseAll: 'Collapse',
  ungroup: 'Ungroup',
  expandAllAriaLabel: 'Expand all groups',
  collapseAllAriaLabel: 'Collapse all groups',
  expandDetailAriaLabel: 'Expand detail',
  collapseDetailAriaLabel: 'Collapse detail',
  detailEmptyMessage: 'No detail rows.',
  detailLoadingMessage: 'Preparing detail grid…',
  detailNotConfiguredMessage: 'No detail grid configured.',
  detailGridAriaLabel: 'Detail grid',
  ungroupAriaLabel: 'Clear row grouping',
  columnsPanelShortLabel: 'Cols',
  filtersPanelShortLabel: 'Filters',
  groupsPanelLabel: 'Groups',
  groupsPanelShortLabel: 'Groups',
  pinLeft: 'Pin left',
  pinRight: 'Pin right',
  unpinColumn: 'Unpin',
  sortAscending: 'Sort ascending',
  sortDescending: 'Sort descending',
  sortClear: 'Clear sort',
  autosizeColumn: 'Autosize this column',
  hideColumn: 'Hide column',
  filterAny: 'Any',
  filterTrue: 'True',
  filterFalse: 'False',
  filterPlaceholder: 'Filter…',
  filterSet: 'Set',
  filterNoValues: 'No values',
  copyCell: 'Copy cell',
  copyRow: 'Copy row',
  exportCsvAction: 'Export CSV',
  autosizeColumns: 'Autosize columns',
  clearFilters: 'Clear filters',
  copyShortcut: '⌘C',
  groupsPanelHint: 'Group rows by column values. Order is outer → inner.',
  moveGroupUp: 'Move group up',
  moveGroupDown: 'Move group down',
  noteTitle: 'Note',
  noteAdd: 'Add note',
  noteEdit: 'Edit note',
  noteRemove: 'Remove note',
  notePlaceholder: 'Write a note…',
  invalidNumber: 'Not a valid number',
  invalidDate: 'Not a valid date',
  invalidBoolean: 'Not a valid yes/no value',
  invalidOption: 'Not an allowed value',
};

export function mergeGridLocale(partial?: Partial<DataGridLocale> | null): DataGridLocale {
  return { ...defaultGridLocale, ...partial };
}

/** Toolbar chrome labels derived from locale (binder + plugins). */
export function toolbarLabelsFromLocale(locale: DataGridLocale): {
  quickFilterPlaceholder: string;
  quickFilterAriaLabel: string;
  findPlaceholder: string;
  findAriaLabel: string;
  findPrevAriaLabel: string;
  findNextAriaLabel: string;
} {
  return {
    quickFilterPlaceholder: locale.quickFilterPlaceholder,
    quickFilterAriaLabel: locale.filtersQuickFilterLabel,
    findPlaceholder: locale.findPlaceholder,
    findAriaLabel: locale.findAriaLabel,
    findPrevAriaLabel: locale.findPrevAriaLabel,
    findNextAriaLabel: locale.findNextAriaLabel,
  };
}
