import { createApp } from '../src/app';
import { Config, ConfigResult } from '../src/config';
import { RequestLogEntry } from '../src/logging';
import { LogEntryRow, MetricRow, MetricsStore } from '../src/store';

export const API_KEY = 'test-api-key-0123456789abcdefghijklmnop';

export const config: Config = {
  supabaseUrl: 'https://example.supabase.co',
  supabaseSecretKey: 'secret',
  apiKey: API_KEY,
  timezone: 'Europe/London',
};

export function metricRow(overrides: Partial<MetricRow> = {}): MetricRow {
  return {
    id: 'metric-1',
    name: 'Reading',
    type: 'timed',
    timeframe: 'weekly',
    source: 'user',
    display_order: 0,
    created_at: '2026-05-03T17:43:07.290353+00:00',
    checklist_items: null,
    ...overrides,
  };
}

export function entry(metricId: string, loggedAt: string, value: number, id = `${metricId}@${loggedAt}`): LogEntryRow {
  return { id, metric_id: metricId, value, logged_at: loggedAt };
}

export function fakeStore(metrics: MetricRow[] = [], entries: LogEntryRow[] = []) {
  const calls: { createdBefore: Date }[] = [];
  const entryCalls: { metricIds: string[]; from: Date; to: Date }[] = [];
  const store: MetricsStore = {
    async listMetrics(options) {
      calls.push(options);
      return metrics;
    },
    async listLogEntries(options) {
      entryCalls.push(options);
      return entries.filter((e) => {
        const t = Date.parse(e.logged_at);
        return options.metricIds.includes(e.metric_id) && t >= options.from.getTime() && t < options.to.getTime();
      });
    },
  };
  return { store, calls, entryCalls };
}

export function buildApp({
  store = fakeStore().store,
  configResult = { ok: true, config } as ConfigResult,
}: { store?: MetricsStore; configResult?: ConfigResult } = {}) {
  const logs: RequestLogEntry[] = [];
  const app = createApp({ config: configResult, makeStore: () => store, log: (e) => logs.push(e) });
  return { app, logs };
}

export const auth = { Authorization: `Bearer ${API_KEY}` };
