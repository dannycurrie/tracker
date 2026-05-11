# Implementation Plan: Checklist Metric

**Branch**: `007-checklist-metric` | **Date**: 2026-05-09 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `specs/007-checklist-metric/spec.md`

## Summary

Add a new "checklist" metric type. Each checklist metric carries 1–10 named items stored directly on the metric entity (`checklist_items: string[] | null`). Checking an item in the current period upserts a log entry with a deterministic, stable ID (`${metricId}-chk-${itemIndex}-${periodStart.getTime()}`) and a proportional value (`1/N`). Unchecking deletes that log entry. No schema changes to `log_entries` are required. The dashboard card shows "X/N" for checklist metrics; tapping opens a new `ChecklistScreen`. The `AddMetricScreen` is extended to allow defining items when Checklist is selected.

## Technical Context

**Language/Version**: TypeScript (React Native 0.74.5, Expo SDK 51)  
**Primary Dependencies**: TanStack Query v5, React Native built-ins, existing `insertLogEntry` / `deleteLogEntry` services  
**Storage**: Supabase `metrics` table (new `checklist_items JSONB` column); MMKV-backed `localDb` (automatic — JSON serialized)  
**Testing**: Manual (no automated tests requested)  
**Target Platform**: iOS (Expo bare workflow)  
**Project Type**: Mobile app  
**Performance Goals**: X/N count updates within 1 second of check/uncheck (SC-001)  
**Constraints**: No new npm dependencies; `log_entries` schema unchanged; `checklist_items` column must be added to Supabase before Supabase mode works  
**Scale/Scope**: 1 new utility, 1 new hook, 1 new service file, 1 new screen, modifications to 6 existing files

## Constitution Check

Constitution is an unpopulated template — no project-specific gates apply. No new npm dependencies. Changes are additive and backward-compatible (non-checklist metrics unaffected by the new column — it's nullable).

## Project Structure

### Documentation (this feature)

```text
specs/007-checklist-metric/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
└── tasks.md             ← Phase 2 output (/speckit-tasks)
```

### Source Code (files touched by this feature)

```text
src/
├── types/
│   └── index.ts                                    ← ADD 'checklist' to MetricType; ADD checklist_items field
├── utils/
│   └── checklist.ts                                ← NEW: stableChecklistItemId()
├── hooks/
│   ├── useChecklistState.ts                        ← NEW: useChecklistState(metric)
│   └── usePreviousPeriodValue.ts                   ← ADD early return for checklist type
├── services/
│   ├── metrics.ts                                  ← UPDATE fetchUserMetrics select; UPDATE createMetric signature
│   ├── localDb.ts                                  ← UPDATE createMetric; ADD seed checklist metric + entries
│   └── checklistItems.ts                           ← NEW: checkItem(), uncheckItem()
├── components/
│   └── MetricCard/
│       └── MetricCard.tsx                          ← ADD checklist display branch
└── screens/
    ├── index.tsx                                   ← ADD Checklist route to RootStackParamList
    ├── DashboardScreen/
    │   └── DashboardScreen.tsx                     ← UPDATE renderItem navigation
    ├── AddMetricScreen/
    │   └── AddMetricScreen.tsx                     ← ADD Checklist type + item-entry UI
    └── ChecklistScreen/
        └── ChecklistScreen.tsx                     ← NEW: checklist interaction screen
```

## Implementation Details

### 1. `src/types/index.ts`

```ts
export type MetricType = 'cumulative' | 'timed' | 'average' | 'checklist';

export interface Metric {
  // ...existing fields unchanged...
  checklist_items: string[] | null;  // ADD — null for non-checklist types
}
```

### 2. `src/utils/checklist.ts` (NEW)

```ts
export function stableChecklistItemId(
  metricId: string,
  itemIndex: number,
  periodStart: Date
): string {
  return `${metricId}-chk-${itemIndex}-${periodStart.getTime()}`;
}
```

### 3. `src/hooks/useChecklistState.ts` (NEW)

```ts
import { usePeriodLogEntries } from './usePeriodLogEntries';
import { getPeriodWindow } from '../utils/periods';
import { stableChecklistItemId } from '../utils/checklist';
import { Metric } from '../types';

export function useChecklistState(metric: Metric) {
  const { start } = getPeriodWindow(metric.timeframe);
  const { entries, isLoading } = usePeriodLogEntries(metric);
  const items = metric.checklist_items ?? [];
  const totalCount = items.length;
  const isItemChecked = (idx: number): boolean =>
    entries.some(e => e.id === stableChecklistItemId(metric.id, idx, start));
  const checkedCount = items.filter((_, i) => isItemChecked(i)).length;
  return { checkedCount, totalCount, isItemChecked, isLoading };
}
```

### 4. `src/services/checklistItems.ts` (NEW)

```ts
import { Metric } from '../types';
import { insertLogEntry, deleteLogEntry } from './logEntries';
import { getPeriodWindow } from '../utils/periods';
import { stableChecklistItemId } from '../utils/checklist';

export async function checkItem(metric: Metric, itemIndex: number): Promise<void> {
  const { start } = getPeriodWindow(metric.timeframe);
  const totalItems = metric.checklist_items?.length ?? 1;
  await insertLogEntry({
    id: stableChecklistItemId(metric.id, itemIndex, start),
    metricId: metric.id,
    value: 1 / totalItems,
  });
}

export async function uncheckItem(metric: Metric, itemIndex: number): Promise<void> {
  const { start } = getPeriodWindow(metric.timeframe);
  await deleteLogEntry(stableChecklistItemId(metric.id, itemIndex, start), metric.id);
}
```

### 5. `src/services/metrics.ts`

- `fetchUserMetrics`: add `checklist_items` to the `.select(...)` string
- `createMetric(name, type, timeframe, source, checklistItems?)`: add optional `checklistItems?: string[]` parameter; include in Supabase insert payload and `localDb.createMetric` call

### 6. `src/services/localDb.ts`

- `createMetric`: accept `checklistItems?: string[]`; store as `checklist_items` on the metric object (null when absent)
- Add seed checklist metric (id: `'mock-4'`, name: `'Morning Routine'`, type: `'checklist'`, timeframe: `'weekly'`, `checklist_items: ['Workout', 'Vitamins', 'Cold shower', 'Meditation']`)
- Add 2 seed log entries for mock-4 using `stableChecklistItemId` computed from `getPeriodWindow('weekly').start` at seed time — items 0 and 1 checked (`value: 0.25` each)
- Existing non-checklist seed metrics need `checklist_items: null` added to their objects for TypeScript compatibility

### 7. `src/hooks/usePreviousPeriodValue.ts`

Add at the very top of the function body, before the `useQuery` call:
```ts
if (metric.type === 'checklist') return { value: null };
```
This ensures no previous period comparison label is shown for checklist metrics.

### 8. `src/screens/index.tsx`

```ts
export type RootStackParamList = {
  Dashboard: undefined;
  AddMetric: undefined;
  Settings: undefined;
  MetricLog: { metricId: string };
  Checklist: { metricId: string };   // ADD
};
// Add: import { ChecklistScreen } from './ChecklistScreen/ChecklistScreen'
// Add: <Stack.Screen name="Checklist" component={ChecklistScreen} />
```

### 9. `src/components/MetricCard/MetricCard.tsx`

- Import `useChecklistState` from `'../../hooks/useChecklistState'`
- Always call `useChecklistState(metric)` (React rules of hooks — no conditional calls)
- Update `displayValue` block to handle `'checklist'`:
  ```ts
  if (metric.type === 'checklist') {
    return checklistState.isLoading ? '…' : `${checklistState.checkedCount}/${checklistState.totalCount}`;
  }
  ```
- In the JSX action section, add `metric.type !== 'checklist'` guard around the cumulative/timed/average controls (or use explicit `{metric.type === 'cumulative' && ...}` pattern already in use — the `'checklist'` case falls through cleanly since none of the existing conditions match it)

### 10. `src/screens/ChecklistScreen/ChecklistScreen.tsx` (NEW)

- Props: `NativeStackScreenProps<RootStackParamList, 'Checklist'>` — destructure `{ route, navigation }`
- Get metric via `useMetrics().metrics.find(m => m.id === route.params.metricId)` — return null if not found
- Call `useChecklistState(metric)` for `{ isItemChecked, isLoading }`
- Render:
  - Header: back button (`navigation.goBack()`) + metric name + period badge (`formatPeriodLabel(metric.timeframe)`)
  - Loading: `ActivityIndicator`
  - Body: `FlatList` over `metric.checklist_items` — each row:
    - Left: item name (`Text`)
    - Right: toggle indicator — "✓" (checked) or "○" (unchecked) as `Text`, wrapped in `TouchableOpacity`
    - `onPress`: if `isItemChecked(index)` → `uncheckItem(metric, index)`, else → `checkItem(metric, index)`
  - `keyExtractor`: use index as string (`(_, i) => String(i)`)
- Imports: `React`, `View`, `Text`, `FlatList`, `TouchableOpacity`, `ActivityIndicator`, `StyleSheet`, `SafeAreaView`, `StatusBar` from `'react-native'`; `NativeStackScreenProps` from `'@react-navigation/native-stack'`; `RootStackParamList` from `'../index'`; `useMetrics` from `'../../hooks/useMetrics'`; `useChecklistState` from `'../../hooks/useChecklistState'`; `checkItem`, `uncheckItem` from `'../../services/checklistItems'`; `formatPeriodLabel` from `'../../utils/periods'`

### 11. `src/screens/DashboardScreen/DashboardScreen.tsx`

Update `renderItem` `onPress`:
```tsx
onPress={() =>
  item.type === 'checklist'
    ? navigation.navigate('Checklist', { metricId: item.id })
    : navigation.navigate('MetricLog', { metricId: item.id })
}
```

### 12. `src/screens/AddMetricScreen/AddMetricScreen.tsx`

- Add `{ label: 'Checklist', value: 'checklist' }` to `TYPE_OPTIONS`
- Add state: `const [checklistItems, setChecklistItems] = useState<string[]>([''])`
- When `type === 'checklist'`, render below the type segment:
  - Label: "ITEMS"
  - For each item in `checklistItems`: `TextInput` for item name + "−" `TouchableOpacity` to remove (disabled if only 1 item)
  - "Add item" `TouchableOpacity` at bottom (disabled when `checklistItems.length >= 10`)
- Update `handleSubmit`:
  - If `type === 'checklist'`: validate `checklistItems.every(s => s.trim().length > 0)` and `checklistItems.length >= 1`; set error and return early if invalid
  - Pass `checklistItems.map(s => s.trim())` to `createMetric`
- Add hint text: `{type === 'checklist' && 'Define items to check off each period — tracked as X/N progress.'}`

---

## Supabase Migration Required

Before this feature works in Supabase mode, run:
```sql
ALTER TABLE metrics ADD COLUMN checklist_items JSONB;
```
Existing rows get NULL (correct). No backfill needed. Local mode works without this migration.

---

## Complexity Tracking

No constitution violations. The `ChecklistScreen` is a genuinely new screen (the existing `MetricLogScreen` is incompatible — it shows raw timestamps, not named items). All other changes are additive and backward-compatible.
