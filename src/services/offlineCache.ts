import { createKV } from '../utils/storage';
import { Metric, LogEntry } from '../types';

const kv = createKV('offline-cache');

export const offlineCache = {
  getMetrics(): Metric[] | null {
    const raw = kv.getString('metrics');
    return raw ? (JSON.parse(raw) as Metric[]) : null;
  },
  setMetrics(metrics: Metric[]): void {
    kv.set('metrics', JSON.stringify(metrics));
  },

  getPeriodValues(metricId: string, start: string, end: string): { value: number }[] | null {
    const raw = kv.getString(`pv:${metricId}:${start}:${end}`);
    return raw ? (JSON.parse(raw) as { value: number }[]) : null;
  },
  setPeriodValues(metricId: string, start: string, end: string, values: { value: number }[]): void {
    kv.set(`pv:${metricId}:${start}:${end}`, JSON.stringify(values));
  },

  getLogEntries(metricId: string, start: string, end: string): LogEntry[] | null {
    const raw = kv.getString(`le:${metricId}:${start}:${end}`);
    return raw ? (JSON.parse(raw) as LogEntry[]) : null;
  },
  setLogEntries(metricId: string, start: string, end: string, entries: LogEntry[]): void {
    kv.set(`le:${metricId}:${start}:${end}`, JSON.stringify(entries));
  },
};
