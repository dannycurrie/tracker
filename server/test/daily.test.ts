import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { stableChecklistItemId } from '../../src/utils/checklist';
import { planPeriods, summarisePeriods } from '../src/aggregate';
import { formatInZone, getPeriodWindow, periodsOverlapping } from '../src/periods';
import { TimeWindow } from '../src/window';
import { auth, buildApp, entry, fakeStore, metricRow } from './helpers';

const TZ = 'Europe/London';
const HOUR = 3_600_000;

function days(metric: ReturnType<typeof metricRow>, entries: ReturnType<typeof entry>[], window: TimeWindow) {
  const { plans } = planPeriods([metric], window, TZ, 'day');
  return summarisePeriods(plans[0], entries, window, TZ);
}

const at = (from: string, to: string): TimeWindow => ({ from: new Date(from), to: new Date(to) });

describe('daily windows', () => {
  const day = (iso: string, tz = TZ) => {
    const p = getPeriodWindow('daily', new Date(iso), tz);
    return { start: formatInZone(p.start, tz), end: formatInZone(p.end, tz), hours: (p.end.getTime() - p.start.getTime()) / HOUR };
  };

  it('runs from local midnight to the next local midnight', () => {
    expect(day('2026-10-14T12:00:00Z')).toEqual({ start: '2026-10-14T00:00:00+01:00', end: '2026-10-15T00:00:00+01:00', hours: 24 });
    // 23:30 UTC is already the next day in BST.
    expect(day('2026-10-14T23:30:00Z').start).toBe('2026-10-15T00:00:00+01:00');
  });

  it('makes the clocks-forward Sunday 23 hours', () => {
    expect(day('2026-03-29T12:00:00Z')).toEqual({ start: '2026-03-29T00:00:00+00:00', end: '2026-03-30T00:00:00+01:00', hours: 23 });
  });

  it('makes the clocks-back Sunday 25 hours', () => {
    expect(day('2026-10-25T12:00:00Z')).toEqual({ start: '2026-10-25T00:00:00+01:00', end: '2026-10-26T00:00:00+00:00', hours: 25 });
  });

  it('uses the local calendar day in other timezones', () => {
    expect(day('2026-10-14T20:00:00Z', 'Asia/Kolkata')).toEqual({
      start: '2026-10-15T00:00:00+05:30',
      end: '2026-10-16T00:00:00+05:30',
      hours: 24,
    });
  });

  it('tiles a week into 7 contiguous days', () => {
    const week = getPeriodWindow('weekly', new Date('2026-10-21T12:00:00Z'), TZ);
    const ds = periodsOverlapping('daily', week.start, week.end, TZ);
    expect(ds).toHaveLength(7);
    expect(ds[0].start).toEqual(week.start);
    expect(ds[6].end).toEqual(week.end);
    for (let i = 1; i < ds.length; i++) expect(ds[i].start).toEqual(ds[i - 1].end);
  });
});

describe('day buckets', () => {
  it('sums each day, oldest first, flagging days cut off by the window', () => {
    const m = metricRow({ id: 'm', type: 'timed' });
    const buckets = days(
      m,
      [entry('m', '2026-10-14T06:00:00Z', 10), entry('m', '2026-10-14T20:00:00Z', 5), entry('m', '2026-10-16T08:00:00Z', 30)],
      at('2026-10-14T12:00:00+01:00', '2026-10-16T12:00:00+01:00') // noon Wed to noon Fri
    );
    expect(buckets).toEqual([
      { start: '2026-10-14T00:00:00+01:00', end: '2026-10-15T00:00:00+01:00', partial: true, entryCount: 2, value: 15 },
      { start: '2026-10-15T00:00:00+01:00', end: '2026-10-16T00:00:00+01:00', partial: false, entryCount: 0, value: 0 },
      { start: '2026-10-16T00:00:00+01:00', end: '2026-10-17T00:00:00+01:00', partial: true, entryCount: 1, value: 30 },
    ]);
  });

  it('averages each day with the shared helper, or null with no entries', () => {
    const m = metricRow({ id: 'm', type: 'average' });
    const buckets = days(
      m,
      [entry('m', '2026-10-14T08:00:00Z', 7), entry('m', '2026-10-14T09:00:00Z', 8), entry('m', '2026-10-14T10:00:00Z', 8)],
      at('2026-10-14T00:00:00+01:00', '2026-10-16T00:00:00+01:00')
    );
    expect(buckets.map((b) => b.value)).toEqual([7.7, null]);
  });

  it('leaves out days that end before the metric was created', () => {
    const m = metricRow({ id: 'm', created_at: '2026-10-15T09:00:00Z' });
    const buckets = days(m, [], at('2026-10-13T00:00:00+01:00', '2026-10-17T00:00:00+01:00'));
    expect(buckets.map((b) => b.start)).toEqual(['2026-10-15T00:00:00+01:00', '2026-10-16T00:00:00+01:00']);
  });

  it('keeps both passes through the repeated hour, and late Sunday, in the 25-hour day', () => {
    const m = metricRow({ id: 'm', type: 'cumulative' });
    const buckets = days(
      m,
      [
        entry('m', '2026-10-24T22:59:59Z', 1), // Sat 23:59:59 BST
        entry('m', '2026-10-25T00:30:00Z', 2), // Sun 01:30 BST, first pass
        entry('m', '2026-10-25T01:30:00Z', 4), // Sun 01:30 GMT, second pass
        entry('m', '2026-10-25T23:30:00Z', 8), // Sun 23:30 GMT, the 25th hour's day
        entry('m', '2026-10-26T00:00:00Z', 16), // Mon 00:00 GMT
      ],
      at('2026-10-24T00:00:00+01:00', '2026-10-27T00:00:00+00:00')
    );
    expect(buckets.map((b) => [b.start, b.entryCount, b.value])).toEqual([
      ['2026-10-24T00:00:00+01:00', 1, 1],
      ['2026-10-25T00:00:00+01:00', 3, 14],
      ['2026-10-26T00:00:00+00:00', 1, 16],
    ]);
  });

  it('puts the hour after the clocks go forward in the 23-hour day', () => {
    const m = metricRow({ id: 'm', type: 'cumulative', created_at: '2026-01-01T00:00:00Z' });
    const buckets = days(
      m,
      [
        entry('m', '2026-03-29T00:59:59Z', 1), // Sun 00:59:59 GMT, just before the gap
        entry('m', '2026-03-29T01:00:00Z', 2), // Sun 02:00 BST, just after it
        entry('m', '2026-03-29T22:59:59Z', 4), // Sun 23:59:59 BST
        entry('m', '2026-03-29T23:00:00Z', 8), // Mon 00:00 BST
      ],
      at('2026-03-29T00:00:00+00:00', '2026-03-31T00:00:00+01:00')
    );
    expect(buckets.map((b) => [b.start, b.entryCount, b.value])).toEqual([
      ['2026-03-29T00:00:00+00:00', 3, 7],
      ['2026-03-30T00:00:00+01:00', 1, 8],
    ]);
  });

  it('keeps checklists on their own timeframe at day granularity', () => {
    const m = metricRow({ id: 'gym', type: 'checklist', checklist_items: ['Stretch', 'Journal'] });
    const weekStart = getPeriodWindow('weekly', new Date('2026-10-14T12:00:00Z'), TZ).start;
    const entries = [entry('gym', '2026-10-14T07:00:00Z', 0.5, stableChecklistItemId('gym', 1, weekStart))];
    const window = at('2026-10-12T00:00:00+01:00', '2026-10-19T00:00:00+01:00');

    const byDay = days(m, entries, window);
    const { plans } = planPeriods([m], window, TZ, 'period');
    expect(byDay).toEqual(summarisePeriods(plans[0], entries, window, TZ));
    expect(byDay).toEqual([
      expect.objectContaining({ start: '2026-10-12T00:00:00+01:00', end: '2026-10-19T00:00:00+01:00', value: 1, total: 2 }),
    ]);
  });
});

describe('day buckets add up to the week (property)', () => {
  // Deterministic PRNG (mulberry32) so failures reproduce.
  function rng(seed: number) {
    return () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
    };
  }

  // Random weeks across 2025–2027, plus both 2026 DST weeks explicitly.
  const random = rng(20261024);
  const weekStarts = [
    ...Array.from({ length: 60 }, () => new Date(Date.parse('2025-01-01T00:00:00Z') + random() * 3 * 365 * 24 * HOUR)),
    new Date('2026-03-27T12:00:00Z'),
    new Date('2026-10-24T12:00:00Z'),
  ];

  it.each(weekStarts.flatMap((d) => (['cumulative', 'timed'] as const).map((type) => [d.toISOString(), type] as const)))(
    'week containing %s (%s)',
    (iso, type) => {
      const week = getPeriodWindow('weekly', new Date(iso), TZ);
      const m = metricRow({ id: 'm', type, timeframe: 'weekly', created_at: '2024-01-01T00:00:00Z' });
      // Entries spread from two days before the week to two days after it, landing on any minute.
      const span = week.end.getTime() - week.start.getTime() + 4 * 24 * HOUR;
      const entries = Array.from({ length: Math.floor(random() * 40) }, (_, i) => {
        const t = week.start.getTime() - 2 * 24 * HOUR + Math.floor((random() * span) / 60_000) * 60_000;
        return entry('m', new Date(t).toISOString(), 1 + Math.floor(random() * 120), `e${i}`);
      });
      const window = { from: week.start, to: week.end };

      const [weekly] = summarisePeriods(planPeriods([m], window, TZ, 'period').plans[0], entries, window, TZ);
      const daily = summarisePeriods(planPeriods([m], window, TZ, 'day').plans[0], entries, window, TZ);

      expect(daily).toHaveLength(7);
      expect(daily.reduce((n, d) => n + (d.value ?? 0), 0)).toBe(weekly.value);
      expect(daily.reduce((n, d) => n + d.entryCount, 0)).toBe(weekly.entryCount);
    }
  );
});

describe('granularity parameter', () => {
  const WINDOW = 'from=2026-10-14T00:00:00%2B01:00&to=2026-10-16T00:00:00%2B01:00';
  const metrics = [
    metricRow({ id: 'w', type: 'cumulative', timeframe: 'weekly' }),
    metricRow({ id: 'c', type: 'checklist', timeframe: 'weekly', checklist_items: ['a'] }),
  ];

  it('returns day buckets and echoes granularity=day', async () => {
    const { store } = fakeStore(metrics, [entry('w', '2026-10-15T08:00:00Z', 3)]);
    const res = await request(buildApp({ store }).app).get(`/v1/metrics?${WINDOW}&granularity=day`).set(auth);

    expect(res.status).toBe(200);
    expect(res.body.granularity).toBe('day');
    const [cumulative, checklist] = res.body.metrics;
    expect(cumulative.periods.map((p: { start: string; value: number }) => [p.start, p.value])).toEqual([
      ['2026-10-14T00:00:00+01:00', 0],
      ['2026-10-15T00:00:00+01:00', 3],
    ]);
    expect(checklist.periods).toEqual([
      expect.objectContaining({ start: '2026-10-12T00:00:00+01:00', end: '2026-10-19T00:00:00+01:00', total: 1 }),
    ]);
  });

  it('defaults to period and treats granularity=period the same', async () => {
    const { store } = fakeStore(metrics);
    const app = buildApp({ store }).app;
    const implicit = await request(app).get(`/v1/metrics?${WINDOW}`).set(auth);
    const explicit = await request(app).get(`/v1/metrics?${WINDOW}&granularity=period`).set(auth);

    expect(implicit.body.granularity).toBe('period');
    expect(explicit.body).toEqual(implicit.body);
    expect(implicit.body.metrics[0].periods).toHaveLength(1);
  });

  it.each([
    ['an unknown value', 'granularity=week'],
    ['an empty value', 'granularity='],
    ['the wrong case', 'granularity=DAY'],
    ['a repeated parameter', 'granularity=day&granularity=day'],
  ])('rejects %s with 400 invalid_granularity', async (_name, param) => {
    const res = await request(buildApp().app).get(`/v1/metrics?${WINDOW}&${param}`).set(auth);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { code: 'invalid_granularity', message: expect.any(String) } });
  });
});
