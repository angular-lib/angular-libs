/**
 * Keyboard / focus model for the grid.
 */

export interface FocusCell {
  rowIndex: number;
  columnId: string;
}

export interface FocusControllerOptions {
  getRowCount: () => number;
  getColumnIds: () => string[];
  /** Map absolute row index → ensure visible (virtual scroll / page). */
  ensureRowVisible?: (rowIndex: number) => void;
  onFocusChange?: (cell: FocusCell | null) => void;
  /** Enter / F2 — start editing focused cell (data rows). */
  onStartEdit?: (cell: FocusCell) => void;
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
}

export class FocusController {
  private focused: FocusCell | null = null;

  constructor(private readonly options: FocusControllerOptions) {}

  getFocus(): FocusCell | null {
    return this.focused;
  }

  setFocus(cell: FocusCell | null): void {
    this.focused = cell;
    if (cell) {
      this.options.ensureRowVisible?.(cell.rowIndex);
    }
    this.options.onFocusChange?.(cell);
  }

  focusCell(rowIndex: number, columnId: string): void {
    const cols = this.options.getColumnIds();
    if (!cols.includes(columnId)) {
      return;
    }
    const max = this.options.getRowCount() - 1;
    if (rowIndex < 0 || rowIndex > max) {
      return;
    }
    this.setFocus({ rowIndex, columnId });
  }

  move(dRow: number, dCol: number): FocusCell | null {
    const cols = this.options.getColumnIds();
    if (!cols.length || this.options.getRowCount() <= 0) {
      return null;
    }

    let rowIndex = this.focused?.rowIndex ?? 0;
    let colIndex = this.focused
      ? Math.max(0, cols.indexOf(this.focused.columnId))
      : 0;

    rowIndex = clamp(rowIndex + dRow, 0, this.options.getRowCount() - 1);
    colIndex = clamp(colIndex + dCol, 0, cols.length - 1);

    const next = { rowIndex, columnId: cols[colIndex]! };
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

    switch (event.key) {
      case 'ArrowUp':
        this.move(-1, 0);
        return true;
      case 'ArrowDown':
        this.move(1, 0);
        return true;
      case 'ArrowLeft':
        this.move(0, -1);
        return true;
      case 'ArrowRight':
        this.move(0, 1);
        return true;
      case 'Home':
        if (event.ctrlKey || event.metaKey) {
          this.move(-this.options.getRowCount(), 0);
        } else if (this.focused) {
          const cols = this.options.getColumnIds();
          if (cols[0]) {
            this.setFocus({ rowIndex: this.focused.rowIndex, columnId: cols[0] });
          }
        }
        return true;
      case 'End':
        if (event.ctrlKey || event.metaKey) {
          this.move(this.options.getRowCount(), 0);
        } else if (this.focused) {
          const cols = this.options.getColumnIds();
          const last = cols[cols.length - 1];
          if (last) {
            this.setFocus({ rowIndex: this.focused.rowIndex, columnId: last });
          }
        }
        return true;
      case 'PageDown':
        this.move(pageRows, 0);
        return true;
      case 'PageUp':
        this.move(-pageRows, 0);
        return true;
      case 'Enter':
      case 'F2':
        if (this.focused) {
          if (this.options.isGroupRow?.(this.focused.rowIndex)) {
            if (event.key === 'Enter') {
              this.options.onToggleGroup?.(this.focused.rowIndex);
              return true;
            }
            return false;
          }
          this.options.onStartEdit?.(this.focused);
          return true;
        }
        return false;
      case 'Escape':
        this.options.onCancelEdit?.();
        return true;
      case ' ':
      case 'Spacebar':
        if (this.focused) {
          if (this.options.isGroupRow?.(this.focused.rowIndex)) {
            this.options.onToggleGroup?.(this.focused.rowIndex);
            return true;
          }
          this.options.onToggleSelect?.(this.focused.rowIndex);
          return true;
        }
        return false;
      default:
        return false;
    }
  }

  isFocused(rowIndex: number, columnId: string): boolean {
    return !!this.focused && this.focused.rowIndex === rowIndex && this.focused.columnId === columnId;
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
