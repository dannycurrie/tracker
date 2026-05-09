# Research: Checklist Metric

**Feature**: 007-checklist-metric  
**Date**: 2026-05-09

## Decision 1: Where to Store Checklist Items

**Decision**: Add a `checklist_items: string[] | null` field to the existing `Metric` entity. Non-checklist metrics store `null`.

**Rationale**: Checklist items belong to exactly one metric, are immutable after creation, and are small in count (1–10 strings). Embedding them directly on the metric avoids a separate join query and keeps the data model simple. In Supabase this maps to a JSONB column; in local mode (MMKV JSON serialization) no change is needed to the storage mechanism.

**Implementation**: 
- TypeScript: `checklist_items: string[] | null` on the `Metric` interface
- Supabase migration: `ALTER TABLE metrics ADD COLUMN checklist_items JSONB;` (nullable, defaults to NULL for existing rows)
- `fetchUserMetrics` Supabase query: add `checklist_items` to the select list
- `createMetric` service: accept optional `checklistItems?: string[]` parameter; include in insert payload when provided
- Local `localDb.createMetric`: accept and store `checklistItems` in the metric object

**Alternatives considered**:
- Separate `checklist_items` table with FK to metrics — unnecessary for 1–10 immutable strings; adds a second query for every metric load
- Store as JSON text in a `metadata` column — less type-safe and harder to query in Supabase

---

## Decision 2: Identifying Which Item a Log Entry Belongs To

**Decision**: Use a stable, deterministic log entry ID that encodes the metric ID, item index, and period start timestamp: `${metricId}-chk-${itemIndex}-${periodStart.getTime()}`.

**Rationale**: This requires zero schema changes to `log_entries`. Checking item K in a period = upsert a log entry with this stable ID (using the existing `insertLogEntry` upsert-on-conflict). Unchecking = delete that specific log entry by ID (using the existing `deleteLogEntry`). The check state of item K is determined by whether a log entry with that ID exists in the period's entries.

**`periodStart.getTime()`** is the Unix millisecond timestamp of the period's start date — deterministic, timezone-agnostic, and unique per period.

**Implementation**:
```ts
// src/utils/checklist.ts
export function stableChecklistItemId(metricId: string, itemIndex: number, periodStart: Date): string {
  return `${metricId}-chk-${itemIndex}-${periodStart.getTime()}`;
}
```

**Check operation**: `insertLogEntry({ id: stableChecklistItemId(...), metricId, value: 1 / items.length })`  
**Uncheck operation**: `deleteLogEntry(stableChecklistItemId(...), metricId)`  
**Is-checked query**: `entries.some(e => e.id === stableChecklistItemId(metricId, idx, periodStart))`

**Alternatives considered**:
- Add `checklist_item_index` column to `log_entries` — schema change, migration complexity, not backward compatible
- Use `session_start_at` to encode item index — extremely hacky; `session_start_at` is semantically a date/time
- UUID per check with a separate lookup table — unnecessary complexity for 1–10 items

---

## Decision 3: New Hook — `useChecklistState`

**Decision**: Create `src/hooks/useChecklistState.ts` that wraps `usePeriodLogEntries` and derives per-item checked state.

**Rationale**: `usePeriodLogEntries` already fetches full `LogEntry[]` (including IDs) and is cache-invalidated on any mutation via `invalidatePeriodEntries`. Wrapping it avoids duplicating the query logic and ensures check state stays in sync with the log. The hook exposes `isItemChecked(idx)`, `checkedCount`, `totalCount`, and `isLoading`.

```ts
export function useChecklistState(metric: Metric) {
  const { start } = getPeriodWindow(metric.timeframe);
  const { entries, isLoading } = usePeriodLogEntries(metric);
  const totalCount = metric.checklist_items?.length ?? 0;
  const isItemChecked = (idx: number) =>
    entries.some(e => e.id === stableChecklistItemId(metric.id, idx, start));
  const checkedCount = (metric.checklist_items ?? []).filter((_, i) => isItemChecked(i)).length;
  return { checkedCount, totalCount, isItemChecked, isLoading };
}
```

---

## Decision 4: Check/Uncheck Service

**Decision**: Create `src/services/checklistItems.ts` with `checkItem(metric, itemIndex)` and `uncheckItem(metric, itemIndex)` — thin wrappers over the existing `insertLogEntry` and `deleteLogEntry`.

**Rationale**: Keeping checklist-specific logic in a named service file makes the intent clear and avoids scattering the stable-ID computation across multiple components.

```ts
export async function checkItem(metric: Metric, itemIndex: number, periodStart: Date): Promise<void> {
  const totalItems = metric.checklist_items?.length ?? 1;
  await insertLogEntry({
    id: stableChecklistItemId(metric.id, itemIndex, periodStart),
    metricId: metric.id,
    value: 1 / totalItems,
  });
}

export async function uncheckItem(metric: Metric, itemIndex: number, periodStart: Date): Promise<void> {
  await deleteLogEntry(stableChecklistItemId(metric.id, itemIndex, periodStart), metric.id);
}
```

---

## Decision 5: MetricCard Display for Checklist Type

**Decision**: In `MetricCard`, when `metric.type === 'checklist'`, call `useChecklistState` and display `"${checkedCount}/${totalCount}"` as the primary value. No action button is shown (no + Add, no timer, no average input).

**Rationale**: The X/N format clearly communicates progress at a glance. The card remains tap-to-navigate (handled by `DashboardScreen`). The `usePeriodValue` hook is not called for checklist metrics since it would produce a sum (proportion 0–1) that isn't the intended display.

---

## Decision 6: Previous Period Comparison — Suppress for Checklist

**Decision**: In `usePreviousPeriodValue`, return `{ value: null }` immediately when `metric.type === 'checklist'`.

**Rationale**: The sum of logged values for a checklist = proportion complete (e.g., 0.75 for 3/4 items). Displayed via the existing `prevLabel` computation (`value.toFixed(0)` = "1" or "0"), this would be meaningless or misleading. Suppressing the label is cleaner than showing an incorrect comparison. A meaningful "3/4 last month" comparison is a future enhancement.

---

## Decision 7: ChecklistScreen Navigation

**Decision**: Update `DashboardScreen` `renderItem` to navigate to `'Checklist'` for checklist metrics and `'MetricLog'` for all others. The `ChecklistScreen` is a new screen added to `RootStackParamList`.

**Rationale**: The existing `MetricLogScreen` shows a chronological list of raw log entries, which is not the right UX for a checklist (items should be presented by name, not timestamp). A dedicated `ChecklistScreen` is required.

---

## Decision 8: AddMetricScreen — Checklist Item Entry UI

**Decision**: When type is `'checklist'`, show a dynamic list of text inputs (up to 10) below the type selector. Users can add/remove items with + and − buttons. Saving passes `checklistItems: string[]` to `createMetric`.

**Rationale**: The existing `AddMetricScreen` uses a simple form with a segment control for type. Adding a conditional item-entry section below the type selector is the least-invasive change. The `ScrollView` already wraps the form, so the extra UI won't break layout.

---

## No New Dependencies

All required capabilities exist:
- `insertLogEntry`, `deleteLogEntry` in `src/services/logEntries.ts`
- `usePeriodLogEntries` in `src/hooks/usePeriodLogEntries.ts`
- `getPeriodWindow` in `src/utils/periods.ts`
- TanStack Query v5, React Native built-ins, `expo-crypto`
