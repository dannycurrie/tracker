import { createApp } from '../src/app';
import { Config, ConfigResult } from '../src/config';
import { RequestLogEntry } from '../src/logging';
import { MetricRow, MetricsStore } from '../src/store';

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

export function fakeStore(metrics: MetricRow[] = []) {
  const calls: { createdBefore: Date }[] = [];
  const store: MetricsStore = {
    async listMetrics(options) {
      calls.push(options);
      return metrics;
    },
  };
  return { store, calls };
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
