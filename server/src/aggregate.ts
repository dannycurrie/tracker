import { computeMean } from '../../src/utils/averageCalc';
import { stableChecklistItemId } from '../../src/utils/checklist';
import { BucketSize, formatInZone, PeriodWindow, periodsOverlapping } from './periods';
import { LogEntryRow, MetricRow } from './store';
import { Granularity, TimeWindow } from './window';

export interface MetricPlan {
  metric: MetricRow;
  periods: PeriodWindow[];
}

interface BasePeriodSummary {
  start: string;
  end: string;
  partial: boolean;
  entryCount: number;
}

export type PeriodSummary =
  | (BasePeriodSummary & { value: number | null })
  | (BasePeriodSummary & { value: number; total: number; items: { label: string; checked: boolean }[] });

/**
 * Works out which periods each metric reports, plus the single window of log
 * entries needed to compute them all (the request window widened to whole periods).
 * `fetchWindow` is null when no metric has any periods.
 */
export function planPeriods(
  metrics: MetricRow[],
  window: TimeWindow,
  tz: string,
  granularity: Granularity = 'period'
): { plans: MetricPlan[]; fetchWindow: TimeWindow | null } {
  const plans = metrics.map((metric) => ({
    metric,
    periods: reportedPeriods(metric, bucketSize(metric, granularity), window, tz),
  }));

  const all = plans.flatMap((p) => p.periods);
  const fetchWindow =
    all.length === 0
      ? null
      : {
          from: new Date(Math.min(...all.map((p) => p.start.getTime()))),
          to: new Date(Math.max(...all.map((p) => p.end.getTime()))),
        };

  return { plans, fetchWindow };
}

/** Each period's value is computed over the whole period, even when the window only covers part of it. */
export function summarisePeriods(
  plan: MetricPlan,
  entries: LogEntryRow[],
  window: TimeWindow,
  tz: string
): PeriodSummary[] {
  const own = entries.filter((e) => e.metric_id === plan.metric.id);

  return plan.periods.map((period) => {
    const inPeriod = own.filter((e) => {
      const t = Date.parse(e.logged_at);
      return t >= period.start.getTime() && t < period.end.getTime();
    });
    const base = {
      start: formatInZone(period.start, tz),
      end: formatInZone(period.end, tz),
      partial: period.start < window.from || period.end > window.to,
      entryCount: inPeriod.length,
    };

    if (plan.metric.type === 'checklist') {
      return { ...base, ...checklistState(plan.metric, period, inPeriod) };
    }
    const values = inPeriod.map((e) => e.value);
    return {
      ...base,
      value: plan.metric.type === 'average' ? computeMean(values) : values.reduce((acc, v) => acc + v, 0),
    };
  });
}

/**
 * Mirrors the app's useChecklistState: item i is checked when the period holds an
 * entry whose id is the stable id for (metric, i, period start). The period start
 * must be the exact instant the device computed, which is why periods use USER_TZ.
 */
function checklistState(metric: MetricRow, period: PeriodWindow, entries: LogEntryRow[]) {
  const ids = new Set(entries.map((e) => e.id));
  const items = (Array.isArray(metric.checklist_items) ? metric.checklist_items : []).map((label, i) => ({
    label,
    checked: ids.has(stableChecklistItemId(metric.id, i, period.start)),
  }));
  return { value: items.filter((item) => item.checked).length, total: items.length, items };
}

// Checklist ticks are keyed to the start of the metric's own period, so they can't be split by day.
function bucketSize(metric: MetricRow, granularity: Granularity): BucketSize {
  return granularity === 'day' && metric.type !== 'checklist' ? 'daily' : metric.timeframe;
}

function reportedPeriods(metric: MetricRow, size: BucketSize, window: TimeWindow, tz: string): PeriodWindow[] {
  const createdAt = Date.parse(metric.created_at);
  return periodsOverlapping(size, window.from, window.to, tz).filter(
    (p) => p.end.getTime() > createdAt
  );
}
