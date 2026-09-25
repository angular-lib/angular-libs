/**
 * ɵ backing exports for `@angular-libs/data-grid/internals`.
 *
 * NOT an entry point. Re-exported (ɵ-prefixed) from the primary entry so the
 * secondary entry imports every symbol via the package specifier and each
 * class / token is declared exactly once in dist. The unprefixed names live in
 * `internals/src/public-api.ts` — add new symbols to BOTH files.
 *
 * Symbols already backing `/plugin` (see `plugin-api.ts`) are not repeated here;
 * `/internals` re-exports them from the same ɵ names.
 *
 * Every name here must start with `ɵ` (enforced by `package-layout.spec.ts`).
 */

export { runClientRowPipeline as ɵrunClientRowPipeline } from './lib/utils/row-pipeline';
export type {
  AfterSortHook as ɵAfterSortHook,
  ClientRowPipelineInput as ɵClientRowPipelineInput,
} from './lib/utils/row-pipeline';

export { runGridRowModel as ɵrunGridRowModel } from './lib/utils/grid-row-model';
export type {
  GridRowModelInput as ɵGridRowModelInput,
  GridRowModelResult as ɵGridRowModelResult,
} from './lib/utils/grid-row-model';

export {
  emptyColumnLayout as ɵemptyColumnLayout,
  materializeColumnLayout as ɵmaterializeColumnLayout,
  moveColumn as ɵmoveColumn,
  partitionColumnsByPin as ɵpartitionColumnsByPin,
  reconcileColumnLayout as ɵreconcileColumnLayout,
  reconcileColumnOrder as ɵreconcileColumnOrder,
  reconcileHiddenColumnIds as ɵreconcileHiddenColumnIds,
  CHROME_TRACK as ɵCHROME_TRACK,
  resolveColumnTracks as ɵresolveColumnTracks,
  resolveColumnWidths as ɵresolveColumnWidths,
  setColumnPin as ɵsetColumnPin,
} from './lib/utils/column-layout';
export type {
  ColumnLayout as ɵColumnLayout,
  ColumnPinSide as ɵColumnPinSide,
  ColumnTrackLayout as ɵColumnTrackLayout,
  ColumnTracksChrome as ɵColumnTracksChrome,
} from './lib/utils/column-layout';

export {
  isPaginationSlotRow as ɵisPaginationSlotRow,
  countPaginationSlots as ɵcountPaginationSlots,
  countDisplayedDataRows as ɵcountDisplayedDataRows,
  paginationSlotIndex as ɵpaginationSlotIndex,
  pageIndexForDisplayIndex as ɵpageIndexForDisplayIndex,
  paginateDisplayRows as ɵpaginateDisplayRows,
} from './lib/utils/row-display';

export {
  computeVirtualWindow as ɵcomputeVirtualWindow,
  cumulativeOffsets as ɵcumulativeOffsets,
  findRowAtOffset as ɵfindRowAtOffset,
  rowHeightAt as ɵrowHeightAt,
  rowOffsetY as ɵrowOffsetY,
} from './lib/controllers/virtual-window';
export type {
  VirtualWindow as ɵVirtualWindow,
  VirtualWindowInput as ɵVirtualWindowInput,
} from './lib/controllers/virtual-window';

export { FindController as ɵFindController } from './lib/controllers/find';
export type { FindControllerOptions as ɵFindControllerOptions } from './lib/controllers/find';

export {
  attachRowReorder as ɵattachRowReorder,
  buildRowReorderEvent as ɵbuildRowReorderEvent,
  isRowDragAllowed as ɵisRowDragAllowed,
  isValidRowReorder as ɵisValidRowReorder,
  resolveRowDropDataIndex as ɵresolveRowDropDataIndex,
} from './lib/utils/row-interactions';

export {
  buildHeaderRows as ɵbuildHeaderRows,
  buildLeafGroupMap as ɵbuildLeafGroupMap,
  buildVisibleGroupHeaderRow as ɵbuildVisibleGroupHeaderRow,
  hasColumnGroups as ɵhasColumnGroups,
  isColumnGroupDef as ɵisColumnGroupDef,
  resolveColumnOrGroupDefs as ɵresolveColumnOrGroupDefs,
  sameColumnGroup as ɵsameColumnGroup,
} from './lib/utils/column-groups';
export type {
  ColumnGroupMeta as ɵColumnGroupMeta,
  HeaderGroupCell as ɵHeaderGroupCell,
} from './lib/utils/column-groups';

export {
  parseSetFilter as ɵparseSetFilter,
  serializeSetFilter as ɵserializeSetFilter,
  collectSetFilterValues as ɵcollectSetFilterValues,
} from './lib/utils/filter-rows';

export {
  isCustomEditorComponent as ɵisCustomEditorComponent,
  isCustomRendererComponent as ɵisCustomRendererComponent,
  isSelectEditor as ɵisSelectEditor,
  resolveSelectValues as ɵresolveSelectValues,
} from './lib/utils/editors';

export { defaultContextMenuItems as ɵdefaultContextMenuItems } from './lib/utils/context-menu';
export { buildLeanColumnMenuItems as ɵbuildLeanColumnMenuItems } from './lib/utils/column-menu';
export type { LeanColumnMenuHelpers as ɵLeanColumnMenuHelpers } from './lib/utils/column-menu';

export { createDataGridSession as ɵcreateDataGridSession } from './lib/session/create-session';
export type {
  CreateSessionOptions as ɵCreateSessionOptions,
  CreateSessionModels as ɵCreateSessionModels,
  CreateSessionOutputs as ɵCreateSessionOutputs,
  GridSession as ɵGridSession,
} from './lib/session/create-session';

export {
  SelectionHost as ɵSelectionHost,
  ColumnLayoutHost as ɵColumnLayoutHost,
  EditSyncHost as ɵEditSyncHost,
  MenuHost as ɵMenuHost,
  ViewportHost as ɵViewportHost,
} from './lib/hosts/index';
export type {
  BinderPublishSurface as ɵBinderPublishSurface,
  SelectionSurface as ɵSelectionSurface,
  SelectionDeps as ɵSelectionDeps,
  ColumnLayoutSurface as ɵColumnLayoutSurface,
  ColumnLayoutDeps as ɵColumnLayoutDeps,
  EditSyncSurface as ɵEditSyncSurface,
  EditSyncDeps as ɵEditSyncDeps,
  MenuSurface as ɵMenuSurface,
  MenuDeps as ɵMenuDeps,
  ViewportSurface as ɵViewportSurface,
  ViewportDeps as ɵViewportDeps,
  HostWritable as ɵHostWritable,
} from './lib/hosts/index';
