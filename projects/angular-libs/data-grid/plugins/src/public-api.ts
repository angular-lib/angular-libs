/**
 * Secondary entry: `@angular-libs/data-grid/plugins`
 *
 * Plugin factories live here (dialog/store-style). Import from this path so the
 * primary package stays focused on the grid core + contracts.
 */

export { statusBarPlugin } from './lib/status-bar.plugin';
export type { StatusBarPluginOptions } from './lib/status-bar.plugin';
export { findPlugin } from './lib/find.plugin';
export type { FindPluginOptions } from './lib/find.plugin';
export { sideBarPlugin } from './lib/side-bar.plugin';
export type {
  SideBarAdapter,
  SideBarPlugin,
  SideBarPluginOptions,
} from './lib/side-bar.plugin';
export { clipboardPlugin } from './lib/clipboard.plugin';
export type { ClipboardPluginOptions } from './lib/clipboard.plugin';
export { csvExportPlugin } from './lib/csv-export.plugin';
export type { CsvExportPluginOptions } from './lib/csv-export.plugin';
export { autosizePlugin } from './lib/autosize.plugin';
export type { AutosizePluginOptions } from './lib/autosize.plugin';
export { notesPlugin, noteKey } from './lib/notes.plugin';
export type { NotesAdapter, NotesPlugin } from './lib/notes.plugin';
export type {
  Note,
  NotesCellRef,
  NotesGetParams,
  NotesMap,
  NotesPluginOptions,
  NotesSetParams,
  NotesSignal,
} from './lib/notes.types';
export { flashCellsPlugin, flashKey } from './lib/flash-cells.plugin';
export type {
  FlashCellsAdapter,
  FlashCellsPlugin,
} from './lib/flash-cells.plugin';
export type {
  FlashCellRef,
  FlashCellsParams,
  FlashCellsPluginOptions,
} from './lib/flash-cells.types';
export { cellRangePlugin } from './lib/cell-range.plugin';
export type {
  CellRangeAdapter,
  CellRangePlugin,
  CellRangePluginOptions,
} from './lib/cell-range.plugin';
export { rowDragPlugin } from './lib/row-drag.plugin';
export type {
  RowDragAdapter,
  RowDragPlugin,
  RowDragPluginOptions,
} from './lib/row-drag.plugin';
export { aggregateRowPlugin } from './lib/aggregate-row.plugin';
export { infiniteScrollPlugin } from './lib/infinite-scroll.plugin';
export type { InfiniteScrollPluginOptions } from './lib/infinite-scroll.plugin';
export { rowGroupPlugin } from './lib/row-group.plugin';
export type { RowGroupPlugin, RowGroupPluginOptions } from './lib/row-group.plugin';
export {
  createRowGroupAdapter,
  buildGroupedRowsFromAdapter,
  collectAllGroupIdsFromAdapter,
} from './lib/row-group.adapter';
export type { RowGroupAdapter } from './lib/row-group.adapter';
export { treeDataPlugin, createTreeDataAdapter } from './lib/tree-data.plugin';
export type { TreeDataPluginOptions, TreeDataPlugin, TreeDataAdapter } from './lib/tree-data.plugin';
export { defaultGridPlugins } from './lib/default-plugins';
export type { DefaultGridPluginsOptions } from './lib/default-plugins';

export { DataGridColumnsPanel } from './lib/sidebar/columns-panel';
export { DataGridFiltersPanel } from './lib/sidebar/filters-panel';
export { DataGridRowGroupPanel } from './lib/sidebar/row-group-panel';

export {
  DataGridSlotRegistry,
  activatePlugins,
  dedupePlugins,
  notifyPlugins,
} from '@angular-libs/data-grid/plugin';
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
} from '@angular-libs/data-grid/plugin';
