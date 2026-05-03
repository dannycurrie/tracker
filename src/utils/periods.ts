import { MetricTimeframe } from '../types';

export interface PeriodWindow {
  start: Date;
  end: Date;
}

export function getPeriodWindow(timeframe: MetricTimeframe, now: Date = new Date()): PeriodWindow {
  if (timeframe === 'weekly') {
    const day = now.getDay(); // 0=Sun, 1=Mon...6=Sat
    const daysToMonday = day === 0 ? 6 : day - 1;
    const start = new Date(now);
    start.setDate(now.getDate() - daysToMonday);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    return { start, end };
  }

  // monthly
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
  return { start, end };
}

export function formatPeriodLabel(timeframe: MetricTimeframe, now: Date = new Date()): string {
  if (timeframe === 'weekly') {
    const { start, end } = getPeriodWindow('weekly', now);
    const endDay = new Date(end);
    endDay.setDate(end.getDate() - 1);
    return `${start.toLocaleDateString('en', { month: 'short', day: 'numeric' })} – ${endDay.toLocaleDateString('en', { month: 'short', day: 'numeric' })}`;
  }
  return now.toLocaleDateString('en', { month: 'long', year: 'numeric' });
}
