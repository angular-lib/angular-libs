/**
 * Keyboard / focus model for the grid (OVERVIEW §5c).
 * Body navigation is stable; header / floatingFilter realms enable Wave 2 continuum.
 */

export type FocusRealm = 'body' | 'header' | 'floatingFilter';

export interface FocusCell {
  rowIndex: number;
  columnId: string;
  /** Defaults to `'body'` when omitted (backward compatible). */
  realm?: FocusRealm;
}

export function focusRealmOf(cell: FocusCell | null | undefined): FocusRealm {
  return cell?.realm ?? 'body';
}

export interface FocusControllerOptions {
  getRowCount: () => number;
  getColumnIds: () => string[];
  /** Map absolute row index → ensure visible (virtual scroll / page). */
  ensureRowVisible?: (rowIndex: number) => void;
  onFocusChange?: (cell: FocusCell | null) => void;
  /**
   * Enter / F2 — start editing focused cell (data rows).
   * `reason` lets §5b `enterIdle: 'moveDown'` apply only to Enter (F2 always edits).
   */
  onStartEdit?: (cell: FocusCell, reason: 'enter' | 'f2') => void;
  /** Escape — cancel in-progress edit. */
  onCancelEdit?: () => void;
  /** Space — toggle row selection (data rows). */
  onToggleSelect?: (rowIndex: number) => void;
  /**
   * Ctrl/Cmd+A — select all visible / page rows.
   * Return `false` to leave the browser default (e.g. when selection is not multi).
   */
  onSelectAll?: () => boolean | void;
  /** Enter / Space on a group row — expand/collapse. */
  onToggleGroup?: (rowIndex: number) => void;
  /** True when the focused display row is a group header. */
  isGroupRow?: (rowIndex: number) => boolean;
  /** PageUp/PageDown step size (defaults to 10). Prefer viewport/rowHeight. */
  getPageRowCount?: () => number;
  /** Enter on header — toggle sort (Shift = multi). */
  onHeaderActivate?: (columnId: string, multi: boolean) => void;
  /** Alt+ArrowDown on header — open column menu (may be a stub). */
  onOpenColumnMenu?: (columnId: string) => void;
  /** Whether floating filter row is present for continuum navigation. */
  hasFloatingFilters?: () => boolean;
  /**
   * Shift+arrows in body — extend cell range (OVERVIEW §5 / K7).
   * Return `true` when handled (skip normal move).
   */
  onExtendRange?: (dRow: number, dCol: number) => boolean;
  /** Non-shift body navigation — clear any active cell range. */
  onClearRange?: () => void;
}

export class FocusController {
  private focused: FocusCell | null = null;
  /** Last body/header focus for Tab re-entry (K4). */
  private lastFocus: FocusCell | null = null;

  constructor(private readonly options: FocusControllerOptions) {}

  getFocus(): FocusCell | null {
    return this.focused;
  }

  getLastFocus(): FocusCell | null {
    return this.lastFocus;
  }

  setFocus(cell: FocusCell | null): void {
    this.focused = cell
      ? { ...cell, realm: focusRealmOf(cell) }
      : null;
    if (this.focused) {
      this.lastFocus = this.focused;
      if (focusRealmOf(this.focused) === 'body') {
        this.options.ensureRowVisible?.(this.focused.rowIndex);
      }
    }
    this.options.onFocusChange?.(this.focused);
  }

  /** Restore last focus or first body/header cell (Tab into grid). */
  restoreOrFocusDefault(): FocusCell | null {
    const cols = this.options.getColumnIds();
    if (!cols.length) {
      return null;
    }
    if (this.lastFocus && cols.includes(this.lastFocus.columnId)) {
      const realm = focusRealmOf(this.lastFocus);
      if (realm === 'body') {
        const max = this.options.getRowCount() - 1;
        if (this.lastFocus.rowIndex >= 0 && this.lastFocus.rowIndex <= max) {
          this.setFocus(this.lastFocus);
          return this.focused;
        }
      } else {
        this.setFocus(this.lastFocus);
        return this.focused;
      }
    }
    if (this.options.getRowCount() > 0) {
      this.setFocus({ rowIndex: 0, columnId: cols[0]!, realm: 'body' });
    } else {
      this.setFocus({ rowIndex: 0, columnId: cols[0]!, realm: 'header' });
    }
    return this.focused;
  }

  focusCell(rowIndex: number, columnId: string, realm: FocusRealm = 'body'): void {
    const cols = this.options.getColumnIds();
    if (!cols.includes(columnId)) {
      return;
    }
    if (realm === 'body') {
      const max = this.options.getRowCount() - 1;
      if (rowIndex < 0 || rowIndex > max) {
        return;
      }
    }
    this.setFocus({ rowIndex, columnId, realm });
  }

  /**
   * Move horizontally with row wrap (Excel-style Tab after commit).
   * Stays put when already at the first/last body cell.
   */
  moveHorizontalWrap(dCol: number): FocusCell | null {
    const cols = this.options.getColumnIds();
    if (!cols.length || focusRealmOf(this.focused) !== 'body') {
      return this.move(0, dCol);
    }

    const rowCount = this.options.getRowCount();
    if (rowCount <= 0) {
      return this.focused;
    }

    let rowIndex = this.focused?.rowIndex ?? 0;
    let colIndex = this.focused
      ? Math.max(0, cols.indexOf(this.focused.columnId))
      : 0;

    colIndex += dCol;
    if (colIndex >= cols.length) {
      colIndex = 0;
      rowIndex += 1;
    } else if (colIndex < 0) {
      colIndex = cols.length - 1;
      rowIndex -= 1;
    }

    if (rowIndex < 0 || rowIndex >= rowCount) {
      return this.focused;
    }

    this.options.onClearRange?.();
    this.setFocus({ rowIndex, columnId: cols[colIndex]!, realm: 'body' });
    return this.focused;
  }

  move(dRow: number, dCol: number): FocusCell | null {
    const cols = this.options.getColumnIds();
    if (!cols.length) {
      return null;
    }

    const realm = focusRealmOf(this.focused);
    let rowIndex = this.focused?.rowIndex ?? 0;
    let colIndex = this.focused
      ? Math.max(0, cols.indexOf(this.focused.columnId))
      : 0;

    colIndex = clamp(colIndex + dCol, 0, cols.length - 1);

    if (realm === 'header') {
      if (dRow > 0) {
        if (this.options.hasFloatingFilters?.()) {
          this.setFocus({ rowIndex: 0, columnId: cols[colIndex]!, realm: 'floatingFilter' });
          return this.focused;
        }
        if (this.options.getRowCount() > 0) {
          this.setFocus({ rowIndex: 0, columnId: cols[colIndex]!, realm: 'body' });
          return this.focused;
        }
        return this.focused;
      }
      if (dRow < 0) {
        // Stay on header (no group-header realm yet).
        this.setFocus({ rowIndex: 0, columnId: cols[colIndex]!, realm: 'header' });
        return this.focused;
      }
      this.setFocus({ rowIndex: 0, columnId: cols[colIndex]!, realm: 'header' });
      return this.focused;
    }

    if (realm === 'floatingFilter') {
      if (dRow < 0) {
        this.setFocus({ rowIndex: 0, columnId: cols[colIndex]!, realm: 'header' });
        return this.focused;
      }
      if (dRow > 0 && this.options.getRowCount() > 0) {
        this.setFocus({ rowIndex: 0, columnId: cols[colIndex]!, realm: 'body' });
        return this.focused;
      }
      this.setFocus({ rowIndex: 0, columnId: cols[colIndex]!, realm: 'floatingFilter' });
      return this.focused;
    }

    // body
    if (dRow < 0 && rowIndex + dRow < 0) {
      if (this.options.hasFloatingFilters?.()) {
        this.setFocus({ rowIndex: 0, columnId: cols[colIndex]!, realm: 'floatingFilter' });
      } else {
        this.setFocus({ rowIndex: 0, columnId: cols[colIndex]!, realm: 'header' });
      }
      return this.focused;
    }

    if (this.options.getRowCount() <= 0) {
      this.setFocus({ rowIndex: 0, columnId: cols[colIndex]!, realm: 'header' });
      return this.focused;
    }

    rowIndex = clamp(rowIndex + dRow, 0, this.options.getRowCount() - 1);
    const next: FocusCell = { rowIndex, columnId: cols[colIndex]!, realm: 'body' };
    this.setFocus(next);
    return next;
  }

  handleKeydown(event: KeyboardEvent): boolean {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
      if (!this.options.onSelectAll) {
        return false;
      }
      return this.options.onSelectAll() !== false;
    }

    const pageRows = Math.max(1, this.options.getPageRowCount?.() ?? 10);
    const realm = focusRealmOf(this.focused);

    switch (event.key) {
      case 'ArrowUp':
        if (realm === 'body' && event.shiftKey && this.options.onExtendRange?.(-1, 0)) {
          return true;
        }
        if (realm === 'body' && !event.shiftKey) {
          this.options.onClearRange?.();
        }
        this.move(-1, 0);
        return true;
      case 'ArrowDown':
        if (realm === 'header' && event.altKey && this.focused) {
          this.options.onOpenColumnMenu?.(this.focused.columnId);
          return true;
        }
        if (realm === 'body' && event.shiftKey && this.options.onExtendRange?.(1, 0)) {
          return true;
        }
        if (realm === 'body' && !event.shiftKey) {
          this.options.onClearRange?.();
        }
        this.move(1, 0);
        return true;
      case 'ArrowLeft':
        if (realm === 'body' && event.shiftKey && this.options.onExtendRange?.(0, -1)) {
          return true;
        }
        if (realm === 'body' && !event.shiftKey) {
          this.options.onClearRange?.();
        }
        this.move(0, -1);
        return true;
      case 'ArrowRight':
        if (realm === 'body' && event.shiftKey && this.options.onExtendRange?.(0, 1)) {
          return true;
        }
        if (realm === 'body' && !event.shiftKey) {
          this.options.onClearRange?.();
        }
        this.move(0, 1);
        return true;
      case 'Home':
        if (event.ctrlKey || event.metaKey) {
          if (realm === 'body' && this.options.getRowCount() > 0 && this.focused) {
            // Clamp to first body row — do not bridge into header continuum.
            this.options.onClearRange?.();
            this.setFocus({
              rowIndex: 0,
              columnId: this.focused.columnId,
              realm: 'body',
            });
          }
        } else if (this.focused) {
          const cols = this.options.getColumnIds();
          if (cols[0]) {
            this.setFocus({
              rowIndex: this.focused.rowIndex,
              columnId: cols[0],
              realm,
            });
          }
        }
        return true;
      case 'End':
        if (event.ctrlKey || event.metaKey) {
          const rowCount = this.options.getRowCount();
          if (realm === 'body' && rowCount > 0 && this.focused) {
            this.options.onClearRange?.();
            this.setFocus({
              rowIndex: rowCount - 1,
              columnId: this.focused.columnId,
              realm: 'body',
            });
          }
        } else if (this.focused) {
          const cols = this.options.getColumnIds();
          const last = cols[cols.length - 1];
          if (last) {
            this.setFocus({
              rowIndex: this.focused.rowIndex,
              columnId: last,
              realm,
            });
          }
        }
        return true;
      case 'PageDown':
        if (realm === 'header' || realm === 'floatingFilter') {
          // Mirror ArrowUp from body → header: jump into the first body row.
          if (this.options.getRowCount() > 0 && this.focused) {
            const cols = this.options.getColumnIds();
            const colIndex = Math.max(0, cols.indexOf(this.focused.columnId));
            this.setFocus({
              rowIndex: 0,
              columnId: cols[colIndex] ?? cols[0]!,
              realm: 'body',
            });
          }
          return true;
        }
        if (realm === 'body') {
          this.move(pageRows, 0);
        }
        return true;
      case 'PageUp':
        if (realm === 'body' && (this.focused?.rowIndex ?? 0) === 0) {
          // Symmetric: from first body row, PageUp returns to header / floating filter.
          const cols = this.options.getColumnIds();
          const colIndex = this.focused
            ? Math.max(0, cols.indexOf(this.focused.columnId))
            : 0;
          if (this.options.hasFloatingFilters?.()) {
            this.setFocus({
              rowIndex: 0,
              columnId: cols[colIndex] ?? cols[0]!,
              realm: 'floatingFilter',
            });
          } else if (cols.length) {
            this.setFocus({
              rowIndex: 0,
              columnId: cols[colIndex] ?? cols[0]!,
              realm: 'header',
            });
          }
          return true;
        }
        if (realm === 'body') {
          this.move(-pageRows, 0);
        }
        return true;
      case 'Enter':
      case 'F2':
        if (!this.focused) {
          return false;
        }
        if (realm === 'header') {
          if (event.key === 'Enter') {
            this.options.onHeaderActivate?.(this.focused.columnId, event.shiftKey);
            return true;
          }
          return false;
        }
        if (realm === 'floatingFilter') {
          // Enter focuses filter control — host/template handles; don't start edit.
          return false;
        }
        if (this.options.isGroupRow?.(this.focused.rowIndex)) {
          if (event.key === 'Enter') {
            this.options.onToggleGroup?.(this.focused.rowIndex);
            return true;
          }
          return false;
        }
        this.options.onStartEdit?.(this.focused, event.key === 'F2' ? 'f2' : 'enter');
        return true;
      case 'Escape':
        this.options.onCancelEdit?.();
        return true;
      case ' ':
      case 'Spacebar':
        if (!this.focused || realm !== 'body') {
          return false;
        }
        if (this.options.isGroupRow?.(this.focused.rowIndex)) {
          this.options.onToggleGroup?.(this.focused.rowIndex);
          return true;
        }
        this.options.onToggleSelect?.(this.focused.rowIndex);
        return true;
      default:
        return false;
    }
  }

  /** Alt+↓ when header focused — also callable from keydown path above. */
  openColumnMenuFromFocus(): boolean {
    if (focusRealmOf(this.focused) !== 'header' || !this.focused) {
      return false;
    }
    this.options.onOpenColumnMenu?.(this.focused.columnId);
    return true;
  }

  isFocused(rowIndex: number, columnId: string, realm: FocusRealm = 'body'): boolean {
    return (
      !!this.focused &&
      focusRealmOf(this.focused) === realm &&
      this.focused.rowIndex === rowIndex &&
      this.focused.columnId === columnId
    );
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
