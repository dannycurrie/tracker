import { afterEach, describe, expect, it } from 'vitest';
import { getPeriodWindow as appGetPeriodWindow } from '../../src/utils/periods';
import { formatInZone, getPeriodWindow, periodsOverlapping } from '../src/periods';

const LONDON = 'Europe/London';

const window = (tf: 'weekly' | 'monthly', iso: string, tz = LONDON) => {
  const p = getPeriodWindow(tf, new Date(iso), tz);
  return { start: formatInZone(p.start, tz), end: formatInZone(p.end, tz) };
};

describe('getPeriodWindow', () => {
  it('runs weekly periods Monday to Monday in local time', () => {
    expect(window('weekly', '2026-10-14T12:00:00Z')).toEqual({
      start: '2026-10-12T00:00:00+01:00',
      end: '2026-10-19T00:00:00+01:00',
    });
  });

  it('puts Sunday in the week that started the previous Monday', () => {
    expect(window('weekly', '2026-10-18T22:00:00Z').start).toBe('2026-10-12T00:00:00+01:00');
  });

  it('uses the local date, not the UTC date, at the week boundary', () => {
    // 23:30 UTC on Sunday is 00:30 BST on Monday.
    expect(window('weekly', '2026-10-18T23:30:00Z').start).toBe('2026-10-19T00:00:00+01:00');
    // Local Monday midnight itself belongs to the new week.
    expect(window('weekly', '2026-10-18T23:00:00Z').start).toBe('2026-10-19T00:00:00+01:00');
    expect(window('weekly', '2026-10-18T22:59:59.999Z').start).toBe('2026-10-12T00:00:00+01:00');
  });

  it('handles the week the clocks go forward (167 hours)', () => {
    const p = getPeriodWindow('weekly', new Date('2026-03-27T12:00:00Z'), LONDON);
    expect(formatInZone(p.start, LONDON)).toBe('2026-03-23T00:00:00+00:00');
    expect(formatInZone(p.end, LONDON)).toBe('2026-03-30T00:00:00+01:00');
    expect((p.end.getTime() - p.start.getTime()) / 3_600_000).toBe(167);
  });

  it('handles the week the clocks go back (169 hours)', () => {
    const p = getPeriodWindow('weekly', new Date('2026-10-24T12:00:00Z'), LONDON);
    expect(formatInZone(p.start, LONDON)).toBe('2026-10-19T00:00:00+01:00');
    expect(formatInZone(p.end, LONDON)).toBe('2026-10-26T00:00:00+00:00');
    expect((p.end.getTime() - p.start.getTime()) / 3_600_000).toBe(169);
  });

  it('runs monthly periods from the 1st to the 1st across DST', () => {
    expect(window('monthly', '2026-03-15T12:00:00Z')).toEqual({
      start: '2026-03-01T00:00:00+00:00',
      end: '2026-04-01T00:00:00+01:00',
    });
  });

  it('rolls December into January', () => {
    expect(window('monthly', '2026-12-31T23:59:59Z')).toEqual({
      start: '2026-12-01T00:00:00+00:00',
      end: '2027-01-01T00:00:00+00:00',
    });
  });

  it('works for timezones ahead of UTC and with half-hour offsets', () => {
    expect(window('weekly', '2026-10-18T19:00:00Z', 'Asia/Kolkata')).toEqual({
      start: '2026-10-19T00:00:00+05:30',
      end: '2026-10-26T00:00:00+05:30',
    });
    expect(window('monthly', '2026-09-30T15:00:00Z', 'Australia/Sydney')).toEqual({
      start: '2026-10-01T00:00:00+10:00',
      end: '2026-11-01T00:00:00+11:00',
    });
  });

  it('stays contiguous at local midnight in a zone whose DST changes happen at midnight', () => {
    const tz = 'America/Santiago';
    for (const tf of ['weekly', 'monthly'] as const) {
      const periods = periodsOverlapping(tf, new Date('2026-01-01T00:00:00Z'), new Date('2028-01-01T00:00:00Z'), tz);
      for (let i = 1; i < periods.length; i++) {
        expect(periods[i].start.getTime()).toBe(periods[i - 1].end.getTime());
      }
      expect(periods.filter((p) => !formatInZone(p.start, tz).includes('T00:00:00'))).toEqual([]);
    }
  });
});

describe('parity with the app', () => {
  const originalTz = process.env.TZ;
  afterEach(() => {
    process.env.TZ = originalTz;
  });

  it.each(['Europe/London', 'America/New_York', 'Australia/Sydney', 'Asia/Kolkata'])(
    'matches the app running in %s',
    (tz) => {
      process.env.TZ = tz;
      const mismatches: string[] = [];
      // Every 5 hours across two years, so samples land on every hour of day and across DST.
      for (let t = Date.parse('2026-01-01T00:00:00Z'); t < Date.parse('2028-01-01T00:00:00Z'); t += 5 * 3_600_000) {
        for (const tf of ['weekly', 'monthly'] as const) {
          const now = new Date(t);
          const ours = getPeriodWindow(tf, now, tz);
          const app = appGetPeriodWindow(tf, now);
          if (ours.start.getTime() !== app.start.getTime() || ours.end.getTime() !== app.end.getTime()) {
            mismatches.push(`${tf} ${now.toISOString()}`);
          }
        }
      }
      expect(mismatches).toEqual([]);
    }
  );
});

describe('periodsOverlapping', () => {
  const starts = (tf: 'weekly' | 'monthly', from: string, to: string) =>
    periodsOverlapping(tf, new Date(from), new Date(to), LONDON).map((p) => formatInZone(p.start, LONDON));

  it('includes the periods that the window only partly covers', () => {
    expect(starts('weekly', '2026-10-14T00:00:00Z', '2026-10-21T00:00:00Z')).toEqual([
      '2026-10-12T00:00:00+01:00',
      '2026-10-19T00:00:00+01:00',
    ]);
  });

  it('treats the window as half-open', () => {
    // `from` on a boundary does not pull in the previous week; `to` on a boundary excludes the next.
    expect(starts('weekly', '2026-10-11T23:00:00Z', '2026-10-18T23:00:00Z')).toEqual(['2026-10-12T00:00:00+01:00']);
  });

  it('returns contiguous periods across a long window', () => {
    const periods = periodsOverlapping('weekly', new Date('2025-01-01T00:00:00Z'), new Date('2027-01-01T00:00:00Z'), LONDON);
    expect(periods.length).toBe(105);
    for (let i = 1; i < periods.length; i++) {
      expect(periods[i].start.getTime()).toBe(periods[i - 1].end.getTime());
    }
    expect(periods.every((p) => formatInZone(p.start, LONDON).includes('T00:00:00'))).toBe(true);
  });

  it('returns months oldest first', () => {
    expect(starts('monthly', '2026-11-15T00:00:00Z', '2027-02-01T00:00:00Z')).toEqual([
      '2026-11-01T00:00:00+00:00',
      '2026-12-01T00:00:00+00:00',
      '2027-01-01T00:00:00+00:00',
    ]);
  });
});
