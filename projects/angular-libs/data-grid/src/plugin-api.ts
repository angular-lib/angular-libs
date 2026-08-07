/**
 * Plugin-author API — `@angular-libs/data-grid/plugin`
 *
 * Contracts for first-/third-party plugins. Consumers should import from
 * `@angular-libs/data-grid`; feature factories from `@angular-libs/data-grid/plugins`.
 */

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
  OverlayContribution,
  OverlayLayout,
  RowModelContext,
  RowModelDataStage,
  RowModelDisplayBuilder,
} from './lib/plugins/capabilities';

export { FocusController, focusRealmOf } from './lib/controllers/focus';
export type { FocusCell, FocusControllerOptions, FocusRealm } from './lib/controllers/focus';

export { composeDataGridApiHost } from './lib/api/compose-host';
export type { ComposedDataGridApiHost, DataGridLocaleHost } from './lib/api/compose-host';

export type {
  BoundCellRangeAdapter,
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
  DataGridSideBarApiHost,
  DataGridViewportHost,
  PluginLifecycle,
} from './lib/api/grid-api';

export {
  cellInNormalizedRange,
  moveFocusWithinGrid,
  normalizeCellRange,
  singleCellRange,
} from './lib/utils/cell-range';
export type { NormalizedCellRange } from './lib/utils/cell-range';

export {
  isCellRangeAdapter,
  isRowGroupAdapter,
  isTreeDataAdapter,
  pickAdapter,
} from './lib/create-grid';
