/**
 * ɵ backing exports for `@angular-libs/data-grid/plugin`.
 *
 * NOT an entry point. Re-exported (ɵ-prefixed) from the primary entry so the
 * secondary entry imports every symbol via the package specifier and each
 * class / token is declared exactly once in dist. The unprefixed names live in
 * `plugin/src/public-api.ts` — add new symbols to BOTH files.
 *
 * Every name here must start with `ɵ` (enforced by `package-layout.spec.ts`).
 */

export {
  DataGridSlotRegistry as ɵDataGridSlotRegistry,
  activatePlugins as ɵactivatePlugins,
  dedupePlugins as ɵdedupePlugins,
  notifyPlugins as ɵnotifyPlugins,
} from './lib/plugins/types';
export type {
  DataGridPlugin as ɵDataGridPlugin,
  DataGridPluginContext as ɵDataGridPluginContext,
  DataGridSlotId as ɵDataGridSlotId,
  DataGridSidebarSlotItem as ɵDataGridSidebarSlotItem,
  DataGridStatusBarSlotItem as ɵDataGridStatusBarSlotItem,
  DataGridToolbarActionParams as ɵDataGridToolbarActionParams,
  DataGridToolbarSlotItem as ɵDataGridToolbarSlotItem,
  FindFeatureConfig as ɵFindFeatureConfig,
  InfiniteScrollFeatureConfig as ɵInfiniteScrollFeatureConfig,
} from './lib/plugins/types';

export { GridKernel as ɵGridKernel } from './lib/kernel/grid-kernel';
export type { GridKernelOptions as ɵGridKernelOptions } from './lib/kernel/grid-kernel';

export {
  GridCapabilities as ɵGridCapabilities,
  ROW_GROUP_ADAPTER as ɵROW_GROUP_ADAPTER,
  TREE_DATA_ADAPTER as ɵTREE_DATA_ADAPTER,
} from './lib/plugins/capabilities';
export type {
  AggregateContribution as ɵAggregateContribution,
  CellDecoratorContext as ɵCellDecoratorContext,
  CellDecoratorContribution as ɵCellDecoratorContribution,
  ContextMenuContribution as ɵContextMenuContribution,
  DisplayViewContribution as ɵDisplayViewContribution,
  InteractionContribution as ɵInteractionContribution,
  OverlayContribution as ɵOverlayContribution,
  OverlayLayout as ɵOverlayLayout,
  RowModelContext as ɵRowModelContext,
  RowModelDataStage as ɵRowModelDataStage,
  RowModelDisplayBuilder as ɵRowModelDisplayBuilder,
} from './lib/plugins/capabilities';

export {
  FocusController as ɵFocusController,
  focusRealmOf as ɵfocusRealmOf,
} from './lib/controllers/focus';
export type {
  FocusCell as ɵFocusCell,
  FocusControllerOptions as ɵFocusControllerOptions,
  FocusRealm as ɵFocusRealm,
} from './lib/controllers/focus';

export { composeDataGridApiHost as ɵcomposeDataGridApiHost } from './lib/api/compose-host';
export type {
  ComposedDataGridApiHost as ɵComposedDataGridApiHost,
  DataGridLocaleHost as ɵDataGridLocaleHost,
} from './lib/api/compose-host';

export type {
  DataGridApiHost as ɵDataGridApiHost,
  DataGridClipboardHost as ɵDataGridClipboardHost,
  DataGridColumnsHost as ɵDataGridColumnsHost,
  DataGridEditingHost as ɵDataGridEditingHost,
  DataGridFindHost as ɵDataGridFindHost,
  DataGridLocaleApiHost as ɵDataGridLocaleApiHost,
  DataGridRowGroupHost as ɵDataGridRowGroupHost,
  DataGridSelectionHost as ɵDataGridSelectionHost,
  DataGridSideBarApiHost as ɵDataGridSideBarApiHost,
  DataGridViewportHost as ɵDataGridViewportHost,
  PluginLifecycle as ɵPluginLifecycle,
} from './lib/api/grid-api';

export {
  cellInNormalizedRange as ɵcellInNormalizedRange,
  moveFocusWithinGrid as ɵmoveFocusWithinGrid,
  normalizeCellRange as ɵnormalizeCellRange,
  singleCellRange as ɵsingleCellRange,
} from './lib/utils/cell-range';
export type { NormalizedCellRange as ɵNormalizedCellRange } from './lib/utils/cell-range';

// Row-model authoring helpers (display rows, grouping, tree, aggregates, column defs).
export {
  buildDisplayRows as ɵbuildDisplayRows,
  wrapDataRows as ɵwrapDataRows,
  collectTreeGroupIds as ɵcollectTreeGroupIds,
  isDataDisplayRow as ɵisDataDisplayRow,
  isGroupDisplayRow as ɵisGroupDisplayRow,
  isPluginDisplayRow as ɵisPluginDisplayRow,
  stepDisplayIndexSkippingPlugins as ɵstepDisplayIndexSkippingPlugins,
  resolveDisplayRowHeight as ɵresolveDisplayRowHeight,
} from './lib/utils/row-display';
export type {
  CustomDisplayRow as ɵCustomDisplayRow,
  DataDisplayRow as ɵDataDisplayRow,
  DisplayRow as ɵDisplayRow,
  GroupDisplayRow as ɵGroupDisplayRow,
  RowGroupConfig as ɵRowGroupConfig,
  TreeDataConfig as ɵTreeDataConfig,
} from './lib/utils/row-display';
export { collectAllGroupIds as ɵcollectAllGroupIds } from './lib/utils/collect-group-ids';
export {
  aggregateColumn as ɵaggregateColumn,
  formatAggregateValue as ɵformatAggregateValue,
} from './lib/utils/editors';
export { flattenColumnDefs as ɵflattenColumnDefs } from './lib/utils/column-groups';
