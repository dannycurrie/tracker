# Data Model: Checklist Metric

**Feature**: 007-checklist-metric  
**Date**: 2026-05-09

## Modified Entities

### Metric (modified)

Adds `checklist_items` field to the existing entity.

| Field | Type | Notes |
|-------|------|-------|
| id | string | UUID — unchanged |
| name | string | Display name — unchanged |
| type | 'cumulative' \| 'timed' \| 'average' \| **'checklist'** | **New value added** |
| timeframe | 'weekly' \| 'monthly' | Period window — unchanged |
| source | 'user' \| 'apple_health' | Checklist metrics always 'user' — unchanged |
| display_order | number | Dashboard sort order — unchanged |
| created_at | string | ISO timestamp — unchanged |
| **checklist_items** | **string[] \| null** | **NEW** — ordered item names; null for non-checklist metrics; 1–10 elements |

**Validation rules**:
- `type === 'checklist'` ⟹ `checklist_items` is a non-empty array (1–10 strings, all non-empty)
- `type !== 'checklist'` ⟹ `checklist_items` is null
- Item names: non-empty strings; duplicates allowed; max length per item: reasonable display limit (e.g. 100 chars)

**Supabase migration**:
```sql
ALTER TABLE metrics ADD COLUMN checklist_items JSONB;
```
Existing rows get NULL (correct for non-checklist types). No default needed.

**Supabase select update** (in `fetchUserMetrics`):
```ts
.select('id, name, type, timeframe, source, display_order, created_at, checklist_items')
```

---

## Unchanged Entities

### LogEntry (unchanged schema, new usage pattern)

| Field | Type | Notes |
|-------|------|-------|
| id | string | For checklist checks: `${metricId}-chk-${itemIndex}-${periodStart.getTime()}` |
| metric_id | string | FK to metrics — unchanged |
| value | number | For checklist: `1 / totalItems` (proportional value per checked item) |
| logged_at | string | ISO timestamp of check action — unchanged |
| session_start_at | string \| null | Always null for checklist entries — unchanged |
| created_at | string | ISO timestamp — unchanged |

**New usage pattern**: For checklist metrics, each `LogEntry` represents one checked item in one period. The stable ID encodes which item it is. The sum of all entries = proportion complete (0.0–1.0). No schema changes needed.

---

## New Entities (Derived / Computed)

### ChecklistItemState (computed, not persisted)

Derived from `LogEntry[]` for the current period.

| Field | Type | Description |
|-------|------|-------------|
| itemIndex | number | Position in `metric.checklist_items` array (0-based) |
| label | string | `metric.checklist_items[itemIndex]` |
| isChecked | boolean | True if a log entry with the stable ID for this item exists in the current period |

**Derivation**:
```
stableId(metricId, itemIndex, periodStart) = `${metricId}-chk-${itemIndex}-${periodStart.getTime()}`
isChecked(idx) = entries.some(e => e.id === stableId(metricId, idx, periodStart))
```

---

## New Utility

### `stableChecklistItemId` (in `src/utils/checklist.ts`)

```ts
stableChecklistItemId(metricId: string, itemIndex: number, periodStart: Date): string
→ `${metricId}-chk-${itemIndex}-${periodStart.getTime()}`
```

Properties:
- Deterministic for (metric, item, period) tuple
- `periodStart.getTime()` is Unix ms — timezone-agnostic
- Unique across periods (different `getTime()` values)
- Readable in logs (contains metricId and item index)

---

## TanStack Query Cache Keys

| Query Key Pattern | Scope | staleTime | Notes |
|-------------------|-------|-----------|-------|
| `['metrics']` | All user metrics | N/A (default) | Invalidated after createMetric |
| `['periodEntries', metricId, start, end]` | Current period value entries | 10,000 ms | Used by usePeriodValue (not checklist) |
| `['periodLogEntries', metricId, start, end]` | Current period full log entries | 10,000 ms | **Used by useChecklistState** via usePeriodLogEntries |
| `['previousPeriodEntries', metricId, start, end]` | Previous period entries | Infinity | Suppressed for checklist (returns null) |

---

## State Transitions

### Check Item
```
User taps unchecked item
  → checkItem(metric, itemIndex, periodStart)
  → insertLogEntry({ id: stableId(...), value: 1/N })
  → invalidatePeriodEntries(metricId)         ← invalidates ['periodLogEntries', ...]
  → useChecklistState re-derives: isItemChecked(idx) = true, checkedCount++
  → MetricCard displays X+1/N
```

### Uncheck Item
```
User taps checked item
  → uncheckItem(metric, itemIndex, periodStart)
  → deleteLogEntry(stableId(...), metricId)
  → invalidatePeriodEntries(metricId)
  → useChecklistState re-derives: isItemChecked(idx) = false, checkedCount--
  → MetricCard displays X-1/N
```

### Period Reset
```
New period begins
  → getPeriodWindow returns new { start, end }
  → All query keys change (include start/end in key)
  → No existing entries match new period window
  → All items show as unchecked (checkedCount = 0)
  → No explicit reset action needed
```

### Create Checklist Metric
```
User saves in AddMetricScreen (type=checklist, items=['item1', 'item2', ...])
  → createMetric(name, 'checklist', timeframe, 'user', checklistItems)
  → Supabase: INSERT INTO metrics(..., checklist_items) VALUES (..., '["item1","item2"]'::jsonb)
  → Local: localDb.createMetric(...) stores full Metric with checklist_items
  → invalidateQueries(['metrics'])
  → Dashboard shows new card with "0/N"
```
