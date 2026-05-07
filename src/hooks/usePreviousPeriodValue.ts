import { useQuery } from '@tanstack/react-query';
import { Metric } from '../types';
import { fetchPeriodEntries } from '../services/logEntries';
import { getPreviousPeriodWindow } from '../utils/periods';
import { computeMean } from '../utils/averageCalc';

export function usePreviousPeriodValue(metric: Metric): { value: number | null } {
  const { start, end } = getPreviousPeriodWindow(metric.timeframe);

  const { data } = useQuery({
    queryKey: ['previousPeriodEntries', metric.id, start.toISOString(), end.toISOString()],
    queryFn: () => fetchPeriodEntries(metric.id, start, end),
    staleTime: Infinity,
  });

  if (!data || data.length === 0) return { value: null };

  const values = data.map((r) => r.value);
  const aggregate =
    metric.type === 'average'
      ? computeMean(values)
      : values.reduce((acc, v) => acc + v, 0);

  return { value: aggregate === 0 ? null : aggregate };
}
