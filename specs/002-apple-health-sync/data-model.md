# Data Model: Apple Health Running Sync

**Branch**: `002-apple-health-sync` | **Phase**: 1

## Entities

### HealthWorkout *(transient — sourced from Apple Health, never persisted directly)*

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | HKWorkout UUID. Used as the log entry `id` for deduplication |
| `distanceKm` | `number` | Workout distance in kilometres (requested in `km` from HealthKit) |
| `startDate` | `Date` | Workout start timestamp |
| `endDate` | `Date` | Workout end timestamp. Used to advance the sync checkpoint |

**Validation rules**:
- `distanceKm` must be ≥ 0.001 — workouts below this threshold are silently ignored (FR-009, edge case: zero-distance workouts)
- `id` must be a non-empty string

---

### SyncCheckpoint *(persisted in MMKV)*

| MMKV Key | Value Type | Description |
|----------|-----------|-------------|
| `'health:last_sync_at'` | `string \| null` | ISO 8601 timestamp of the `endDate` of the last successfully processed workout. `null` on first sync — system falls back to 90-day lookback. |
| `'health:running_metric_id'` | `string \| null` | Cached `id` of the running distance metric. Avoids a fetch on every foreground event. `null` until first sync resolves the metric. |

**State transitions**:
```
null (first launch)
  → populated after first successful sync
  → updated to latest workout endDate after each subsequent sync
```

---

### LogEntry *(existing entity — extended usage)*

The existing `LogEntry` / `PendingLogEntry` types are reused without modification. Health-sourced entries are inserted via the existing `insertLogEntry` service:

| Field | Value for Health entries |
|-------|--------------------------|
| `id` | HKWorkout UUID (provides free deduplication via upsert) |
| `metric_id` | ID of the Running Distance metric |
| `value` | `distanceKm` (rounded to 3 decimal places) |
| `logged_at` | Workout `endDate` ISO string |
| `session_start_at` | Workout `startDate` ISO string |

---

### RunningDistanceMetric *(existing Metric entity — auto-bootstrapped)*

Created via `createMetric` if no metric named `'Running Distance'` exists. No new fields.

| Field | Bootstrapped Value |
|-------|--------------------|
| `name` | `'Running Distance'` |
| `type` | `'cumulative'` |
| `timeframe` | `'weekly'` |

---

## Data Flow

```
Apple Health
    │
    │  getWorkouts(type=Running, startDate=lastSyncAt, unit=km)
    ▼
HealthWorkout[]  (transient)
    │
    │  filter(distanceKm >= 0.001)
    │  sort by endDate ASC
    ▼
for each workout:
    insertLogEntry({
        id: workout.id,          ← HKWorkout UUID (deduplication key)
        metricId: runningMetricId,
        value: workout.distanceKm,
        loggedAt: workout.endDate,
        sessionStartAt: workout.startDate
    })
    │
    ├─ online  → upsert to Supabase (ignoreDuplicates)
    └─ offline → enqueue to MMKV offline queue
    │
    ▼
update MMKV 'health:last_sync_at' to endDate of last workout
```
