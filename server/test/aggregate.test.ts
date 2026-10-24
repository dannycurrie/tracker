import { describe, expect, it } from 'vitest';
import { stableChecklistItemId } from '../../src/utils/checklist';
import { planPeriods, summarisePeriods } from '../src/aggregate';
import { getPeriodWindow } from '../src/periods';
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
    expect(planPeriods([metricRow({ created_at: '2027-01-01T00:00:00Z' })], window, TZ).fetchWindow).toBeNull();
  });
});

describe('checklist periods', () => {
  const items = ['Stretch', 'Journal', 'Cold shower'];
  const m = metricRow({ id: 'gym', type: 'checklist', checklist_items: items });
  // Weeks of 12 Oct and 19 Oct 2026, as the app on a London device would compute them.
  const week1 = getPeriodWindow('weekly', new Date('2026-10-14T12:00:00Z'), TZ).start;
  const week2 = getPeriodWindow('weekly', new Date('2026-10-21T12:00:00Z'), TZ).start;
  const tick = (idx: number, periodStart: Date, loggedAt: string) =>
    entry('gym', loggedAt, 1 / items.length, stableChecklistItemId('gym', idx, periodStart));

  it('reports checked count, total and item states per period', () => {
    const periods = summarise(m, [
      tick(0, week1, '2026-10-13T07:00:00Z'),
      tick(2, week1, '2026-10-16T07:00:00Z'),
      tick(1, week2, '2026-10-20T07:00:00Z'),
    ]);

    expect(periods).toEqual([
      {
        start: '2026-10-12T00:00:00+01:00',
        end: '2026-10-19T00:00:00+01:00',
        partial: true,
        entryCount: 2,
        value: 2,
        total: 3,
        items: [
          { label: 'Stretch', checked: true },
          { label: 'Journal', checked: false },
          { label: 'Cold shower', checked: true },
        ],
      },
      expect.objectContaining({ entryCount: 1, value: 1, total: 3 }),
    ]);
    expect(periods[1]).toMatchObject({ items: [{ checked: false }, { checked: true }, { checked: false }] });
  });

  it('reports all and none checked', () => {
    const periods = summarise(m, [0, 1, 2].map((i) => tick(i, week1, '2026-10-13T07:00:00Z')));
    expect(periods.map((p) => p.value)).toEqual([3, 0]);
  });

  it("does not count a tick whose id belongs to another period", () => {
    // Logged inside week 2 but keyed to week 1's start: the app would not show it as checked in week 2.
    const periods = summarise(m, [tick(0, week1, '2026-10-20T07:00:00Z')]);
    expect(periods.map((p) => [p.entryCount, p.value])).toEqual([[0, 0], [1, 0]]);
  });

  it("ignores other metrics' entries even with a matching id", () => {
    const stray = { ...tick(0, week1, '2026-10-13T07:00:00Z'), metric_id: 'other' };
    expect(summarise(m, [stray]).map((p) => p.value)).toEqual([0, 0]);
  });

  it('misses every tick when the period start is computed in the wrong timezone', () => {
    // Guards the reason periods use USER_TZ: a UTC-midnight start produces different ids.
    const utcMonday = new Date('2026-10-12T00:00:00Z');
    const periods = summarise(m, [0, 1, 2].map((i) => tick(i, utcMonday, '2026-10-13T07:00:00Z')));
    expect(periods[0]).toMatchObject({ entryCount: 3, value: 0 });
  });

  it('handles a checklist with no items', () => {
    const periods = summarise(metricRow({ id: 'gym', type: 'checklist', checklist_items: null }), []);
    expect(periods[0]).toMatchObject({ value: 0, total: 0, items: [] });
  });
});
