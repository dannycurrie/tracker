# Tasks: Previous Period Comparison

**Input**: Design documents from `specs/006-previous-period-comparison/`
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ quickstart.md ✅

**Tests**: Not requested — no test tasks generated.

**Organization**: US1 (show previous period value) and US2 (consistent formatting) are implemented together in `MetricCard` since formatting is inseparable from display. US2 has no separate implementation phase — it is covered by T004. New file: `src/hooks/usePreviousPeriodValue.ts`. Modified files: `src/utils/periods.ts`, `src/services/localDb.ts`, `src/components/MetricCard/MetricCard.tsx`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files or fully independent within same file)
- **[Story]**: Maps to user story from spec.md (US1, US2)

---

## Phase 2: Foundational (Blocking Prerequisite)

**Purpose**: Add the previous period window utility that both US1 and US2 depend on.

**⚠️ CRITICAL**: Phases 3–4 cannot begin until this phase is complete.

- [x] T001 Add `getPreviousPeriodWindow(timeframe: MetricTimeframe, now: Date = new Date()): PeriodWindow` to `src/utils/periods.ts` — implementation: `const current = getPeriodWindow(timeframe, now); return getPeriodWindow(timeframe, new Date(current.start.getTime() - 1));` — export it alongside the existing exports; no changes to existing functions; import `MetricTimeframe` and `PeriodWindow` are already in scope in that file

**Checkpoint**: `getPreviousPeriodWindow` is exported from `src/utils/periods.ts` and can be imported by the new hook.

---

## Phase 3: User Story 1 — Show Previous Period Value (Priority: P1) 🎯 MVP

**Goal**: Every metric card with qualifying previous-period data shows a subordinate comparison label below the current value. Cards with no data or a zero aggregate show no label.

**Independent Test**: Open Dashboard in local mode with previous-period seed entries → confirm metric cards show a small grey label such as "3 last week" or "Avg 4.0 last month" below the current value. A metric with no previous-period seed data shows no label.

- [x] T002 [US1] Create `src/hooks/usePreviousPeriodValue.ts` — exports `usePreviousPeriodValue(metric: Metric): { value: number | null }`; uses `useQuery` with key `['previousPeriodEntries', metric.id, start.toISOString(), end.toISOString()]`; `queryFn: () => fetchPeriodEntries(metric.id, start, end)`; `staleTime: Infinity`; if `!data || data.length === 0` return `{ value: null }`; compute aggregate: `metric.type === 'average' ? computeMean(values) : values.reduce((acc, v) => acc + v, 0)`; return `{ value: aggregate === 0 ? null : aggregate }`; imports: `useQuery` from `'@tanstack/react-query'`, `Metric` from `'../types'`, `fetchPeriodEntries` from `'../services/logEntries'`, `getPreviousPeriodWindow` from `'../utils/periods'`, `computeMean` from `'../utils/averageCalc'`
- [x] T003 [P] [US1] Update seed data in `src/services/localDb.ts` — add a `daysAgo(d: number): string` helper: `return new Date(Date.now() - d * 86_400_000).toISOString()` — add previous-period entries to `buildSeedEntries()`: for weekly metrics (mock-1 Cups of coffee, mock-2 Reading) add entries with `logged_at: daysAgo(10)` (10 days ago is always in the previous Mon–Sun week regardless of current day); for monthly metric (mock-3 Sleep quality) add entries with `logged_at: daysAgo(35)` (35 days ago is always in the previous calendar month); specific entries to add:
  ```
  { id: 'mock-prev-1', metric_id: 'mock-1', value: 1, logged_at: daysAgo(10), session_start_at: null, created_at: now },
  { id: 'mock-prev-2', metric_id: 'mock-1', value: 1, logged_at: daysAgo(11), session_start_at: null, created_at: now },
  { id: 'mock-prev-3', metric_id: 'mock-1', value: 1, logged_at: daysAgo(12), session_start_at: null, created_at: now },
  { id: 'mock-prev-4', metric_id: 'mock-2', value: 20, logged_at: daysAgo(10), session_start_at: daysAgo(10), created_at: now },
  { id: 'mock-prev-5', metric_id: 'mock-3', value: 7, logged_at: daysAgo(35), session_start_at: null, created_at: now },
  { id: 'mock-prev-6', metric_id: 'mock-3', value: 8, logged_at: daysAgo(36), session_start_at: null, created_at: now },
  ```
  Note: if the app has already been seeded on device, the new entries won't appear until `SEEDED_KEY` is cleared (reinstall or clear storage); this is acceptable for development — no migration needed
- [x] T004 [US1] Update `src/components/MetricCard/MetricCard.tsx` to display the comparison label — add import: `import { usePreviousPeriodValue } from '../../hooks/usePreviousPeriodValue'`; call the hook: `const { value: prevValue } = usePreviousPeriodValue(metric)`; add `prevLabel` derived string immediately after the `displayValue` block:
  ```ts
  const prevLabel = (() => {
    if (prevValue === null) return null;
    const ref = metric.timeframe === 'weekly' ? 'last week' : 'last month';
    if (metric.type === 'timed') return `${prevValue} min ${ref}`;
    if (metric.type === 'average') return `Avg ${prevValue.toFixed(1)} ${ref}`;
    return `${prevValue.toFixed(0)} ${ref}`;
  })();
  ```
  Insert between `<Text style={styles.value}>` and the action button block:
  ```tsx
  {prevLabel !== null && (
    <Text style={styles.prevValue}>{prevLabel}</Text>
  )}
  ```
  Add style entry: `prevValue: { fontSize: 13, color: '#888', marginBottom: 10, marginTop: -6 }` — `marginTop: -6` closes the gap between the large value and the label; `marginBottom: 10` keeps spacing before the action button; this task covers both US1 (display + suppression) and US2 (type-specific formatting, unit suffix, time reference, decimal precision) since they are implemented in the same `prevLabel` computation

**Checkpoint**: User Stories 1 and 2 complete — Dashboard shows previous period labels on cards with qualifying data; zero/no-data cards show no label; label format matches type (cumulative: integer, timed: "X min", average: "Avg X.X") with correct time reference.

---

## Phase 4: User Story 2 — Consistent Formatting (Priority: P2)

**Note**: US2 formatting requirements (unit suffix, "Avg" prefix, one decimal place for averages, "last week"/"last month" time reference) are fully implemented in T004 above. No additional implementation tasks are needed for US2. The polish phase below validates the formatting.

---

## Final Phase: Polish & Cross-Cutting Concerns

- [x] T005 [P] Verify TypeScript compiles cleanly — run `npx tsc --noEmit` and confirm zero new errors introduced by this feature (pre-existing `useTimer.ts` `getStartedAt` warning is acceptable)
- [x] T006 [P] Verify MetricCard action buttons still work — in local mode, tap **+ Add** on the Cups of coffee card and confirm count increments without regression; tap **Start** on Reading and confirm timer starts; tap background of card → confirm MetricLogScreen navigation still works (outer `TouchableOpacity` in DashboardScreen must not be broken by the new label)
- [x] T007 [P] Verify previous period label appearance in local mode — open Dashboard → confirm "3 last week" (or similar) appears under Cups of coffee, "20 min last week" under Reading, "Avg 7.5 last month" under Sleep quality (values based on seed entries from T003); confirm labels are visually subordinate (smaller, grey) relative to the primary value

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 2)**: No external dependencies — T001 must complete before T002 (hook imports `getPreviousPeriodWindow`); T003 is parallel with T002 (different file)
- **User Stories (Phase 3)**: T002 must complete before T004 (MetricCard imports `usePreviousPeriodValue`); T003 is parallel with T002 and can also complete after T004 (seed data is independent of component code)
- **Polish (Final)**: All story phases complete

### Within Phase 3

```
T001 (Foundational complete)
  → T002 (create hook) [parallel with T003]
  → T003 [P] (seed data — different file, parallel with T002)
  → T004 (MetricCard — depends on T002; T003 can still complete after)
```

### Parallel Opportunities

```bash
# Phase 3 — T002 and T003 can run in parallel:
Task T002: "usePreviousPeriodValue hook in src/hooks/usePreviousPeriodValue.ts"
Task T003: "previous-period seed entries in src/services/localDb.ts"

# Final Phase — all three can run in parallel:
Task T005: "TypeScript compile check"
Task T006: "MetricCard action button regression"
Task T007: "Previous period label visual verification"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: Foundational (T001)
2. Complete Phase 3: T002 → T003 (parallel) → T004
3. **STOP and VALIDATE**: Open Dashboard in local mode — confirm comparison labels appear on metric cards with previous-period seed data
4. Verify no regression on MetricCard action buttons

### Incremental Delivery

1. Foundational → `getPreviousPeriodWindow` utility ready
2. US1+US2 → hook + seed data + MetricCard label (all formatting included)
3. Polish → type check, regression, visual verification

---

## Notes

- `staleTime: Infinity` on `usePreviousPeriodValue` is intentional — previous period data is immutable once closed; invalidating it on mutations would waste a network round-trip with no user benefit
- The query key `['previousPeriodEntries', ...]` is distinct from `['periodEntries', ...]` — existing `invalidatePeriodEntries` calls do NOT touch the previous period cache
- `marginTop: -6` in the `prevValue` style compensates for the bottom margin already baked into `styles.value` (`marginBottom: 12`) — the label should sit snugly below the large number without extra whitespace
- Seed entries use `daysAgo(10)` / `daysAgo(11)` / `daysAgo(12)` for weekly metrics — any of these is guaranteed to land in the previous Mon–Sun week regardless of what day of the week today is (current week is at most 6 days old, so 10 days ago is always at least 4 days before the current period start)
- Seed entries use `daysAgo(35)` / `daysAgo(36)` for monthly metrics — guaranteed previous calendar month regardless of current date within the month
- If MMKV seed data was already written (device/simulator has been launched before), the new seed entries will not appear until storage is cleared (or the app is reinstalled). This is expected — seed data is written once. During development, clear app data or uninstall/reinstall to repopulate with updated seed entries.
- US2 formatting is co-located with US1 rendering in T004 — separating them would require a second pass over the same lines with no benefit
