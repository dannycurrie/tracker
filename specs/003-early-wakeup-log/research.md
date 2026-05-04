# Research: Early Wakeup Log

**Branch**: `003-early-wakeup-log` | **Phase**: 0

## Decision 1: Sleep Data API

**Decision**: Use `react-native-health` `getSleepSamples(options, callback)` — the same library already installed for running workout sync.

**Rationale**: Already a dependency. Returns individual Apple Health category samples (one row per sleep phase) with fields `id` (UUID), `value` (phase string), `startDate`, `endDate`, `sourceName`, `sourceId`. No new library needed.

**Type mismatch note**: The TypeScript declaration types `value` as `number`, but the native Objective-C implementation returns a string: one of `"INBED"`, `"ASLEEP"`, `"CORE"`, `"DEEP"`, `"REM"`, `"AWAKE"`, `"UNKNOWN"`. The raw callback result must be cast accordingly in implementation.

**Resolved**: `getSleepSamples` from `react-native-health` ✅

---

## Decision 2: Session Grouping Algorithm

**Decision**: Cluster individual sleep samples into logical sessions by collapsing consecutive samples with a start-to-previous-end gap of ≤ 2 hours.

**Rationale**: Apple Health represents one overnight sleep as many segments (CORE, DEEP, REM, AWAKE, etc.). There is no native "sleep session" object. To determine wake-up time and total sleep duration for a night, the samples must be reassembled into a session.

- **Asleep-type samples** (count toward duration and determine wake time): `ASLEEP`, `CORE`, `DEEP`, `REM`
- **Excluded from duration but may appear within a session**: `INBED`, `AWAKE`, `UNKNOWN`
- **Session boundaries**: If the start of sample N is more than 2 hours after the end of sample N-1, a new session begins
- **Wake time**: `max(endDate)` across all asleep-type samples in the session
- **Total sleep duration**: `sum(endDate - startDate)` across all asleep-type samples in the session

**Alternatives considered**:
- Using INBED end time as wake time: unreliable — many devices don't record INBED, and third-party apps use ASLEEP
- Using the HKAnchoredObjectQuery approach: sleep data doesn't have the same workout query structure; `getSleepSamples` with date range is the correct API
- Gap threshold of 4 hours: too wide; could merge two separate sleeps. 2 hours handles all typical AWAKE segments and measurement gaps

**Resolved**: Cluster by ≤2h gap; wake time = max asleep-type end; duration = sum asleep-type durations ✅

---

## Decision 3: Deduplication Strategy

**Decision**: Use the UUID of the sample with the latest `endDate` (the "last asleep" sample) as the log entry ID for the session.

**Rationale**: This is a real Apple Health UUID, stable across syncs as long as the user doesn't edit that specific sample. Follows the same UUID-as-ID pattern established by the running workout sync. If the user edits their sleep data (changing the last sample), the ID changes and a manual resync (Settings → Sync) corrects the record.

**Alternatives considered**:
- Composite hash of sourceName + wakeTime: fragile if end time is edited
- Session start date as ID: not a UUID; multiple sessions could start at similar times

**Resolved**: UUID of last-ending asleep sample in the session ✅

---

## Decision 4: HealthKit Permission

**Decision**: Add `SleepAnalysis` to the existing `initHealthKit` permissions call in `requestHealthPermission()`, alongside `Workout`.

**Rationale**: iOS presents all requested permissions in a single system sheet. Adding `SleepAnalysis` to the existing call means one prompt covers both features rather than two separate prompts appearing at different times.

**Alternatives considered**:
- Separate `initHealthKit` call on first sleep sync: would show a second permission dialog after the user has already dismissed the first, causing confusion

**Resolved**: Combine `SleepAnalysis` with `Workout` in a single `initHealthKit` call ✅

---

## Decision 5: Sync Checkpoint

**Decision**: MMKV key `'sleep:last_sync_at'` storing an ISO 8601 string — same pattern as `'health:last_sync_at'` for running.

**Rationale**: Keeps state management consistent. Defaults to 90 days ago on first sync.

**Resolved**: `'sleep:last_sync_at'` in the existing `createKV('health-sync')` instance ✅

---

## Decision 6: Dispatch in `resyncAppleHealthMetrics`

**Decision**: Dispatch to the correct query function by checking the metric ID inside `resyncAppleHealthMetrics()`.

**Rationale**: `resyncAppleHealthMetrics()` currently hard-calls `queryRunningWorkouts` for all apple_health metrics. With two metric types now, each needs its own data source. Dispatching by metric ID is the simplest correct approach that avoids premature abstraction.

```
RUNNING_METRIC_ID  → queryRunningWorkouts(since)
EARLY_WAKEUP_METRIC_ID → querySleepSessions(since)
```

If a metric ID is unrecognised, the function skips it (logs a warning and continues).

**Alternatives considered**:
- Adding a `kind` field to the Metric type: over-engineering for two hard-coded IDs
- Separate resync buttons per metric type: worse UX; the Settings button should handle all at once

**Resolved**: ID-based dispatch inside `resyncAppleHealthMetrics` ✅
