import NetInfo from '@react-native-community/netinfo';
import { supabase } from './supabase';
import { localDb } from './localDb';
import { offlineCache } from './offlineCache';
import { isLocalMode } from '../config/mode';
import { Metric, MetricType, MetricTimeframe, MetricSource } from '../types';

export async function fetchUserMetrics(): Promise<Metric[]> {
  if (isLocalMode) return localDb.fetchMetrics();

  const net = await NetInfo.fetch();
  if (!net.isConnected) {
    return offlineCache.getMetrics() ?? [];
  }

  const { data, error } = await supabase!
    .from('metrics')
    .select('id, name, type, timeframe, source, display_order, created_at, checklist_items')
    .order('display_order', { ascending: true });

  if (error) throw error;
  const metrics = (data as Metric[]) ?? [];
  offlineCache.setMetrics(metrics);
  return metrics;
}

export async function createMetric(
  name: string,
  type: MetricType,
  timeframe: MetricTimeframe,
  source: MetricSource = 'user',
  checklistItems?: string[]
): Promise<Metric> {
  if (isLocalMode) return localDb.createMetric(name, type, timeframe, source, checklistItems);

  const { data: existing } = await supabase!
    .from('metrics')
    .select('display_order')
    .order('display_order', { ascending: false })
    .limit(1);

  const nextOrder = existing && existing.length > 0 ? existing[0].display_order + 1 : 0;

  const { data, error } = await supabase!
    .from('metrics')
    .insert({
      name: name.trim(),
      type,
      timeframe,
      source,
      display_order: nextOrder,
      checklist_items: checklistItems ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  const metric = data as Metric;
  const cached = offlineCache.getMetrics();
  if (cached) offlineCache.setMetrics([...cached, metric]);
  return metric;
}
