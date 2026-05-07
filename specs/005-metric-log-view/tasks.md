# Tasks: Metric Log View

**Input**: Design documents from `specs/005-metric-log-view/`
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ quickstart.md ✅

**Tests**: Not requested — no test tasks generated.

**Organization**: Tasks grouped by user story. US1 is independently deliverable as MVP. New files: `src/screens/MetricLogScreen/MetricLogScreen.tsx`, `src/hooks/usePeriodLogEntries.ts`. Modified files: `src/services/logEntries.ts`, `src/services/localDb.ts`, `src/screens/index.tsx`, `src/screens/DashboardScreen/DashboardScreen.tsx`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files or fully independent within same file)
- **[Story]**: Maps to user story from spec.md (US1, US2, US3)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Service layer additions and navigation registration that all user stories depend on.

**⚠️ CRITICAL**: Phases 3–5 cannot begin until this phase is complete.

- [x] T001 Add `fetchPeriodLogEntries(metricId: string, periodStart: Date, periodEnd: Date): Promise<LogEntry[]>` to `src/services/logEntries.ts` — Supabase path: `.from('log_entries').select('*').eq('metric_id', metricId).gte('logged_at', periodStart.toISOString()).lt('logged_at', periodEnd.toISOString()).order('logged_at', { ascending: false })`; local mode path: `localDb.fetchPeriodLogEntries(metricId, periodStart, periodEnd)`; import `LogEntry` from `'../types'`
- [x] T002 Update `invalidatePeriodEntries(metricId: string)` in `src/services/logEntries.ts` — add a second `queryClient.invalidateQueries({ queryKey: ['periodLogEntries', metricId] })` call after the existing `['periodEntries', metricId]` call so that both the dashboard value and the log view refresh after any insert, delete, or resync
- [x] T003 [P] Add `deleteLogEntry(id: string, metricId: string): Promise<void>` to `src/services/logEntries.ts` — local mode path: `localDb.deleteLogEntry(id)` then `invalidatePeriodEntries(metricId)`; Supabase path: `.from('log_entries').delete().eq('id', id)`, on error `logger.error('Failed to delete log entry', error, { id })` then throw, on success `invalidatePeriodEntries(metricId)`
- [x] T004 [P] Add `fetchPeriodLogEntries(metricId, periodStart, periodEnd): LogEntry[]` to the `localDb` object in `src/services/localDb.ts` — `readEntries()`, filter by `metric_id === metricId` and `logged_at >= periodStart` and `logged_at < periodEnd`, sort descending by `logged_at`, return full `LogEntry[]` (no projection)
- [x] T005 [P] Add `deleteLogEntry(id: string): void` to the `localDb` object in `src/services/localDb.ts` — `writeEntries(readEntries().filter((e) => e.id !== id))`
- [x] T006 Add `MetricLog: { metricId: string }` to `RootStackParamList` in `src/screens/index.tsx` and register a `Stack.Screen name="MetricLog"` pointing to the new `MetricLogScreen` component (import path `'./MetricLogScreen/MetricLogScreen'`)

**Checkpoint**: Foundational layer complete — service functions, local DB methods, and navigation route are all wired up.

---

## Phase 3: User Story 1 — View Log History (Priority: P1) 🎯 MVP

**Goal**: Tapping a metric card navigates to a screen listing all current-period log entries for that metric in reverse chronological order.

**Independent Test**: Tap any metric in local mode (seed data has entries) → confirm MetricLogScreen opens showing a list of dated entries sorted most-recent-first. Tap back → return to dashboard.

- [x] T007 [US1] Create `src/hooks/usePeriodLogEntries.ts` — exports `usePeriodLogEntries(metric: Metric): { entries: LogEntry[]; isLoading: boolean }`; uses `useQuery` from `@tanstack/react-query` with key `['periodLogEntries', metric.id, start.toISOString(), end.toISOString()]`; `queryFn: () => fetchPeriodLogEntries(metric.id, start, end)`; `staleTime: 10_000`; returns `{ entries: data ?? [], isLoading }`; imports: `useQuery` from `'@tanstack/react-query'`, `Metric`, `LogEntry` from `'../types'`, `fetchPeriodLogEntries` from `'../services/logEntries'`, `getPeriodWindow` from `'../utils/periods'`
- [x] T008 [US1] Create `src/screens/MetricLogScreen/MetricLogScreen.tsx` — the screen component with these characteristics:
  - Props: `NativeStackScreenProps<RootStackParamList, 'MetricLog'>` — destructure `{ route, navigation }`
  - Get `metricId` from `route.params.metricId`
  - Get metric via `useMetrics().metrics.find((m) => m.id === metricId)` — if not found, render nothing (null)
  - Get entries via `usePeriodLogEntries(metric)` returning `{ entries, isLoading }`
  - Header: `SafeAreaView` wrapper → back button (`navigation.goBack()`) + metric name + `formatPeriodLabel(metric.timeframe)` badge
  - Body: `ActivityIndicator` when `isLoading`; empty-state `Text` "No entries this period" when `entries.length === 0`; otherwise `FlatList` of entry rows
  - Each entry row: left side shows formatted value (`timed` → `${v} min`, `average` → `v.toFixed(1)`, `cumulative` → `v.toFixed(0)`), below that a `Text` with `new Date(entry.logged_at).toLocaleString('en', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })`; right side shows a `TouchableOpacity` with "✕" text (delete button — implemented in T009); `keyExtractor` uses `entry.id`
  - Imports: `React`, `View`, `Text`, `FlatList`, `TouchableOpacity`, `ActivityIndicator`, `StyleSheet`, `SafeAreaView`, `StatusBar`, `Alert` from `'react-native'`; `NativeStackScreenProps` from `'@react-navigation/native-stack'`; `RootStackParamList` from `'../index'`; `useMetrics` from `'../../hooks/useMetrics'`; `usePeriodLogEntries` from `'../../hooks/usePeriodLogEntries'`; `formatPeriodLabel` from `'../../utils/periods'`; `LogEntry`, `MetricType` from `'../../types'`
- [x] T009 [US1] Update `src/screens/DashboardScreen/DashboardScreen.tsx` — change `renderItem` to wrap each `MetricCard` with a `TouchableOpacity` (import it at top): `const renderItem = ({ item }: { item: Metric }) => (<TouchableOpacity activeOpacity={1} onPress={() => navigation.navigate('MetricLog', { metricId: item.id })}><MetricCard metric={item} /></TouchableOpacity>)`; inner `TouchableOpacity` elements in `MetricCard` continue to handle their own events via React Native's default event propagation

**Checkpoint**: User Story 1 complete — tapping a metric opens its log view with dated entries.

---

## Phase 4: User Story 2 — Delete a Log Entry (Priority: P2)

**Goal**: A visible "✕" button on each log entry row allows the user to delete that entry; the list and dashboard value update immediately.

**Independent Test**: Open a metric with 3 entries → tap ✕ on one entry → confirm deletion confirmation dialog appears → confirm → list now shows 2 entries → navigate back → dashboard shows updated value.

- [x] T010 [US2] Add delete handler to the entry rows in `src/screens/MetricLogScreen/MetricLogScreen.tsx` — implement `handleDelete(entry: LogEntry): void` that calls `Alert.alert('Delete entry', 'Remove this log entry?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => deleteLogEntry(entry.id, metricId) }])`; import `deleteLogEntry` from `'../../services/logEntries'`; wire the `onPress` of the "✕" `TouchableOpacity` in the entry row to `handleDelete(entry)`; add a `useState<boolean>` for `isDeleting` if needed to disable the button during the async delete

**Checkpoint**: User Story 2 complete — entries can be deleted from the log view with immediate list and dashboard updates.

---

## Phase 5: User Story 3 — Entry Source Context (Priority: P3)

**Goal**: Log entries originating from Apple Health sessions show a secondary "Session started [time]" line, visually distinguishing them from manually-added entries.

**Independent Test**: Open a metric whose entries have `session_start_at` set (e.g. Reading in local mode) → confirm each entry shows a secondary greyed "Session started [time]" line below the main logged time.

- [x] T011 [US3] Update entry rows in `src/screens/MetricLogScreen/MetricLogScreen.tsx` — after the `logged_at` `Text` element, add a conditional: `{entry.session_start_at && (<Text style={styles.rowSession}>{'Session started ' + new Date(entry.session_start_at).toLocaleString('en', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</Text>)}`; add `rowSession` style: `{ fontSize: 11, color: '#888', marginTop: 1 }`

**Checkpoint**: User Story 3 complete — Apple Health entries show session start context.

---

## Final Phase: Polish & Cross-Cutting Concerns

- [x] T012 [P] Verify TypeScript compiles cleanly — run `npx tsc --noEmit` and confirm zero new errors introduced by this feature (the pre-existing `useTimer.ts` `getStartedAt` warning is acceptable)
- [x] T013 [P] Verify action buttons inside MetricCard still work — in local mode, tap the **+ Add** button inside the Cups of coffee card (not the card background) and confirm the count increments without navigating to the log view; tap the **Start** button in the Reading card and confirm the timer starts; tap the card background area and confirm navigation to MetricLogScreen occurs

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 2)**: No external dependencies — T001 must precede T002 and T003 (T002 modifies the function added in T001); T004, T005, T006 are parallel with T001–T003
- **User Stories (Phase 3–5)**: All depend on Phase 2 completion
- **Polish (Final)**: Depends on all user story phases complete

### User Story Dependencies

- **US1 (P1)**: Depends on T001 (`fetchPeriodLogEntries`), T006 (`MetricLog` route) — implement T007 → T008 → T009
- **US2 (P2)**: Depends on T003 (`deleteLogEntry`), T008 (MetricLogScreen exists) — T010 modifies T008's screen
- **US3 (P3)**: Depends on T008 (entry rows exist) — T011 adds a conditional to the existing rows

### Within Phase 2

```
T001 → T002
T001 → T003   (T003 calls invalidatePeriodEntries defined in T001's file; write after T002)
T004 [P]      (different file from T001–T003)
T005 [P]      (same file as T004, but independent method)
T006 [P]      (different file)
```

### Within User Story 1

```
T007 [P with T008 start] → T008 (MetricLogScreen imports usePeriodLogEntries) → T009
```

### Parallel Opportunities

```bash
# Phase 2 — run in parallel:
Task T004: "localDb.fetchPeriodLogEntries in src/services/localDb.ts"
Task T005: "localDb.deleteLogEntry in src/services/localDb.ts"
Task T006: "MetricLog route in src/screens/index.tsx"

# Phase 3 — T007 and T008 skeleton can start together:
Task T007: "usePeriodLogEntries hook in src/hooks/usePeriodLogEntries.ts"
Task T008: "MetricLogScreen in src/screens/MetricLogScreen/MetricLogScreen.tsx"

# Final Phase — run in parallel:
Task T012: "TypeScript compile check"
Task T013: "MetricCard button behavior regression test"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: Foundational (T001 → T002 → T003, T004, T005, T006 in parallel)
2. Complete Phase 3: User Story 1 (T007 → T008 → T009)
3. **STOP and VALIDATE**: Tap any metric in local mode — confirm log view opens with dated entries
4. Verify card action buttons still work (quick manual check)

### Incremental Delivery

1. Foundational → service layer ready, route registered
2. US1 → Tap-to-view log history (MVP)
3. US2 → Delete entries from log view
4. US3 → Apple Health session context on entries
5. Polish → Type check, regression check

---

## Notes

- `react-native-gesture-handler` is NOT installed — delete UX uses a visible ✕ button, not swipe-to-delete
- Inner `TouchableOpacity` elements inside `MetricCard` (the `+ Add`, `Start`, `AverageInput` buttons) correctly intercept their own press events via React Native's default touch propagation — the outer navigation wrapper only fires when no inner button is tapped
- `invalidatePeriodEntries` (T002) uses TanStack Query v5 prefix matching — `{ queryKey: ['periodLogEntries', metricId] }` invalidates all queries whose key starts with those two elements, covering any period window
- `activeOpacity={1}` on the outer wrapper in T009 keeps the card's visual appearance unchanged on tap — the card already has its own visual states via its inner `TouchableOpacity` elements
- Local mode seed data (`localDb.ts`) has `session_start_at` set on the two Reading entries and the Sleep quality entries — US3 can be verified immediately in local mode without Apple Health
