# Tasks: Mindful Minutes Sync

**Input**: Design documents from `specs/004-mindful-minutes-sync/`
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ quickstart.md ✅

**Tests**: Not requested — no test tasks generated.

**Organization**: Tasks grouped by user story. US1 is independently deliverable as MVP. All changes land in `src/services/healthSync.ts` and `src/hooks/useHealthSync.ts`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files or fully independent within same file)
- **[Story]**: Maps to user story from spec.md (US1, US2, US3)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core scaffold that all user stories depend on — new constants, type, and HealthKit query primitive.

**⚠️ CRITICAL**: Phases 3–5 cannot begin until this phase is complete.

- [x] T001 Add `AppleHealthKit.Constants.Permissions.MindfulSession` to the `read` array in `requestHealthPermission()` in `src/services/healthSync.ts` alongside the existing `Workout` and `SleepAnalysis` permissions, so the single `initHealthKit` call covers all three data types
- [x] T002 [P] Add constants `const MINDFUL_LAST_SYNC_KEY = 'mindful:last_sync_at'` and `const MINDFUL_METRIC_ID = '5dab6c51-bd6c-4a14-9047-cb588889dd7b'` in `src/services/healthSync.ts` at the top-level constant block alongside `LAST_SYNC_KEY`, `SLEEP_LAST_SYNC_KEY`, `RUNNING_METRIC_ID`, and `EARLY_WAKEUP_METRIC_ID`
- [x] T003 [P] Add internal `interface RawMindfulSample { startDate: string; endDate: string }` in `src/services/healthSync.ts` alongside the existing `HealthWorkout`, `RawSleepSample`, and `SleepSession` interfaces — note: the native `getMindfulSession` API does NOT return `id` or `value` fields
- [x] T004 Implement `queryMindfulSessions(since: Date): Promise<RawMindfulSample[]>` in `src/services/healthSync.ts` — calls `AppleHealthKit.getMindfulSession({ startDate: since.toISOString(), endDate: new Date().toISOString() })`, casts results via `results as unknown as RawMindfulSample[]` (the TS type declares `id?` and `value` on `HealthValue` but the native code returns neither), sorts ascending by `startDate` in JS (the native implementation always returns descending regardless of the `ascending` option), rejects with a typed Error on callback error

**Checkpoint**: Foundational scaffold ready — user story phases can now proceed.

---

## Phase 3: User Story 1 — Automatic Mindful Minutes Logging (Priority: P1) 🎯 MVP

**Goal**: On every app foreground event, each mindful session since the last checkpoint automatically produces one log entry with value equal to the session's duration in whole minutes against the Mindful Minutes metric.

**Independent Test**: Add a 10-minute mindful session in the Health app → open the Tracker app → confirm one log entry appears for the Mindful Minutes metric with value `10`. Add a session under 1 minute → confirm no entry is created.

- [x] T005 [US1] Implement `syncMindfulMinutes(): Promise<void>` in `src/services/healthSync.ts`:
  - Guard: `if (isLocalMode) return`
  - Call `requestHealthPermission()`, return silently on `false`
  - Read `MINDFUL_LAST_SYNC_KEY` from `storage` (default: 90 days ago via `new Date(Date.now() - NINETY_DAYS_MS)`)
  - `logger.info('Mindful sync started', { since: checkpoint.toISOString() })`
  - `queryMindfulSessions(checkpoint)` → filter: `Math.round((new Date(s.endDate).getTime() - new Date(s.startDate).getTime()) / 60000) >= 1`
  - For each qualifying session: compute `durationMinutes = Math.round((new Date(session.endDate).getTime() - new Date(session.startDate).getTime()) / 60000)`; call `insertLogEntry({ id: session.startDate, metricId: MINDFUL_METRIC_ID, value: durationMinutes, loggedAt: new Date(session.endDate), sessionStartAt: session.startDate })`, increment `submitted` or `queued` counter
  - After loop (if qualifying.length > 0): advance `MINDFUL_LAST_SYNC_KEY` to `qualifying[qualifying.length - 1].endDate`
  - `logger.info('Mindful sync complete', { sessions: qualifying.length, submitted, queued })`
- [x] T006 [US1] Update `useHealthSync()` in `src/hooks/useHealthSync.ts` — add `syncMindfulMinutes` to the `Promise.all` call: `Promise.all([syncRunningWorkouts(), syncSleepSessions(), syncMindfulMinutes()])`; import `syncMindfulMinutes` from `'../services/healthSync'`

**Checkpoint**: User Story 1 complete — open the app after a mindful session and the entry auto-appears with the correct minute value.

---

## Phase 4: User Story 2 — Manual Resync (Priority: P2)

**Goal**: Settings → "Sync Apple Health Metrics" correctly rebuilds Mindful Minutes entries for the current period, alongside running and sleep entries.

**Independent Test**: Log a 10-minute session auto-sync → edit the session in Health to 8 minutes → tap "Sync Apple Health Metrics" in Settings → confirm the entry now shows value `8`.

- [x] T007 [US2] Extend `syncEntriesForMetric(metricId: string, since: Date)` in `src/services/healthSync.ts` — add a third branch for `MINDFUL_METRIC_ID` after the existing `EARLY_WAKEUP_METRIC_ID` branch:
  - `if (metricId === MINDFUL_METRIC_ID)`: call `queryMindfulSessions(since)`, filter sessions where `Math.round((endDate - startDate) / 60000) >= 1`, map each to `{ id: s.startDate, value: Math.round((new Date(s.endDate).getTime() - new Date(s.startDate).getTime()) / 60000), loggedAt: new Date(s.endDate), sessionStartAt: s.startDate }`, and return the array
- [x] T008 [US2] Update `resyncAppleHealthMetrics()` in `src/services/healthSync.ts` — extend the checkpoint key resolution block after the resync loop for each metric: when `metric.id === MINDFUL_METRIC_ID`, reset `MINDFUL_LAST_SYNC_KEY` to `start.toISOString()` (so background sync resumes from the correct period start after a manual resync); the existing pattern already handles `RUNNING_METRIC_ID` → `LAST_SYNC_KEY` and all others → `SLEEP_LAST_SYNC_KEY` — replace that fallback with explicit checks for all three metric IDs

**Checkpoint**: User Story 2 complete — Settings resync rebuilds all three metric types correctly.

---

## Phase 5: User Story 3 — Permission Handling (Priority: P3)

**Goal**: MindfulSession permission denial is silent — no error shown, no other feature disrupted.

**Independent Test**: Clear Apple Health permissions in iOS Settings → open the app → deny Mindful Minutes → confirm no error dialog appears and other metric screens work normally.

- [x] T009 [US3] Confirm `isLocalMode` guard is the very first statement in `syncMindfulMinutes()` in `src/services/healthSync.ts` (before any HealthKit call); confirm the `false` branch of `requestHealthPermission()` logs `'Health permission denied — sync disabled'` and returns without throwing (covers workout, sleep, and mindful); verify no `Alert.alert()` or visible error appears anywhere in the mindful sync call chain; verify `syncMindfulMinutes` can be called in isolation and produces no side-effects when either guard triggers

**Checkpoint**: User Story 3 complete — app degrades silently on permission denial.

---

## Final Phase: Polish & Cross-Cutting Concerns

- [x] T010 [P] Review checkpoint advancement logic in `syncMindfulMinutes()` in `src/services/healthSync.ts` — confirm `MINDFUL_LAST_SYNC_KEY` is only advanced when `qualifying.length > 0` (guarded by the early return), confirm it is set to `qualifying[qualifying.length - 1].endDate` (string, not Date), confirm the dedup key `session.startDate` passed as `id` to `insertLogEntry` is the raw ISO string from HealthKit; confirm `MINDFUL_LAST_SYNC_KEY` is reset to `start.toISOString()` (not `SLEEP_LAST_SYNC_KEY`) in `resyncAppleHealthMetrics()` for the mindful metric
- [ ] T011 Run `npm run xcode` to confirm the native build succeeds; install on a physical device and complete the quickstart.md manual test: add a 10-minute mindful session in the Health app, open the Tracker app, confirm the Mindful Minutes metric shows one entry with value `10`; add a second session of 5 minutes, background and foreground the app, confirm a second entry with value `5` appears and no duplicate of the first

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 2)**: No external dependencies — start immediately; T002 and T003 are parallel; T001 then T004 sequentially
- **User Stories (Phase 3–5)**: All depend on Phase 2 completion; can proceed sequentially by story
- **Polish (Final)**: Depends on all user story phases complete

### User Story Dependencies

- **US1 (P1)**: Depends only on Phase 2 — T005 depends on T004; T006 depends on T005
- **US2 (P2)**: Depends on T004 (`queryMindfulSessions` used in `syncEntriesForMetric`) — verify after US1
- **US3 (P3)**: T009 verifies T005 and T001 — confirm after US1

### Within Phase 2

```
T001 → (T002 parallel with T003) → T004
```

### Within User Story 1

```
T004 → T005 → T006
```

### Parallel Opportunities

```bash
# Phase 2 — run in parallel after T001:
Task T002: "Add MINDFUL_LAST_SYNC_KEY and MINDFUL_METRIC_ID constants"
Task T003: "Add RawMindfulSample interface"

# Final Phase — run in parallel:
Task T010: "Verify checkpoint advancement and resync correctness"
Task T011: "npm run xcode + device test"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: Foundational (T001 → T002/T003 → T004)
2. Complete Phase 3: User Story 1 (T005 → T006)
3. **STOP and VALIDATE**: Add a 10-minute mindful session in Health, open app, confirm entry appears with value `10`
4. Deploy to device via `npm run xcode`

### Incremental Delivery

1. Foundational → HealthKit mindful query wired, permission expanded
2. US1 → Automatic per-session minute logging on foreground (MVP)
3. US2 → Settings resync correctly handles all three metric types
4. US3 → Permission lifecycle verified
5. Polish → Checkpoint logic confirmed, build validated

---

## Notes

- `react-native-health` and HealthKit entitlement are already in place — no `npm install` or `app.json` changes needed
- The native `getMindfulSession` implementation omits `id` and `value` from its response despite the TS type declaring them — use `startDate` as the dedup key and compute duration from `endDate − startDate`
- The native implementation always sorts by `endDate DESC` and ignores the `ascending` option — sort ascending in JS inside `queryMindfulSessions`
- Checkpoint advancement (T005) uses `last.endDate` as a raw string (already ISO from HealthKit) — no `.toISOString()` conversion needed; compare this to the sleep checkpoint which uses `.toISOString()` because `wakeTime` is a `Date` object
- `resyncAppleHealthMetrics` (T008) resets `MINDFUL_LAST_SYNC_KEY` to `start.toISOString()` (period start) so background sync resumes from the correct point after a manual resync
