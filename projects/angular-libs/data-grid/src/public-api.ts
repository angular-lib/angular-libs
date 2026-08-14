/*
 * Public API Surface of data-grid (consumer).
 *
 * Plugin factories: `@angular-libs/data-grid/plugins`
 * Plugin authoring: `@angular-libs/data-grid/plugin`
 * Unstable internals: `@angular-libs/data-grid/internals`
 */

export { DataGrid } from './lib/components/data-grid/data-grid';
export { DataGridApi } from './lib/api/grid-api';
export type {
  BoundRowGroupAdapter,
  BoundTreeDataAdapter,
  BoundCellRangeAdapter,
} from './lib/api/grid-api';
export { GridEventBus } from './lib/api/grid-events';
export type {
  DataGridEventMap,
  DataGridEventName,
  GridEventUnsubscribe,
} from './lib/api/grid-events';
export {
  createGrid,
  pickAdapter,
  isRowGroupAdapter,
  isTreeDataAdapter,
  isCellRangeAdapter,
} from './lib/create-grid';
export type {
  CreateGridOptions,
  GridChromeOptions,
  GridController,
  GridViewportOptions,
  IsRowSelectableFn,
} from './lib/create-grid';
export {
  resolveEditInteraction,
  isTypeToEditKey,
  resolveTypeToEditSeed,
} from './lib/editing/edit-interaction';
export type {
  EditInteractionConfig,
  EditInteractionInput,
  EditInteractionPreset,
  ResolvedEditInteraction,
  TypeToEditColumn,
  TypeToEditSeed,
} from './lib/editing/edit-interaction';
export { DataGridFindBar } from './lib/components/chrome/data-grid-find-bar';
export { DataGridToolbar } from './lib/components/chrome/data-grid-toolbar';
export type { DataGridToolbarLabels } from './lib/components/chrome/data-grid-toolbar';
export { DataGridStatusBar } from './lib/components/chrome/data-grid-status-bar';
export type { DataGridStatusBarLabels } from './lib/components/chrome/data-grid-status-bar';
export { DataGridSidebar } from './lib/components/chrome/data-grid-sidebar';
export { DataGridFilterField } from './lib/components/chrome/data-grid-filter-field';
export {
  DATA_GRID_SIDEBAR_HOST,
} from './lib/components/chrome/sidebar-host';
export type { DataGridSidebarHost } from './lib/components/chrome/sidebar-host';
export { RowEditSession } from './lib/editing/row-edit-session';
export type { RowEditSessionHooks } from './lib/editing/row-edit-session';
export {
  CellEditorRegistry,
  defaultCellEditorRegistry,
  isHostOwnedRowForm,
  registerBuiltInEditorResolver,
  resolveCellEditor,
} from './lib/editing/cell-editor-registry';
export type { ResolvedCellEditor, RowEditAdapter } from './lib/editing/cell-editor-registry';
export {
  DataGridCellDirective,
  DataGridContextMenuDirective,
  DataGridEmptyDirective,
  DataGridHeaderDirective,
  DataGridLoadingDirective,
} from './lib/data-grid-cell.directive';
export { AlTooltipDirective } from './lib/tooltip/tooltip.directive';
export type {
  AlTooltipPosition,
  AlTooltipVariant,
} from './lib/tooltip/tooltip.directive';
export type {
  AggFunc,
  BuiltInCellEditor,
  CellClickEvent,
  CellEditEvent,
  CellEditorParams,
  CellEditorParamsConfig,
  CellRendererParams,
  ColumnAlign,
  ColumnDataType,
  ColumnDef,
  ColumnFilterType,
  ColumnGroupDef,
  ColumnOrGroupDef,
  ColumnPin,
  CreateRowFormFn,
  DataGridContextMenuContext,
  DataGridContextMenuItem,
  DataGridContextMenuItems,
  DataGridFilterState,
  DataGridQuery,
  DataGridState,
  EditMode,
  CellRange,
  FillEvent,
  PasteEvent,
  ResolvedColumn,
  RowClassFn,
  RowClickEvent,
  RowEditContext,
  RowEditEvent,
  RowEditSchema,
  RowReorderEvent,
  SelectionMode,
  SideBarConfig,
  SideBarPanelId,
  SideBarPosition,
  SortDirection,
  SortState,
  ValueSetterParams,
} from './lib/components/data-grid/data-grid.types';
export { rowsToCsv, downloadCsv } from './lib/utils/csv';
export { serializeGridState, parseGridState, createEmptyGridState } from './lib/utils/state';
export { collectFindMatches, splitFindHighlight } from './lib/utils/find';
export type { FindMatch, FindTextPart } from './lib/utils/find';
export { cloneRowDraft, formFieldForColumn } from './lib/utils/row-edit';
export { applyCellEdit, applyRowEdit, writeCellValue, mergeRowsById } from './lib/utils/apply-edit';
export {
  applyRowTransaction,
} from './lib/utils/apply-row-transaction';
export type {
  RowTransaction,
  RowTransactionResult,
} from './lib/utils/apply-row-transaction';
export {
  toDateKey,
  formatLocalDateKey,
} from './lib/utils/filter-rows';
export { parseClipboardMatrix, applyPasteMatrix, tileMatrix } from './lib/utils/clipboard-paste';
export {
  formatCellValue,
  getCellValue,
  serializeCellValue,
  isBooleanColumn,
  isDateColumn,
} from './lib/utils/cell-value';
export { coerceCellEditValue, isBlankCellInput } from './lib/utils/coerce-cell-value';
export { defaultGridLocale, mergeGridLocale, toolbarLabelsFromLocale } from './lib/locale/default-locale';
export type { DataGridLocale } from './lib/locale/default-locale';
