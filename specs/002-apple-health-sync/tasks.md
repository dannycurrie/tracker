# Tasks: Apple Health Running Sync

**Input**: Design documents from `specs/002-apple-health-sync/`
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ quickstart.md ✅

**Tests**: Not requested — no test tasks generated.

**Organization**: Tasks grouped by user story. US1 is independently deliverable as MVP.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no incomplete-task dependencies)
- **[Story]**: Maps to user story from spec.md (US1, US2, US3)

---

## Phase 1: Setup

**Purpose**: Install the HealthKit library and configure native permissions.

- [x] T001 Add `react-native-health` to `dependencies` in `package.json`
- [x] T002 [P] Add HealthKit entitlement (`com.apple.developer.healthkit: true`) and `NSHealthShareUsageDescription` string to `app.json` under `expo.ios.entitlements` and `expo.ios.infoPlist`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core scaffold that all user stories depend on.

**⚠️ CRITICAL**: Phases 3–5 cannot begin until this phase is complete.

- [x] T003 Create `src/services/healthSync.ts` — initialise a MMKV storage instance via `createKV('health-sync')`, declare key constants `LAST_SYNC_KEY = 'health:last_sync_at'` and `RUNNING_METRIC_ID_KEY = 'health:running_metric_id'`, and define the `HealthWorkout` internal type `{ id: string; distanceKm: number; startDate: Date; endDate: Date }`
- [x] T004 Implement `requestHealthPermission(): Promise<boolean>` in `src/services/healthSync.ts` — calls `AppleHealthKit.initHealthKit` with `{ permissions: { read: [AppleHealthKit.Constants.Permissions.Workout] } }`, returns `true` on success and `false` on any error or denial without throwing

**Checkpoint**: Foundational scaffold ready — user story phases can now proceed.

---

## Phase 3: User Story 1 — Sync Running Workouts on App Open (Priority: P1) 🎯 MVP

**Goal**: On foreground, new running workouts from Apple Health appear as individual log entries against a cumulative running distance metric, with no user input required.

**Independent Test**: Add a test run to Apple Health → open the app → confirm a new log entry appears for the correct distance against the Running Distance metric.

- [x] T005 [US1] Implement `resolveRunningMetricId(): Promise<string>` in `src/services/healthSync.ts` — reads cached ID from MMKV (`RUNNING_METRIC_ID_KEY`); on cache miss calls `fetchUserMetrics()` and finds a metric with name `'Running Distance'` (case-insensitive); if none found calls `createMetric('Running Distance', 'cumulative', 'weekly')`; writes resolved ID to MMKV before returning
- [x] T006 [US1] Implement `syncRunningWorkouts(): Promise<void>` in `src/services/healthSync.ts` — reads `LAST_SYNC_KEY` from MMKV (defaulting to 90 days ago on `null`); calls `requestHealthPermission()` and returns silently on `false`; queries HealthKit for running workouts (`type: 'Running'`, `unit: 'km'`, `ascending: true`) since the checkpoint; filters out entries where `distanceKm < 0.001`; calls `resolveRunningMetricId()`; for each workout calls `insertLogEntry({ id: workout.id, metricId, value: workout.distanceKm, loggedAt: workout.endDate, sessionStartAt: workout.startDate.toISOString() })`; after all insertions advances `LAST_SYNC_KEY` to the `endDate` of the final workout
- [x] T007 [US1] Create `src/hooks/useHealthSync.ts` — on mount calls `syncRunningWorkouts()`; subscribes to `AppState.addEventListener('change', handler)` where `handler` calls `syncRunningWorkouts()` when the next state is `'active'`; removes the listener on unmount via the subscription's `remove()` method
- [x] T008 [US1] Call `useHealthSync()` in `App.tsx` inside the `App` function body, after the `if (!sessionReady) return null` guard, so sync fires on every foreground event once the app is ready

**Checkpoint**: User Story 1 complete — core sync is independently functional.

---

## Phase 4: User Story 2 — Offline Sync Queue (Priority: P2)

**Goal**: Running workouts detected while the device is offline are queued locally and automatically submitted when connectivity returns, without user intervention.

**Independent Test**: Enable airplane mode → open app after a workout → re-enable connectivity → confirm the entry appears in the log within 10 seconds.

- [x] T009 [US2] Review checkpoint advancement logic in `syncRunningWorkouts()` in `src/services/healthSync.ts` — confirm `LAST_SYNC_KEY` is advanced after all workouts are processed regardless of online/offline state (the existing `insertLogEntry` upsert with `ignoreDuplicates: true` ensures any queued entry that is later re-attempted does not duplicate); add `logger.info('Health sync complete', { total, queued, submitted })` after the loop to surface offline counts in BetterStack logs

**Checkpoint**: User Story 2 complete — offline path confirmed resilient; no re-processing of queued workouts.

---

## Phase 5: User Story 3 — Health Permission Request (Priority: P3)

**Goal**: The app requests HealthKit permission on first use, and silently disables syncing if denied, with no impact on the rest of the app.

**Independent Test**: Clear Health permissions for the app in iOS Settings → open app → confirm the permission prompt appears; deny → confirm no error is shown and the rest of the app (metrics, log entries) functions normally.

- [x] T010 [US3] Add `isLocalMode` guard at the very top of `syncRunningWorkouts()` in `src/services/healthSync.ts` — `if (isLocalMode) return;` — so the function is a no-op in local mode and Expo Go where HealthKit is unavailable (consistent with the pattern used throughout the codebase)
- [x] T011 [US3] Add `logger.info('Health permission denied — sync disabled')` in the denial branch of `requestHealthPermission()` in `src/services/healthSync.ts`; confirm no `Alert` or user-visible error is raised anywhere in the sync flow on permission denial; verify app navigation and other features remain unaffected

**Checkpoint**: User Story 3 complete — permission lifecycle fully handled; app degrades silently.

---

## Final Phase: Polish & Cross-Cutting Concerns

- [x] T012 [P] Add `logger.info('Health sync started', { since: checkpointDate.toISOString() })` at the start of the sync body in `src/services/healthSync.ts` (after permission check passes) so each sync run is traceable in BetterStack with its lookback window
- [ ] T013 Run `npm run xcode` to confirm the native build succeeds with the HealthKit entitlement applied; install on a physical device and complete the quickstart.md manual test

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately; T001 and T002 are parallel
- **Foundational (Phase 2)**: Depends on Phase 1 completion — blocks all user stories; T003 before T004
- **User Stories (Phase 3–5)**: All depend on Phase 2 completion; can proceed sequentially or in parallel across stories
- **Polish (Final)**: Depends on all user story phases complete

### User Story Dependencies

- **US1 (P1)**: Depends only on Phase 2 — no dependency on US2 or US3
- **US2 (P2)**: Depends on T006 (checkpoint logic exists before confirming it) — verify after US1
- **US3 (P3)**: T010 depends on T006 existing; T011 depends on T004 existing — both can follow US1

### Within User Story 1

```
T003 → T004 → T005 → T006 → T007 → T008
                ↑           
          (metric query)    
```

### Parallel Opportunities

```bash
# Phase 1 — run together:
Task T001: "Add react-native-health to package.json"
Task T002: "Configure HealthKit in app.json"

# US1 — sequential within the story (each depends on previous):
T005 (metric resolver) → T006 (sync function uses it) → T007 (hook calls sync) → T008 (App mounts hook)

# Final Phase — run together:
Task T012: "Add sync-start logging to healthSync.ts"
Task T013: "Build and device-test"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1 (T005 → T006 → T007 → T008)
4. **STOP and VALIDATE**: Add a test run in Apple Health, open app, confirm entry appears
5. Deploy to device via `npm run xcode`

### Incremental Delivery

1. Setup + Foundational → HealthKit wired, permission function ready
2. US1 → Core sync working on device (MVP)
3. US2 → Offline resilience confirmed
4. US3 → Permission lifecycle polished
5. Polish → Logging complete, build verified

---

## Notes

- `react-native-health` requires a physical device or a HealthKit-enabled simulator for end-to-end testing
- The `isLocalMode` guard (T010) must be added before any other sync logic to prevent HealthKit calls in Expo Go
- Checkpoint advancement (T006/T009) should always happen after the loop, regardless of connectivity — the UUID-based upsert handles idempotency
- `useHealthSync` should be mounted unconditionally (not inside a `useEffect` dependency on auth state) — the `isLocalMode` guard inside the service is the correct gate
