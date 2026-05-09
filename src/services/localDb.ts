import { createKV } from '../utils/storage';
import { Metric, LogEntry, MetricType, MetricTimeframe, MetricSource, PendingLogEntry } from '../types';
import { getPeriodWindow } from '../utils/periods';
import { stableChecklistItemId } from '../utils/checklist';

const storage = createKV('local-db');

const METRICS_KEY = 'local:metrics';
const ENTRIES_KEY = 'local:log_entries';
const SEEDED_KEY = 'local:seeded';

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3_600_000).toISOString();
}

function daysAgo(d: number): string {
  return new Date(Date.now() - d * 86_400_000).toISOString();
}

function buildSeedMetrics(): Metric[] {
  return [
    { id: 'mock-1', name: 'Cups of coffee', type: 'cumulative', timeframe: 'weekly',  source: 'user', display_order: 0, created_at: hoursAgo(72), checklist_items: null },
    { id: 'mock-2', name: 'Reading',         type: 'timed',       timeframe: 'weekly',  source: 'user', display_order: 1, created_at: hoursAgo(72), checklist_items: null },
    { id: 'mock-3', name: 'Sleep quality',   type: 'average',     timeframe: 'monthly', source: 'user', display_order: 2, created_at: hoursAgo(72), checklist_items: null },
    { id: 'mock-4', name: 'Morning Routine', type: 'checklist',   timeframe: 'weekly',  source: 'user', display_order: 3, created_at: hoursAgo(72), checklist_items: ['Workout', 'Vitamins', 'Cold shower', 'Meditation'] },
  ];
}

function buildSeedEntries(): LogEntry[] {
  const now = hoursAgo(0);
  const checklistPeriodStart = getPeriodWindow('weekly').start;
  return [
    // Cups of coffee — 3 taps within the last 6 hours (always in current period)
    { id: 'mock-log-1', metric_id: 'mock-1', value: 1, logged_at: hoursAgo(6),   session_start_at: null, created_at: now },
    { id: 'mock-log-2', metric_id: 'mock-1', value: 1, logged_at: hoursAgo(3),   session_start_at: null, created_at: now },
    { id: 'mock-log-3', metric_id: 'mock-1', value: 1, logged_at: hoursAgo(0.5), session_start_at: null, created_at: now },
    // Reading — two sessions (15 min + 10 min = 25 min)
    { id: 'mock-log-4', metric_id: 'mock-2', value: 15, logged_at: hoursAgo(5), session_start_at: hoursAgo(5.25), created_at: now },
    { id: 'mock-log-5', metric_id: 'mock-2', value: 10, logged_at: hoursAgo(2), session_start_at: hoursAgo(2.17), created_at: now },
    // Sleep quality — ratings 3, 4, 5 → avg 4.0
    { id: 'mock-log-6', metric_id: 'mock-3', value: 3, logged_at: hoursAgo(6), session_start_at: null, created_at: now },
    { id: 'mock-log-7', metric_id: 'mock-3', value: 4, logged_at: hoursAgo(3), session_start_at: null, created_at: now },
    { id: 'mock-log-8', metric_id: 'mock-3', value: 5, logged_at: hoursAgo(1), session_start_at: null, created_at: now },
    // Previous-period entries for comparison label feature
    // Weekly metrics: daysAgo(10-12) always lands in the previous Mon–Sun week
    { id: 'mock-prev-1', metric_id: 'mock-1', value: 1, logged_at: daysAgo(10), session_start_at: null, created_at: now },
    { id: 'mock-prev-2', metric_id: 'mock-1', value: 1, logged_at: daysAgo(11), session_start_at: null, created_at: now },
    { id: 'mock-prev-3', metric_id: 'mock-1', value: 1, logged_at: daysAgo(12), session_start_at: null, created_at: now },
    { id: 'mock-prev-4', metric_id: 'mock-2', value: 20, logged_at: daysAgo(10), session_start_at: daysAgo(10), created_at: now },
    // Monthly metric: daysAgo(35-36) always lands in the previous calendar month
    { id: 'mock-prev-5', metric_id: 'mock-3', value: 7, logged_at: daysAgo(35), session_start_at: null, created_at: now },
    { id: 'mock-prev-6', metric_id: 'mock-3', value: 8, logged_at: daysAgo(36), session_start_at: null, created_at: now },
    // Morning Routine checklist — items 0 (Workout) and 1 (Vitamins) checked in current period
    { id: stableChecklistItemId('mock-4', 0, checklistPeriodStart), metric_id: 'mock-4', value: 0.25, logged_at: hoursAgo(2), session_start_at: null, created_at: now },
    { id: stableChecklistItemId('mock-4', 1, checklistPeriodStart), metric_id: 'mock-4', value: 0.25, logged_at: hoursAgo(1), session_start_at: null, created_at: now },
  ];
}

function ensureSeeded(): void {
  if (storage.getBoolean(SEEDED_KEY)) return;
  storage.set(METRICS_KEY, JSON.stringify(buildSeedMetrics()));
  storage.set(ENTRIES_KEY, JSON.stringify(buildSeedEntries()));
  storage.set(SEEDED_KEY, true);
}

function readMetrics(): Metric[] {
  ensureSeeded();
  const raw = storage.getString(METRICS_KEY);
  return raw ? (JSON.parse(raw) as Metric[]) : [];
}

function writeMetrics(metrics: Metric[]): void {
  storage.set(METRICS_KEY, JSON.stringify(metrics));
}

function readEntries(): LogEntry[] {
  ensureSeeded();
  const raw = storage.getString(ENTRIES_KEY);
  return raw ? (JSON.parse(raw) as LogEntry[]) : [];
}

function writeEntries(entries: LogEntry[]): void {
  storage.set(ENTRIES_KEY, JSON.stringify(entries));
}

export const localDb = {
  fetchMetrics(): Metric[] {
    return readMetrics();
  },

  createMetric(name: string, type: MetricType, timeframe: MetricTimeframe, source: MetricSource = 'user', checklistItems?: string[]): Metric {
    const metrics = readMetrics();
    const nextOrder = metrics.length > 0 ? Math.max(...metrics.map((m) => m.display_order)) + 1 : 0;
    const metric: Metric = {
      id: `local-${Date.now()}`,
      name,
      type,
      timeframe,
      source,
      display_order: nextOrder,
      created_at: new Date().toISOString(),
      checklist_items: checklistItems ?? null,
    };
    writeMetrics([...metrics, metric]);
    return metric;
  },

  fetchPeriodEntries(metricId: string, periodStart: Date, periodEnd: Date): { value: number }[] {
    return readEntries()
      .filter(
        (e) =>
          e.metric_id === metricId &&
          new Date(e.logged_at) >= periodStart &&
          new Date(e.logged_at) < periodEnd
      )
      .map((e) => ({ value: e.value }));
  },

  insertLogEntry(entry: PendingLogEntry): void {
    const entries = readEntries();
    if (entries.some((e) => e.id === entry.id)) return; // idempotent
    writeEntries([
      ...entries,
      { ...entry, created_at: new Date().toISOString() },
    ]);
  },

  deleteLogEntriesForPeriod(metricId: string, periodStart: Date, periodEnd: Date): void {
    const entries = readEntries();
    writeEntries(
      entries.filter(
        (e) =>
          !(
            e.metric_id === metricId &&
            new Date(e.logged_at) >= periodStart &&
            new Date(e.logged_at) < periodEnd
          )
      )
    );
  },

  fetchPeriodLogEntries(metricId: string, periodStart: Date, periodEnd: Date): LogEntry[] {
    return readEntries()
      .filter(
        (e) =>
          e.metric_id === metricId &&
          new Date(e.logged_at) >= periodStart &&
          new Date(e.logged_at) < periodEnd
      )
      .sort((a, b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime());
  },

  deleteLogEntry(id: string): void {
    writeEntries(readEntries().filter((e) => e.id !== id));
  },
};
