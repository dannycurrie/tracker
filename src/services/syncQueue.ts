import { supabase } from './supabase';
import { isLocalMode } from '../config/mode';
import { useOfflineQueue } from '../store/offlineQueue';
import { queryClient } from './queryClient';
import { logger } from './logger';

export async function drainQueue(): Promise<void> {
  if (isLocalMode) return;

  const entries = useOfflineQueue.getState().dequeueAll();
  const deleteIds = useOfflineQueue.getState().dequeueAllDeletions();

  if (entries.length === 0 && deleteIds.length === 0) return;

  const failedEntries: typeof entries = [];
  const failedDeleteIds: string[] = [];

  for (const entry of entries) {
    try {
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
      if (error) throw error;
    } catch (err) {
      logger.error('Failed to sync log entry', err, { entryId: entry.id, metricId: entry.metric_id });
      failedEntries.push(entry);
    }
  }

  for (const id of deleteIds) {
    try {
      const { error } = await supabase!.from('log_entries').delete().eq('id', id);
      if (error) throw error;
    } catch (err) {
      logger.error('Failed to sync log entry deletion', err, { id });
      failedDeleteIds.push(id);
    }
  }

  if (failedEntries.length > 0) {
    logger.info('Re-enqueuing failed sync entries', { count: failedEntries.length });
    for (const entry of failedEntries) useOfflineQueue.getState().enqueue(entry);
  }
  if (failedDeleteIds.length > 0) {
    logger.info('Re-enqueuing failed deletions', { count: failedDeleteIds.length });
    for (const id of failedDeleteIds) useOfflineQueue.getState().enqueueDeletion(id);
  }

  logger.info('Offline queue drained', {
    inserted: entries.length - failedEntries.length,
    deleted: deleteIds.length - failedDeleteIds.length,
  });

  queryClient.invalidateQueries({ queryKey: ['periodEntries'] });
  queryClient.invalidateQueries({ queryKey: ['periodLogEntries'] });
}
