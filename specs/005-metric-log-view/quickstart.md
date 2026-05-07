# Quickstart & Manual Test: Metric Log View

**Branch**: `005-metric-log-view` | **Date**: 2026-05-07

## Prerequisites

- App running in local mode (Expo Go or simulator) or on a physical device
- At least one metric with log entries in the current period (seed data provides this in local mode)

---

## Scenario 1 — Navigate to log view (US1, P1)

**Goal**: Tapping a metric card opens the log view for that metric.

Steps:
1. Open the Tracker app (local mode has 3 seeded metrics with entries)
2. Tap the **Cups of coffee** card
3. **Expected**: MetricLogScreen opens showing 3 entries (values: 1, 1, 1) sorted most-recent-first. Header shows "Cups of coffee" and the current week label (e.g. "May 4 – May 10").
4. Tap the back button
5. **Expected**: Returns to the dashboard

---

## Scenario 2 — Correct entry count and ordering (US1, P1)

**Goal**: Entries are in reverse chronological order.

Steps:
1. Tap the **Reading** metric card
2. **Expected**: MetricLogScreen shows 2 entries (values: 10 min, 15 min — most recent first based on `logged_at`)
3. Tap the **Sleep quality** card
4. **Expected**: 3 entries (values: 5.0, 4.0, 3.0 — most recent first)

---

## Scenario 3 — Empty state (US1, P1)

**Goal**: A metric with no entries shows a friendly empty state.

Steps:
1. Create a new metric (tap + Add → create a cumulative weekly metric)
2. Do not add any entries
3. Tap the new metric card
4. **Expected**: MetricLogScreen opens with no list items and shows an empty-state message (e.g. "No entries this period")

---

## Scenario 4 — Delete an entry (US2, P2)

**Goal**: Deleting an entry removes it from the list and updates the dashboard total.

Steps:
1. Note the current value on the **Cups of coffee** card (should be 3)
2. Tap the **Cups of coffee** card to open the log view
3. Tap the trash/delete button on the most-recent entry
4. **Expected**: Entry is removed from the list; the list now shows 2 entries
5. Navigate back to dashboard
6. **Expected**: The **Cups of coffee** card now shows value 2

---

## Scenario 5 — Apple Health entry shows session context (US3, P3)

**Goal**: Entries with a session start time show secondary context.

Steps (requires Apple Health sync or local mode with `session_start_at` in seed data):
1. Open the **Reading** metric log view (seed data has `session_start_at` for both entries)
2. **Expected**: Each entry shows its duration value AND a secondary line like "Session started [time]"
3. Tap the trash/delete button on one Reading entry
4. **Expected**: Deleted; remaining entry still shows its session context

---

## Scenario 6 — Action buttons still work after wrapping

**Goal**: The existing increment / timer / average buttons in the metric card still function after the card is wrapped with a tap-to-navigate gesture.

Steps:
1. On the Dashboard, tap the **+ Add** button inside the **Cups of coffee** card (not the card background)
2. **Expected**: Entry count increments (card value increases by 1); no navigation occurs
3. Tap the **Start** button inside the **Reading** card
4. **Expected**: Timer starts; no navigation occurs
5. Tap the card *background area* (outside any button) on either card
6. **Expected**: MetricLogScreen opens for that metric
