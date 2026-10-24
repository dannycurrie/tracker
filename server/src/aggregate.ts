import { computeMean } from '../../src/utils/averageCalc';
import { formatInZone, PeriodWindow, periodsOverlapping } from './periods';
import { LogEntryRow, MetricRow } from './store';
import { TimeWindow } from './window';

export interface MetricPlan {
  metric: MetricRow;
  periods: PeriodWindow[];
}

export interface PeriodSummary {
  start: string;
  end: string;
  partial: boolean;
  entryCount: number;
  value: number | null;
}

/**
 * Works out which periods each metric reports, plus the single window of log
 * entries needed to compute them all (the request window widened to whole periods).
 * `fetchWindow` is null when no metric has any periods.
 */
export function planPeriods(
  metrics: MetricRow[],
  window: TimeWindow,
  tz: string
): { plans: MetricPlan[]; fetchWindow: TimeWindow | null } {
  const plans = metrics.map((metric) => ({ metric, periods: reportedPeriods(metric, window, tz) }));

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
    const values = own
      .filter((e) => {
        const t = Date.parse(e.logged_at);
        return t >= period.start.getTime() && t < period.end.getTime();
      })
      .map((e) => e.value);

    return {
      start: formatInZone(period.start, tz),
      end: formatInZone(period.end, tz),
      partial: period.start < window.from || period.end > window.to,
      entryCount: values.length,
      value: plan.metric.type === 'average' ? computeMean(values) : values.reduce((acc, v) => acc + v, 0),
    };
  });
}

function reportedPeriods(metric: MetricRow, window: TimeWindow, tz: string): PeriodWindow[] {
  // Checklist periods arrive in ticket 04.
  if (metric.type === 'checklist') return [];

  const createdAt = Date.parse(metric.created_at);
  return periodsOverlapping(metric.timeframe, window.from, window.to, tz).filter(
    (p) => p.end.getTime() > createdAt
  );
}
