# PRD: Metrics API

**Status**: Approved design. Live DB checked 2026-10-24.
**Date**: 2026-10-24
**Branch**: `008-metrics-api`

## Summary

A small, read-only HTTP server in front of the Supabase DB, with one endpoint. It returns every one of the user's metrics with aggregated values for a requested time window. The values match what the app's dashboard shows.

## Goals

- Let the user's own scripts and tools (dashboards, spreadsheets, AI agents, automations) read their tracker data.
- Return numbers that match the app exactly for every metric type, checklists included.

## Non-goals

- The app does not use this API. It keeps talking to Supabase directly.
- No writes, no multiple users, no third-party access.
- No named periods (`?period=week`). The caller passes explicit timestamps.
- No CORS or browser access.

## Users

One user: the app's owner, calling from scripts and tools.

## Endpoint

`GET /v1/metrics?from=<ISO-8601>&to=<ISO-8601>`

### Authentication

- `Authorization: Bearer <API_KEY>`. The key is compared in constant time.
- There is one key. To rotate it, change the `API_KEY` env var and redeploy.

### Parameters

| Param | Required | Rules |
|---|---|---|
| `from` | yes | ISO-8601 with an offset or `Z` |
| `to` | yes | ISO-8601 with an offset or `Z`. Must be after `from`. Can be in the future. |

- The window is half-open, `[from, to)`, the same as the app's `gte`/`lt` queries.
- The longest allowed range is **2 years**.

### Response headers

- `Cache-Control: no-store`
- No CORS headers

### Response `200`

```json
{
  "from": "2026-10-01T00:00:00Z",
  "to": "2026-10-24T00:00:00Z",
  "timezone": "Europe/London",
  "metrics": [
    {
      "id": "…",
      "name": "Reading",
      "type": "timed",
      "timeframe": "weekly",
      "source": "user",
      "unit": "minutes",
      "periods": [
        {
          "start": "2026-10-13T00:00:00+01:00",
          "end": "2026-10-20T00:00:00+01:00",
          "partial": false,
          "entryCount": 4,
          "value": 95
        }
      ]
    },
    {
      "id": "…",
      "name": "Morning routine",
      "type": "checklist",
      "timeframe": "weekly",
      "source": "user",
      "unit": null,
      "periods": [
        {
          "start": "2026-10-13T00:00:00+01:00",
          "end": "2026-10-20T00:00:00+01:00",
          "partial": false,
          "entryCount": 2,
          "value": 2,
          "total": 3,
          "items": [
            { "label": "Stretch", "checked": true },
            { "label": "Journal", "checked": true },
            { "label": "Cold shower", "checked": false }
          ]
        }
      ]
    }
  ]
}
```

### Errors

The body is always `{ "error": { "code": string, "message": string } }`. Supabase internals never reach the response.

| Status | When |
|---|---|
| 400 | A parameter is missing or malformed, `from >= to`, or the range is over 2 years |
| 401 | The `Authorization` header is missing or the key is wrong |
| 500 | Any other failure, including a missing server config |

## Aggregation rules

### Periods

- Each metric is split into periods of **its own timeframe**. Weekly periods run Monday 00:00 to Monday 00:00. Monthly periods run from the 1st to the 1st. Both are computed in `USER_TZ`.
- The response includes every period that overlaps `[from, to)`, oldest first.
- A period that the window cuts off is still computed over the **whole** period, so the value matches the app, and it carries `partial: true`.
- Period bounds are offset timestamps in `USER_TZ`.
- Periods that end before the metric's `created_at` are left out.
- A metric created after `to` doesn't appear in the response.
- Every other metric appears, in `display_order`, including metrics with no entries.

### Values

| Type | `value` | `unit` |
|---|---|---|
| `cumulative` | Sum of entry values, or `0` with no entries | `null` |
| `timed` | Sum of entry values, or `0` with no entries | `"minutes"` |
| `average` | `computeMean` (rounded to 1 decimal place), or `null` with no entries | `null` |
| `checklist` | Number of checked items. The period also carries `total` and `items[]`. | `null` |

An item counts as checked when a log entry exists whose `id` equals `stableChecklistItemId(metricId, itemIndex, periodStart)`. Here `periodStart` is the start of the period in `USER_TZ`. The match has to be exact, or every checklist comes back 0/N.

## Architecture

- **Runtime**: Express on Vercel (Node), in `server/` with its own `package.json`.
- **Shared code**: imports `src/utils/averageCalc.ts` and `src/utils/checklist.ts` from the app.
- **Periods**: a new timezone-aware `getPeriodWindow(timeframe, now, tz)` on the server. It doesn't rely on the host's TZ. A parity test checks it against the app's `src/utils/periods.ts`.
- **Data access**: the Supabase secret key. The DB is single-tenant: there's no `user_id` column and RLS is off, so the server reads every row and **the bearer API key is the only access control**. The secret key also means the server keeps working when RLS is turned on later (see `prds/009-db-lockdown.md`). It takes two queries:
  1. All metrics, ordered by `display_order`.
  2. All `log_entries` for those metric IDs, over the window widened out to whole periods. Grouping and aggregation happen in memory.
- **Logging**: one structured JSON line per request on stdout (method, path, status, duration, period count). The API key and response bodies are never logged.

### Configuration (`server/.env`, never `EXPO_PUBLIC_*`)

| Var | Purpose |
|---|---|
| `SUPABASE_URL` | Project URL |
| `SUPABASE_SECRET_KEY` | Service-role / secret key |
| `API_KEY` | Bearer token for callers |
| `USER_TZ` | IANA timezone, e.g. `Europe/London` |

### Deployment

- A Vercel project linked to `github.com/dannycurrie/tracker`.
- Root Directory is `server/`, with "Include files outside Root Directory" turned on.
- Production deploys on push to `main`.
- Secrets are set for **Production only**, so preview deployments can't serve data and return 500.

## Testing

Vitest in `server/`:

- **Periods**: weekly and monthly bounds in `USER_TZ`, DST-transition weeks, and parity with the app's `periods.ts` run under `TZ=USER_TZ`.
- **Aggregation**: every metric type, empty periods, partial flags, the `created_at` cutoff, and checklist ID matching.
- **Routes** (Supertest with an injected fake data layer): auth, each validation rule, the error shape, and the response shape.
- No tests run against the live DB.

## Known limitations (accepted)

1. The server can't see entries still waiting in a device's offline queue.
2. Checklist items are matched by **index**. If a checklist's items are reordered or edited, past periods show the current labels.
3. If a period started while the device was in a different timezone, its checklist items may show as unchecked.

## Live DB findings (2026-10-24)

- **Schema**: the columns match the app's types, including `source` (an enum, default `'user'`) and `checklist_items` (JSONB). There's no `user_id` column. `specs/001-habit-metric-tracker/contracts/schema.sql` has been updated to match.
- **Users**: `auth.users` is empty. The app never signs in, so the anonymous-auth design from spec 001 was never wired up. All data is global, single-tenant rows.
- **Access**: RLS is off. The public anon key, which ships in the app bundle, can read (and presumably write) every row. This is out of scope here and tracked in `prds/009-db-lockdown.md`. It doesn't block this API.

## Next steps

Work through the tickets in [`plans/008-metrics-api/`](../plans/008-metrics-api/README.md) in order, test-first, on branch `008-metrics-api`.
