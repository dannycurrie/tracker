# Metrics API

A read-only HTTP API over the tracker's Supabase DB. It returns every metric with per-period values that match the app's dashboard. The full design is in [`prds/008-metrics-api.md`](../prds/008-metrics-api.md).

Production: `https://tracker-metrics-api.vercel.app`

## Endpoint

```
GET /v1/metrics?from=<ISO-8601>&to=<ISO-8601>
Authorization: Bearer <API_KEY>
```

`from` and `to` must be date-times with an offset or `Z`, with `from < to`. The window is half-open, `[from, to)`, and can span at most 2 years. A future `to` is fine.

```sh
curl -H "Authorization: Bearer $API_KEY" \
  "https://tracker-metrics-api.vercel.app/v1/metrics?from=2026-10-01T00:00:00Z&to=2026-10-24T00:00:00Z"
```

In a query string, write a `+` offset as `%2B`. An unencoded `+` decodes to a space, but the server accepts that too.

### Response

Every metric created before `to`, in `display_order`. Each metric has a `periods[]` array: every period of the metric's own timeframe that overlaps the window, oldest first.

- **Weekly** periods run Monday 00:00 to Monday 00:00 and **monthly** periods run from the 1st to the 1st, both in `USER_TZ`. `start` and `end` are given in that timezone with its offset.
- A period that the window cuts off is still computed over the **whole** period, so it matches the app, and it's flagged `partial: true`.
- Periods that ended before the metric was created are left out.
- `entryCount` is the number of log entries in the period.

| Type | `value` | Extra fields |
|---|---|---|
| `cumulative` | Sum of entries (0 if there are none) | |
| `timed` | Sum in minutes (0 if there are none); `unit: "minutes"` | |
| `average` | Mean to 1 decimal place, or `null` if there are no entries | |
| `checklist` | Number of checked items | `total`, `items: [{ label, checked }]` |

### Errors

The body is always `{ "error": { "code", "message" } }`.

| Status | Codes |
|---|---|
| 400 | `missing_parameter`, `invalid_timestamp`, `invalid_range`, `range_too_large` |
| 401 | `unauthorized` |
| 404 | `not_found` |
| 500 | `internal_error`, `server_misconfigured` |

## Known limitations

1. **Offline-queued entries aren't visible.** Entries waiting in a device's offline queue only show up once that device syncs.
2. **Checklist items are matched by index.** If a checklist's items are reordered or edited, past periods report the current labels against the old ticks.
3. **Ticks made in another timezone can show as unchecked.** The app keys each tick to the period start *as the device computed it*. A tick made while the device was in another timezone uses that zone's midnight and won't match the period computed in `USER_TZ`. Example: one tick on 5 Aug 2026 was made on Paris time, so the week of 3 Aug reports it unchecked.

## Configuration

Copy `.env.example` to `.env` for local work. In Vercel, these are set for **Production only**, so preview deployments return `server_misconfigured`.

| Var | Purpose |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SECRET_KEY` | Secret key. The DB has no RLS, and the server reads every row. |
| `API_KEY` | Bearer token for callers, at least 32 characters (`openssl rand -base64 32`) |
| `USER_TZ` | IANA timezone periods are computed in, e.g. `Europe/London` |

To rotate `API_KEY`, change it in Vercel and redeploy.

## Development

```sh
npm install
npm run dev        # http://localhost:3000, reads .env
npm test           # Vitest: periods (incl. parity with the app), aggregation, routes
npm run typecheck
```

The server imports `averageCalc`, `checklist` and the shared types from the app's `src/`, so the two stay in step. `src/periods.ts` reimplements the app's period logic in a timezone-aware way, and a test checks the two give the same results.

## Deployment

Vercel project `tracker-metrics-api`: Root Directory `server`, "Include files outside the Root Directory" on (needed for the `src/` imports), Node 24. Every push to `main` deploys to production. `vercel.json` routes every path to `api/index.ts`, and Express handles routing from there.
