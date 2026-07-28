/**
 * Flash-cells contracts — imperative highlight via {@link flashCellsPlugin}.
 */

export interface FlashCellRef {
  rowId: string | number;
  columnId: string;
}

export interface FlashCellsParams {
  /** Explicit cells to flash. */
  cells?: FlashCellRef[];
  /** Flash whole rows (× `columnIds` or all visible columns). */
  rowIds?: Array<string | number>;
  /** Limit columns when using `rowIds`. */
  columnIds?: string[];
  /** Flash background colour. Default: amber `#ffeb3b`. */
  color?: string;
  /** Total animation duration in ms. Default: `1000`. */
  duration?: number;
}

export interface FlashCellsPluginOptions {
  /** Default flash colour when `params.color` is omitted. */
  color?: string;
  /** Default duration (ms) when `params.duration` is omitted. */
  duration?: number;
}

export function flashKey(rowId: string | number, columnId: string): string {
  return `${rowId}:${columnId}`;
}
