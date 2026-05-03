import { useQuery } from '@tanstack/react-query';
import { Metric } from '../types';
import { fetchPeriodEntries } from '../services/logEntries';
import { getPeriodWindow } from '../utils/periods';
import { computeMean } from '../utils/averageCalc';

export function usePeriodValue(metric: Metric): { value: number | null; isLoading: boolean } {
  const { start, end } = getPeriodWindow(metric.timeframe);

  const { data, isLoading } = useQuery({
    queryKey: ['periodEntries', metric.id, start.toISOString(), end.toISOString()],
    queryFn: () => fetchPeriodEntries(metric.id, start, end),
    staleTime: 10_000,
  });

  if (isLoading || !data) return { value: null, isLoading };

  const values = data.map((r) => r.value);

  if (metric.type === 'average') {
    return { value: computeMean(values), isLoading: false };
  }

  // cumulative and timed: sum
  const sum = values.reduce((acc, v) => acc + v, 0);
  return { value: sum, isLoading: false };
}
