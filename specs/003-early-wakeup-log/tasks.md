# Tasks: Early Wakeup Log

**Input**: Design documents from `specs/003-early-wakeup-log/`
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ quickstart.md ✅

**Tests**: Not requested — no test tasks generated.

**Organization**: Tasks grouped by user story. US1 is independently deliverable as MVP. All changes land in `src/services/healthSync.ts` and `src/hooks/useHealthSync.ts`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files or fully independent within same file)
- **[Story]**: Maps to user story from spec.md (US1, US2, US3)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core scaffold that all user stories depend on — new constants, types, and HealthKit sleep primitives.

**⚠️ CRITICAL**: Phases 3–5 cannot begin until this phase is complete.

- [x] T001 Add `AppleHealthKit.Constants.Permissions.SleepAnalysis` to the `read` array in `requestHealthPermission()` in `src/services/healthSync.ts` alongside the existing `Workout` permission, so a single `initHealthKit` call covers both data types
- [x] T002 [P] Add constants `const SLEEP_LAST_SYNC_KEY = 'sleep:last_sync_at'` and `const EARLY_WAKEUP_METRIC_ID = '1b0558fb-9594-41db-bb2e-bb0f0621b8fc'` in `src/services/healthSync.ts` at the top-level constant block alongside `LAST_SYNC_KEY` and `RUNNING_METRIC_ID`
- [x] T003 [P] Add internal `interface RawSleepSample { id: string; value: string; startDate: string; endDate: string }` and `interface SleepSession { id: string; wakeTime: Date; sessionStart: Date; durationMinutes: number }` in `src/services/healthSync.ts` alongside the existing `HealthWorkout` interface
- [x] T004 Implement `querySleepRawSamples(since: Date): Promise<RawSleepSample[]>` in `src/services/healthSync.ts` — calls `AppleHealthKit.getSleepSamples({ startDate: since.toISOString(), endDate: new Date().toISOString(), ascending: true })`, casts each result to `RawSleepSample` (the library's TypeScript type declares `value: number` but native code returns a string — use `r as unknown as RawSleepSample`), filters to entries where `value` is one of `['ASLEEP', 'CORE', 'DEEP', 'REM']`, rejects with a typed Error on callback error
- [x] T005 Implement `groupIntoSessions(samples: RawSleepSample[]): SleepSession[]` in `src/services/healthSync.ts` — pure function, no I/O; iterates `samples` (pre-sorted ascending by startDate); starts a new session group when `new Date(sample.startDate).getTime() - maxEndMs > 2 * 60 * 60 * 1000` (2-hour gap); for each completed group computes: `id` = `id` of the sample with the greatest `endDate`; `wakeTime` = `new Date(maxEndDate)`; `sessionStart` = `new Date(minStartDate)`; `durationMinutes` = sum of `(endDate - startDate) / 60000` across all samples in the group

**Checkpoint**: Foundational scaffold ready — user story phases can now proceed.

---

## Phase 3: User Story 1 — Automatic Early Wakeup Logging (Priority: P1) 🎯 MVP

**Goal**: On every app foreground event, qualifying sleep sessions (≥4h, ending before 10am, ending before 7am) automatically produce a log entry with value `1` against the Early Wakeup metric.

**Independent Test**: Add a qualifying sleep session in Apple Health (e.g. 10pm–6:30am) → open the app → confirm one entry appears for the Early Wakeup metric. Add a session ending at 7:30am → confirm no entry is created.

- [x] T006 [US1] Implement `syncSleepSessions(): Promise<void>` in `src/services/healthSync.ts`:
  - Guard: `if (isLocalMode) return`
  - Call `requestHealthPermission()`, return silently on `false`
  - Read `SLEEP_LAST_SYNC_KEY` from `storage` (default: 90 days ago)
  - `logger.info('Sleep sync started', { since: checkpoint.toISOString() })`
  - `querySleepRawSamples(checkpoint)` → `groupIntoSessions()`
  - Filter sessions: `durationMinutes >= 240 AND wakeTime.getHours() < 10`
  - For each qualifying session where `wakeTime.getHours() < 7`: call `insertLogEntry({ id: session.id, metricId: EARLY_WAKEUP_METRIC_ID, value: 1, loggedAt: session.wakeTime, sessionStartAt: session.sessionStart.toISOString() })`, increment `submitted` or `queued` counter
  - After loop: advance `SLEEP_LAST_SYNC_KEY` to `session.wakeTime.toISOString()` of the **last qualifying session processed** (only if at least one qualifying session exists; also advance past non-qualifying sessions that fall before 10am to avoid re-reading already-seen data — use the wakeTime of the last session with `wakeTime.getHours() < 10` as the new checkpoint)
  - `logger.info('Sleep sync complete', { sessions: qualifying.length, submitted, queued })`
- [x] T007 [US1] Update `useHealthSync()` in `src/hooks/useHealthSync.ts` — replace the sequential `syncRunningWorkouts()` calls with `Promise.all([syncRunningWorkouts(), syncSleepSessions()])` on both mount and foreground events; import `syncSleepSessions` from `../services/healthSync`

**Checkpoint**: User Story 1 complete — open the app after a qualifying sleep and the entry auto-appears.

---

## Phase 4: User Story 2 — Manual Resync (Priority: P2)

**Goal**: Settings → "Sync Apple Health Metrics" correctly rebuilds Early Wakeup entries for the current period alongside running entries, dispatching to the correct data source per metric.

**Independent Test**: Log an early wakeup auto-sync → edit the sleep session end time in Apple Health to 7:15am → tap "Sync Apple Health Metrics" in Settings → confirm the entry is removed.

- [x] T008 [US2] Refactor `resyncAppleHealthMetrics()` in `src/services/healthSync.ts` — extract a `syncEntriesForMetric(metricId: string, since: Date): Promise<Array<{ id: string; value: number; loggedAt: Date; sessionStartAt: string }>>` helper function that:
  - If `metricId === RUNNING_METRIC_ID`: calls `queryRunningWorkouts(since)` and maps each to `{ id, value: distanceKm, loggedAt: endDate, sessionStartAt: startDate.toISOString() }`
  - If `metricId === EARLY_WAKEUP_METRIC_ID`: calls `querySleepRawSamples(since)` → `groupIntoSessions()`, filters `durationMinutes >= 240 AND wakeTime.getHours() < 10 AND wakeTime.getHours() < 7`, maps each to `{ id, value: 1, loggedAt: wakeTime, sessionStartAt: sessionStart.toISOString() }`
  - Otherwise: `logger.info('Unknown apple_health metric — skipping resync', { metricId })` and returns `[]`
  - Replace the current `queryRunningWorkouts` call in `resyncAppleHealthMetrics` with `syncEntriesForMetric(metric.id, start)`, also reset the appropriate checkpoint key (`LAST_SYNC_KEY` for running, `SLEEP_LAST_SYNC_KEY` for sleep) to `start.toISOString()` after the resync loop for each metric

**Checkpoint**: User Story 2 complete — Settings resync rebuilds both metric types correctly.

---

## Phase 5: User Story 3 — Permission Handling (Priority: P3)

**Goal**: Sleep permission denial is silent — no error shown, no other feature disrupted.

**Independent Test**: Clear Apple Health permissions in iOS Settings → open the app → deny Sleep Analysis → confirm no error dialog appears and the metrics/log entries screens work normally.

- [x] T009 [US3] Confirm `isLocalMode` guard is the very first statement in `syncSleepSessions()` in `src/services/healthSync.ts` (before any HealthKit call); confirm the `false` branch of `requestHealthPermission()` logs `'Health permission denied — sync disabled'` and returns without throwing (covers both workout and sleep); verify no `Alert.alert()` or visible error appears anywhere in the sleep sync call chain; verify `syncSleepSessions` can be called in isolation and produces no side-effects when either guard triggers

**Checkpoint**: User Story 3 complete — app degrades silently on permission denial.

---

## Final Phase: Polish & Cross-Cutting Concerns

- [x] T010 [P] Review checkpoint advancement logic in `syncSleepSessions()` in `src/services/healthSync.ts` — confirm `SLEEP_LAST_SYNC_KEY` is advanced after the loop regardless of online/offline state (offline entries are queued by `insertLogEntry` and submitted later; `ignoreDuplicates: true` on the upsert prevents double-counting); confirm both `LAST_SYNC_KEY` (running) and `SLEEP_LAST_SYNC_KEY` (sleep) are reset correctly in `resyncAppleHealthMetrics()` for their respective metric IDs
- [ ] T011 Run `npm run xcode` to confirm the native build succeeds; install on a physical device and complete the quickstart.md manual test: add a qualifying sleep session (≥4h, end before 7am), open the app, confirm the Early Wakeup metric shows one entry for that session

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 2)**: No external dependencies — start immediately; T002 and T003 are parallel; T001 then T004 then T005 sequentially
- **User Stories (Phase 3–5)**: All depend on Phase 2 completion; can proceed sequentially by story or concurrently
- **Polish (Final)**: Depends on all user story phases complete

### User Story Dependencies

- **US1 (P1)**: Depends only on Phase 2 — T006 depends on T004+T005; T007 depends on T006
- **US2 (P2)**: Depends on T006 (syncEntriesForMetric uses functions defined there) — verify after US1
- **US3 (P3)**: T009 verifies T006 and T001 — confirm after US1

### Within Phase 2

```
T001 → (T002 parallel with T003) → T004 → T005
```

### Within User Story 1

```
T005 → T006 → T007
```

### Parallel Opportunities

```bash
# Phase 2 — run in parallel after T001:
Task T002: "Add SLEEP_LAST_SYNC_KEY and EARLY_WAKEUP_METRIC_ID constants"
Task T003: "Add RawSleepSample and SleepSession interfaces"

# Final Phase — run in parallel:
Task T010: "Verify checkpoint advancement and resync correctness"
Task T011: "npm run xcode + device test"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: Foundational (T001 → T002/T003 → T004 → T005)
2. Complete Phase 3: User Story 1 (T006 → T007)
3. **STOP and VALIDATE**: Add test sleep data in Apple Health, open app, confirm entry appears
4. Deploy to device via `npm run xcode`

### Incremental Delivery

1. Foundational → HealthKit sleep query wired, session grouping ready
2. US1 → Automatic early wakeup logging on foreground (MVP)
3. US2 → Settings resync correctly handles both running and sleep metrics
4. US3 → Permission lifecycle verified
5. Polish → Checkpoint logic confirmed, build validated

---

## Notes

- `react-native-health` and HealthKit entitlement are already in place — no `npm install` or `app.json` changes needed
- The library's TypeScript type declares `HealthValue.value` as `number`, but the native `getSleepSamples` implementation returns a string ("ASLEEP", "CORE", etc.) — cast via `r as unknown as RawSleepSample` in T004
- `groupIntoSessions` is a pure function with no async I/O — it should be straightforward to reason about and manually verify with test data
- Checkpoint advancement in `syncSleepSessions` (T006) advances past all sessions with `wakeTime.getHours() < 10` — not just qualifying (< 7am) ones — to avoid re-reading sessions that will never qualify on subsequent syncs
- `resyncAppleHealthMetrics` (T008) resets `SLEEP_LAST_SYNC_KEY` to `start.toISOString()` (period start) so background sync resumes from the correct point after a manual resync
