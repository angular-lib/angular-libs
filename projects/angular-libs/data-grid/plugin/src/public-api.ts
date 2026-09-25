/**
 * Plugin-author API — `@angular-libs/data-grid/plugin`
 *
 * Stable contracts for first-/third-party plugins: slots, capabilities, kernel,
 * focus, adapters, cell-range and row-model (display row / aggregate) helpers.
 * Consumers should import from `@angular-libs/data-grid`; feature factories
 * from `@angular-libs/data-grid/plugins`.
 *
 * Every symbol is declared in the primary entry (ɵ-prefixed, see
 * `src/plugin-api.ts`) and only re-exported here, so dist has a single
 * declaration of each class / token. Never import core via relative paths.
 */

export {
  ɵDataGridSlotRegistry as DataGridSlotRegistry,
  ɵactivatePlugins as activatePlugins,
  ɵdedupePlugins as dedupePlugins,
  ɵnotifyPlugins as notifyPlugins,
  ɵsetupPlugin as setupPlugin,
} from '@angular-libs/data-grid';
export type {
  ɵActivePlugin as ActivePlugin,
  ɵPluginErrorReporter as PluginErrorReporter,
  ɵPluginHook as PluginHook,
  ɵDataGridPlugin as DataGridPlugin,
  ɵDataGridPluginContext as DataGridPluginContext,
  ɵDataGridSlotId as DataGridSlotId,
  ɵDataGridSidebarSlotItem as DataGridSidebarSlotItem,
  ɵDataGridStatusBarSlotItem as DataGridStatusBarSlotItem,
  ɵDataGridToolbarActionParams as DataGridToolbarActionParams,
  ɵDataGridToolbarSlotItem as DataGridToolbarSlotItem,
  ɵFindFeatureConfig as FindFeatureConfig,
  ɵInfiniteScrollFeatureConfig as InfiniteScrollFeatureConfig,
} from '@angular-libs/data-grid';
export { ɵGridKernel as GridKernel } from '@angular-libs/data-grid';
export type { ɵGridKernelOptions as GridKernelOptions } from '@angular-libs/data-grid';
export { ɵGridCapabilities as GridCapabilities } from '@angular-libs/data-grid';
export { ɵGridAdapterRegistry as GridAdapterRegistry } from '@angular-libs/data-grid';
export { adapterKey } from '@angular-libs/data-grid';
export type { AdapterKey } from '@angular-libs/data-grid';
export type {
  ɵAggregateContribution as AggregateContribution,
  ɵCellWidgetContribution as CellWidgetContribution,
  ɵRangeSelectionContribution as RangeSelectionContribution,
  ɵRowAriaContribution as RowAriaContribution,
  ɵCellDecoratorContext as CellDecoratorContext,
  ɵCellDecoratorContribution as CellDecoratorContribution,
  ɵContextMenuContribution as ContextMenuContribution,
  ɵDisplayViewContribution as DisplayViewContribution,
  ɵInteractionContribution as InteractionContribution,
  ɵOverlayContribution as OverlayContribution,
  ɵOverlayLayout as OverlayLayout,
  ɵRowModelContext as RowModelContext,
  ɵRowModelDataStage as RowModelDataStage,
  ɵRowModelDisplayBuilder as RowModelDisplayBuilder,
} from '@angular-libs/data-grid';
export {
  ɵFocusController as FocusController,
  ɵfocusRealmOf as focusRealmOf,
} from '@angular-libs/data-grid';
export type {
  ɵFocusCell as FocusCell,
  ɵFocusControllerOptions as FocusControllerOptions,
  ɵFocusRealm as FocusRealm,
} from '@angular-libs/data-grid';
export { ɵcomposeDataGridApiHost as composeDataGridApiHost } from '@angular-libs/data-grid';
export type {
  ɵComposedDataGridApiHost as ComposedDataGridApiHost,
  ɵDataGridLocaleHost as DataGridLocaleHost,
} from '@angular-libs/data-grid';
export type {
  ɵDataGridAdaptersHost as DataGridAdaptersHost,
  ɵDataGridApiHost as DataGridApiHost,
  ɵDataGridClipboardHost as DataGridClipboardHost,
  ɵDataGridColumnsHost as DataGridColumnsHost,
  ɵDataGridEditingHost as DataGridEditingHost,
  ɵDataGridFindHost as DataGridFindHost,
  ɵDataGridLocaleApiHost as DataGridLocaleApiHost,
  ɵDataGridRowGroupHost as DataGridRowGroupHost,
  ɵDataGridSelectionHost as DataGridSelectionHost,
  ɵDataGridSideBarApiHost as DataGridSideBarApiHost,
  ɵDataGridViewportHost as DataGridViewportHost,
} from '@angular-libs/data-grid';
export {
  ɵcellInNormalizedRange as cellInNormalizedRange,
  ɵmoveFocusWithinGrid as moveFocusWithinGrid,
  ɵnormalizeCellRange as normalizeCellRange,
  ɵsingleCellRange as singleCellRange,
} from '@angular-libs/data-grid';
export type { ɵNormalizedCellRange as NormalizedCellRange } from '@angular-libs/data-grid';
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
