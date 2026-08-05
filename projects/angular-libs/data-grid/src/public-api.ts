/*
 * Public API Surface of data-grid (core).
 *
 * Plugin factories live in `@angular-libs/data-grid/plugins`.
 */

export { DataGrid } from './lib/components/data-grid/data-grid';
export { DataGridApi } from './lib/api/grid-api';
export type {
  BoundRowGroupAdapter,
  BoundTreeDataAdapter,
  DataGridApiHost,
  DataGridClipboardHost,
  DataGridColumnsHost,
  DataGridEditingHost,
  DataGridFindHost,
  DataGridLocaleApiHost,
  DataGridRowGroupHost,
  DataGridSelectionHost,
  DataGridViewportHost,
  PluginLifecycle,
} from './lib/api/grid-api';
export { createGrid, pickAdapter } from './lib/create-grid';
export type { CreateGridOptions, GridController, IsRowSelectableFn } from './lib/create-grid';
export {
  resolveEditInteraction,
} from './lib/editing/edit-interaction';
export type {
  EditInteractionConfig,
  EditInteractionInput,
  EditInteractionPreset,
  ResolvedEditInteraction,
} from './lib/editing/edit-interaction';
export { GridKernel } from './lib/kernel/grid-kernel';
export type { GridKernelOptions } from './lib/kernel/grid-kernel';
export { GridCapabilities, ROW_GROUP_ADAPTER, TREE_DATA_ADAPTER } from './lib/plugins/capabilities';
export type {
  AggregateContribution,
  CellDecoratorContext,
  CellDecoratorContribution,
  ContextMenuContribution,
  DisplayViewContribution,
  InteractionContribution,
  RowModelContext,
  RowModelDataStage,
  RowModelDisplayBuilder,
} from './lib/plugins/capabilities';
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
export { defaultContextMenuItems } from './lib/utils/context-menu';
export { collectFindMatches, splitFindHighlight } from './lib/utils/find';
export type { FindMatch, FindTextPart } from './lib/utils/find';
export { cloneRowDraft, formFieldForColumn } from './lib/utils/row-edit';
export { applyCellEdit, applyRowEdit, writeCellValue } from './lib/utils/apply-edit';
export {
  applyRowTransaction,
} from './lib/utils/apply-row-transaction';
export type {
  RowTransaction,
  RowTransactionResult,
} from './lib/utils/apply-row-transaction';
export {
  emptyColumnLayout,
  materializeColumnLayout,
  moveColumn,
  partitionColumnsByPin,
  reconcileColumnLayout,
  reconcileColumnOrder,
  reconcileHiddenColumnIds,
  resolveColumnWidths,
  setColumnPin,
} from './lib/utils/column-layout';
export type { ColumnLayout, ColumnPinSide } from './lib/utils/column-layout';
export {
  buildRowReorderEvent,
  isRowDragAllowed,
  isValidRowReorder,
  parseDragIndex,
} from './lib/utils/row-interactions';
export {
  buildHeaderRows,
  buildLeafGroupMap,
  buildVisibleGroupHeaderRow,
  flattenColumnDefs,
  hasColumnGroups,
  isColumnGroupDef,
  resolveColumnOrGroupDefs,
  sameColumnGroup,
} from './lib/utils/column-groups';
export type { ColumnGroupMeta, HeaderGroupCell } from './lib/utils/column-groups';
export {
  toDateKey,
  formatLocalDateKey,
  parseSetFilter,
  serializeSetFilter,
  collectSetFilterValues,
} from './lib/utils/filter-rows';
export { parseClipboardMatrix, applyPasteMatrix } from './lib/utils/clipboard-paste';
export {
  formatCellValue,
  getCellValue,
  isBooleanColumn,
  isDateColumn,
} from './lib/utils/cell-value';
export { coerceCellEditValue, isBlankCellInput } from './lib/utils/coerce-cell-value';
export { collectAllGroupIds } from './lib/utils/collect-group-ids';
export {
  aggregateColumn,
  formatAggregateValue,
  isCustomEditorComponent,
  isCustomRendererComponent,
  isSelectEditor,
  resolveSelectValues,
} from './lib/utils/editors';
export { defaultGridLocale, mergeGridLocale, toolbarLabelsFromLocale } from './lib/locale/default-locale';
export type { DataGridLocale } from './lib/locale/default-locale';
export {
  DataGridSlotRegistry,
  activatePlugins,
  dedupePlugins,
  notifyPlugins,
} from './lib/plugins/types';
export type {
  DataGridPlugin,
  DataGridPluginContext,
  DataGridSlotId,
  DataGridSidebarSlotItem,
  DataGridStatusBarSlotItem,
  DataGridToolbarActionParams,
  DataGridToolbarSlotItem,
  FindFeatureConfig,
  InfiniteScrollFeatureConfig,
} from './lib/plugins/types';
export { FocusController, focusRealmOf } from './lib/controllers/focus';
export type { FocusCell, FocusControllerOptions, FocusRealm } from './lib/controllers/focus';
export { FindController } from './lib/controllers/find';
export type { FindControllerOptions } from './lib/controllers/find';
export { computeVirtualWindow } from './lib/controllers/virtual-window';
export type { VirtualWindow, VirtualWindowInput } from './lib/controllers/virtual-window';
export { runClientRowPipeline } from './lib/utils/row-pipeline';
export type { AfterSortHook, ClientRowPipelineInput } from './lib/utils/row-pipeline';
export { runGridRowModel } from './lib/utils/grid-row-model';
export type { GridRowModelInput, GridRowModelResult } from './lib/utils/grid-row-model';
export {
  buildDisplayRows,
  wrapDataRows,
  collectTreeGroupIds,
  isDataDisplayRow,
  isGroupDisplayRow,
} from './lib/utils/row-display';
export type {
  CustomDisplayRow,
  DataDisplayRow,
  DisplayRow,
  GroupDisplayRow,
  RowGroupConfig,
  TreeDataConfig,
} from './lib/utils/row-display';
export { composeDataGridApiHost } from './lib/api/compose-host';
export type { ComposedDataGridApiHost, DataGridLocaleHost } from './lib/api/compose-host';
