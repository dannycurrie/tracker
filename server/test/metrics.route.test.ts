import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { auth, buildApp, entry, fakeStore, metricRow, API_KEY } from './helpers';

const WINDOW = '/v1/metrics?from=2026-10-01T00:00:00Z&to=2026-10-24T00:00:00Z';

describe('auth', () => {
  it.each([
    ['no header', {}],
    ['wrong key', { Authorization: 'Bearer nope' }],
    ['wrong scheme', { Authorization: `Basic ${API_KEY}` }],
    ['key without scheme', { Authorization: API_KEY }],
  ])('rejects %s with 401', async (_name, headers) => {
    const { app } = buildApp();
    const res = await request(app).get(WINDOW).set(headers);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: { code: 'unauthorized', message: expect.any(String) } });
  });

  it('accepts the key with a case-insensitive scheme', async () => {
    const { app } = buildApp();
    const res = await request(app).get(WINDOW).set({ Authorization: `bearer ${API_KEY}` });
    expect(res.status).toBe(200);
  });

  it('checks auth before validating parameters', async () => {
    const { app } = buildApp();
    const res = await request(app).get('/v1/metrics');
    expect(res.status).toBe(401);
  });
});

describe('window validation', () => {
  const get = (query: string) => request(buildApp().app).get(`/v1/metrics?${query}`).set(auth);

  it.each([
    ['missing from', 'to=2026-10-24T00:00:00Z', 'missing_parameter'],
    ['missing to', 'from=2026-10-01T00:00:00Z', 'missing_parameter'],
    ['empty from', 'from=&to=2026-10-24T00:00:00Z', 'missing_parameter'],
    ['date only', 'from=2026-10-01&to=2026-10-24T00:00:00Z', 'invalid_timestamp'],
    ['no offset', 'from=2026-10-01T00:00:00&to=2026-10-24T00:00:00Z', 'invalid_timestamp'],
    ['not a date', 'from=yesterday&to=2026-10-24T00:00:00Z', 'invalid_timestamp'],
    ['impossible date', 'from=2026-09-31T00:00:00Z&to=2026-10-24T00:00:00Z', 'invalid_timestamp'],
    ['repeated param', 'from=2026-10-01T00:00:00Z&from=2026-10-02T00:00:00Z&to=2026-10-24T00:00:00Z', 'invalid_timestamp'],
    ['from equals to', 'from=2026-10-01T00:00:00Z&to=2026-10-01T00:00:00Z', 'invalid_range'],
    ['from after to', 'from=2026-10-24T00:00:00Z&to=2026-10-01T00:00:00Z', 'invalid_range'],
    ['over 2 years', 'from=2024-10-01T00:00:00Z&to=2026-10-01T00:00:01Z', 'range_too_large'],
  ])('rejects %s with 400', async (_name, query, code) => {
    const res = await get(query);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { code, message: expect.any(String) } });
  });

  it.each([
    ['exactly 2 years', 'from=2024-10-01T00:00:00Z&to=2026-10-01T00:00:00Z'],
    ['a future to', 'from=2026-10-01T00:00:00Z&to=2027-06-01T00:00:00Z'],
    ['encoded + offset', 'from=2026-10-01T00:00:00%2B01:00&to=2026-10-24T00:00:00Z'],
    ['unencoded + offset', 'from=2026-10-01T00:00:00+01:00&to=2026-10-24T00:00:00Z'],
    ['negative offset', 'from=2026-10-01T00:00:00-05:00&to=2026-10-24T00:00:00Z'],
    ['fractional seconds', 'from=2026-10-01T00:00:00.123Z&to=2026-10-24T00:00:00Z'],
  ])('accepts %s', async (_name, query) => {
    const res = await get(query);
    expect(res.status).toBe(200);
  });

  it('interprets offsets correctly', async () => {
    const res = await get('from=2026-10-01T00:00:00+01:00&to=2026-10-24T00:00:00-05:00');
    expect(res.body.from).toBe('2026-09-30T23:00:00.000Z');
    expect(res.body.to).toBe('2026-10-24T05:00:00.000Z');
  });
});

describe('response', () => {
  it('returns every metric in store order with units', async () => {
    const { store, calls } = fakeStore([
      metricRow({ id: 'a', name: 'Reading', type: 'timed', display_order: 0 }),
      metricRow({ id: 'b', name: 'Steps', type: 'cumulative', timeframe: 'monthly', source: 'apple_health', display_order: 1 }),
      metricRow({ id: 'c', name: 'Mood', type: 'average', display_order: 2 }),
      metricRow({ id: 'd', name: 'Routine', type: 'checklist', display_order: 3, checklist_items: ['Stretch'] }),
    ]);
    const res = await request(buildApp({ store }).app).get(WINDOW).set(auth);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      from: '2026-10-01T00:00:00.000Z',
      to: '2026-10-24T00:00:00.000Z',
      timezone: 'Europe/London',
      granularity: 'period',
      metrics: [
        { id: 'a', name: 'Reading', type: 'timed', timeframe: 'weekly', source: 'user', unit: 'minutes', periods: expect.any(Array) },
        { id: 'b', name: 'Steps', type: 'cumulative', timeframe: 'monthly', source: 'apple_health', unit: null, periods: expect.any(Array) },
        { id: 'c', name: 'Mood', type: 'average', timeframe: 'weekly', source: 'user', unit: null, periods: expect.any(Array) },
        { id: 'd', name: 'Routine', type: 'checklist', timeframe: 'weekly', source: 'user', unit: null, periods: expect.any(Array) },
      ],
    });
    expect(calls).toEqual([{ createdBefore: new Date('2026-10-24T00:00:00Z') }]);
  });

  it('returns period values computed from the store, fetching entries once', async () => {
    const { store, entryCalls } = fakeStore(
      [
        metricRow({ id: 'w', type: 'timed', timeframe: 'weekly' }),
        metricRow({ id: 'mo', type: 'average', timeframe: 'monthly' }),
      ],
      [
        entry('w', '2026-10-13T08:00:00Z', 30),
        entry('w', '2026-10-16T08:00:00Z', 15),
        entry('mo', '2026-10-02T08:00:00Z', 4),
        entry('mo', '2026-10-20T08:00:00Z', 5),
      ]
    );
    const { app, logs } = buildApp({ store });
    const res = await request(app)
      .get('/v1/metrics?from=2026-10-12T00:00:00%2B01:00&to=2026-10-19T00:00:00%2B01:00')
      .set(auth);

    expect(res.status).toBe(200);
    const [weekly, monthly] = res.body.metrics;
    expect(weekly.periods).toEqual([
      { start: '2026-10-12T00:00:00+01:00', end: '2026-10-19T00:00:00+01:00', partial: false, entryCount: 2, value: 45 },
    ]);
    expect(monthly.periods).toEqual([
      { start: '2026-10-01T00:00:00+01:00', end: '2026-11-01T00:00:00+00:00', partial: true, entryCount: 2, value: 4.5 },
    ]);
    expect(entryCalls).toEqual([
      { metricIds: ['w', 'mo'], from: new Date('2026-09-30T23:00:00Z'), to: new Date('2026-11-01T00:00:00Z') },
    ]);
    expect(logs[0].periodCount).toBe(2);
  });

  it('does not fetch entries when no metric has periods', async () => {
    const { store, entryCalls } = fakeStore([metricRow({ created_at: '2027-01-01T00:00:00Z' })]);
    const res = await request(buildApp({ store }).app).get(WINDOW).set(auth);
    expect(res.body.metrics[0].periods).toEqual([]);
    expect(entryCalls).toEqual([]);
  });

  it('returns an empty list when there are no metrics', async () => {
    const res = await request(buildApp().app).get(WINDOW).set(auth);
    expect(res.body.metrics).toEqual([]);
  });

  it('sets no-store and sends no CORS or x-powered-by headers', async () => {
    const res = await request(buildApp().app).get(WINDOW).set(auth).set('Origin', 'https://evil.example');
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

describe('errors', () => {
  it('returns 500 without leaking store errors', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const store = {
      listMetrics: async () => {
        throw new Error('connection refused to db.internal:5432');
      },
      listLogEntries: async () => [],
    };
    const res = await request(buildApp({ store }).app).get(WINDOW).set(auth);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: { code: 'internal_error', message: 'Something went wrong' } });
    expect(JSON.stringify(res.body)).not.toContain('db.internal');
  });

  it('returns 500 for every request when the server is misconfigured', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { app } = buildApp({ configResult: { ok: false, problems: ['API_KEY is not set'] } });
    const res = await request(app).get(WINDOW).set(auth);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: { code: 'server_misconfigured', message: 'The server is not configured' } });
    expect(JSON.stringify(res.body)).not.toContain('API_KEY');
  });

  it('returns 404 in the standard error shape for unknown routes', async () => {
    const res = await request(buildApp().app).get('/nope').set(auth);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'not_found', message: 'Not found' } });
  });
});

describe('logging', () => {
  it('writes one entry per request without the key or query values', async () => {
    const { app, logs } = buildApp();
    await request(app).get(WINDOW).set(auth);
    await request(app).get(WINDOW);

    expect(logs).toEqual([
      { method: 'GET', path: '/v1/metrics', status: 200, durationMs: expect.any(Number), periodCount: 0 },
      { method: 'GET', path: '/v1/metrics', status: 401, durationMs: expect.any(Number) },
    ]);
    expect(JSON.stringify(logs)).not.toContain(API_KEY);
    expect(JSON.stringify(logs)).not.toContain('2026-10-01');
  });
});
