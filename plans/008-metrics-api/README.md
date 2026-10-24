# Plan: Metrics API

Source: [`prds/008-metrics-api.md`](../../prds/008-metrics-api.md)

Tickets are tracer-bullet vertical slices, numbered in dependency order. A ticket can start once everything in its **Blocked by** line is done.

| # | Ticket | Blocked by |
|---|---|---|
| 01 ✅ | [Verify live DB schema and resolve user ID](01-verify-live-db.md) | None. Done. |
| 02 ✅ | [Tracer bullet: authenticated `/v1/metrics` on Vercel](02-tracer-bullet-endpoint.md) | 01 ✅ |
| 03 ✅ | [Period buckets with sum and average values](03-period-buckets.md) | 02 ✅ |
| 04 ✅ | [Checklist metrics](04-checklist-metrics.md) | 03 ✅ |
| 05 | [Daily granularity](05-daily-granularity.md) | 04 ✅ |
