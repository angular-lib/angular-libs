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

/** Why focus changed — `'reconcile'` = re-anchored after rows/columns changed (no DOM steal). */
export type FocusChangeReason = 'user' | 'reconcile';

export function focusRealmOf(cell: FocusCell | null | undefined): FocusRealm {
  return cell?.realm ?? 'body';
}

/** Leaf header rowIndex: 1 when column groups exist, otherwise 0. */
export function leafHeaderRowIndex(hasColumnGroups: boolean): number {
  return hasColumnGroups ? 1 : 0;
}

export interface FocusControllerOptions {
  getRowCount: () => number;
  getColumnIds: () => string[];
  /** Map absolute row index → ensure visible (virtual scroll / page). */
  ensureRowVisible?: (rowIndex: number) => void;
  onFocusChange?: (cell: FocusCell | null, reason?: FocusChangeReason) => void;
  /** Stable identity of the body row at `rowIndex` (K4 focus follows row). */
  getRowKey?: (rowIndex: number) => string | undefined;
  /** Current index of the body row with `rowKey`, or `-1`. */
  findRowIndex?: (rowKey: string) => number;
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
  /**
   * Body rows the continuum should skip (master-detail plugin/detail shells).
   * Arrow / page moves land on the next non-skipped row, or stay put.
   */
  isSkipRow?: (rowIndex: number) => boolean;
  /** PageUp/PageDown step size (defaults to 10). Prefer viewport/rowHeight. */
  getPageRowCount?: () => number;
  /** Enter on header — toggle sort (Shift = multi). */
  onHeaderActivate?: (columnId: string, multi: boolean) => void;
  /** Alt+ArrowDown on a leaf header — open column menu. */
  onOpenColumnMenu?: (columnId: string) => void;
  /** Whether a column-group header row is present (header rowIndex 0). */
  hasColumnGroups?: () => boolean;
  /** Whether floating filter row is present for continuum navigation. */
  hasFloatingFilters?: () => boolean;
  /**
   * Enter on a floating-filter cell — focus the inner control (AG pattern).
   * Return `true` when handled (preventDefault).
   */
  onFloatingFilterEnter?: (columnId: string) => boolean;
  /**
   * Shift+arrows in body — extend cell range (OVERVIEW §5 / K7).
   * Return `true` when handled (skip normal move).
   */
  onExtendRange?: (dRow: number, dCol: number) => boolean;
  /** Non-shift body navigation — clear any active cell range. */
  onClearRange?: () => void;
  /**
   * Enter on a group / master-detail expand cell when the row is already open.
   * Return `true` to enter the nested widget instead of toggling.
   */
  onEnterWidget?: (rowIndex: number) => boolean;
}

export class FocusController {
  private focused: FocusCell | null = null;
  /** Last body/header focus for Tab re-entry (K4). */
  private lastFocus: FocusCell | null = null;
  /**
   * Stable body-row identity (`DisplayRow.id`) of `focused` / `lastFocus` so
   * {@link reconcile} can follow the row across sort / filter (K4).
   */
  private focusedKey: string | undefined;
  private lastKey: string | undefined;
  /** Visible column index at last focus — reconcile falls back here when the column goes away. */
  private columnHint = 0;

  constructor(private readonly options: FocusControllerOptions) {}

  getFocus(): FocusCell | null {
    return this.focused;
  }

  getLastFocus(): FocusCell | null {
    return this.lastFocus;
  }

  setFocus(cell: FocusCell | null): void {
    this.focused = cell ? this.stamp(cell) : null;
    this.focusedKey = this.focused ? this.rowKeyOf(this.focused) : undefined;
    if (this.focused) {
      this.lastFocus = this.focused;
      this.lastKey = this.focusedKey;
      if (focusRealmOf(this.focused) === 'body') {
        this.options.ensureRowVisible?.(this.focused.rowIndex);
      }
    }
    this.options.onFocusChange?.(this.focused);
  }

  /**
   * Re-anchor focus after the row model or visible columns changed (K4).
   * Body focus follows its row identity; a vanished row / column clamps to the
   * nearest valid cell. Notifies `onFocusChange(cell, 'reconcile')` only when
   * the focus actually changed. Never scrolls — the caller decides.
   */
  reconcile(): boolean {
    if (!this.focused) {
      const last = this.lastFocus && this.reanchor(this.lastFocus, this.lastKey);
      if (last) {
        this.lastFocus = last;
        this.lastKey = this.rowKeyOf(last);
      }
      return false;
    }
    const next = this.reanchor(this.focused, this.focusedKey);
    const nextKey = next ? this.rowKeyOf(next) : undefined;
    if (!next || (sameFocus(next, this.focused) && nextKey === this.focusedKey)) {
      return false;
    }
    this.focused = next;
    this.focusedKey = nextKey;
    this.lastFocus = next;
    this.lastKey = nextKey;
    this.options.onFocusChange?.(next, 'reconcile');
    return true;
  }

  private stamp(cell: FocusCell): FocusCell {
    const colIndex = this.options.getColumnIds().indexOf(cell.columnId);
    if (colIndex >= 0) {
      this.columnHint = colIndex;
    }
    return { ...cell, realm: focusRealmOf(cell) };
  }

  private rowKeyOf(cell: FocusCell): string | undefined {
    return focusRealmOf(cell) === 'body' ? this.options.getRowKey?.(cell.rowIndex) : undefined;
  }

  private reanchor(cell: FocusCell, rowKey: string | undefined): FocusCell | null {
    const cols = this.options.getColumnIds();
    if (!cols.length) {
      return null;
    }
    const columnId = cols.includes(cell.columnId)
      ? cell.columnId
      : cols[clamp(this.columnHint, 0, cols.length - 1)]!;
    let realm = focusRealmOf(cell);
    let rowIndex = cell.rowIndex;
    if (realm === 'floatingFilter' && !this.options.hasFloatingFilters?.()) {
      realm = 'header';
      rowIndex = this.leafHeaderRow();
    } else if (realm === 'header') {
      rowIndex = Math.min(rowIndex, this.leafHeaderRow());
    } else if (realm === 'body') {
      const count = this.options.getRowCount();
      if (count <= 0) {
        realm = 'header';
        rowIndex = this.leafHeaderRow();
      } else {
        const byKey = rowKey != null ? (this.options.findRowIndex?.(rowKey) ?? -1) : -1;
        const max = count - 1;
        rowIndex = byKey >= 0 ? byKey : clamp(rowIndex, 0, max);
        if (this.options.isSkipRow?.(rowIndex)) {
          const up = edgeNonSkipRow(this.options.isSkipRow, rowIndex, -1, max);
          rowIndex = up !== rowIndex ? up : edgeNonSkipRow(this.options.isSkipRow, rowIndex, 1, max);
        }
      }
    }
    return this.stamp({ rowIndex, columnId, realm });
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

  /** Leaf header rowIndex for this grid (1 when column groups exist). */
  leafHeaderRow(): number {
    return leafHeaderRowIndex(this.options.hasColumnGroups?.() ?? false);
  }

  private isLeafHeader(): boolean {
    return (
      focusRealmOf(this.focused) === 'header' &&
      (this.focused?.rowIndex ?? 0) === this.leafHeaderRow()
    );
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
    const hasGroups = this.options.hasColumnGroups?.() ?? false;
    const leafHeader = leafHeaderRowIndex(hasGroups);

    if (realm === 'header') {
      const headerRow = this.focused?.rowIndex ?? leafHeader;
      const onGroupRow = hasGroups && headerRow === 0;
      if (dRow > 0) {
        if (onGroupRow) {
          this.setFocus({
            rowIndex: leafHeader,
            columnId: cols[colIndex]!,
            realm: 'header',
          });
          return this.focused;
        }
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
        if (!onGroupRow && hasGroups) {
          this.setFocus({ rowIndex: 0, columnId: cols[colIndex]!, realm: 'header' });
          return this.focused;
        }
        this.setFocus({
          rowIndex: headerRow,
          columnId: cols[colIndex]!,
          realm: 'header',
        });
        return this.focused;
      }
      this.setFocus({
        rowIndex: headerRow,
        columnId: cols[colIndex]!,
        realm: 'header',
      });
      return this.focused;
    }

    if (realm === 'floatingFilter') {
      if (dRow < 0) {
        this.setFocus({
          rowIndex: this.leafHeaderRow(),
          columnId: cols[colIndex]!,
          realm: 'header',
        });
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
        this.setFocus({
          rowIndex: this.leafHeaderRow(),
          columnId: cols[colIndex]!,
          realm: 'header',
        });
      }
      return this.focused;
    }

    if (this.options.getRowCount() <= 0) {
      this.setFocus({
        rowIndex: this.leafHeaderRow(),
        columnId: cols[colIndex]!,
        realm: 'header',
      });
      return this.focused;
    }

    const max = this.options.getRowCount() - 1;
    const from = rowIndex;
    rowIndex = clamp(rowIndex + dRow, 0, max);
    rowIndex = skipBodyRows(this.options.isSkipRow, from, rowIndex, max);
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

    if (!this.focused && NAV_KEYS.has(event.key)) {
      // No focus yet (e.g. synthetic key on the frame) — land on the default / last cell.
      this.restoreOrFocusDefault();
      return true;
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
        if (realm === 'header' && event.altKey && this.focused && this.isLeafHeader()) {
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
            const max = this.options.getRowCount() - 1;
            const rowIndex = edgeNonSkipRow(this.options.isSkipRow, 0, 1, max);
            this.setFocus({
              rowIndex,
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
            const max = rowCount - 1;
            const rowIndex = edgeNonSkipRow(this.options.isSkipRow, max, -1, max);
            this.setFocus({
              rowIndex,
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
              rowIndex: this.leafHeaderRow(),
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
        // Excel Shift+F2 is cell comments; `notesPlugin` owns that chord.
        if (event.key === 'F2' && event.shiftKey) {
          return false;
        }
        if (realm === 'header') {
          if (event.key === 'Enter') {
            if (this.isLeafHeader()) {
              this.options.onHeaderActivate?.(this.focused.columnId, event.shiftKey);
            }
            return true;
          }
          return false;
        }
        if (realm === 'floatingFilter') {
          if (event.key === 'Enter') {
            return this.options.onFloatingFilterEnter?.(this.focused.columnId) ?? false;
          }
          return false;
        }
        if (this.options.isGroupRow?.(this.focused.rowIndex)) {
          if (event.key === 'Enter') {
            if (this.options.onEnterWidget?.(this.focused.rowIndex)) {
              return true;
            }
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

const NAV_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
  'PageUp',
  'PageDown',
]);

function sameFocus(a: FocusCell, b: FocusCell): boolean {
  return (
    a.rowIndex === b.rowIndex &&
    a.columnId === b.columnId &&
    focusRealmOf(a) === focusRealmOf(b)
  );
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function edgeNonSkipRow(
  isSkip: ((rowIndex: number) => boolean) | undefined,
  start: number,
  dir: 1 | -1,
  max: number,
): number {
  let i = start;
  while (i >= 0 && i <= max && isSkip?.(i)) {
    i += dir;
  }
  if (i < 0 || i > max || isSkip?.(i)) {
    return start;
  }
  return i;
}

function skipBodyRows(
  isSkip: ((rowIndex: number) => boolean) | undefined,
  from: number,
  landed: number,
  max: number,
): number {
  if (!isSkip || landed === from) {
    return landed;
  }
  const dir = landed > from ? 1 : -1;
  let i = landed;
  while (i >= 0 && i <= max && isSkip(i)) {
    i += dir;
  }
  if (i < 0 || i > max || isSkip(i)) {
    return from;
  }
  return i;
}
