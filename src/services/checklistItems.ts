import { Metric } from '../types';
import { insertLogEntry, deleteLogEntry } from './logEntries';
import { getPeriodWindow } from '../utils/periods';
import { stableChecklistItemId } from '../utils/checklist';

export async function checkItem(metric: Metric, itemIndex: number): Promise<void> {
  const { start } = getPeriodWindow(metric.timeframe);
  const totalItems = metric.checklist_items?.length ?? 1;
  await insertLogEntry({
    id: stableChecklistItemId(metric.id, itemIndex, start),
    metricId: metric.id,
    value: 1 / totalItems,
  });
}

export async function uncheckItem(metric: Metric, itemIndex: number): Promise<void> {
  const { start } = getPeriodWindow(metric.timeframe);
  await deleteLogEntry(stableChecklistItemId(metric.id, itemIndex, start), metric.id);
}
