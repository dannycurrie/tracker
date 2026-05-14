import { supabase } from './supabase';
import { isLocalMode } from '../config/mode';
import { useOfflineQueue } from '../store/offlineQueue';
import { queryClient } from './queryClient';
import { logger } from './logger';

export async function drainQueue(): Promise<void> {
  if (isLocalMode) return;
  const entries = useOfflineQueue.getState().dequeueAll();
  if (entries.length === 0) return;

  const failed = [];

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
      failed.push(entry);
    }
  }

  // Re-enqueue entries that failed to sync
  if (failed.length > 0) {
    logger.info('Re-enqueuing failed sync entries', { count: failed.length });
    for (const entry of failed) {
      useOfflineQueue.getState().enqueue(entry);
    }
  } else {
    logger.info('Offline queue drained', { count: entries.length });
  }

  // Invalidate all period entry queries so values refresh from Supabase
  queryClient.invalidateQueries({ queryKey: ['periodEntries'] });
  queryClient.invalidateQueries({ queryKey: ['periodLogEntries'] });
}
