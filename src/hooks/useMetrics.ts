import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Metric } from '../types';
import { fetchUserMetrics } from '../services/metrics';

const METRICS_KEY = ['metrics'];

export function useMetrics(): {
  metrics: Metric[];
  isLoading: boolean;
  error: Error | null;
  invalidate: () => void;
} {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: METRICS_KEY,
    queryFn: fetchUserMetrics,
  });

  return {
    metrics: data ?? [],
    isLoading,
    error: error as Error | null,
    invalidate: () => queryClient.invalidateQueries({ queryKey: METRICS_KEY }),
  };
}
