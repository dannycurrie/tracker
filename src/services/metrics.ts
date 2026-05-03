import { supabase } from './supabase';
import { localDb } from './localDb';
import { isLocalMode } from '../config/mode';
import { Metric, MetricType, MetricTimeframe } from '../types';

export async function fetchUserMetrics(): Promise<Metric[]> {
  if (isLocalMode) return localDb.fetchMetrics();

  const { data, error } = await supabase!
    .from('metrics')
    .select('id, name, type, timeframe, display_order, created_at')
    .order('display_order', { ascending: true });

  if (error) throw error;
  return (data as Metric[]) ?? [];
}

export async function createMetric(
  name: string,
  type: MetricType,
  timeframe: MetricTimeframe
): Promise<Metric> {
  if (isLocalMode) return localDb.createMetric(name, type, timeframe);

  const { data: existing } = await supabase!
    .from('metrics')
    .select('display_order')
    .order('display_order', { ascending: false })
    .limit(1);

  const nextOrder = existing && existing.length > 0 ? existing[0].display_order + 1 : 0;

  const { data, error } = await supabase!
    .from('metrics')
    .insert({ name: name.trim(), type, timeframe, display_order: nextOrder })
    .select()
    .single();

  if (error) throw error;
  return data as Metric;
}
