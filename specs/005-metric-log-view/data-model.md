# Data Model: Metric Log View

**Branch**: `005-metric-log-view` | **Date**: 2026-05-07

## Entities

### LogEntry (existing type — no change)

A single recorded data point for a metric. Already defined in `src/types/index.ts`.

| Field | Type | Notes |
|-------|------|-------|
| `id` | `string` | Stable UUID; Apple Health entries use `startDate` ISO string as ID |
| `metric_id` | `string` | FK to parent metric |
| `value` | `number` | The recorded value |
| `logged_at` | `string` | ISO 8601; time the entry was logged (session end time for Apple Health) |
| `session_start_at` | `string \| null` | ISO 8601; session start for Apple Health entries; null for manual entries |
| `created_at` | `string` | Record creation time |

**Display rule**: If `session_start_at` is non-null, the entry is Apple Health-sourced and displays a secondary "Session started [time]" line.

---

## New Service Functions

### `fetchPeriodLogEntries(metricId, periodStart, periodEnd): Promise<LogEntry[]>`

Returns full `LogEntry` objects (not projected) for the metric within the period, sorted by `logged_at` descending.

**Supabase query**:
```
.from('log_entries')
.select('*')
.eq('metric_id', metricId)
.gte('logged_at', periodStart.toISOString())
.lt('logged_at', periodEnd.toISOString())
.order('logged_at', { ascending: false })
```

**localDb equivalent**: `readEntries()` → filter by metric + period → sort descending → return full objects (no projection).

---

### `deleteLogEntry(id: string, metricId: string): Promise<void>`

Deletes a single entry by its `id`. `metricId` is used only for cache invalidation.

**Supabase query**: `.from('log_entries').delete().eq('id', id)`

**localDb equivalent**: `readEntries()` → filter out by id → `writeEntries`.

---

## Query Key Design

| Hook | Query Key | Invalidated By |
|------|-----------|---------------|
| `usePeriodValue` | `['periodEntries', metricId, start, end]` | `insertLogEntry`, `deleteLogEntry`, `deleteLogEntriesForPeriod` |
| `usePeriodLogEntries` | `['periodLogEntries', metricId, start, end]` | `insertLogEntry`, `deleteLogEntry`, `deleteLogEntriesForPeriod` |

`invalidatePeriodEntries(metricId)` in `logEntries.ts` will invalidate both prefixes: `['periodEntries', metricId]` and `['periodLogEntries', metricId]`.

---

## Screen Data Flow

```
DashboardScreen
    │ user taps MetricCard
    ▼
MetricLogScreen({ metricId })
    │
    ├─ useMetrics() → find metric by id (name, timeframe, type)
    │
    ├─ usePeriodLogEntries(metric)
    │     ├─ getPeriodWindow(metric.timeframe) → { start, end }
    │     └─ fetchPeriodLogEntries(metricId, start, end) → LogEntry[]
    │
    ▼ render
    MetricLogScreen
    ├── header: metric.name + formatPeriodLabel(metric.timeframe)
    ├── back button → navigation.goBack()
    ├── [loading] ActivityIndicator
    ├── [empty] "No entries this period" message
    └── FlatList of LogEntry rows
         └── each row:
              ├── value (formatted per metric.type)
              ├── logged_at (formatted date/time)
              ├── [if session_start_at] "Session started [time]" (secondary)
              └── trash button → deleteLogEntry(entry.id, metricId)
```

---

## Navigation Params

```ts
// src/screens/index.tsx
export type RootStackParamList = {
  Dashboard: undefined;
  AddMetric: undefined;
  Settings: undefined;
  MetricLog: { metricId: string };
};
```

---

## New Files

| File | Purpose |
|------|---------|
| `src/screens/MetricLogScreen/MetricLogScreen.tsx` | New screen — list of log entries with delete |
| `src/hooks/usePeriodLogEntries.ts` | TanStack Query hook for `fetchPeriodLogEntries` |

## Modified Files

| File | Change |
|------|--------|
| `src/services/logEntries.ts` | Add `fetchPeriodLogEntries`, `deleteLogEntry`; update `invalidatePeriodEntries` |
| `src/services/localDb.ts` | Add `fetchPeriodLogEntries`, `deleteLogEntry` methods |
| `src/screens/index.tsx` | Add `MetricLog` route |
| `src/screens/DashboardScreen/DashboardScreen.tsx` | Wrap `MetricCard` with `TouchableOpacity` for navigation |
