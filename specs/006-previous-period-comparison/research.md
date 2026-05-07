# Research: Previous Period Comparison

**Feature**: 006-previous-period-comparison  
**Date**: 2026-05-07

## Decision 1: Previous Period Window Derivation

**Decision**: Derive the previous period window by calling the existing `getPeriodWindow(timeframe, now)` with `now` set to `current.start - 1ms`.

**Rationale**: `getPeriodWindow` already handles all calendar math for both weekly (Monday–Sunday) and monthly (calendar month) timeframes. Passing a date 1ms before the current period's start lands in the middle of the previous period, so the function returns the correct previous window without any new calendar logic.

**Alternatives considered**:
- Subtract 7 days (weekly) / 1 month (monthly) from current start directly — fragile across month boundaries and DST; reusing `getPeriodWindow` is safer.
- Store previous period boundaries separately — unnecessary persistence for a derived value.

**Implementation**: Add `getPreviousPeriodWindow(timeframe, now?)` to `src/utils/periods.ts`:
```ts
const current = getPeriodWindow(timeframe, now);
const oneMsBefore = new Date(current.start.getTime() - 1);
return getPeriodWindow(timeframe, oneMsBefore);
```

---

## Decision 2: Data Fetching Strategy

**Decision**: Reuse the existing `fetchPeriodEntries(metricId, periodStart, periodEnd)` service function with the previous period's window. No new service function needed.

**Rationale**: `fetchPeriodEntries` already queries log entries by metric ID and date range, returning `{ value: number }[]`. The previous period comparison uses the same query with different date bounds.

**Alternatives considered**:
- Extend `fetchPeriodEntries` with a "previous" flag — unnecessary complexity; the caller controls the date range.
- Batch current + previous in one query — premature optimisation; two small queries from cache is acceptable.

---

## Decision 3: New Hook vs Extending usePeriodValue

**Decision**: Create a new `usePreviousPeriodValue(metric)` hook in `src/hooks/usePreviousPeriodValue.ts`, separate from `usePeriodValue`.

**Rationale**: `usePeriodValue` is called by `MetricCard` for the current value display. Adding a second TanStack Query call inside it would require the hook to return two values and would conflate two concerns. A separate hook keeps both hooks single-purpose and independently queryable.

**Query key**: `['previousPeriodEntries', metric.id, start.toISOString(), end.toISOString()]` — distinct from `['periodEntries', ...]` so invalidation of current period data does not affect the previous period cache (previous period data is immutable once the period closes).

**Zero suppression**: The hook returns `null` when the computed aggregate is 0 or when there are no entries, per FR-007.

---

## Decision 4: Comparison Label Placement and Styling

**Decision**: Insert the comparison label as a `Text` element in `MetricCard` between the main value and the action button, styled at `fontSize: 13, color: '#888'`.

**Rationale**: Placing it directly below the large value (`fontSize: 36`) creates a natural visual hierarchy: name → current value → comparison → action. Font size 13 with muted grey is visually subordinate but legible, matching the existing badge style (fontSize 11, `#666`).

**Label format per metric type**:
- cumulative: `"${value.toFixed(0)} last week"` / `"${value.toFixed(0)} last month"`
- timed: `"${value} min last week"` / `"${value} min last month"`
- average: `"Avg ${value.toFixed(1)} last week"` / `"Avg ${value.toFixed(1)} last month"`

**Time reference helper**: Derive from `metric.timeframe` — `'weekly' → 'last week'`, `'monthly' → 'last month'`.

---

## Decision 5: Cache Invalidation Scope

**Decision**: Do NOT invalidate `['previousPeriodEntries', ...]` on log entry mutations.

**Rationale**: Once a period closes, its entries are immutable from the user's perspective. The previous period value should not change during the current period. Using `staleTime: Infinity` (or a very long stale time) on the previous period query is appropriate. Contrast with `usePeriodValue` which uses `staleTime: 10_000` because the current period changes frequently.

---

## No New Dependencies

All required capabilities exist:
- `getPeriodWindow` in `src/utils/periods.ts`
- `fetchPeriodEntries` in `src/services/logEntries.ts`
- `computeMean` in `src/utils/averageCalc.ts`
- TanStack Query v5 (already installed)
- `MetricCard` styling conventions already established
