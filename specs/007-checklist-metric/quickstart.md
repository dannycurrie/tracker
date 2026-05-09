# Quickstart: Checklist Metric

**Feature**: 007-checklist-metric  
**Date**: 2026-05-09

## Integration Scenarios

### Scenario 1 — Dashboard Shows X/N for Checklist Metric

**Setup**: Local mode seed data includes a checklist metric (e.g., "Morning Routine") with 4 items, 2 of which are checked in the current period.

**Steps**:
1. Open the app in local mode
2. Navigate to the Dashboard

**Expected**: The "Morning Routine" metric card shows "2/4" as the primary value. No "+ Add" button, timer, or average input is shown on the card.

---

### Scenario 2 — Tap Card Opens Checklist Screen

**Setup**: Same seed metric as Scenario 1.

**Steps**:
1. Open Dashboard in local mode
2. Tap the "Morning Routine" metric card

**Expected**: The ChecklistScreen opens showing all 4 items by name. Items 0 and 1 (the checked ones) display a checked indicator. Items 2 and 3 display as unchecked.

---

### Scenario 3 — Check an Item Updates X/N

**Steps**:
1. Open ChecklistScreen for a checklist metric with 1 of 4 items checked ("1/4" on dashboard)
2. Tap an unchecked item

**Expected**: The item immediately shows as checked. The dashboard card (visible after navigating back) shows "2/4".

---

### Scenario 4 — Uncheck an Item

**Steps**:
1. Open ChecklistScreen with 2 of 4 items checked
2. Tap a checked item

**Expected**: The item immediately shows as unchecked. The dashboard card shows "1/4".

---

### Scenario 5 — Check State Persists Across App Sessions

**Steps**:
1. Check 2 items in the checklist
2. Close the app completely and reopen

**Expected**: The 2 checked items are still shown as checked. The dashboard shows "2/N".

---

### Scenario 6 — No Previous Period Label on Checklist Card

**Setup**: Previous period has checked entries for a checklist metric.

**Steps**:
1. Open Dashboard in local mode (with previous-period seed entries for the checklist metric)

**Expected**: No previous period comparison label (e.g., no "0.5 last week") appears below the X/N value on the checklist card. The label is suppressed for checklist metrics.

---

### Scenario 7 — Create Checklist Metric via Add Metric Screen

**Steps**:
1. Tap "+ Add" in the dashboard header
2. Enter name "Evening Wind-Down"
3. Select type "Checklist"
4. Add 3 items: "Read", "Meditate", "Journaling"
5. Select timeframe "Daily" (or weekly as applicable)
6. Tap Save

**Expected**: A new "Evening Wind-Down" card appears on the dashboard showing "0/3". Tapping opens a checklist screen with all 3 items unchecked.

---

### Scenario 8 — Add Metric Validation

**Steps (a)**: Open Add Metric → select Checklist → tap Save without adding any items  
**Expected**: Save is blocked; an error message indicates at least 1 item is required

**Steps (b)**: Open Add Metric → select Checklist → add 1 item but leave its text blank → tap Save  
**Expected**: Save is blocked; the blank item field is highlighted

**Steps (c)**: Open Add Metric → select Checklist → add 10 items → attempt to add an 11th  
**Expected**: The "add item" button/control is disabled; the input for an 11th item cannot be created

---

## Local Mode Seed Data Requirements

To enable verification of Scenarios 1–6 without running the Add Metric flow first, add a checklist seed metric to `localDb.ts`:

**Seed metric**:
```ts
{ id: 'mock-4', name: 'Morning Routine', type: 'checklist', timeframe: 'weekly',
  source: 'user', display_order: 3, created_at: hoursAgo(72),
  checklist_items: ['Workout', 'Vitamins', 'Cold shower', 'Meditation'] }
```

**Seed log entries** (2 items checked in current period):
```ts
// item 0 (Workout) and item 1 (Vitamins) are checked
{ id: stableId('mock-4', 0, currentPeriodStart), metric_id: 'mock-4', value: 0.25, logged_at: hoursAgo(2), ... }
{ id: stableId('mock-4', 1, currentPeriodStart), metric_id: 'mock-4', value: 0.25, logged_at: hoursAgo(1), ... }
```

Because `stableChecklistItemId` uses `periodStart.getTime()`, seed entries must compute the period start at seed time using `getPeriodWindow('weekly')`. Seed data is seeded once (SEEDED_KEY check); a reinstall/storage clear is needed to pick up updated seed entries on existing devices.

---

## Regression Checks

After this feature is implemented:
- Confirm cumulative (Cups of coffee), timed (Reading), and average (Sleep quality) cards still render correctly
- Confirm tapping non-checklist metric cards still navigates to `MetricLogScreen`
- Confirm `+ Add`, timer start, and average input buttons still work inside non-checklist cards
- Confirm previous period labels still appear on non-checklist cards (cumulative/timed/average)
