# Tasks: Habit Metric Tracker

**Input**: Design documents from `specs/001-habit-metric-tracker/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓

**Tests**: Not requested in specification — no test tasks generated.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story this task belongs to (US1–US5, maps to spec.md priorities P1–P5)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Bootstrap the Expo/React Native project and install all dependencies.

- [x] T001 Initialise Expo project with blank TypeScript template: `npx create-expo-app tracker --template blank-typescript`
- [x] T00x Install all core dependencies per quickstart.md: `@supabase/supabase-js`, `react-native-mmkv`, `@tanstack/react-query`, `zustand`, `@react-native-community/netinfo`, `react-native-uuid`, `expo-secure-store`, `expo-crypto`
- [x] T00x [P] Configure TypeScript strict mode in tsconfig.json (`"strict": true`, path aliases for `@/src/*`)
- [x] T00x [P] Set up ESLint and Prettier in .eslintrc.js and .prettierrc (React Native + TypeScript rules)
- [x] T00x [P] Create .env and .env.example with Supabase placeholder variables (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`)
- [x] T00x Create src/ directory structure per plan.md: `src/components/`, `src/screens/`, `src/services/`, `src/hooks/`, `src/store/`, `src/utils/`, `src/types/`

**Checkpoint**: Project boots in iOS Simulator, dependencies installed, directory structure in place.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can start.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T00x Create Supabase project: enable anonymous auth (Authentication > Providers > Anonymous), run `contracts/schema.sql` in SQL editor, copy project URL and anon key to .env
- [x] T00x Implement Supabase client with SecureStore-backed session persistence in `src/services/supabase.ts` (see quickstart.md for implementation)
- [x] T00x [P] Define all shared TypeScript types in `src/types/index.ts`: `MetricType`, `MetricTimeframe`, `Metric`, `LogEntry`, `PendingLogEntry`, `TimerState`
- [x] T0xx [P] Set up TanStack QueryClient with default options (staleTime, retry config) and export `QueryClientProvider` wrapper in `src/services/queryClient.ts`
- [x] T0xx Implement anonymous session bootstrap in `App.tsx`: call `supabase.auth.signInAnonymously()` if `getSession()` returns null; wrap app in `QueryClientProvider`

**Checkpoint**: App launches, anonymous Supabase session established on first run, session persists across restarts.

---

## Phase 3: User Story 1 — View and Increment Metrics (Priority: P1) 🎯 MVP

**Goal**: User opens the app, sees all their metrics with current period totals, and can tap to increment a cumulative metric. A log entry is created on each increment.

**Independent Test**: Create one cumulative metric directly in Supabase, launch the app, verify it shows with value 0, tap increment, verify value increases to 1 and a log entry appears in the `log_entries` table.

- [x] T0xx [P] [US1] Implement period window calculator `getPeriodWindow(timeframe, now?)` in `src/utils/periods.ts` — returns `{ start: Date, end: Date }` for weekly (Monday–Sunday) and monthly (1st–last) periods
- [x] T0xx [P] [US1] Implement running mean helper `computeMean(values: number[]): number | null` in `src/utils/averageCalc.ts` — returns null for empty array
- [x] T0xx [US1] Implement log entry service in `src/services/logEntries.ts`: `insertLogEntry({ id, metricId, value, loggedAt, sessionStartAt? })` and `fetchPeriodEntries(metricId, periodStart, periodEnd)` using query patterns from `contracts/query-patterns.md`
- [x] T0xx [US1] Implement metrics service in `src/services/metrics.ts`: `fetchUserMetrics()` — SELECT all metrics ordered by display_order
- [x] T0xx [P] [US1] Implement `usePeriodValue(metric: Metric)` hook in `src/hooks/usePeriodValue.ts`: calls `fetchPeriodEntries`, computes SUM for cumulative/timed and mean for average; returns `number | null`
- [x] T0xx [P] [US1] Implement `useMetrics()` hook in `src/hooks/useMetrics.ts`: TanStack Query fetch of all user metrics, exports `metrics`, `isLoading`, `invalidate`
- [x] T0xx [US1] Implement `MetricCard` component (cumulative variant) in `src/components/MetricCard/MetricCard.tsx`: displays metric name, timeframe badge, current period value from `usePeriodValue`, single-tap increment button that calls `insertLogEntry` and invalidates the period value query
- [x] T0xx [US1] Implement `DashboardScreen` in `src/screens/DashboardScreen/DashboardScreen.tsx`: renders `FlatList` of `MetricCard` components using `useMetrics`, includes placeholder "Add Metric" button (no-op for now)
- [x] T0xx [US1] Wire `DashboardScreen` as the root screen in `App.tsx`

**Checkpoint**: App shows metrics list, tap increments cumulative metric, value updates within 1 second, log entry created in Supabase.

---

## Phase 4: User Story 2 — Create a New Metric (Priority: P2)

**Goal**: User taps "Add Metric", fills in name + type + timeframe, confirms, and the new metric appears on the dashboard with a value of 0.

**Independent Test**: Launch app with empty metrics table. Tap "Add Metric", enter name "Snacks", type "cumulative", timeframe "weekly", tap confirm. Verify "Snacks" appears on dashboard with value 0.

- [x] T0xx [US2] Install and configure React Navigation stack navigator: `@react-navigation/native`, `@react-navigation/native-stack`; set up `RootStack` in `src/screens/index.ts` with `Dashboard` and `AddMetric` routes; wrap `App.tsx` in `NavigationContainer`
- [x] T0xx [P] [US2] Implement `createMetric(name, type, timeframe)` service function in `src/services/metrics.ts`: INSERT into `metrics` with next available `display_order`
- [x] T0xx [US2] Implement `AddMetricScreen` in `src/screens/AddMetricScreen/AddMetricScreen.tsx`: text input for name (non-empty validation), segmented control or picker for type (cumulative / timed / average), segmented control for timeframe (weekly / monthly), submit button that calls `createMetric` then navigates back
- [x] T0xx [US2] Wire "Add Metric" button on `DashboardScreen` to navigate to `AddMetricScreen`; invalidate `useMetrics` query on return so new metric appears immediately in `src/screens/DashboardScreen/DashboardScreen.tsx`

**Checkpoint**: Full create-and-view flow works end-to-end. All three metric types can be created and appear on dashboard.

---

## Phase 5: User Story 3 — Timed Session Tracking (Priority: P3)

**Goal**: User starts a timer on a timed metric, backgrounds the app, returns, stops the timer, and the elapsed minutes are added to the period total.

**Independent Test**: Create one timed metric. Tap Start. Press Home (background app). Wait 2 minutes. Reopen. Verify live elapsed shows ~2 minutes. Tap Stop. Verify period total increases by 2 and a log entry with `session_start_at` appears in Supabase.

- [x] T0xx [US3] Implement timer store in `src/store/timerStore.ts`: Zustand store with MMKV persistence; state is `Record<metricId, { startedAt: string }>` (ISO timestamp); actions: `startTimer(metricId)`, `stopTimer(metricId)`, `getStartedAt(metricId)`
- [x] T0xx [US3] Implement `useTimer(metricId: string)` hook in `src/hooks/useTimer.ts`: reads timerStore, subscribes to `AppState` changes (to force re-render on foreground), computes `elapsed = Date.now() - startedAt`, returns `{ isRunning, elapsedMs, start, stop }`
- [x] T0xx [P] [US3] Implement `TimerControl` component in `src/components/TimerControl/TimerControl.tsx`: uses `useTimer`, shows Start button when idle or live elapsed + Stop button when running; calls `insertLogEntry` with `value = Math.floor(elapsedMs / 60000)` and `sessionStartAt` on stop
- [x] T0xx [US3] Update `MetricCard` in `src/components/MetricCard/MetricCard.tsx` to render `TimerControl` in place of the increment button when `metric.type === 'timed'`
- [x] T0xx [US3] Update `insertLogEntry` in `src/services/logEntries.ts` to accept and persist `sessionStartAt?: string` (already in schema; wire it through)

**Checkpoint**: Timer starts, survives background, elapsed shown live on foreground, Stop adds correct minutes to period total.

---

## Phase 6: User Story 4 — Average Value Tracking (Priority: P4)

**Goal**: User submits a 1–5 rating for an average metric; the displayed value updates to the running mean of all entries in the current period. Empty period shows "—".

**Independent Test**: Create one average metric. Submit value 4. Verify display shows 4.0. Submit value 2. Verify display updates to 3.0. Delete all log entries and verify display shows "—".

- [x] T0xx [P] [US4] Implement `AverageInput` component in `src/components/AverageInput/AverageInput.tsx`: row of 5 tappable buttons (1–2–3–4–5), highlights selected value, submit button calls `insertLogEntry` with the selected integer; rejects values outside 1–5
- [x] T0xx [US4] Update `MetricCard` in `src/components/MetricCard/MetricCard.tsx` to render `AverageInput` in place of the increment button when `metric.type === 'average'`
- [x] T0xx [US4] Update `usePeriodValue` in `src/hooks/usePeriodValue.ts` to display `null` (rendered as "—") when `metric.type === 'average'` and no entries exist in the current period (verify `computeMean([])` returns null)

**Checkpoint**: All three metric types render correctly on the dashboard. Average metric shows "—" when empty and correct mean when entries exist.

---

## Phase 7: User Story 5 — Offline Usage (Priority: P5)

**Goal**: User increments any metric while offline; local value updates immediately; all actions sync automatically when connectivity returns with no duplicate or missing log entries.

**Independent Test**: Enable airplane mode. Increment a cumulative metric 3 times, stop a timed session. Verify local counts update immediately and an offline indicator is visible. Restore connectivity. Within 10 seconds verify all 4 log entries appear in Supabase with no duplicates.

- [x] T0xx [US5] Implement MMKV-backed offline queue in `src/store/offlineQueue.ts`: Zustand store backed by MMKV; `PendingLogEntry[]` array; actions: `enqueue(entry)`, `dequeueAll()`, `peek()`
- [x] T0xx [US5] Implement sync queue service in `src/services/syncQueue.ts`: iterates `offlineQueue.dequeueAll()`, uploads each entry via Supabase `upsert` with `ON CONFLICT (id) DO NOTHING` (see `contracts/query-patterns.md` pattern 5), re-enqueues on network failure
- [x] T0xx [US5] Implement `useNetworkSync` hook in `src/hooks/useNetworkSync.ts`: subscribes to `@react-native-community/netinfo`; on `isConnected` transition to `true`, calls `syncQueue.drain()`; exports `isOnline: boolean`
- [x] T0xx [US5] Update `insertLogEntry` in `src/services/logEntries.ts`: check `isConnected` via NetInfo; if offline, call `offlineQueue.enqueue(entry)` and apply optimistic update to TanStack Query cache; if online, insert directly then also clear any matching entry from queue
- [x] T0xx [P] [US5] Implement `OfflineBanner` component in `src/components/OfflineBanner/OfflineBanner.tsx`: uses `useNetworkSync`, renders a visible banner (e.g., "Offline — changes will sync automatically") when `!isOnline`
- [x] T0xx [US5] Mount `useNetworkSync` and render `OfflineBanner` at the top of `DashboardScreen` in `src/screens/DashboardScreen/DashboardScreen.tsx`

**Checkpoint**: All five user stories functional. Offline increments queue, banner shows, sync drains queue on reconnect, no duplicates in Supabase.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Hardening and UX improvements that span multiple user stories.

- [x] T0xx [P] Add loading skeleton (or ActivityIndicator) to `DashboardScreen` while `useMetrics` is loading in `src/screens/DashboardScreen/DashboardScreen.tsx`
- [x] T0xx [P] Add empty state UI to `DashboardScreen` when user has no metrics ("Track your first habit — tap + to add a metric") in `src/screens/DashboardScreen/DashboardScreen.tsx`
- [x] T0xx [P] Add non-empty validation to metric name field in `AddMetricScreen` (disable submit button, show inline error) in `src/screens/AddMetricScreen/AddMetricScreen.tsx`
- [x] T0xx [P] Show a pending indicator on `MetricCard` while an increment is optimistically in-flight (e.g., dim the value or show a spinner on the button) in `src/components/MetricCard/MetricCard.tsx`
- [x] T0xx Add global error handler in `App.tsx`: catch Supabase errors, show user-friendly toast or alert (no raw error strings exposed to user)
- [x] T0xx Run through quickstart.md end-to-end: verify all 6 success criteria from spec.md are measurably met

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — **BLOCKS all user stories**
- **Phase 3 (US1)**: Depends on Phase 2 — first user story to implement
- **Phase 4 (US2)**: Depends on Phase 2 — can start immediately after Phase 2 (shares no files with US1 except metrics.ts service)
- **Phase 5 (US3)**: Depends on Phase 3 (shares MetricCard, logEntries.ts)
- **Phase 6 (US4)**: Depends on Phase 3 (shares MetricCard, usePeriodValue)
- **Phase 7 (US5)**: Depends on Phase 3 (wraps logEntries.ts)
- **Phase 8 (Polish)**: Depends on all desired user stories complete

### User Story Dependencies

| Story | Depends On | Reason |
|-------|------------|--------|
| US1 (P1) | Phase 2 only | Foundation of the app |
| US2 (P2) | Phase 2 only | Separate screen, shares metrics.ts |
| US3 (P3) | US1 | Extends MetricCard and logEntries.ts |
| US4 (P4) | US1 | Extends MetricCard and usePeriodValue |
| US5 (P5) | US1 | Wraps logEntries.ts with queue logic |

### Within Each User Story

- Utilities and types before hooks
- Hooks before components
- Components before screens
- Screens before App.tsx wiring

---

## Parallel Opportunities

### Phase 1 — can run together
```
T003 (tsconfig) + T004 (ESLint) + T005 (.env files) — all different config files
```

### Phase 2 — can run together after T007/T008
```
T009 (types) + T010 (QueryClient) — different files
```

### Phase 3 (US1) — can run together after T014/T015
```
T012 (periods.ts) + T013 (averageCalc.ts)   — different utils
T016 (usePeriodValue) + T017 (useMetrics)   — different hooks
```

### Phase 5 (US3) — can run together
```
T027 (TimerControl component) — independently of T025/T026 if props interface agreed
```

### Phase 7 (US5) — can run together after T035
```
T037 (OfflineBanner component) — independently of T033-T036
```

### Phase 8 (Polish) — all [P] tasks run together
```
T039 + T040 + T041 + T042 — different components/screens
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1 (T012–T020)
4. **STOP and VALIDATE**: Create a metric in Supabase, open app, increment it, verify log entry created
5. Ship or demo MVP

### Incremental Delivery

1. Setup + Foundational → app boots with Supabase session
2. **+US1** → view and increment metrics (MVP)
3. **+US2** → create metrics in-app (fully self-contained)
4. **+US3** → timed sessions
5. **+US4** → average tracking (all three types complete)
6. **+US5** → offline resilience
7. Polish → production-ready

### Parallel Execution (Solo Developer)

Given the story dependency chain (US3/US4/US5 all build on US1), the recommended order is strictly sequential: US1 → US2 → US3 → US4 → US5. US2 can be interleaved with US3 since they touch different files.

---

## Notes

- `[P]` tasks operate on different files — safe to hand to parallel agents
- `[Story]` label maps each task to the user story it satisfies for traceability
- Each phase ends with a **Checkpoint** — validate independently before proceeding
- All log entry IDs are client-assigned UUIDs (see research.md Decision 6)
- Never store `current_value` — always derive from log entries (see research.md Decision 3)
- Timer uses absolute `startedAt` timestamp, not a running counter (see research.md Decision 2)
