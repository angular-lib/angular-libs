import type {
  DataGridContextMenuContext,
  DataGridContextMenuItem,
  DataGridContextMenuItems,
} from '../components/data-grid/data-grid.types';

export function resolveContextMenuItems<T>(
  items: DataGridContextMenuItems<T> | null | undefined,
  ctx: DataGridContextMenuContext<T>,
): DataGridContextMenuItem<T>[] {
  if (!items) {
    return [];
  }
  return [...(typeof items === 'function' ? items(ctx) : items)];
}

/** Sensible defaults — explicit actions, not AG string tokens. */
export function defaultContextMenuItems<T>(helpers: {
  copyCell: () => void;
  copyRow: () => void;
  exportCsv: () => void;
  autoSize: () => void;
  clearFilters: () => void;
  hasFilters: boolean;
}): DataGridContextMenuItem<T>[] {
  const items: DataGridContextMenuItem<T>[] = [
    {
      id: 'copy-cell',
      label: 'Copy cell',
      shortcut: '⌘C',
      action: () => helpers.copyCell(),
    },
    {
      id: 'copy-row',
      label: 'Copy row',
      action: () => helpers.copyRow(),
    },
    {
      id: 'export-csv',
      label: 'Export CSV',
      separator: true,
      action: () => helpers.exportCsv(),
    },
    {
      id: 'autosize',
      label: 'Autosize columns',
      action: () => helpers.autoSize(),
    },
  ];

  if (helpers.hasFilters) {
    items.push({
      id: 'clear-filters',
      label: 'Clear filters',
      separator: true,
      action: () => helpers.clearFilters(),
    });
  }

  return items;
}

export function writeClipboardText(text: string): void {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    void navigator.clipboard.writeText(text);
    return;
  }
  if (typeof document === 'undefined') {
    return;
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
}

export function positionMenu(
  x: number,
  y: number,
  menuWidth: number,
  menuHeight: number,
): { left: number; top: number } {
  if (typeof window === 'undefined') {
    return { left: x, top: y };
  }
  const pad = 8;
  const maxLeft = window.innerWidth - menuWidth - pad;
  const maxTop = window.innerHeight - menuHeight - pad;
  return {
    left: Math.max(pad, Math.min(x, maxLeft)),
    top: Math.max(pad, Math.min(y, maxTop)),
  };
}
