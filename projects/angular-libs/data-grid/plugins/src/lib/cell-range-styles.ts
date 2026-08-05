/**
 * Injected once — range highlight + overlay ring + fill-handle styles.
 */

const STYLE_ID = 'al-dg-cell-range-styles';

export function ensureCellRangeStyles(): void {
  if (typeof document === 'undefined') {
    return;
  }
  document.getElementById('al-dg-cell-range-styles-v2')?.remove();
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = `
.al-data-grid .al-dg-cell--range {
  background: var(--al-dg-range-bg, #b7e4ff) !important;
}
/* In-grid overlay layer — absolute within .al-data-grid__range-layer */
.al-dg-range-ring {
  position: absolute;
  box-sizing: border-box;
  border: 2px solid var(--al-dg-range-border, #2196f3);
  pointer-events: none;
  z-index: 1;
}
.al-dg-fill-handle {
  position: absolute;
  width: 11px;
  height: 11px;
  margin: 0;
  padding: 0;
  background: var(--al-dg-range-border, #2196f3);
  border: 1px solid #fff;
  cursor: crosshair;
  z-index: 2;
  pointer-events: auto;
  box-sizing: border-box;
  touch-action: none;
}
`;
}
