# Implementation Plan: Previous Period Comparison

**Branch**: `006-previous-period-comparison` | **Date**: 2026-05-07 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `specs/006-previous-period-comparison/spec.md`

## Summary

Add a subordinate comparison label to each metric card showing the aggregated value from the previous complete period (sum for cumulative/timed, mean for average). The previous period window is derived by re-using the existing `getPeriodWindow` utility with a date 1ms before the current period start. A new `usePreviousPeriodValue` hook fetches entries via the existing `fetchPeriodEntries` service. `MetricCard` renders the label only when the previous period value is non-null and non-zero.

## Technical Context

**Language/Version**: TypeScript (React Native 0.74.5, Expo SDK 51)  
**Primary Dependencies**: TanStack Query v5, React Native built-ins  
**Storage**: Supabase (prod) / MMKV + in-memory localDb (local mode) — read-only for this feature  
**Testing**: Manual (no automated tests requested)  
**Target Platform**: iOS (Expo bare workflow)  
**Project Type**: Mobile app  
**Performance Goals**: Previous period label appears within 3 seconds of dashboard load (SC-001)  
**Constraints**: No new npm dependencies; immutable previous period data (staleTime: Infinity)  
**Scale/Scope**: One new hook, one utility function, one component update

## Constitution Check

Constitution is unpopulated template — no project-specific gates to check. No new dependencies, no new screens, no new services. Change is minimal and self-contained.

## Project Structure

### Documentation (this feature)

```text
specs/006-previous-period-comparison/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
└── tasks.md             ← Phase 2 output (/speckit-tasks)
```

### Source Code (files touched by this feature)

```text
src/
├── utils/
│   └── periods.ts                          ← ADD getPreviousPeriodWindow()
├── hooks/
│   └── usePreviousPeriodValue.ts           ← NEW
└── components/
    └── MetricCard/
        └── MetricCard.tsx                  ← ADD comparison label + usePreviousPeriodValue call
```

**No new files in services/, screens/, or store/. No navigation changes. No new dependencies.**

## Implementation Details

### 1. `src/utils/periods.ts` — Add `getPreviousPeriodWindow`

```ts
export function getPreviousPeriodWindow(
  timeframe: MetricTimeframe,
  now: Date = new Date()
): PeriodWindow {
  const current = getPeriodWindow(timeframe, now);
  return getPeriodWindow(timeframe, new Date(current.start.getTime() - 1));
}
```

- Export it so the hook can import it.
- No changes to existing `getPeriodWindow` or `formatPeriodLabel`.

---

### 2. `src/hooks/usePreviousPeriodValue.ts` — New hook

```ts
import { useQuery } from '@tanstack/react-query';
import { Metric } from '../types';
import { fetchPeriodEntries } from '../services/logEntries';
import { getPreviousPeriodWindow } from '../utils/periods';
import { computeMean } from '../utils/averageCalc';

export function usePreviousPeriodValue(metric: Metric): { value: number | null } {
  const { start, end } = getPreviousPeriodWindow(metric.timeframe);

  const { data } = useQuery({
    queryKey: ['previousPeriodEntries', metric.id, start.toISOString(), end.toISOString()],
    queryFn: () => fetchPeriodEntries(metric.id, start, end),
    staleTime: Infinity,
  });

  if (!data || data.length === 0) return { value: null };

  const values = data.map((r) => r.value);
  const aggregate =
    metric.type === 'average'
      ? computeMean(values)
      : values.reduce((acc, v) => acc + v, 0);

  return { value: aggregate === 0 ? null : aggregate };
}
```

- `staleTime: Infinity` — previous period data is immutable once closed.
- Returns `null` for zero aggregate (FR-007).
- No `isLoading` exposed — the label simply doesn't appear until data arrives (null during load, same as no data).

---

### 3. `src/components/MetricCard/MetricCard.tsx` — Add comparison label

**Changes**:
- Import `usePreviousPeriodValue` from `'../../hooks/usePreviousPeriodValue'`
- Call `const { value: prevValue } = usePreviousPeriodValue(metric);`
- Add `prevLabel` derived string:
  ```ts
  const prevLabel = (() => {
    if (prevValue === null) return null;
    const ref = metric.timeframe === 'weekly' ? 'last week' : 'last month';
    if (metric.type === 'timed') return `${prevValue} min ${ref}`;
    if (metric.type === 'average') return `Avg ${prevValue.toFixed(1)} ${ref}`;
    return `${prevValue.toFixed(0)} ${ref}`;
  })();
  ```
- Insert between `<Text style={styles.value}>` and the action buttons:
  ```tsx
  {prevLabel !== null && (
    <Text style={styles.prevValue}>{prevLabel}</Text>
  )}
  ```
- Add style:
  ```ts
  prevValue: { fontSize: 13, color: '#888', marginBottom: 10, marginTop: -6 },
  ```
  `marginTop: -6` tightens the gap between the large value and the comparison label; `marginBottom: 10` separates it from the action button.

---

## Seed Data Requirement

To verify in local mode, `src/services/localDb.ts` seed entries must include at least one entry with `logged_at` in the previous calendar month (for monthly metrics) and previous Mon–Sun week (for weekly metrics).

Check seed data timestamps. If all existing seed entries fall within the current period at the time of testing, add supplementary seed entries with appropriate historical `logged_at` values.

---

## Execution Order

1. `src/utils/periods.ts` — add `getPreviousPeriodWindow` (no dependencies)
2. `src/hooks/usePreviousPeriodValue.ts` — create new hook (depends on periods.ts change)
3. `src/components/MetricCard/MetricCard.tsx` — add label (depends on hook)
4. `src/services/localDb.ts` — verify/add seed entries for previous period
5. TypeScript compile check (`npx tsc --noEmit`)
6. Manual verification per quickstart.md

## Complexity Tracking

No constitution violations. No new dependencies. No new screens, routes, or services. Change is additive and confined to three files plus optional seed data.
