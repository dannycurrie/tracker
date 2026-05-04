# Feature Specification: Early Wakeup Log

**Feature Branch**: `003-early-wakeup-log`
**Created**: 2026-05-04
**Status**: Draft
**Input**: User description: "Using Apple Health sleep data, log to an apple health metric with ID 1b0558fb-9594-41db-bb2e-bb0f0621b8fc every time the user's wake up time (ending sleep after 4+ hours, before 10am) is before 7am"

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Automatic Early Wakeup Logging (Priority: P1)

Every time the user ends a qualifying overnight sleep session before 7:00am, the app automatically logs one entry to their Early Wakeup metric — no user action required. The user can open the app at any time after waking and see today's early wakeup recorded, along with their weekly streak.

**Why this priority**: This is the entire feature. All other stories are delivery details.

**Independent Test**: Add a qualifying sleep session to Apple Health (4+ hours, ending at 6:45am), open the app, and confirm one entry appears in the Early Wakeup metric for that day.

**Acceptance Scenarios**:

1. **Given** a completed sleep session of 5 hours ending at 6:30am, **When** the app opens or comes to the foreground, **Then** one log entry is created for the Early Wakeup metric
2. **Given** a completed sleep session of 5 hours ending at 7:30am, **When** the app foregrounds, **Then** no log entry is created (wakeup is not before 7am)
3. **Given** a completed sleep session of 3 hours ending at 6:30am, **When** the app foregrounds, **Then** no log entry is created (session is under 4 hours — not an overnight sleep)
4. **Given** a completed sleep session of 5 hours ending at 10:30am, **When** the app foregrounds, **Then** no log entry is created (wakeup is after 10am — not a morning wakeup)
5. **Given** the same qualifying sleep session synced twice, **Then** only one log entry exists (deduplication by session ID)

---

### User Story 2 — Manual Resync (Priority: P2)

The user can trigger a full resync of Early Wakeup data from the Settings screen. This clears and rebuilds entries for the current period from Apple Health, allowing the user to correct the record if they edited sleep data after the automatic sync.

**Why this priority**: Supports data correction without reinstalling or waiting for time-based resolution.

**Independent Test**: Add a sleep session to Apple Health, open app (auto-logged), then edit the session end time to 7:15am in Apple Health, go to Settings → Sync Apple Health Metrics — confirm the entry is removed.

**Acceptance Scenarios**:

1. **Given** an Early Wakeup entry exists for the current period, **When** the user taps "Sync Apple Health Metrics" in Settings, **Then** the current period's entries are cleared and rebuilt from the latest Apple Health data
2. **Given** Apple Health permission is denied, **When** the user triggers a resync, **Then** no error is displayed and the rest of the app continues to function normally

---

### User Story 3 — Permission Handling (Priority: P3)

On first use, the app requests Apple Health sleep data permission. If the user denies permission, the Early Wakeup feature is silently disabled — no error messages appear and all other app features remain unaffected.

**Why this priority**: Graceful degradation; the app must not break if sleep permission is denied.

**Independent Test**: Clear Health permissions in iOS Settings → open app → deny sleep permission → confirm no error appears and metrics/log entry features work normally.

**Acceptance Scenarios**:

1. **Given** Health permission has not been granted, **When** the app first opens, **Then** a system permission prompt is shown requesting sleep data access
2. **Given** the user denies sleep data permission, **When** the app foregrounds, **Then** no Early Wakeup entries are created and no error is shown

---

### Edge Cases

- What if the user records two qualifying sleep sessions in one day (e.g., night shift + short nap that both meet criteria)? → Each generates a separate log entry; both count.
- What if a sleep session straddles midnight (starts 11pm, ends 6am)? → The end time determines whether it qualifies; 6am end qualifies.
- What if the user has no sleep data in Apple Health? → No entries logged; app behaves normally.
- What if a sleep session's end time is edited in Apple Health after auto-sync? → Manual resync from Settings corrects the record.
- What if the device clock is in a non-local timezone? → All time comparisons (before 7am, before 10am) use local device time.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST read sleep session data from Apple Health on every app foreground event
- **FR-002**: A qualifying sleep session MUST meet all three conditions: duration ≥ 4 hours, end time before 10:00am local time, and end time before 7:00am local time
- **FR-003**: System MUST create one log entry for each qualifying sleep session identified since the last sync checkpoint
- **FR-004**: Each log entry MUST use the Apple Health sleep session's unique identifier as the log entry ID, preventing duplicate entries on re-sync
- **FR-005**: The log entry value MUST be `1` (representing one qualifying early wakeup event)
- **FR-006**: System MUST advance the sync checkpoint to the end time of the last processed sleep session after each sync
- **FR-007**: On first sync, system MUST look back 90 days to capture historical qualifying sessions
- **FR-008**: If Apple Health sleep permission is denied, the sync function MUST exit silently — no error is shown to the user
- **FR-009**: The "Sync Apple Health Metrics" button in Settings MUST clear and rebuild Early Wakeup entries for the current period
- **FR-010**: All sleep session filtering MUST use the device's local timezone for time comparisons

### Key Entities

- **SleepSession**: A period of sleep recorded in Apple Health. Key attributes: unique ID, start time, end time, duration. Qualifying sessions meet the 4-hour minimum, end before 10am, and end before 7am.
- **EarlyWakeupEntry**: A log entry in the tracker representing one qualifying early wakeup. Value is always `1`. Keyed by the originating sleep session ID.
- **SyncCheckpoint**: The timestamp of the most recently processed sleep session end time, persisted locally. Prevents reprocessing old sessions on every foreground event.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Early Wakeup entries appear in the app within 5 seconds of the app coming to the foreground after a qualifying sleep session
- **SC-002**: Zero duplicate entries are created when the same sleep session is processed multiple times
- **SC-003**: Denying sleep permission produces zero error messages or disruptions to other app features
- **SC-004**: Manual resync from Settings completes within 10 seconds and accurately reflects the current Apple Health sleep data for the active period

## Assumptions

- Sleep permission is requested using the same Apple Health permission flow as workout data — users will see a single combined prompt
- Log entry value of `1` is appropriate for the Early Wakeup metric (it is configured as a cumulative metric tracking days per week)
- The 7:00am and 10:00am thresholds are fixed and not user-configurable in this version
- The 4-hour minimum duration is a fixed filter for distinguishing overnight sleep from naps — not user-configurable
- Sync fires on app foreground via the existing AppState listener; no new background sync infrastructure is introduced
- The metric ID `1b0558fb-9594-41db-bb2e-bb0f0621b8fc` is pre-created in the database and will not be auto-created by this feature
- "Ending sleep" means the end timestamp of a recorded sleep session in Apple Health (not the first movement or alarm)
