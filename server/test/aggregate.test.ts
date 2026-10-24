import { describe, expect, it } from 'vitest';
import { planPeriods, summarisePeriods } from '../src/aggregate';
import { entry, metricRow } from './helpers';

const TZ = 'Europe/London';
// Wed 14 Oct to Wed 21 Oct 2026: partly covers the weeks of 12 Oct and 19 Oct.
const window = { from: new Date('2026-10-14T00:00:00Z'), to: new Date('2026-10-21T00:00:00Z') };

function summarise(metric: ReturnType<typeof metricRow>, entries: ReturnType<typeof entry>[], w = window) {
  const { plans } = planPeriods([metric], w, TZ);
  return summarisePeriods(plans[0], entries, w, TZ);
}

describe('summarisePeriods', () => {
  it('sums cumulative and timed entries over the whole period, flagging partial ones', () => {
    const m = metricRow({ id: 'm', type: 'timed' });
    const periods = summarise(m, [
      entry('m', '2026-10-12T08:00:00Z', 10), // Mon, before `from` but in the first period
      entry('m', '2026-10-15T08:00:00Z', 20),
      entry('m', '2026-10-25T08:00:00Z', 5), // Sun, after `to` but in the second period
    ]);

    expect(periods).toEqual([
      { start: '2026-10-12T00:00:00+01:00', end: '2026-10-19T00:00:00+01:00', partial: true, entryCount: 2, value: 30 },
      { start: '2026-10-19T00:00:00+01:00', end: '2026-10-26T00:00:00+00:00', partial: true, entryCount: 1, value: 5 },
    ]);
  });

  it('returns 0 for a sum with no entries', () => {
    const periods = summarise(metricRow({ id: 'm', type: 'cumulative' }), []);
    expect(periods.map((p) => [p.entryCount, p.value])).toEqual([[0, 0], [0, 0]]);
  });

  it('averages with the app helper (1 dp) and returns null with no entries', () => {
    const m = metricRow({ id: 'm', type: 'average' });
    const periods = summarise(m, [entry('m', '2026-10-13T08:00:00Z', 7), entry('m', '2026-10-14T08:00:00Z', 8), entry('m', '2026-10-15T08:00:00Z', 8)]);
    expect(periods.map((p) => p.value)).toEqual([7.7, null]);
  });

  it('marks periods fully inside the window as not partial', () => {
    const w = { from: new Date('2026-10-11T23:00:00Z'), to: new Date('2026-10-18T23:00:00Z') }; // exactly one BST week
    const periods = summarise(metricRow({ id: 'm' }), [], w);
    expect(periods).toHaveLength(1);
    expect(periods[0].partial).toBe(false);
  });

  it('assigns an entry at a period boundary to the period it starts', () => {
    const m = metricRow({ id: 'm', type: 'cumulative' });
    const periods = summarise(m, [entry('m', '2026-10-18T23:00:00Z', 1)]); // Mon 19 Oct 00:00 BST
    expect(periods.map((p) => p.value)).toEqual([0, 1]);
  });

  it("ignores other metrics' entries", () => {
    const periods = summarise(metricRow({ id: 'm', type: 'cumulative' }), [entry('other', '2026-10-15T08:00:00Z', 99)]);
    expect(periods.map((p) => p.value)).toEqual([0, 0]);
  });
});

describe('planPeriods', () => {
  it('drops periods that end before the metric was created', () => {
    // Created Tue 20 Oct: the week of 12 Oct ended before then, the week of 19 Oct contains it.
    const m = metricRow({ id: 'm', created_at: '2026-10-20T09:00:00Z' });
    const { plans } = planPeriods([m], window, TZ);
    expect(plans[0].periods.map((p) => p.start.toISOString())).toEqual(['2026-10-18T23:00:00.000Z']);
  });

  it('drops a period that ends exactly when the metric was created', () => {
    const m = metricRow({ id: 'm', created_at: '2026-10-18T23:00:00Z' });
    const { plans } = planPeriods([m], window, TZ);
    expect(plans[0].periods).toHaveLength(1);
  });

  it('fetches entries over the window widened to whole periods of every metric', () => {
    const { fetchWindow } = planPeriods(
      [metricRow({ id: 'w', timeframe: 'weekly' }), metricRow({ id: 'mo', timeframe: 'monthly' })],
      window,
      TZ
    );
    expect(fetchWindow).toEqual({
      from: new Date('2026-09-30T23:00:00Z'), // 1 Oct 00:00 BST
      to: new Date('2026-11-01T00:00:00Z'), // 1 Nov 00:00 GMT
    });
  });

  it('has no fetch window when no metric reports periods', () => {
    expect(planPeriods([], window, TZ).fetchWindow).toBeNull();
    expect(planPeriods([metricRow({ type: 'checklist', checklist_items: ['a'] })], window, TZ).fetchWindow).toBeNull();
  });
});
