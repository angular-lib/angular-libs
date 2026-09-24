export interface TileGridOptions {
  /** Default 4. */
  rows?: number;
  /** Default 4. */
  cols?: number;
}

/**
 * Full-screen grid: drag (or click) across cells to pick an area. Calls `onSelect`
 * with the area's viewport rect. Escape or releasing outside the grid cancels.
 */
export function showTileGrid(options: TileGridOptions, onSelect: (rect: DOMRect) => void): void {
  const { rows = 4, cols = 4 } = options;
  const overlay = document.createElement('div');
  overlay.className = 'al-tile-overlay';
  overlay.popover = 'manual';
  const grid = document.createElement('div');
  grid.className = 'al-tile-grid';
  grid.style.gridTemplate = `repeat(${rows}, 1fr) / repeat(${cols}, 1fr)`;
  for (let i = 0; i < rows * cols; i++) grid.append(document.createElement('div'));
  overlay.append(grid);
  document.body.append(overlay);
  overlay.showPopover?.();

  const cells = [...grid.children] as HTMLElement[];
  let start = -1;
  const cellAt = (e: PointerEvent) => cells.indexOf((document.elementFromPoint(e.clientX, e.clientY) as HTMLElement)?.closest('.al-tile-grid > div') as HTMLElement);
  const selected = () => cells.filter((c) => c.classList.contains('al-selected'));

  const select = (end: number) => {
    const [r1, r2] = [Math.floor(start / cols), Math.floor(end / cols)].sort((a, b) => a - b);
    const [c1, c2] = [start % cols, end % cols].sort((a, b) => a - b);
    cells.forEach((cell, i) => {
      const r = Math.floor(i / cols);
      const c = i % cols;
      cell.classList.toggle('al-selected', r >= r1 && r <= r2 && c >= c1 && c <= c2);
    });
  };

  const close = () => {
    document.removeEventListener('keydown', onKey, true);
    overlay.remove();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    close();
  };
  document.addEventListener('keydown', onKey, true);

  overlay.addEventListener('pointerdown', (e) => {
    start = cellAt(e);
    if (start < 0) return close();
    overlay.setPointerCapture?.(e.pointerId);
    select(start);
  });
  overlay.addEventListener('pointermove', (e) => {
    const cell = start < 0 ? -1 : cellAt(e);
    if (cell >= 0) select(cell);
  });
  overlay.addEventListener('pointerup', () => {
    const picked = selected();
    if (start >= 0 && picked.length) {
      const first = picked[0].getBoundingClientRect();
      const last = picked[picked.length - 1].getBoundingClientRect();
      onSelect(new DOMRect(first.left, first.top, last.right - first.left, last.bottom - first.top));
    }
    close();
  });
}
