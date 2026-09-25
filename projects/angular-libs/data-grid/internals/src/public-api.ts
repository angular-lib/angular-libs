/**
 * Internals API — `@angular-libs/data-grid/internals`
 *
 * Unstable surface for tests and advanced tooling. Not freeze-stable.
 * First-party plugins must not depend on it — plugin-author helpers live in
 * `@angular-libs/data-grid/plugin`.
 *
 * Every symbol is declared in the primary entry (ɵ-prefixed, see
 * `src/internals-api.ts` / `src/plugin-api.ts`) and only re-exported here.
 */

export { ɵrunClientRowPipeline as runClientRowPipeline } from '@angular-libs/data-grid';
export type {
  ɵAfterSortHook as AfterSortHook,
  ɵClientRowPipelineInput as ClientRowPipelineInput,
} from '@angular-libs/data-grid';
export { ɵrunGridRowModel as runGridRowModel } from '@angular-libs/data-grid';
export type {
  ɵGridRowModelInput as GridRowModelInput,
  ɵGridRowModelResult as GridRowModelResult,
} from '@angular-libs/data-grid';
export {
  ɵemptyColumnLayout as emptyColumnLayout,
  ɵmaterializeColumnLayout as materializeColumnLayout,
  ɵmoveColumn as moveColumn,
  ɵpartitionColumnsByPin as partitionColumnsByPin,
  ɵreconcileColumnLayout as reconcileColumnLayout,
  ɵreconcileColumnOrder as reconcileColumnOrder,
  ɵreconcileHiddenColumnIds as reconcileHiddenColumnIds,
  ɵCHROME_TRACK as CHROME_TRACK,
  ɵresolveColumnTracks as resolveColumnTracks,
  ɵresolveColumnWidths as resolveColumnWidths,
  ɵsetColumnPin as setColumnPin,
} from '@angular-libs/data-grid';
export type {
  ɵColumnLayout as ColumnLayout,
  ɵColumnPinSide as ColumnPinSide,
  ɵColumnTrackLayout as ColumnTrackLayout,
  ɵColumnTracksChrome as ColumnTracksChrome,
} from '@angular-libs/data-grid';
export {
  ɵisPaginationSlotRow as isPaginationSlotRow,
  ɵcountPaginationSlots as countPaginationSlots,
  ɵcountDisplayedDataRows as countDisplayedDataRows,
  ɵpaginationSlotIndex as paginationSlotIndex,
  ɵpageIndexForDisplayIndex as pageIndexForDisplayIndex,
  ɵpaginateDisplayRows as paginateDisplayRows,
} from '@angular-libs/data-grid';
export {
  ɵcomputeVirtualWindow as computeVirtualWindow,
  ɵcumulativeOffsets as cumulativeOffsets,
  ɵfindRowAtOffset as findRowAtOffset,
  ɵrowHeightAt as rowHeightAt,
  ɵrowOffsetY as rowOffsetY,
} from '@angular-libs/data-grid';
export type {
  ɵVirtualWindow as VirtualWindow,
  ɵVirtualWindowInput as VirtualWindowInput,
} from '@angular-libs/data-grid';
export { ɵFindController as FindController } from '@angular-libs/data-grid';
export type { ɵFindControllerOptions as FindControllerOptions } from '@angular-libs/data-grid';
export {
  ɵattachRowReorder as attachRowReorder,
  ɵbuildRowReorderEvent as buildRowReorderEvent,
  ɵisRowDragAllowed as isRowDragAllowed,
  ɵisValidRowReorder as isValidRowReorder,
  ɵresolveRowDropDataIndex as resolveRowDropDataIndex,
} from '@angular-libs/data-grid';
export {
  ɵbuildHeaderRows as buildHeaderRows,
  ɵbuildLeafGroupMap as buildLeafGroupMap,
  ɵbuildVisibleGroupHeaderRow as buildVisibleGroupHeaderRow,
  ɵhasColumnGroups as hasColumnGroups,
  ɵisColumnGroupDef as isColumnGroupDef,
  ɵresolveColumnOrGroupDefs as resolveColumnOrGroupDefs,
  ɵsameColumnGroup as sameColumnGroup,
} from '@angular-libs/data-grid';
export type {
  ɵColumnGroupMeta as ColumnGroupMeta,
  ɵHeaderGroupCell as HeaderGroupCell,
} from '@angular-libs/data-grid';
export {
  ɵparseSetFilter as parseSetFilter,
  ɵserializeSetFilter as serializeSetFilter,
  ɵcollectSetFilterValues as collectSetFilterValues,
} from '@angular-libs/data-grid';
export {
  ɵisCustomEditorComponent as isCustomEditorComponent,
  ɵisCustomRendererComponent as isCustomRendererComponent,
  ɵisSelectEditor as isSelectEditor,
  ɵresolveSelectValues as resolveSelectValues,
} from '@angular-libs/data-grid';
export { ɵdefaultContextMenuItems as defaultContextMenuItems } from '@angular-libs/data-grid';
export { ɵbuildLeanColumnMenuItems as buildLeanColumnMenuItems } from '@angular-libs/data-grid';
export type { ɵLeanColumnMenuHelpers as LeanColumnMenuHelpers } from '@angular-libs/data-grid';
export { ɵcreateDataGridSession as createDataGridSession } from '@angular-libs/data-grid';
export type {
  ɵCreateSessionOptions as CreateSessionOptions,
  ɵCreateSessionModels as CreateSessionModels,
  ɵCreateSessionOutputs as CreateSessionOutputs,
  ɵGridSession as GridSession,
} from '@angular-libs/data-grid';
export {
  ɵSelectionHost as SelectionHost,
  ɵColumnLayoutHost as ColumnLayoutHost,
  ɵEditSyncHost as EditSyncHost,
  ɵMenuHost as MenuHost,
  ɵViewportHost as ViewportHost,
} from '@angular-libs/data-grid';
export type {
  ɵBinderPublishSurface as BinderPublishSurface,
  ɵSelectionSurface as SelectionSurface,
  ɵSelectionDeps as SelectionDeps,
  ɵColumnLayoutSurface as ColumnLayoutSurface,
  ɵColumnLayoutDeps as ColumnLayoutDeps,
  ɵEditSyncSurface as EditSyncSurface,
  ɵEditSyncDeps as EditSyncDeps,
  ɵMenuSurface as MenuSurface,
  ɵMenuDeps as MenuDeps,
  ɵViewportSurface as ViewportSurface,
  ɵViewportDeps as ViewportDeps,
  ɵHostWritable as HostWritable,
} from '@angular-libs/data-grid';

// Also exposed (stable) via `@angular-libs/data-grid/plugin`; kept for tooling.
export { ɵcomposeDataGridApiHost as composeDataGridApiHost } from '@angular-libs/data-grid';
export type {
  ɵComposedDataGridApiHost as ComposedDataGridApiHost,
  ɵDataGridLocaleHost as DataGridLocaleHost,
} from '@angular-libs/data-grid';
export {
  ɵbuildDisplayRows as buildDisplayRows,
  ɵwrapDataRows as wrapDataRows,
  ɵcollectTreeGroupIds as collectTreeGroupIds,
  ɵisDataDisplayRow as isDataDisplayRow,
  ɵisGroupDisplayRow as isGroupDisplayRow,
  ɵisPluginDisplayRow as isPluginDisplayRow,
  ɵstepDisplayIndexSkippingPlugins as stepDisplayIndexSkippingPlugins,
  ɵresolveDisplayRowHeight as resolveDisplayRowHeight,
} from '@angular-libs/data-grid';
export type {
  ɵCustomDisplayRow as CustomDisplayRow,
  ɵDataDisplayRow as DataDisplayRow,
  ɵDisplayRow as DisplayRow,
  ɵGroupDisplayRow as GroupDisplayRow,
  ɵRowGroupConfig as RowGroupConfig,
  ɵTreeDataConfig as TreeDataConfig,
} from '@angular-libs/data-grid';
export { ɵcollectAllGroupIds as collectAllGroupIds } from '@angular-libs/data-grid';
export {
  ɵaggregateColumn as aggregateColumn,
  ɵformatAggregateValue as formatAggregateValue,
} from '@angular-libs/data-grid';
export { ɵflattenColumnDefs as flattenColumnDefs } from '@angular-libs/data-grid';
