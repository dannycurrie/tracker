export type MetricType = 'cumulative' | 'timed' | 'average';
export type MetricTimeframe = 'weekly' | 'monthly';
export type MetricSource = 'user' | 'apple_health';

export interface Metric {
  id: string;
  name: string;
  type: MetricType;
  timeframe: MetricTimeframe;
  source: MetricSource;
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
