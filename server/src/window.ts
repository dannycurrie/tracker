import { ApiError } from './errors';

export interface TimeWindow {
  from: Date;
  to: Date;
}

const MAX_RANGE_YEARS = 2;

// Date-time with an explicit offset or Z. Date-only and offset-less strings are
// rejected because their timezone would be ambiguous.
const ISO_WITH_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})$/;

/** Parses and validates the half-open [from, to) window from the query string. */
export function parseWindow(query: Record<string, unknown>): TimeWindow {
  const from = parseTimestamp(query, 'from');
  const to = parseTimestamp(query, 'to');

  if (from.getTime() >= to.getTime()) {
    throw new ApiError(400, 'invalid_range', '`from` must be before `to`');
  }

  const limit = new Date(from);
  limit.setUTCFullYear(limit.getUTCFullYear() + MAX_RANGE_YEARS);
  if (to.getTime() > limit.getTime()) {
    throw new ApiError(400, 'range_too_large', `The window can span at most ${MAX_RANGE_YEARS} years`);
  }

  return { from, to };
}

function parseTimestamp(query: Record<string, unknown>, name: 'from' | 'to'): Date {
  // An unencoded `+` in a query string decodes to a space, so `+01:00` arrives as ` 01:00`.
  const raw = typeof query[name] === 'string' ? query[name].replace(/ (\d{2}:\d{2})$/, '+$1') : query[name];
  if (raw === undefined || raw === '') {
    throw new ApiError(400, 'missing_parameter', `\`${name}\` is required`);
  }
  if (typeof raw !== 'string' || !ISO_WITH_OFFSET.test(raw)) {
    throw new ApiError(
      400,
      'invalid_timestamp',
      `\`${name}\` must be a single ISO-8601 date-time with an offset or Z`
    );
  }

  const date = new Date(raw);
  // Date accepts some impossible values (e.g. day 31 in a 30-day month) by rolling
  // over; reject those by checking the calendar date survived the round trip.
  if (Number.isNaN(date.getTime()) || !calendarDateMatches(raw, date)) {
    throw new ApiError(400, 'invalid_timestamp', `\`${name}\` is not a real date-time`);
  }
  return date;
}

function calendarDateMatches(raw: string, date: Date): boolean {
  const offset = raw.match(/(Z|[+-]\d{2}:\d{2})$/)![1];
  const offsetMinutes =
    offset === 'Z'
      ? 0
      : (offset[0] === '-' ? -1 : 1) * (Number(offset.slice(1, 3)) * 60 + Number(offset.slice(4, 6)));
  const local = new Date(date.getTime() + offsetMinutes * 60_000);
  return local.toISOString().slice(0, 10) === raw.slice(0, 10);
}
