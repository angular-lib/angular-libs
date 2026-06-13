import type { DialogPlugin, DialogPluginContext } from '../dialog.types';
import { isMinimized, isMaximized, setPosition, restore } from '../actions';

export interface TileSnappingOptions {
  /** Number of virtual rows in the screen selection grid. Defaults to 4. */
  rows?: number;
  /** Number of virtual columns in the screen selection grid. Defaults to 4. */
  cols?: number;
  /** Key to hook the snapping overlay. Must be pressed with Alt/Option. Defaults to 'KeyS'. */
  triggerKeyCode?: string;
  /** Visual padding inside the full screen grid overlay. Defaults to '8px'. */
  padding?: string;
  /** Gap spacing between virtual grid cells. Defaults to '8px'. */
  gap?: string;
}

/**
 * A visually rich, macOS-like interactive tiles grid snapping plugin.
 * 
 * When Alt/Option + S (configurable) is pressed, a fullscreen glassmorphic tiles selection grid pops up.
 * Clicking and dragging across grid cells lets the user select an active area. Releasing the pointer
 * dismisses the overlay and snaps the dialog's width, height, and coordinates perfectly to fill the selected tiles.
 * 
 * Works flawlessly on standalone nodes and coordinates directly with the draggable plugin.
 */
export function tileSnappingPlugin(options: TileSnappingOptions = {}): DialogPlugin {
  const {
    rows = 4,
    cols = 4,
    triggerKeyCode = 'KeyS',
    padding = '8px',
    gap = '8px',
  } = options;

  return {
    id: 'tile-snapping',
    setup(context: DialogPluginContext<any, any>): () => void {
      const { element, dialogRef } = context;
      let overlayEl: HTMLDivElement | null = null;
      let startRow = -1;
      let startCol = -1;
      let isSelecting = false;

      const showSelectionOverlay = () => {
        if (overlayEl || isMinimized(dialogRef)) return;

        overlayEl = document.createElement('div');
        overlayEl.className = 'al-tile-overlay';

        const gridEl = document.createElement('div');
        gridEl.className = 'al-tile-grid';
        gridEl.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
        gridEl.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
        gridEl.style.padding = padding;
        gridEl.style.gap = gap;

        // Populate cells
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const cell = document.createElement('div');
            cell.className = 'al-tile-cell';
            cell.dataset['row'] = String(r);
            cell.dataset['col'] = String(c);
            gridEl.appendChild(cell);
          }
        }

        overlayEl.appendChild(gridEl);
        document.body.appendChild(overlayEl);

        // Force browser layout repaint then add visible transitions
        overlayEl.clientLeft;
        overlayEl.classList.add('al-visible');

        // Capture pointer events on the overlay container
        overlayEl.addEventListener('pointerdown', onPointerDown);
        overlayEl.addEventListener('pointermove', onPointerMove);
        overlayEl.addEventListener('pointerup', onPointerEnd);
        overlayEl.addEventListener('pointercancel', onPointerEnd);
      };

      const closeOverlay = () => {
        if (!overlayEl) return;
        const currentOverlay = overlayEl;
        overlayEl = null;

        isSelecting = false;
        startRow = -1;
        startCol = -1;

        currentOverlay.classList.remove('al-visible');
        setTimeout(() => currentOverlay.remove(), 250);
      };

      const getCellFromPoint = (clientX: number, clientY: number): HTMLElement | null => {
        return overlayEl ? (document.elementFromPoint(clientX, clientY) as HTMLElement | null)?.closest('.al-tile-cell') || null : null;
      };

      const onPointerDown = (e: PointerEvent) => {
        if (e.button !== 0) return; // Left mouse click / primary pointer only
        const cell = getCellFromPoint(e.clientX, e.clientY);
        if (!cell) return;

        isSelecting = true;
        startRow = +cell.dataset['row']!;
        startCol = +cell.dataset['col']!;

        overlayEl?.setPointerCapture(e.pointerId);
        updateSelection(startRow, startCol);
      };

      const onPointerMove = (e: PointerEvent) => {
        if (!isSelecting || startRow < 0 || startCol < 0) return;
        const cell = getCellFromPoint(e.clientX, e.clientY);
        if (!cell) return;

        updateSelection(+cell.dataset['row']!, +cell.dataset['col']!);
      };

      const onPointerEnd = (e: PointerEvent) => {
        if (!isSelecting) return;
        if (overlayEl?.hasPointerCapture(e.pointerId)) {
          overlayEl.releasePointerCapture(e.pointerId);
        }

        if (e.type === 'pointerup') {
          snapDialogToSelection();
        }
        closeOverlay();
      };

      const updateSelection = (currRow: number, currCol: number) => {
        if (!overlayEl) return;

        const minRow = Math.min(startRow, currRow);
        const maxRow = Math.max(startRow, currRow);
        const minCol = Math.min(startCol, currCol);
        const maxCol = Math.max(startCol, currCol);

        overlayEl.querySelectorAll<HTMLElement>('.al-tile-cell').forEach((cell) => {
          const r = +cell.dataset['row']!;
          const c = +cell.dataset['col']!;
          const inSelection = r >= minRow && r <= maxRow && c >= minCol && c <= maxCol;
          cell.classList.toggle('al-selected', inSelection);
        });
      };

      const snapDialogToSelection = () => {
        if (!overlayEl) return;

        const selectedCells = overlayEl.querySelectorAll('.al-tile-cell.al-selected');
        if (selectedCells.length === 0) return;

        // If currently maximized, restore/un-maximize it first before placing absolute coordinates
        if (isMaximized(dialogRef)) {
          restore(dialogRef);
        }

        let left = Infinity;
        let top = Infinity;
        let right = -Infinity;
        let bottom = -Infinity;

        selectedCells.forEach((cellEl) => {
          const rect = cellEl.getBoundingClientRect();
          left = Math.min(left, rect.left);
          top = Math.min(top, rect.top);
          right = Math.max(right, rect.right);
          bottom = Math.max(bottom, rect.bottom);
        });

        const targetWidth = right - left;
        const targetHeight = bottom - top;

        // Neutralize the center-alignment CSS and margins to align translation coordinate space
        // 1:1 with targeted viewport boundaries.
        element.style.margin = '0';
        element.style.inset = '0 auto auto 0';
        element.style.maxWidth = 'none';
        element.style.maxHeight = 'none';

        // Reset dialog alignment natively using unified setPosition
        setPosition(dialogRef, 0, 0, targetWidth, targetHeight);

        // Measure dialog's static/untranslated client left/top origin position
        const currentRect = element.getBoundingClientRect();

        // Apply new snapped coordinates cleanly!
        setPosition(dialogRef, left - currentRect.left, top - currentRect.top);

        // Bring focus back to the dialog element natively
        element.focus();
      };

      // Listen globally for triggering Keydown combination Alt/Option + triggeringKeyCode
      const onKeyDown = (e: KeyboardEvent) => {
        // Find if this dialog is currently the visually foremost/top-most non-modal dialog on the screen.
        // This is extremely robust: it bypasses browser focus/blur inconsistencies that shift focus to document.body
        // when clicking non-focusable dialog headers or points.
        const openDialogs = Array.from(document.querySelectorAll('.al-dialog:not(.al-dialog-minimized)')) as HTMLElement[];
        const isForemostDialog = openDialogs.length > 0 && openDialogs[openDialogs.length - 1] === element;
        if (!isForemostDialog) return;

        if (e.altKey && e.code === triggerKeyCode) {
          e.preventDefault();
          showSelectionOverlay();
        } else if (e.key === 'Escape' && overlayEl) {
          e.preventDefault();
          closeOverlay();
        }
      };

      window.addEventListener('keydown', onKeyDown, true);

      return () => {
        closeOverlay();
        window.removeEventListener('keydown', onKeyDown, true);
      };
    }
  };
}