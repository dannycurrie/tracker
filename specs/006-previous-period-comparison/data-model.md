# Data Model: Previous Period Comparison

**Feature**: 006-previous-period-comparison  
**Date**: 2026-05-07

## Entities

### PreviousPeriodValue (computed, not persisted)

Defined in spec.md Key Entities section. This is a derived value computed on demand from existing `log_entries` rows; it is never stored separately.

| Field | Type | Description |
|-------|------|-------------|
| metricId | string | Foreign key to `metrics.id` |
| periodStart | Date | Start of the previous complete period (inclusive) |
| periodEnd | Date | End of the previous complete period (exclusive) |
| value | number \| null | Aggregated value (sum for cumulative/timed, mean for average); null if no entries or aggregate is 0 |

**Computation rules**:
- `periodStart`/`periodEnd` derived from `getPreviousPeriodWindow(metric.timeframe)`
- For `cumulative` and `timed` metric types: `value = sum(log_entries.value)` where `logged_at ∈ [periodStart, periodEnd)`
- For `average` metric type: `value = mean(log_entries.value)` where `logged_at ∈ [periodStart, periodEnd)`
- `value = null` when: no entries exist in the window, OR computed aggregate equals 0

---

## Existing Entities (unchanged)

### Metric (existing, unchanged)

| Field | Type | Notes |
|-------|------|-------|
| id | string | UUID |
| name | string | Display name |
| type | 'cumulative' \| 'timed' \| 'average' | Drives aggregation method |
| timeframe | 'weekly' \| 'monthly' | Drives period window calculation |
| source | 'user' \| 'apple_health' | No special casing needed for this feature |
| display_order | number | Dashboard sort order |
| created_at | string | ISO timestamp |

### LogEntry (existing, read-only in this feature)

| Field | Type | Notes |
|-------|------|-------|
| id | string | UUID or dedup key (e.g. session startDate) |
| metric_id | string | FK to metrics |
| value | number | The individual logged value |
| logged_at | string | ISO timestamp — used for period window filtering |
| session_start_at | string \| null | Apple Health session context |
| created_at | string | ISO timestamp |

---

## Period Window Logic

### Current Period (existing)
```
getPeriodWindow(timeframe, now) → { start, end }
```
- weekly: Monday 00:00:00 of current week → following Monday 00:00:00
- monthly: 1st of current month 00:00:00 → 1st of next month 00:00:00

### Previous Period (new)
```
getPreviousPeriodWindow(timeframe, now) → { start, end }
```
- Derived as: `getPeriodWindow(timeframe, new Date(currentStart.getTime() - 1))`
- weekly example (current = Mon 2026-05-04): previous = Mon 2026-04-27 → Mon 2026-05-04
- monthly example (current = May 2026): previous = 2026-05-01 00:00 - 1ms = April → { start: Apr 1, end: May 1 }

---

## TanStack Query Cache Keys

| Query Key Pattern | Scope | staleTime |
|-------------------|-------|-----------|
| `['periodEntries', metricId, start, end]` | Current period entries | 10,000 ms |
| `['periodLogEntries', metricId, start, end]` | Current period log list | 10,000 ms |
| `['previousPeriodEntries', metricId, start, end]` | Previous period entries | Infinity (immutable once period closes) |

---

## State Transitions

No new state transitions. The previous period value is read-only (derived from closed period data). No mutations target previous period entries in this feature.
