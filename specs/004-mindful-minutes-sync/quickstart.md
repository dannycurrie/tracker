# Quickstart & Manual Test: Mindful Minutes Sync

**Branch**: `004-mindful-minutes-sync` | **Date**: 2026-05-05

## Prerequisites

- Physical iOS device (Simulator does not support HealthKit)
- Xcode installed; run `npm run xcode` to build and install
- Health app accessible on the device
- At least one Apple Health-compatible mindfulness app (Headspace, Calm, Apple Breathe, etc.) or manual entry in Health app

---

## Test Data Setup

### Adding a mindful session manually (Health app)

1. Open the **Health** app
2. Tap **Browse** → **Mindfulness** → **Mindful Minutes**
3. Tap **Add Data**
4. Set a start time and a duration (e.g., 10 minutes from 8:00 AM to 8:10 AM)
5. Tap **Add**

Repeat to add multiple sessions if testing scenario 2 (multiple sessions).

### Adding via Apple Breathe / Mindfulness app

1. Open the **Mindfulness** app on iPhone/Apple Watch
2. Complete a session (or use Reflect/Breathe)
3. Confirm it appears in Health → Mindful Minutes

---

## Scenario 1 — Auto-sync: Single session logs correctly (US1, P1)

**Goal**: One session → one log entry with the correct minute value.

Steps:
1. Add a 10-minute mindful session (e.g., 8:00–8:10 AM today)
2. Build and open the Tracker app
3. Navigate to the Mindful Minutes metric
4. **Expected**: One log entry appears with value `10`

---

## Scenario 2 — Auto-sync: Multiple sessions since last sync (US1, P1)

**Goal**: Three sessions → three separate log entries.

Steps:
1. Add three sessions: 5 min, 12 min, 20 min (different times today)
2. Open the Tracker app (or background + foreground it if already open)
3. Navigate to the Mindful Minutes metric
4. **Expected**: Three log entries: values `5`, `12`, `20`

---

## Scenario 3 — No duplicates on re-foreground (US1, P1)

**Goal**: The same session is not logged twice.

Steps:
1. Add one session and confirm it logs (Scenario 1)
2. Background and foreground the app again
3. **Expected**: Still only one log entry for that session — no duplicate

---

## Scenario 4 — Short session ignored (FR-005)

**Goal**: Sessions under 1 minute are not logged.

Steps:
1. Add a mindful session of 30 seconds (manually set start/end within 1 minute)
2. Open the Tracker app
3. **Expected**: No log entry is created for that session

---

## Scenario 5 — Manual resync (US2, P2)

**Goal**: Settings resync clears and rebuilds entries accurately.

Steps:
1. Add two sessions and confirm both log
2. Delete one session from Health → Mindful Minutes → tap the session → swipe left or edit → Delete
3. Go to Settings → "Sync Apple Health Metrics"
4. Navigate back to Mindful Minutes metric
5. **Expected**: Only one log entry remains (matching the surviving session)

---

## Scenario 6 — Permission denied (US3, P3)

**Goal**: No error if HealthKit access is denied.

Steps:
1. Go to iOS Settings → Privacy & Security → Health → Tracker app
2. Toggle off Mindful Minutes (or revoke all)
3. Open Tracker app
4. **Expected**: App opens normally, no error dialog, other metrics unaffected

---

## Checkpoint verification

After Scenario 1–2, confirm the MMKV checkpoint advances:

- The `'mindful:last_sync_at'` key in `createKV('health-sync')` should be set to the `endDate` of the most recent session processed.
- On next foreground, only sessions after that time are queried.

(This can be verified by adding a `logger.info` call or inspecting MMKV state in a debug build.)
