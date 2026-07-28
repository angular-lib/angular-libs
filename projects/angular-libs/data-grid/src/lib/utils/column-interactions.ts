/**
 * Column resize helpers — reorder/pin live in `column-layout.ts`.
 */

export function nextWidthOverride(
  widths: Record<string, number>,
  columnId: string,
  nextWidth: number,
  minWidth = 48,
): Record<string, number> {
  return { ...widths, [columnId]: Math.max(minWidth, nextWidth) };
}

/**
 * Attach window pointer listeners for a column resize drag. Returns cleanup.
 */
export function attachColumnResize(options: {
  startX: number;
  startWidth: number;
  minWidth?: number;
  onWidth: (width: number) => void;
  onEnd?: () => void;
}): () => void {
  const min = options.minWidth ?? 48;
  const onMove = (ev: PointerEvent): void => {
    options.onWidth(Math.max(min, options.startWidth + (ev.clientX - options.startX)));
  };
  const onUp = (): void => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    options.onEnd?.();
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  return onUp;
}
