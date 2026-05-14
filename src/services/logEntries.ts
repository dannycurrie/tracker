import NetInfo from '@react-native-community/netinfo';
import { supabase } from './supabase';
import { logger } from './logger';
import { localDb } from './localDb';
import { isLocalMode } from '../config/mode';
import { useOfflineQueue } from '../store/offlineQueue';
import { LogEntry, PendingLogEntry } from '../types';
import { queryClient } from './queryClient';

export interface InsertLogEntryParams {
  id: string;
  metricId: string;
  value: number;
  loggedAt?: Date;
  sessionStartAt?: string;
}

export async function fetchPeriodEntries(
  metricId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<{ value: number }[]> {
  if (isLocalMode) return localDb.fetchPeriodEntries(metricId, periodStart, periodEnd);

  const { data, error } = await supabase!
    .from('log_entries')
    .select('value')
    .eq('metric_id', metricId)
    .gte('logged_at', periodStart.toISOString())
    .lt('logged_at', periodEnd.toISOString());

  if (error) throw error;
  return data ?? [];
}

export async function fetchPeriodLogEntries(
  metricId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<LogEntry[]> {
  if (isLocalMode) return localDb.fetchPeriodLogEntries(metricId, periodStart, periodEnd);

  const { data, error } = await supabase!
    .from('log_entries')
    .select('*')
    .eq('metric_id', metricId)
    .gte('logged_at', periodStart.toISOString())
    .lt('logged_at', periodEnd.toISOString())
    .order('logged_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function deleteLogEntry(id: string, metricId: string): Promise<void> {
  if (isLocalMode) {
    localDb.deleteLogEntry(id);
    invalidatePeriodEntries(metricId);
    return;
  }

  const { error } = await supabase!.from('log_entries').delete().eq('id', id);
  if (error) {
    logger.error('Failed to delete log entry', error, { id });
    throw error;
  }
  invalidatePeriodEntries(metricId);
}

export async function insertLogEntry(params: InsertLogEntryParams): Promise<void> {
  const { id, metricId, value, sessionStartAt } = params;
  const loggedAt = (params.loggedAt ?? new Date()).toISOString();

  const entry: PendingLogEntry = {
    id,
    metric_id: metricId,
    value,
    logged_at: loggedAt,
    session_start_at: sessionStartAt ?? null,
  };

  if (isLocalMode) {
    localDb.insertLogEntry(entry);
    invalidatePeriodEntries(metricId);
    return;
  }

  const net = await NetInfo.fetch();
  if (!net.isConnected) {
    logger.info('Offline — queuing log entry', { metricId, value });
    useOfflineQueue.getState().enqueue(entry);
    optimisticallyAddEntry(metricId, value);
    return;
  }

  const { error } = await supabase!.from('log_entries').upsert(
    {
      id: entry.id,
      metric_id: entry.metric_id,
      value: entry.value,
      logged_at: entry.logged_at,
      session_start_at: entry.session_start_at,
    },
    { onConflict: 'id', ignoreDuplicates: true }
  );

  if (error) {
    logger.error('Failed to insert log entry, queuing for retry', error, { metricId, value });
    useOfflineQueue.getState().enqueue(entry);
    optimisticallyAddEntry(metricId, value);
    return;
  }
  invalidatePeriodEntries(metricId);
}

export async function deleteLogEntriesForPeriod(
  metricId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<void> {
  if (isLocalMode) {
    localDb.deleteLogEntriesForPeriod(metricId, periodStart, periodEnd);
    invalidatePeriodEntries(metricId);
    return;
  }

  const { error } = await supabase!
    .from('log_entries')
    .delete()
    .eq('metric_id', metricId)
    .gte('logged_at', periodStart.toISOString())
    .lt('logged_at', periodEnd.toISOString());

  if (error) {
    logger.error('Failed to delete log entries for period', error, { metricId });
    throw error;
  }
  invalidatePeriodEntries(metricId);
}

function invalidatePeriodEntries(metricId: string): void {
  queryClient.invalidateQueries({ queryKey: ['periodEntries', metricId] });
  queryClient.invalidateQueries({ queryKey: ['periodLogEntries', metricId] });
}

function optimisticallyAddEntry(metricId: string, value: number): void {
  queryClient.setQueriesData<{ value: number }[]>(
    { queryKey: ['periodEntries', metricId] },
    (old) => (old ?? []).concat({ value })
  );
}
