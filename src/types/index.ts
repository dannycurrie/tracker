export type MetricType = 'cumulative' | 'timed' | 'average';
export type MetricTimeframe = 'weekly' | 'monthly';

export interface Metric {
  id: string;
  name: string;
  type: MetricType;
  timeframe: MetricTimeframe;
  display_order: number;
  created_at: string;
}

export interface LogEntry {
  id: string;
  metric_id: string;
  value: number;
  logged_at: string;
  session_start_at: string | null;
  created_at: string;
}

export interface PendingLogEntry {
  id: string;
  metric_id: string;
  value: number;
  logged_at: string;
  session_start_at: string | null;
}
