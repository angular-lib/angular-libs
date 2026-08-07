/**
 * Internals API — `@angular-libs/data-grid/internals`
 *
 * Unstable surface for tests and advanced tooling. Not freeze-stable.
 */

export { runClientRowPipeline } from './lib/utils/row-pipeline';
export type { AfterSortHook, ClientRowPipelineInput } from './lib/utils/row-pipeline';

export { runGridRowModel } from './lib/utils/grid-row-model';
export type { GridRowModelInput, GridRowModelResult } from './lib/utils/grid-row-model';

export {
  emptyColumnLayout,
  materializeColumnLayout,
  moveColumn,
  partitionColumnsByPin,
  reconcileColumnLayout,
  reconcileColumnOrder,
  reconcileHiddenColumnIds,
  CHROME_TRACK,
  resolveColumnTracks,
  resolveColumnWidths,
  setColumnPin,
} from './lib/utils/column-layout';
export type {
  ColumnLayout,
  ColumnPinSide,
  ColumnTrackLayout,
  ColumnTracksChrome,
} from './lib/utils/column-layout';

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

export { computeVirtualWindow } from './lib/controllers/virtual-window';
export type { VirtualWindow, VirtualWindowInput } from './lib/controllers/virtual-window';

export { FindController } from './lib/controllers/find';
export type { FindControllerOptions } from './lib/controllers/find';

export {
  attachRowReorder,
  buildRowReorderEvent,
  isRowDragAllowed,
  isValidRowReorder,
  resolveRowDropDataIndex,
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
  parseSetFilter,
  serializeSetFilter,
  collectSetFilterValues,
} from './lib/utils/filter-rows';

export {
  aggregateColumn,
  formatAggregateValue,
  isCustomEditorComponent,
  isCustomRendererComponent,
  isSelectEditor,
  resolveSelectValues,
} from './lib/utils/editors';

export { collectAllGroupIds } from './lib/utils/collect-group-ids';

export { defaultContextMenuItems } from './lib/utils/context-menu';
export { buildLeanColumnMenuItems } from './lib/utils/column-menu';
export type { LeanColumnMenuHelpers } from './lib/utils/column-menu';

export { composeDataGridApiHost } from './lib/api/compose-host';
export type { ComposedDataGridApiHost, DataGridLocaleHost } from './lib/api/compose-host';

export {
  createDataGridSession,
} from './lib/session/create-session';
export type {
  CreateSessionOptions,
  CreateSessionModels,
  CreateSessionOutputs,
  GridSession,
} from './lib/session/create-session';

export {
  SelectionHost,
  ColumnLayoutHost,
  EditSyncHost,
  MenuHost,
  ViewportHost,
} from './lib/hosts/index';
export type {
  BinderPublishSurface,
  SelectionSurface,
  SelectionDeps,
  ColumnLayoutSurface,
  ColumnLayoutDeps,
  EditSyncSurface,
  EditSyncDeps,
  MenuSurface,
  MenuDeps,
  ViewportSurface,
  ViewportDeps,
  HostWritable,
} from './lib/hosts/index';
