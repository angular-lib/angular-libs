/**
 * Compose focused API hosts into the intersection surface used by {@link DataGridApi}.
 * Prefer depending on a narrow host in tests/features; the façade still takes the union.
 */

import type {
  DataGridApiHost,
  DataGridClipboardHost,
  DataGridColumnsHost,
  DataGridEditingHost,
  DataGridFindHost,
  DataGridRowGroupHost,
  DataGridSelectionHost,
  DataGridSideBarApiHost,
  DataGridViewportHost,
} from './grid-api';
import type { DataGridLocale } from '../locale/default-locale';

export interface DataGridLocaleHost {
  getLocale(): DataGridLocale;
}

export type ComposedDataGridApiHost<T = unknown> = DataGridApiHost<T> & DataGridLocaleHost;

export function composeDataGridApiHost<T>(parts: {
  selection: DataGridSelectionHost<T>;
  columns: DataGridColumnsHost;
  editing?: DataGridEditingHost;
  viewport?: DataGridViewportHost<T>;
  find: DataGridFindHost;
  rowGroup?: DataGridRowGroupHost;
  clipboard?: DataGridClipboardHost<T>;
  locale: DataGridLocaleHost;
  sideBar?: DataGridSideBarApiHost;
}): ComposedDataGridApiHost<T> {
  return {
    ...parts.selection,
    ...parts.columns,
    ...parts.find,
    ...parts.locale,
    ...(parts.editing ?? {}),
    ...(parts.viewport ?? {}),
    ...(parts.rowGroup ?? {}),
    ...(parts.clipboard ?? {}),
    ...(parts.sideBar ?? {}),
  };
}
