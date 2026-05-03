# Feature Specification: Apple Health Running Sync

**Feature Branch**: `002-apple-health-sync`
**Created**: 2026-05-03
**Status**: Draft
**Input**: User description: "Add a feature which connects to the user's apple health account and logs any running workout distances since the last sync. Each workout should be logged as a separate log entry e.g. a 5.3km run should equal one log against a cumulative metric for running distance. It should work offline by queuing the log entries until the device is back online"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sync Running Workouts on App Open (Priority: P1)

A user who regularly runs and tracks their workouts in Apple Health opens the app. The app reads all running workouts recorded since the last successful sync and creates one log entry per workout against a cumulative running distance metric. The user sees their total running distance updated without any manual input.

**Why this priority**: This is the core value of the feature — zero-effort automatic logging of workouts the user has already completed.

**Independent Test**: Can be fully tested by completing a run in Apple Health, opening the app, and verifying a new log entry appears for the correct distance against the running distance metric.

**Acceptance Scenarios**:

1. **Given** the user has completed two runs in Apple Health since the last sync (4.2 km and 8.1 km), **When** the app opens, **Then** two separate log entries are created (4.2 and 8.1) against the running distance metric, and the running distance total updates accordingly.
2. **Given** the user has no new runs since the last sync, **When** the app opens, **Then** no new log entries are created and the running distance total is unchanged.
3. **Given** the user opens the app for the first time, **When** Health permission is granted, **Then** all running workouts from a reasonable lookback window are synced as individual log entries.

---

### User Story 2 - Offline Sync Queue (Priority: P2)

A user completes a run and opens the app while they have no internet connection. The app reads the workout from Apple Health and queues the log entry. When the device comes back online, the queued entry is automatically submitted without any user action.

**Why this priority**: The feature must be resilient to connectivity gaps — runners frequently use their phones in areas with poor signal.

**Independent Test**: Can be fully tested by enabling airplane mode, opening the app after a workout, re-enabling connectivity, and verifying the entry appears in the log.

**Acceptance Scenarios**:

1. **Given** the user has no internet connection, **When** a new run is detected from Apple Health, **Then** a log entry is queued locally and the UI reflects the pending entry.
2. **Given** one or more log entries are in the offline queue, **When** the device regains connectivity, **Then** all queued entries are automatically submitted in the order they were created.
3. **Given** an entry fails to submit after connectivity is restored, **Then** it remains in the queue and is retried on the next sync attempt.

---

### User Story 3 - Health Permission Request (Priority: P3)

A user opens the app for the first time after this feature is introduced. The app requests permission to read running workout data from Apple Health. The user can grant or deny access. If denied, the rest of the app continues to function normally without the sync feature.

**Why this priority**: Permission handling is required for the feature to function but is a one-time setup step that does not affect core app value if declined.

**Independent Test**: Can be tested independently by clearing app permissions, reopening the app, and verifying the permission prompt appears and both grant and deny paths behave correctly.

**Acceptance Scenarios**:

1. **Given** the app has not previously requested Health access, **When** the user opens the app, **Then** a system permission prompt for running workout access is displayed.
2. **Given** the user denies Health access, **When** the app resumes, **Then** the Health sync feature is silently disabled and no error is shown; all other features function normally.
3. **Given** the user has previously denied Health access, **When** they navigate to app settings, **Then** they can re-enable Health access from the system settings.

---

### Edge Cases

- What happens when a workout has a distance of zero (e.g. a treadmill run with no GPS)?
- How does the system handle duplicate workouts if the same data is synced twice (e.g. after app reinstall)?
- What if no running distance metric exists in the app yet — should one be created automatically or should the user be prompted?
- What happens when Apple Health data is modified or deleted after it has already been synced?
- How are very large backlog syncs handled (e.g. user grants permission after 6 months of running)?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST request read access to running workout data from Apple Health on first use of this feature.
- **FR-002**: The system MUST read all running workouts recorded since the timestamp of the last successful sync.
- **FR-003**: The system MUST create one log entry per workout, using the workout's distance in kilometres as the value.
- **FR-004**: Log entries MUST be recorded against a cumulative running distance metric.
- **FR-005**: If no running distance metric exists, the system MUST create one automatically using sensible defaults (cumulative type, weekly timeframe).
- **FR-006**: The system MUST store the timestamp of the last successful sync so subsequent syncs only process new workouts.
- **FR-007**: If the device is offline when workouts are detected, log entries MUST be added to the existing offline queue.
- **FR-008**: Queued entries MUST be submitted automatically when the device regains connectivity, without user intervention.
- **FR-009**: The system MUST deduplicate log entries so that the same workout is never logged more than once, even if the sync runs multiple times.
- **FR-010**: If Health access is denied or unavailable, the rest of the app MUST continue to function normally with no error shown to the user.
- **FR-011**: The sync MUST run automatically each time the app is brought to the foreground.
- **FR-012**: Workout distances MUST be converted to kilometres if stored in other units by Apple Health.

### Key Entities

- **Running Workout**: A single recorded running session sourced from Apple Health. Key attributes: unique identifier, distance (km), start time, end time.
- **Sync Checkpoint**: The timestamp of the most recent successfully processed workout, persisted locally. Used to avoid re-processing old workouts.
- **Running Distance Metric**: The cumulative metric in the app against which running log entries are recorded. Created automatically if absent.
- **Log Entry**: A single recorded value against a metric. For this feature: one entry per workout, value = distance in km.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Running workouts completed in Apple Health appear as log entries in the app within 5 seconds of the app coming to the foreground.
- **SC-002**: 100% of new running workouts since the last sync are captured — no workouts are silently skipped.
- **SC-003**: No workout is logged more than once, regardless of how many times the sync runs.
- **SC-004**: Entries queued while offline are submitted within 10 seconds of the device regaining connectivity.
- **SC-005**: Denying or revoking Health permission causes zero disruption to any other app feature.

## Assumptions

- The app runs on iOS only; Apple Health is therefore always the source of truth for workout data (no Android equivalent is in scope).
- Distances are expressed in kilometres in the app; conversion from other units is handled silently.
- A lookback window of 90 days is applied on first sync to avoid overwhelming the log with years of historical data.
- Workouts with zero distance (e.g. strength training accidentally categorised as running) are silently ignored.
- The existing offline queue mechanism used for manual log entries is reused for Health-synced entries.
- The user's Apple Health account is on the same device as the app; cross-device sync is out of scope.
- Automatic sync on foreground is sufficient; a manual "sync now" button is out of scope for v1.
