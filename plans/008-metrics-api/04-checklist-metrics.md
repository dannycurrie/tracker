# 04: Checklist metrics

**What to build:** Checklist metrics return a checked count per period, along with the state of each item, matching what the app shows. An item counts as checked when there's a log entry whose ID equals the app's stable checklist item ID for (metric, item index, period start in `USER_TZ`).

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] Checklist buckets include `value` (checked count), `total` (number of items) and `items: [{ label, checked }]`, in the item order of the current checklist.
- [ ] Matching reuses the app's shared stable-ID helper rather than reimplementing it.
- [ ] Tests cover all checked, none checked, partially checked, and entries that belong to other periods or other metrics.
- [ ] A test confirms the result is wrong if the period start is computed in the wrong timezone, which guards against regressions.
- [ ] A server README documents the endpoint, the config and the three accepted limitations: offline-queued entries aren't visible, items are matched by index, and periods recorded in another timezone can mismatch.
- [ ] Demo: production checklist counts match the app for the current period.
