import { createClient } from '@supabase/supabase-js';
import type { Metric } from '../../src/types';
import { Config } from './config';

export type MetricRow = Metric;

export interface MetricsStore {
  /** All metrics created before `createdBefore`, in `display_order`. */
  listMetrics(options: { createdBefore: Date }): Promise<MetricRow[]>;
}

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
  };
}
