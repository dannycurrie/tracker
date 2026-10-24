# 05: Daily granularity

**What to build:** An optional `granularity` query parameter. With `granularity=day`, each non-checklist metric returns one bucket per calendar day in `USER_TZ` that overlaps `[from, to)`, instead of one per period of its own timeframe. Buckets keep the existing shape, so a caller can count the days a habit was logged as well as its total. Checklists are scored per period by design, so they keep their own timeframe buckets at either granularity. Without the parameter, responses are unchanged.

The first caller is the `week-review` CLI in `obsidian-utils`. It needs per-day buckets to show "days logged" in the weekly review. Today the deployed API ignores `granularity=day` and returns weekly buckets, so the CLI refuses the response rather than counting a week of entries as 1/7.

**Blocked by:** 04 ✅

**Status:** done (2026-10-24)

- [x] `granularity` accepts `period` (the default) or `day`. Any other value returns `400` with code `invalid_granularity` in the usual error shape.
- [x] The response echoes the granularity it applied in a top-level `granularity` field, so callers can tell when it was honoured.
- [x] With `day`, cumulative, timed and average metrics return one bucket per `USER_TZ` calendar day, oldest first. Each bucket runs from local midnight to the next local midnight, with `start` and `end` as offset timestamps in `USER_TZ`, plus `partial` and `entryCount`.
- [x] DST days are whole local days: the clocks-forward Sunday is 23 hours and the clocks-back Sunday is 25 hours. Tests cover both, including entries logged in the repeated 01:00–02:00 hour and late on the 25-hour Sunday.
- [x] Day values follow the existing rules: `cumulative` and `timed` sum their entries, or `0` with none. `average` uses the shared mean helper (1 decimal place), or `null` with none.
- [x] Day buckets cut off by `from` or `to` are computed over the whole day and flagged `partial: true`. Days that end before the metric's `created_at` are left out, as with period buckets.
- [x] Checklist metrics return the same buckets at either granularity: their own timeframe, with `value`, `total` and `items`.
- [x] A property test checks that, for any whole week, the sum of the day buckets' `value` and `entryCount` equals that week's period bucket for cumulative and timed metrics.
- [x] The existing tests pass unchanged without the parameter. The PRD and the server README document the parameter, the checklist exception and the `granularity` response field.
- [x] Demo: for each of the last 4 complete weeks in production, the day buckets add up to the weekly bucket for every non-checklist metric, and `week-review` produces a review from the deployed API.

**Notes:**
- One existing assertion had to change. The route test that checks the whole response body with `toEqual` now includes `granularity: 'period'`, because criterion 2 adds that top-level field. Every other existing test passes unchanged.
- **Verification:** in production, for the weeks of 21 Sep, 28 Sep, 5 Oct and 12 Oct 2026, the 7 day buckets add up exactly (value and `entryCount`) to the weekly bucket for every weekly metric. Monthly metrics have no weekly bucket, so their day buckets were compared with a raw `log_entries` sum for the week, and those match too. Checklist buckets are identical at both granularities.
- `week-review` ran against the deployed API using a scratch vault and produced the 2026-W42 review (for example, Meditation minutes 4/7 days, 40, +27).
