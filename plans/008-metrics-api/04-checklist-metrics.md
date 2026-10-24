# 04: Checklist metrics

**What to build:** Checklist metrics return a checked count per period, along with the state of each item, matching what the app shows. An item counts as checked when there's a log entry whose ID equals the app's stable checklist item ID for (metric, item index, period start in `USER_TZ`).

**Blocked by:** 03

**Status:** done (2026-10-24)

- [x] Checklist buckets include `value` (checked count), `total` (number of items) and `items: [{ label, checked }]`, in the item order of the current checklist.
- [x] Matching reuses the app's shared stable-ID helper rather than reimplementing it.
- [x] Tests cover all checked, none checked, partially checked, and entries that belong to other periods or other metrics.
- [x] A test confirms the result is wrong if the period start is computed in the wrong timezone, which guards against regressions.
- [x] A server README documents the endpoint, the config and the three accepted limitations: offline-queued entries aren't visible, items are matched by index, and periods recorded in another timezone can mismatch.
- [x] Demo: production checklist counts match the app for the current period.

**Verification:** for Gym routine (7 items, 25 weeks, 66 ticks), the API agrees with the app's own period and stable-ID logic on raw entries in every week. One of the 67 entries matches no item: a tick on 5 Aug 2026 that was keyed to a Europe/Paris period start. That's limitation 3, and the README uses it as the example.
