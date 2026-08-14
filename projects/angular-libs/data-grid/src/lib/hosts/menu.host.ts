import {
  defaultContextMenuItems,
  positionMenu,
  resolveContextMenuItems,
  writeClipboardText,
} from '../utils/context-menu';
import { buildLeanColumnMenuItems } from '../utils/column-menu';
import { rowsToCsv } from '../utils/csv';
import { formatCellValue } from '../utils/cell-value';
import { signal, type WritableSignal } from '@angular/core';
import type { MenuDeps } from './binder-surface';
import type {
  DataGridContextMenuContext,
  DataGridContextMenuItem,
  ResolvedColumn,
} from '../components/data-grid/data-grid.types';

/** Owns context menus and lean column menus (menu state signals). */
export class MenuHost<T> {
  readonly contextMenuState: WritableSignal<{
    left: number;
    top: number;
    ctx: DataGridContextMenuContext<T> | null;
    source: 'cell' | 'header';
    items: DataGridContextMenuItem<T>[];
  } | null> = signal(null);
  readonly columnMenuColumnId: WritableSignal<string | null> = signal(null);

  constructor(private readonly s: MenuDeps<T>) {}

  contextMenuEnabled(): boolean {
    return !!(
      this.s.contextMenu() ||
      this.s.contextMenuItems() ||
      this.s.contextMenuOverlayPresent() ||
      this.s.kernel().capabilities.hasContextMenuItems()
    );
  }

  /** Lean column menu — pin / sort / autosize / hide (Wave 4). */
  openColumnMenu(columnId: string): void {
    const column = this.s.columnsById().get(columnId);
    if (!column) {
      return;
    }
    this.columnMenuColumnId.set(columnId);
    const items = this.leanColumnMenuItems(column);
    const escape =
      typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
        ? CSS.escape
        : (str: string) => str.replace(/"/g, '\\"');
    const th = this.s.hostElement().querySelector(
      `[data-testid="al-dg-col-${escape(columnId)}"]`,
    ) as HTMLElement | null;
    const rect = th?.getBoundingClientRect();
    const pos = positionMenu(
      rect?.left ?? 8,
      (rect?.bottom ?? 8) + 4,
      220,
      8 + items.length * 36,
    );
    this.contextMenuState.set({
      left: pos.left,
      top: pos.top,
      ctx: null,
      source: 'header',
      items,
    });
    this.focusFirstMenuItem();
  }

  closeColumnMenu(): void {
    this.columnMenuColumnId.set(null);
    if (this.contextMenuState()?.source === 'header') {
      this.contextMenuState.set(null);
    }
  }

  leanColumnMenuItems(column: ResolvedColumn<T>): DataGridContextMenuItem<T>[] {
    const locale = this.s.resolvedLocale();
    const pinned = column.pinned === 'left' || column.pinned === 'right' ? column.pinned : null;
    const sortDirection =
      this.s.sorts().find((entry) => entry.columnId === column.id)?.direction ?? null;
    return buildLeanColumnMenuItems({
      locale,
      pinned,
      sortable: !!column.sortable,
      sortDirection,
      canHide: this.s.visibleColumns().length > 1,
      sortAsc: () => this.s.setColumnSort(column.id, 'asc'),
      sortDesc: () => this.s.setColumnSort(column.id, 'desc'),
      clearSort: () => this.s.setColumnSort(column.id, null),
      pinLeft: () => this.s.setColumnPinned(column.id, 'left'),
      pinRight: () => this.s.setColumnPinned(column.id, 'right'),
      unpin: () => this.s.setColumnPinned(column.id, null),
      autosize: () => this.s.autoSizeColumns([column.id]),
      hide: () => this.s.setColumnVisible(column.id, false),
    });
  }

  onCellContextMenu(
    row: T,
    rowId: string | number,
    rowIndex: number,
    column: ResolvedColumn<T>,
    value: unknown,
    event: MouseEvent,
    displayIndex?: number,
  ): void {
    if (!this.contextMenuEnabled()) {
      return;
    }
    if (event.ctrlKey || event.metaKey) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();

    this.s.kernel().focus.focusCell(displayIndex ?? rowIndex, column.id);

    const ctx: DataGridContextMenuContext<T> = {
      row,
      rowId,
      rowIndex,
      column,
      columnId: column.id,
      value,
      event,
      selectedIds: this.s.selectedIds(),
      form: this.s.isRowEditing(rowId) ? this.s.rowForm() : null,
      close: () => this.closeContextMenu(),
    };

    const custom = this.s.contextMenuItems();
    const pluginItems = this.s.kernel().capabilities.resolveContextMenuItems(ctx);
    let hostItems: DataGridContextMenuItem<T>[] = [];
    if (custom) {
      hostItems = resolveContextMenuItems(custom, ctx);
    } else if (this.s.contextMenu() || this.s.contextMenuOverlayPresent()) {
      hostItems = defaultContextMenuItems<T>({
        copyCell: () => writeClipboardText(formatCellValue(value, row, column, rowIndex)),
        copyRow: () =>
          writeClipboardText(
            rowsToCsv([row], this.s.visibleColumns(), { includeHeaders: false }),
          ),
        exportCsv: () => this.s.exportCsv(),
        autoSize: () => this.s.autoSizeColumns(),
        clearFilters: () => this.s.clearFilters(),
        hasFilters:
          Object.keys(this.s.filters()).length > 0 || this.s.quickFilter().trim().length > 0,
        locale: this.s.resolvedLocale(),
      });
    }
    const items = [...pluginItems, ...hostItems];

    if (!this.s.contextMenuTemplate() && !items.length) {
      return;
    }

    const pos = positionMenu(event.clientX, event.clientY, 200, 8 + items.length * 36);
    this.contextMenuState.set({ left: pos.left, top: pos.top, ctx, source: 'cell', items });
    this.s.publishContextMenuOpened(ctx);
    this.focusFirstMenuItem();
  }

  /**
   * Lean column menu — Alt+↓ / API, and header right-click.
   */
  onHeaderContextMenu(column: ResolvedColumn<T>, event: MouseEvent): void {
    if (event.ctrlKey || event.metaKey) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();

    this.columnMenuColumnId.set(column.id);
    const items = this.leanColumnMenuItems(column);
    const pos = positionMenu(event.clientX, event.clientY, 220, 8 + items.length * 36);
    this.contextMenuState.set({
      left: pos.left,
      top: pos.top,
      ctx: null,
      source: 'header',
      items,
    });
    this.focusFirstMenuItem();
  }

  runContextMenuItem(item: DataGridContextMenuItem<T>): void {
    const menu = this.contextMenuState();
    if (!menu || item.disabled) {
      return;
    }
    if (menu.ctx) {
      item.action?.(menu.ctx);
    } else {
      (item.action as (() => void) | undefined)?.();
    }
    this.closeContextMenu();
  }

  closeContextMenu(): void {
    if (!this.contextMenuState()) {
      this.columnMenuColumnId.set(null);
      return;
    }
    this.contextMenuState.set(null);
    this.columnMenuColumnId.set(null);
    this.s.publishContextMenuClosed();
  }

  /** Arrow / Home / End / Escape while a column or context menu is open (AG pattern). */
  onMenuKeydown(event: KeyboardEvent): void {
    if (!this.contextMenuState()) {
      return;
    }
    const items = this.menuItemElements();
    if (!items.length) {
      return;
    }
    const current = typeof document !== 'undefined' ? document.activeElement : null;
    let index = items.findIndex((el) => el === current || el.contains(current));
    if (index < 0) {
      index = 0;
    }
    if (event.key === 'ArrowDown') {
      items[(index + 1) % items.length]!.focus();
    } else if (event.key === 'ArrowUp') {
      items[(index - 1 + items.length) % items.length]!.focus();
    } else if (event.key === 'Home') {
      items[0]!.focus();
    } else if (event.key === 'End') {
      items[items.length - 1]!.focus();
    } else if (event.key === 'Escape') {
      this.closeContextMenu();
      this.closeColumnMenu();
    } else {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  }

  private menuItemElements(): HTMLElement[] {
    return Array.from(
      this.s.hostElement().querySelectorAll<HTMLElement>('.al-data-grid__ctx-item:not(:disabled)'),
    );
  }

  private focusFirstMenuItem(): void {
    queueMicrotask(() => this.menuItemElements()[0]?.focus());
  }

  onDocumentPointerDown(event: Event): void {
    if (!this.contextMenuState()) {
      return;
    }
    const target = event.target as Node | null;
    const menuEl = this.s.hostElement().querySelector('.al-data-grid__ctx');
    if (menuEl && target && menuEl.contains(target)) {
      return;
    }
    this.closeContextMenu();
  }
}
