# Data Model: Habit Metric Tracker

**Branch**: `001-habit-metric-tracker` | **Date**: 2026-04-26

## Overview

The data model is intentionally minimal: two cloud tables (`metrics`, `log_entries`) and two local stores (offline queue, active timers). Current-period values are never persisted — they are always derived from log entries within the active period window.

---

## Cloud Tables (Supabase / PostgreSQL)

### `metrics`

Stores the definition of each trackable habit. Owned by the anonymous Supabase session.

| Column          | Type        | Constraints                                        | Notes                                   |
|-----------------|-------------|----------------------------------------------------|-----------------------------------------|
| `id`            | `UUID`      | PRIMARY KEY, default `gen_random_uuid()`           | Client may pre-generate before insert   |
| `user_id`       | `UUID`      | NOT NULL, references `auth.users(id)`              | Anonymous session user                  |
| `name`          | `TEXT`      | NOT NULL                                           | User-provided label                     |
| `type`          | `TEXT`      | NOT NULL, CHECK IN ('cumulative','timed','average')| Determines interaction and aggregation  |
| `timeframe`     | `TEXT`      | NOT NULL, CHECK IN ('weekly','monthly')            | Determines period window for reset      |
| `display_order` | `INTEGER`   | NOT NULL, DEFAULT 0                                | Dashboard ordering                      |
| `created_at`    | `TIMESTAMPTZ` | NOT NULL, DEFAULT `now()`                        | Server-side creation time               |

**Relationships**: A metric belongs to one user. A metric has many log entries.

**Validation Rules**:
- `name` must be non-empty
- `type` must be one of the three allowed values
- `timeframe` must be one of the two allowed values

---

### `log_entries`

Immutable append-only record of every increment action. The `id` is client-assigned for offline idempotency.

| Column            | Type          | Constraints                                     | Notes                                              |
|-------------------|---------------|-------------------------------------------------|----------------------------------------------------|
| `id`              | `UUID`        | PRIMARY KEY                                     | Client-assigned before queuing; enables idempotent upsert |
| `metric_id`       | `UUID`        | NOT NULL, references `metrics(id)`              |                                                    |
| `value`           | `NUMERIC`     | NOT NULL, CHECK (`value` > 0)                   | Count (cumulative=1), minutes (timed), rating 1–5 (average) |
| `logged_at`       | `TIMESTAMPTZ` | NOT NULL                                        | Client-side timestamp; used for period windowing   |
| `session_start_at`| `TIMESTAMPTZ` | NULLABLE                                        | Only populated for timed entries                   |
| `created_at`      | `TIMESTAMPTZ` | NOT NULL, DEFAULT `now()`                       | Server insertion time; not used for period logic   |

**Relationships**: A log entry belongs to one metric.

**Validation Rules**:
- `value` must be > 0
- For average-type metrics: `value` must be an integer between 1 and 5 (enforced client-side)
- `logged_at` must be <= `now()` at time of insert (enforced client-side)
- No updates or deletes permitted (append-only)

**Conflict Strategy**: `INSERT INTO log_entries ... ON CONFLICT (id) DO NOTHING` — enables safe retry of queued offline actions.

---

## Local Storage (MMKV)

### Offline Queue

Key: `offline_queue`  
Format: JSON array of pending log entry objects, ordered chronologically.

```typescript
type PendingLogEntry = {
  id: string;           // client UUID (matches log_entries.id on server)
  metric_id: string;
  value: number;
  logged_at: string;    // ISO 8601 timestamp
  session_start_at?: string; // ISO 8601, timed entries only
};
```

**Lifecycle**:
1. Entry added to array on increment action while offline (or as optimistic write before confirmation)
2. On connectivity restored: entries are uploaded sequentially using `ON CONFLICT DO NOTHING`
3. On successful server acknowledgement: entry removed from array

---

### Active Timers

Key: `active_timers`  
Format: JSON object mapping `metric_id` to a timer state object.

```typescript
type TimerState = {
  [metric_id: string]: {
    started_at: string; // ISO 8601 timestamp — absolute start time
  };
};
```

**Lifecycle**:
1. Entry created when user taps "Start" on a timed metric
2. Elapsed time is derived on each render: `elapsed = Date.now() - new Date(started_at).getTime()`
3. Entry removed when user taps "Stop"; resulting duration is inserted as a log entry

---

## Period Window Computation

Period boundaries are computed client-side from the current local date and the metric's `timeframe`.

| Timeframe  | Period Start                                 | Period End                                   |
|------------|----------------------------------------------|----------------------------------------------|
| `weekly`   | Most recent Monday at 00:00 (local timezone) | Next Monday at 00:00 (local timezone)         |
| `monthly`  | 1st of current month at 00:00 (local timezone)| 1st of next month at 00:00 (local timezone)  |

**Query pattern**: `logged_at >= period_start AND logged_at < period_end`

---

## Aggregation by Metric Type

| Type         | Aggregation Function           | Displayed As              |
|--------------|-------------------------------|---------------------------|
| `cumulative` | `SUM(value)`                  | Integer count             |
| `timed`      | `SUM(value)`                  | Total minutes             |
| `average`    | `AVG(value)` rounded to 1dp   | Decimal (e.g., 3.7) or "—" if no entries |

---

## Entity Relationship Summary

```
auth.users (Supabase built-in)
    │
    └── metrics (user_id FK)
            │
            └── log_entries (metric_id FK)

Local (MMKV, not synced to server):
    offline_queue     → mirrors pending log_entries rows
    active_timers     → ephemeral timer start timestamps
```
