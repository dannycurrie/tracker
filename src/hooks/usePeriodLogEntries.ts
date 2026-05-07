import { useQuery } from '@tanstack/react-query';
import { Metric, LogEntry } from '../types';
import { fetchPeriodLogEntries } from '../services/logEntries';
import { getPeriodWindow } from '../utils/periods';

export function usePeriodLogEntries(metric: Metric): { entries: LogEntry[]; isLoading: boolean } {
  const { start, end } = getPeriodWindow(metric.timeframe);

  const { data, isLoading } = useQuery({
    queryKey: ['periodLogEntries', metric.id, start.toISOString(), end.toISOString()],
    queryFn: () => fetchPeriodLogEntries(metric.id, start, end),
    staleTime: 10_000,
  });

  return { entries: data ?? [], isLoading };
}
