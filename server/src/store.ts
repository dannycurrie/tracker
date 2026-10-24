import { createClient } from '@supabase/supabase-js';
import type { Metric } from '../../src/types';
import { Config } from './config';

export type MetricRow = Metric;

export interface LogEntryRow {
  id: string;
  metric_id: string;
  value: number;
  logged_at: string;
}

export interface MetricsStore {
  /** All metrics created before `createdBefore`, in `display_order`. */
  listMetrics(options: { createdBefore: Date }): Promise<MetricRow[]>;
  /** Every log entry for `metricIds` with `logged_at` in [from, to). */
  listLogEntries(options: { metricIds: string[]; from: Date; to: Date }): Promise<LogEntryRow[]>;
}

// PostgREST caps rows per response (1000 by default, and the project can lower it),
// so page until an empty page rather than trusting a short one to mean "done".
const PAGE_SIZE = 1000;

export function createSupabaseStore(config: Config): MetricsStore {
  // The DB is single-tenant (no user_id, no RLS), so there is no owner filter.
  // The secret key keeps this working once RLS is enabled (prds/009-db-lockdown.md).
  const supabase = createClient(config.supabaseUrl, config.supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return {
    async listMetrics({ createdBefore }) {
      const { data, error } = await supabase
        .from('metrics')
        .select('id, name, type, timeframe, source, display_order, created_at, checklist_items')
        .lt('created_at', createdBefore.toISOString())
        .order('display_order', { ascending: true });

      if (error) throw new Error(`Failed to fetch metrics: ${error.message}`);
      return (data as MetricRow[]) ?? [];
    },

    async listLogEntries({ metricIds, from, to }) {
      if (metricIds.length === 0) return [];

      const rows: LogEntryRow[] = [];
      for (let offset = 0; ; offset += PAGE_SIZE) {
        const { data, error } = await supabase
          .from('log_entries')
          .select('id, metric_id, value, logged_at')
          .in('metric_id', metricIds)
          .gte('logged_at', from.toISOString())
          .lt('logged_at', to.toISOString())
          .order('logged_at', { ascending: true })
          .order('id', { ascending: true })
          .range(offset, offset + PAGE_SIZE - 1);

        if (error) throw new Error(`Failed to fetch log entries: ${error.message}`);
        if (!data || data.length === 0) return rows;
        // NUMERIC can arrive as a string; the app's aggregation expects numbers.
        rows.push(...data.map((r) => ({ ...r, value: Number(r.value) })));
      }
    },
  };
}
