/**
 * Full client row model: filter → sort → capability data stages → display rows.
 * Pure helper — usable from tests and controller wiring without template logic.
 */

import type { GridCapabilities, RowModelContext } from '../plugins/capabilities';
import { wrapDataRows, type DisplayRow } from './row-display';
import {
  runClientRowPipeline,
  type AfterSortHook,
  type ClientRowPipelineInput,
} from './row-pipeline';

export interface GridRowModelInput<T> extends ClientRowPipelineInput<T> {
  capabilities?: GridCapabilities<T> | null;
  rowModelContext: RowModelContext<T>;
}

export interface GridRowModelResult<T> {
  processedRows: readonly T[];
  displayRows: DisplayRow<T>[];
}

/**
 * Pure composition of the client row model stages (tests / tooling).
 * The live session runs the same stage functions as chained computeds.
 */
export function runGridRowModel<T>(
  input: GridRowModelInput<T>,
  afterSort?: AfterSortHook<T> | null,
): GridRowModelResult<T> {
  const { capabilities, rowModelContext, ...pipelineInput } = input;
  const base = runClientRowPipeline(pipelineInput, afterSort);
  const processedRows = capabilities
    ? capabilities.runDataStages(base, rowModelContext)
    : base;
  const displayRows = capabilities
    ? capabilities.buildDisplayRows(processedRows, rowModelContext)
    : wrapDataRows(processedRows, rowModelContext.rowId);
  return { processedRows, displayRows };
}
