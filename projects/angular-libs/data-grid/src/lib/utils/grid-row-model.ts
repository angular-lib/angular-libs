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
  processedRows: T[];
  displayRows: DisplayRow<T>[];
}

/**
 * Source of truth for the client row model pipeline.
 * {@link DataGrid} should call this rather than re-implementing stages.
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
