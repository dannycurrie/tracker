import type { MetricTimeframe } from '../../src/types';

export interface PeriodWindow {
  start: Date;
  end: Date;
}

interface CivilDate {
  year: number;
  month: number; // 1-12
  day: number;
}

interface WallClock extends CivilDate {
  hour: number;
  minute: number;
  second: number;
}

const HOUR_MS = 3_600_000;

/**
 * The period of `timeframe` containing `instant`, with boundaries at local
 * midnight in `tz`: weekly runs Monday to Monday, monthly the 1st to the 1st.
 * Matches the app's `getPeriodWindow` run on a device set to `tz`.
 */
export function getPeriodWindow(timeframe: MetricTimeframe, instant: Date, tz: string): PeriodWindow {
  const today = wallClock(instant, tz);

  if (timeframe === 'weekly') {
    const weekday = new Date(Date.UTC(today.year, today.month - 1, today.day)).getUTCDay(); // 0=Sun
    const monday = addDays(today, -((weekday + 6) % 7));
    return { start: startOfDay(monday, tz), end: startOfDay(addDays(monday, 7), tz) };
  }

  const first = { year: today.year, month: today.month, day: 1 };
  const next =
    today.month === 12 ? { year: today.year + 1, month: 1, day: 1 } : { year: today.year, month: today.month + 1, day: 1 };
  return { start: startOfDay(first, tz), end: startOfDay(next, tz) };
}

/** Every period of `timeframe` that overlaps the half-open window [from, to), oldest first. */
export function periodsOverlapping(timeframe: MetricTimeframe, from: Date, to: Date, tz: string): PeriodWindow[] {
  const periods: PeriodWindow[] = [];
  for (let p = getPeriodWindow(timeframe, from, tz); p.start < to; p = getPeriodWindow(timeframe, p.end, tz)) {
    periods.push(p);
  }
  return periods;
}

/** `instant` as an ISO-8601 timestamp in `tz`'s wall-clock time with its offset, e.g. `2026-10-13T00:00:00+01:00`. */
export function formatInZone(instant: Date, tz: string): string {
  const w = wallClock(instant, tz);
  const offsetMinutes = Math.round(offsetMs(instant, tz) / 60_000);
  const sign = offsetMinutes < 0 ? '-' : '+';
  const abs = Math.abs(offsetMinutes);
  return (
    `${w.year}-${pad(w.month)}-${pad(w.day)}T${pad(w.hour)}:${pad(w.minute)}:${pad(w.second)}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

/**
 * The instant of local midnight on `date` in `tz`. Resolves DST the way JS Date
 * does: an ambiguous midnight takes the earlier instant, and a midnight skipped by
 * a DST gap moves forward to the first instant after the gap.
 */
function startOfDay(date: CivilDate, tz: string): Date {
  const wall = Date.UTC(date.year, date.month - 1, date.day);
  const offsetBefore = offsetMs(new Date(wall - 12 * HOUR_MS), tz);
  const offsetAfter = offsetMs(new Date(wall + 12 * HOUR_MS), tz);

  const matches = [wall - offsetBefore, wall - offsetAfter].filter((t) => offsetMs(new Date(t), tz) === wall - t);
  if (matches.length > 0) return new Date(Math.min(...matches));
  return new Date(wall - offsetBefore);
}

function offsetMs(instant: Date, tz: string): number {
  const w = wallClock(instant, tz);
  const wallMs = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return wallMs - Math.floor(instant.getTime() / 1000) * 1000;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function wallClock(instant: Date, tz: string): WallClock {
  let fmt = formatters.get(tz);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(tz, fmt);
  }
  const parts = Object.fromEntries(fmt.formatToParts(instant).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

function addDays(date: CivilDate, days: number): CivilDate {
  const d = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
