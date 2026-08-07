/**
 * Compose focused API hosts into the intersection surface used by {@link DataGridApi}.
 * Prefer depending on a narrow host in tests/features; the façade still takes the union.
 *
 * Class instances are supported: prototype methods are bound onto the composed object
 * (plain `{...host}` would drop them).
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

/** Flatten own + prototype methods from a host (class instance or plain object). */
function flattenHost<T extends object>(host: T): T {
  const out: Record<string, unknown> = { ...(host as Record<string, unknown>) };
  let proto: object | null = Object.getPrototypeOf(host);
  while (proto && proto !== Object.prototype) {
    for (const key of Object.getOwnPropertyNames(proto)) {
      if (key === 'constructor' || key in out) {
        continue;
      }
      const desc = Object.getOwnPropertyDescriptor(proto, key);
      if (!desc || typeof desc.value !== 'function') {
        continue;
      }
      out[key] = (desc.value as (...args: unknown[]) => unknown).bind(host);
    }
    proto = Object.getPrototypeOf(proto);
  }
  return out as T;
}

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
    ...flattenHost(parts.selection),
    ...flattenHost(parts.columns),
    ...flattenHost(parts.find),
    ...flattenHost(parts.locale),
    ...(parts.editing ? flattenHost(parts.editing) : {}),
    ...(parts.viewport ? flattenHost(parts.viewport) : {}),
    ...(parts.rowGroup ? flattenHost(parts.rowGroup) : {}),
    ...(parts.clipboard ? flattenHost(parts.clipboard) : {}),
    ...(parts.sideBar ? flattenHost(parts.sideBar) : {}),
  };
}
