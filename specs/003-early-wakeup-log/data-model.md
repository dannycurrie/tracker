# Data Model: Early Wakeup Log

**Branch**: `003-early-wakeup-log` | **Phase**: 1

## Entities

### RawSleepSample *(transient — sourced from Apple Health)*

Individual category sample returned by `getSleepSamples`. Apple Health stores one row per sleep phase segment.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Apple Health UUID for this specific sample |
| `value` | `string` | Phase: `"ASLEEP"` `"CORE"` `"DEEP"` `"REM"` `"INBED"` `"AWAKE"` `"UNKNOWN"` |
| `startDate` | `string` | ISO 8601 start of this phase |
| `endDate` | `string` | ISO 8601 end of this phase |
| `sourceName` | `string` | App or device that recorded this sample |
| `sourceId` | `string` | Bundle ID of the recording source |

**Note**: The TypeScript type declares `value` as `number` but the native code returns a string. Implementation must cast accordingly.

**Asleep-type values** (count toward session duration and determine wake time): `ASLEEP`, `CORE`, `DEEP`, `REM`

---

### SleepSession *(transient — derived from grouped RawSleepSamples)*

A logical overnight sleep period assembled from one or more `RawSleepSample` records.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | UUID of the last-ending asleep-type sample in this session (deduplication key) |
| `wakeTime` | `Date` | `max(endDate)` across all asleep-type samples in the session |
| `durationMinutes` | `number` | `sum(endDate - startDate)` in minutes across all asleep-type samples |

**Grouping rule**: Consecutive samples (sorted ascending by startDate) belong to the same session if `sample[N].startDate - sample[N-1].endDate ≤ 2 hours`.

**Qualifying session** (eligible for log entry):
- `durationMinutes ≥ 240` (4 hours)
- `wakeTime` local hour `< 10` (before 10am)
- `wakeTime` local hour `< 7` (before 7am) → triggers log entry

---

### SyncCheckpoint *(persisted in MMKV — same storage as running sync)*

| MMKV Key | Value Type | Description |
|----------|-----------|-------------|
| `'sleep:last_sync_at'` | `string \| null` | ISO 8601 timestamp of the `endDate` of the most recently processed asleep-type sample. `null` on first sync — defaults to 90-day lookback. |

**State transitions**:
```
null (first launch)
  → populated after first successful sync
  → updated to wakeTime of last qualifying session after each sync
```

---

### EarlyWakeupEntry *(existing LogEntry — extended usage)*

Reuses the existing `LogEntry` / `PendingLogEntry` types without modification.

| Field | Value |
|-------|-------|
| `id` | UUID of the last asleep-type sample in the session |
| `metric_id` | `'1b0558fb-9594-41db-bb2e-bb0f0621b8fc'` |
| `value` | `1` (one qualifying wakeup event) |
| `logged_at` | `wakeTime` (the session's wake-up timestamp) |
| `session_start_at` | Start of first asleep-type sample in the session |

---

## Data Flow

```
Apple Health
    │
    │  getSleepSamples(startDate=lastSyncAt, endDate=now, ascending=true)
    ▼
RawSleepSample[]  (all phases in date range)
    │
    │  filter: value IN ['ASLEEP', 'CORE', 'DEEP', 'REM']
    │  sort by startDate ASC
    │  group into sessions (gap ≤ 2h between consecutive samples)
    ▼
SleepSession[]
    │
    │  filter: durationMinutes ≥ 240 AND wakeTime.hour < 10
    │  (qualifying overnight sessions only)
    ▼
for each qualifying session where wakeTime.hour < 7:
    insertLogEntry({
        id: session.id,              ← last asleep sample UUID (dedup key)
        metricId: EARLY_WAKEUP_METRIC_ID,
        value: 1,
        loggedAt: session.wakeTime,
        sessionStartAt: session.startDate
    })
    │
    ├─ online  → upsert to Supabase (ignoreDuplicates)
    └─ offline → enqueue to MMKV offline queue
    │
    ▼
update MMKV 'sleep:last_sync_at' to wakeTime of last processed qualifying session
```

---

## Permissions

| Permission | Type | Purpose |
|-----------|------|---------|
| `Workout` | Read | Running sync (existing) |
| `SleepAnalysis` | Read | Sleep session sync (new) |

Both are requested together in a single `initHealthKit` call.
