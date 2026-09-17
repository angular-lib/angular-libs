import { focusRealmOf, type FocusCell } from '../controllers/focus';
import type { DataGridNestedRealm } from './nested-realm';

export function focusIsInsideNestedGrid(host: HTMLElement): boolean {
  const active = typeof document !== 'undefined' ? document.activeElement : null;
  if (!(active instanceof Node)) {
    return false;
  }
  for (const grid of host.querySelectorAll(':scope al-data-grid')) {
    if (grid.contains(active)) {
      return true;
    }
  }
  return false;
}

function prevent(event?: Event): void {
  (event as KeyboardEvent | undefined)?.preventDefault?.();
}

export function handleGridEscape(ctx: {
  event?: Event;
  host: HTMLElement;
  nestedRealm: DataGridNestedRealm | null;
  focus: FocusCell | null;
  hadEdit: boolean;
  cancelEdit: () => void;
  headerMenuOpen: boolean;
  closeMenus: () => void;
  hadCellRange: boolean;
  clearCellRange: () => void;
  contextMenuOpen: boolean;
  closeContextMenu: () => void;
  focusHeader: (columnId: string) => void;
  clearOwnFocus?: () => void;
}): void {
  const event = ctx.event;
  if (event?.defaultPrevented || focusIsInsideNestedGrid(ctx.host)) {
    return;
  }
  if (ctx.hadEdit) {
    ctx.cancelEdit();
    prevent(event);
    return;
  }
  if (ctx.headerMenuOpen) {
    ctx.closeMenus();
    prevent(event);
    return;
  }
  if (ctx.focus && focusRealmOf(ctx.focus) === 'floatingFilter') {
    const filterEl = ctx.host.querySelector(
      `[data-testid="al-dg-filter-${ctx.focus.columnId}"]`,
    ) as HTMLElement | null;
    const active = typeof document !== 'undefined' ? document.activeElement : null;
    if (filterEl && active instanceof HTMLElement && filterEl.contains(active) && active !== filterEl) {
      filterEl.focus({ preventScroll: true });
      prevent(event);
      return;
    }
    ctx.focusHeader(ctx.focus.columnId);
    prevent(event);
    return;
  }
  if (ctx.hadCellRange) {
    ctx.clearCellRange();
    prevent(event);
    return;
  }
  ctx.closeContextMenu();
  if (ctx.contextMenuOpen) {
    prevent(event);
    return;
  }
  if (ctx.nestedRealm?.exitToMaster()) {
    ctx.clearOwnFocus?.();
    prevent(event);
  }
}
