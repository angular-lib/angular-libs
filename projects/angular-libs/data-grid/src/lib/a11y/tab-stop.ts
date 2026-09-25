import { focusRealmOf, leafHeaderRowIndex, type FocusCell } from '../controllers/focus';

export interface FocusRenderModel {
  focus: FocusCell | null;
  visibleColumnIds: readonly string[];
  hasColumnGroups: boolean;
  floatingFiltersShown: boolean;
  /** Body rows are rendered (not loading / empty). */
  bodyRendered: boolean;
  /** Rendered (virtual window) slice of the paged display rows. */
  renderedStart: number;
  renderedCount: number;
}

/**
 * Whether the focused cell currently exists in the DOM with `tabindex="0"`.
 * When it does not (virtualized away, filtered out, column hidden, loading),
 * the frame must be the tab stop so the grid stays reachable with Tab (K5).
 */
export function isFocusCellRendered(m: FocusRenderModel): boolean {
  const focus = m.focus;
  if (!focus || !m.visibleColumnIds.includes(focus.columnId)) {
    return false;
  }
  switch (focusRealmOf(focus)) {
    case 'header':
      return focus.rowIndex <= leafHeaderRowIndex(m.hasColumnGroups);
    case 'floatingFilter':
      return m.floatingFiltersShown;
    default:
      return (
        m.bodyRendered &&
        focus.rowIndex >= m.renderedStart &&
        focus.rowIndex < m.renderedStart + m.renderedCount
      );
  }
}
