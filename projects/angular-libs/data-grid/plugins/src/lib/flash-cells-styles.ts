/**
 * Flash-cell animation styles — injected once (same spirit as notes styles).
 */

const STYLE_ID = 'al-dg-flash-styles';

const FLASH_CSS = `
@keyframes al-dg-flash {
  0% {
    background-color: var(--al-dg-flash-color, #ffeb3b);
  }
  100% {
    background-color: transparent;
  }
}
.al-dg-cell--flash {
  animation: al-dg-flash var(--al-dg-flash-duration, 1000ms) ease-out;
}
`;

export function ensureFlashStyles(): void {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) {
    return;
  }
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = FLASH_CSS;
  document.head.appendChild(style);
}
