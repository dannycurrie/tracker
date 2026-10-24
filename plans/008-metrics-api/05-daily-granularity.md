# 05: Daily granularity

**What to build:** An optional `granularity` query parameter. With `granularity=day`, each non-checklist metric returns one bucket per calendar day in `USER_TZ` that overlaps `[from, to)`, instead of one per period of its own timeframe. Buckets keep the existing shape, so a caller can count the days a habit was logged as well as its total. Checklists are scored per period by design, so they keep their own timeframe buckets at either granularity. Without the parameter, responses are unchanged.

The first caller is the `week-review` CLI in `obsidian-utils`. It needs per-day buckets to show "days logged" in the weekly review. Today the deployed API ignores `granularity=day` and returns weekly buckets, so the CLI refuses the response rather than counting a week of entries as 1/7.

**Blocked by:** 04 ✅

**Status:** ready-for-agent

- [ ] `granularity` accepts `period` (the default) or `day`. Any other value returns `400` with code `invalid_granularity` in the usual error shape.
- [ ] The response echoes the granularity it applied in a top-level `granularity` field, so callers can tell when it was honoured.
- [ ] With `day`, cumulative, timed and average metrics return one bucket per `USER_TZ` calendar day, oldest first. Each bucket runs from local midnight to the next local midnight, with `start` and `end` as offset timestamps in `USER_TZ`, plus `partial` and `entryCount`.
- [ ] DST days are whole local days: the clocks-forward Sunday is 23 hours and the clocks-back Sunday is 25 hours. Tests cover both, including entries logged in the repeated 01:00–02:00 hour and late on the 25-hour Sunday.
- [ ] Day values follow the existing rules: `cumulative` and `timed` sum their entries, or `0` with none. `average` uses the shared mean helper (1 decimal place), or `null` with none.
- [ ] Day buckets cut off by `from` or `to` are computed over the whole day and flagged `partial: true`. Days that end before the metric's `created_at` are left out, as with period buckets.
- [ ] Checklist metrics return the same buckets at either granularity: their own timeframe, with `value`, `total` and `items`.
- [ ] A property test checks that, for any whole week, the sum of the day buckets' `value` and `entryCount` equals that week's period bucket for cumulative and timed metrics.
- [ ] The existing tests pass unchanged without the parameter. The PRD and the server README document the parameter, the checklist exception and the `granularity` response field.
- [ ] Demo: for each of the last 4 complete weeks in production, the day buckets add up to the weekly bucket for every non-checklist metric, and `week-review` produces a review from the deployed API.
