/**
 * Injected once — range highlight + overlay ring + fill-handle styles.
 */

const STYLE_ID = 'al-dg-cell-range-styles';

export function ensureCellRangeStyles(): void {
  if (typeof document === 'undefined') {
    return;
  }
  if (document.getElementById(STYLE_ID)) {
    return;
  }
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.al-data-grid .al-dg-cell--range {
  background: var(--al-dg-range-bg, #dbeafe) !important;
}
/* Fixed overlays — avoid td overflow clipping and scrollWidth inflation. */
.al-dg-range-ring {
  position: fixed;
  box-sizing: border-box;
  border: 2px solid var(--al-dg-range-border, #2563eb);
  pointer-events: none;
  z-index: 40;
}
.al-dg-fill-handle {
  position: fixed;
  width: 7px;
  height: 7px;
  margin: 0;
  padding: 0;
  background: var(--al-dg-range-border, #2563eb);
  border: 1px solid #fff;
  cursor: crosshair;
  z-index: 41;
  pointer-events: auto;
  box-sizing: border-box;
}
`;
  document.head.appendChild(style);
}
