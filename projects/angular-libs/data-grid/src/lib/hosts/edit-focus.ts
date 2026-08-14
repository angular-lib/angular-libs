import { afterNextRender, type Injector } from '@angular/core';
import { focusRealmOf, type FocusCell } from '../controllers/focus';
import { isDataDisplayRow, isGroupDisplayRow, type DisplayRow } from '../utils/row-display';
import type { ResolvedColumn } from '../components/data-grid/data-grid.types';

const EDITOR_SELECTOR =
  '.al-data-grid__edit-input, .al-data-grid__edit-check, .al-data-grid__editor-host input, .al-data-grid__editor-host textarea, .al-data-grid__editor-host select, .al-data-grid__editor-host [contenteditable="true"]';

export function isEditorEventTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable ||
    !!target.closest(
      '.al-data-grid__edit-input, .al-data-grid__edit-check, .al-data-grid__editor-host',
    )
  );
}

export function focusEditorInCell(
  host: HTMLElement,
  rowId: string | number,
  columnId: string,
  select = true,
): boolean {
  const root = host.querySelector(
    `[data-testid="al-dg-cell-${rowId}-${columnId}"]`,
  ) as HTMLElement | null;
  if (!root) {
    return false;
  }
  const editor = root.querySelector(EDITOR_SELECTOR) as HTMLElement | null;
  if (!editor) {
    return false;
  }
  editor.focus({ preventScroll: true });
  if (
    select &&
    editor instanceof HTMLInputElement &&
    editor.type !== 'checkbox' &&
    editor.type !== 'date' &&
    typeof editor.select === 'function'
  ) {
    editor.select();
  }
  return true;
}

export function activateFloatingFilter(host: HTMLElement, columnId: string): boolean {
  const el = host.querySelector(
    `[data-testid="al-dg-filter-${columnId}"]`,
  ) as HTMLElement | null;
  if (!el) {
    return false;
  }
  const inner = el.querySelector('input, select, textarea') as HTMLElement | null;
  if (!inner) {
    return false;
  }
  const active = typeof document !== 'undefined' ? document.activeElement : null;
  if (active === inner || (active instanceof HTMLElement && inner.contains(active))) {
    return false;
  }
  inner.focus({ preventScroll: true });
  return true;
}

export interface SyncDomFocusModel<T> {
  hostElement(): HTMLElement;
  injector(): Injector;
  pagedDisplayRows(): readonly DisplayRow<T>[];
  columnsById(): Map<string, ResolvedColumn<T>>;
  editingCell(): { rowId: string | number; columnId: string } | null;
  isRowEditing(rowId: string | number): boolean;
}

/** Sole owner of TD vs editor DOM focus. */
export function syncDomFocus<T>(
  model: SyncDomFocusModel<T>,
  cell: FocusCell | null,
  opts?: { force?: boolean },
): void {
  if (!cell) {
    return;
  }
  const force = opts?.force === true;
  const host = model.hostElement();
  const apply = (allowRetry: boolean): void => {
    const realm = focusRealmOf(cell);
    if (realm === 'header') {
      const headerRow = cell.rowIndex ?? 0;
      if (headerRow === 0) {
        const groupEl = host.querySelector(
          `.al-data-grid__header-row--group [data-leaf-ids~="${cssEscape(cell.columnId)}"]`,
        ) as HTMLElement | null;
        if (groupEl) {
          groupEl.focus({ preventScroll: true });
          return;
        }
      }
      const el = host.querySelector(
        `[data-testid="al-dg-col-${cell.columnId}"]`,
      ) as HTMLElement | null;
      el?.focus({ preventScroll: true });
      return;
    }
    if (realm === 'floatingFilter') {
      const el = host.querySelector(
        `[data-testid="al-dg-filter-${cell.columnId}"]`,
      ) as HTMLElement | null;
      if (!el) {
        return;
      }
      const active = typeof document !== 'undefined' ? document.activeElement : null;
      if (active instanceof HTMLElement && el.contains(active) && active !== el) {
        return;
      }
      el.focus({ preventScroll: true });
      return;
    }
    const item = model.pagedDisplayRows()[cell.rowIndex];
    if (!item) {
      return;
    }
    if (isGroupDisplayRow(item)) {
      const el = host.querySelector(
        `[data-testid="al-dg-group-${item.id}"] [role="gridcell"]`,
      ) as HTMLElement | null;
      el?.focus({ preventScroll: true });
      return;
    }
    if (item.kind === 'plugin') {
      const el = host.querySelector(
        `[data-testid="al-dg-plugin-row-${item.id}"] [role="gridcell"], [data-testid="al-dg-plugin-row-${item.id}"] .al-data-grid__td`,
      ) as HTMLElement | null;
      el?.focus({ preventScroll: true });
      return;
    }
    if (!isDataDisplayRow(item)) {
      return;
    }
    const el = host.querySelector(
      `[data-testid="al-dg-cell-${item.rowId}-${cell.columnId}"]`,
    ) as HTMLElement | null;
    const col = model.columnsById().get(cell.columnId);
    const editing = model.editingCell();
    const cellEditing = editing?.rowId === item.rowId && editing?.columnId === cell.columnId;
    const rowEditing = model.isRowEditing(item.rowId) && !!col?.editable;
    const wantsEditor = cellEditing || rowEditing;
    const active = typeof document !== 'undefined' ? document.activeElement : null;

    if (
      wantsEditor &&
      el &&
      active instanceof HTMLElement &&
      el.contains(active) &&
      isEditorEventTarget(active)
    ) {
      return;
    }
    if (wantsEditor && focusEditorInCell(host, item.rowId, cell.columnId)) {
      return;
    }
    if (wantsEditor && allowRetry) {
      afterNextRender(() => apply(false), { injector: model.injector() });
      return;
    }
    if (
      !force &&
      active instanceof HTMLElement &&
      el &&
      !el.contains(active) &&
      active !== document.body &&
      active !== host
    ) {
      return;
    }
    el?.focus({ preventScroll: true });
  };

  queueMicrotask(() => apply(true));
}

function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
