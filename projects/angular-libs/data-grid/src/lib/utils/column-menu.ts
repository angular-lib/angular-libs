/**
 * Lean column menu items (Wave 4) — pin / sort / autosize / hide.
 * Shared by Alt+↓ `openColumnMenu` and header right-click.
 */

import type { DataGridContextMenuItem } from '../components/data-grid/data-grid.types';
import type { DataGridLocale } from '../locale/default-locale';
import type { ColumnPin } from '../components/data-grid/data-grid.types';

export interface LeanColumnMenuHelpers {
  locale: DataGridLocale;
  pinned: ColumnPin | null;
  sortable: boolean;
  sortDirection: 'asc' | 'desc' | null;
  /** Hide is disabled when it would hide the last visible column. */
  canHide: boolean;
  sortAsc: () => void;
  sortDesc: () => void;
  clearSort: () => void;
  pinLeft: () => void;
  pinRight: () => void;
  unpin: () => void;
  autosize: () => void;
  hide: () => void;
}

export function buildLeanColumnMenuItems<T = unknown>(
  helpers: LeanColumnMenuHelpers,
): DataGridContextMenuItem<T>[] {
  const { locale } = helpers;
  const items: DataGridContextMenuItem<T>[] = [];

  if (helpers.sortable) {
    items.push(
      {
        id: 'sort-asc',
        label: locale.sortAscending,
        disabled: helpers.sortDirection === 'asc',
        action: () => helpers.sortAsc(),
      },
      {
        id: 'sort-desc',
        label: locale.sortDescending,
        disabled: helpers.sortDirection === 'desc',
        action: () => helpers.sortDesc(),
      },
      {
        id: 'sort-clear',
        label: locale.sortClear,
        disabled: helpers.sortDirection == null,
        action: () => helpers.clearSort(),
      },
    );
  }

  items.push(
    {
      id: 'pin-left',
      label: locale.pinLeft,
      separator: helpers.sortable,
      disabled: helpers.pinned === 'left',
      action: () => helpers.pinLeft(),
    },
    {
      id: 'pin-right',
      label: locale.pinRight,
      disabled: helpers.pinned === 'right',
      action: () => helpers.pinRight(),
    },
    {
      id: 'unpin',
      label: locale.unpinColumn,
      disabled: helpers.pinned == null,
      action: () => helpers.unpin(),
    },
    {
      id: 'autosize',
      label: locale.autosizeColumn,
      separator: true,
      action: () => helpers.autosize(),
    },
    {
      id: 'hide',
      label: locale.hideColumn,
      disabled: !helpers.canHide,
      action: () => helpers.hide(),
    },
  );

  return items;
}
