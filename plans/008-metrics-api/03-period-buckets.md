# 03: Period buckets with sum and average values

**What to build:** Each metric returns `periods[]`: one bucket for every period of the metric's own timeframe (weekly: Monday to Monday; monthly: the 1st to the 1st) that overlaps `[from, to)`. Periods are computed in `USER_TZ`. Cumulative, timed and average metrics return values that match the app's dashboard.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] A timezone-aware period window function produces the same boundaries as the app's period logic for `USER_TZ`. A parity test runs the app's version under `TZ=USER_TZ`.
- [ ] Tests cover weeks and months that cross DST transitions.
- [ ] Buckets are listed oldest first. Each has `start` and `end` as offset timestamps in `USER_TZ`, plus `partial` and `entryCount`.
- [ ] A bucket that `from` or `to` cuts off is computed over its **whole** period and flagged `partial: true`.
- [ ] Buckets that end before the metric's `created_at` are left out.
- [ ] `cumulative` and `timed`: `value` is the sum of entries, or `0` with no entries.
- [ ] `average`: `value` comes from the app's shared mean helper (1 decimal place), or `null` with no entries.
- [ ] Log entries are fetched with a single query across all metric IDs, over the window widened out to whole periods. Grouping happens in memory.
- [ ] Demo: the current week and month values from production match the app's dashboard for every non-checklist metric.
