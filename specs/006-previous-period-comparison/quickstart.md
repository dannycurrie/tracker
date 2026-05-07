# Quickstart: Previous Period Comparison

**Feature**: 006-previous-period-comparison  
**Date**: 2026-05-07

## Integration Scenarios

### Scenario 1 — Monthly Cumulative with Previous Period Data

**Setup**: A "Running Distance" metric (type: cumulative, timeframe: monthly) has entries in the previous calendar month. The current month also has entries.

**Steps**:
1. Open the app in local mode
2. Navigate to the Dashboard

**Expected**: The Running Distance metric card shows:
- Large primary value: current month's total (e.g. "23")
- Small subordinate label below: "50 last month" (or the actual previous month sum from seed data)

---

### Scenario 2 — Weekly Cumulative with No Previous Period Data

**Setup**: A metric exists but has no log entries in the previous Mon–Sun week.

**Steps**:
1. Open Dashboard in local mode
2. Observe the metric card for a metric with no previous week data

**Expected**: No comparison label is shown. The card looks identical to the pre-feature state — value + action button only.

---

### Scenario 3 — Average Metric with Previous Period Data

**Setup**: A "Sleep Quality" metric (type: average, timeframe: monthly) has entries in the previous month.

**Steps**:
1. Open Dashboard in local mode

**Expected**: The Sleep Quality card shows a subordinate label such as "Avg 7.2 last month" below the current value.

---

### Scenario 4 — Weekly Metric with Last Week Data

**Setup**: A weekly cumulative metric (e.g. "Cups of Coffee") has entries from the previous Mon–Sun week.

**Steps**:
1. Open Dashboard in local mode

**Expected**: Card shows "12 last week" (or whatever the previous week's total is) below the current value.

---

### Scenario 5 — Zero Aggregate Suppressed

**Setup**: A metric has exactly one log entry in the previous period with value 0.

**Steps**:
1. Open Dashboard in local mode

**Expected**: No comparison label shown. A zero aggregate is treated as no data (FR-007).

---

## Local Mode Seed Data Coverage

The existing `localDb.ts` seed data must be verified to have at least one metric with entries in the previous period window. If all seed entries fall within the current period, add seed entries with `logged_at` timestamps set to last month (or last week for weekly metrics) to enable manual verification of Scenarios 1, 3, and 4 without needing to wait for real time to pass.

**Seed entry dates to add** (if missing):
- For any monthly metric: one or more entries with `logged_at` in the calendar month before the current test date
- For any weekly metric: one or more entries with `logged_at` in the Mon–Sun week before the current test week

---

## Verification Steps (Manual — Local Mode)

1. `npm start` → open iOS simulator
2. Dashboard loads → check each metric card that has previous-period seed data shows a subordinate label
3. Confirm label includes "last week" or "last month" matching each metric's timeframe
4. Confirm label is visually smaller/greyer than the primary value
5. Confirm metrics with no previous-period data show no label
6. Tap a metric card → MetricLogScreen opens (existing feature) — confirm navigation still works
7. Tap `+ Add` on a cumulative card — confirm action still fires (no regression from label addition)
