import { Metric } from '../types';
import { usePeriodLogEntries } from './usePeriodLogEntries';
import { getPeriodWindow } from '../utils/periods';
import { stableChecklistItemId } from '../utils/checklist';

export function useChecklistState(metric: Metric): {
  checkedCount: number;
  totalCount: number;
  isItemChecked: (idx: number) => boolean;
  isLoading: boolean;
} {
  const { start } = getPeriodWindow(metric.timeframe);
  const { entries, isLoading } = usePeriodLogEntries(metric);
  const items = metric.checklist_items ?? [];
  const totalCount = items.length;

  const isItemChecked = (idx: number): boolean =>
    entries.some((e) => e.id === stableChecklistItemId(metric.id, idx, start));

  const checkedCount = items.filter((_, i) => isItemChecked(i)).length;

  return { checkedCount, totalCount, isItemChecked, isLoading };
}
